//! Fetch the site over Tor, from here, and record what came back.
//!
//! The onyums page claims this site is served as an onion service. This checks
//! the claim rather than repeating it: a real rendezvous circuit out to the
//! address we published, TLS inside it, an HTTP request, and the bytes that come
//! back get shown on the page in a browser frame.
//!
//! # Why this is not `artiqwest`
//!
//! It should be. `artiqwest` is this organisation's own "HTTP over Tor" crate and
//! this is exactly its job. It cannot be used here yet: artiqwest 0.4.1 pins
//! `arti-client 0.43` and `tokio-native-tls`, while onyums 0.5 is on
//! `arti-client 0.46` and went deliberately C-free with rustls. Depending on both
//! would put two complete, semver-incompatible copies of arti in one binary — two
//! bootstraps, two consensus downloads, two sets of circuits — and drag OpenSSL
//! back into a static musl build that does not currently need it.
//! `artiqwest::get` also takes an `Arc<TorClient<PreferredRuntime>>` built from
//! its own arti, so the client we already have could not be handed to it anyway.
//!
//! So this does what artiqwest does, over the same arti onyums already depends
//! on. The Tor-specific part is confined to `fetch_once` so that when artiqwest
//! is bumped onto a shared arti, swapping it in is one function.
//!
//! # Why there are two Tor clients
//!
//! The obvious implementation reuses `OnionServiceHandle::tor_client()` — the
//! client that is already bootstrapped and already hosting the service. It does
//! not work: a client cannot reliably rendezvous with a service it is itself
//! hosting. Measured, on the deployed container — the service answered an
//! external probe with 200 in 4.8s while the same container's own attempts
//! failed with `Failed to obtain hidden service circuit`, twice, ten minutes
//! apart. onyums' own live test bootstraps a second client for exactly this
//! reason.
//!
//! So this builds one: its own state directory, and `allow_onion_addrs(true)`,
//! which arti's address filter does not grant by default. That is a second
//! bootstrap, which is a real cost — but it is a second *instance* of the arti
//! already linked in, not a second copy of arti, which is what taking artiqwest
//! would have meant.
//!
//! # Why it lets itself in
//!
//! The service sits behind its own Skin gate, so fetching it returns the
//! proof-of-work challenge rather than the site. This mints itself a clearance
//! with the gate's own store instead of solving the puzzle. Solving it would be
//! theatre — the gate is not what this demonstrates, the circuit is — and a
//! process shipping a solver for its own front door is a strange thing to own.

use std::{
	sync::Arc,
	time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use onyums::{
	OnionAddress,
	arti_client::{TorClient, config::TorClientConfigBuilder},
	onyums_skin::{ClearanceLevel, ClearanceStore, HmacClearanceStore},
	tor_rtcompat::tokio::TokioRustlsRuntime,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_rustls::{TlsConnector, rustls};

/// How often to refresh. The page shows when this last succeeded, so it is also
/// the resolution of that claim: current enough to mean something, rare enough
/// that the service is not mostly serving itself.
const INTERVAL: Duration = Duration::from_secs(600);

/// A whole rendezvous, handshake and render.
///
/// Sixty seconds because that is what onyums' own live test allows per attempt,
/// and it is the only policy anyone has actually proven against the real
/// network. Forty-five was not enough: the first attempt from a freshly
/// bootstrapped client has no circuits to reuse and has to fetch the descriptor
/// from an HsDir before it can even start, and it timed out there.
const TIMEOUT: Duration = Duration::from_secs(60);

/// Refuse anything absurd rather than hold a page of it in memory.
const MAX_BYTES: usize = 4 * 1024 * 1024;

/// How long the self-minted clearance lasts. Only one request uses it.
const CLEARANCE_TTL: Duration = Duration::from_secs(300);

/// How long to wait after a failure, before the first success.
///
/// `descriptor published` means our descriptor reached the directory hashring;
/// it does not mean a client — including this one — can fetch it back yet, and a
/// client that has just bootstrapped has no circuits to reuse. Early attempts
/// therefore fail, and on the plain interval one miss would leave the page with
/// no frame for ten minutes. Fifteen seconds is onyums' own live-test spacing.
const RETRY_WARMUP: Duration = Duration::from_secs(15);

/// How long to wait after a failure once it has worked at least once.
///
/// By then the page has a snapshot to keep showing, so a failure is not urgent —
/// but it should not wait the full interval either.
const RETRY: Duration = Duration::from_secs(60);

/// Give the descriptor a moment to become fetchable before the first attempt,
/// so the common case is a success rather than a warning and a retry.
const SETTLE: Duration = Duration::from_secs(20);

/// The fetch client's own directories, beside the service's inside the keystore
/// volume. Separate from the service's state on purpose — see the module docs —
/// and persistent so a restart does not re-download a consensus.
const FETCH_STATE: &str = "./tor/fetch/state";
const FETCH_CACHE: &str = "./tor/fetch/cache";

/// The client that does the dialling. `create_bootstrapped` hands back an `Arc`,
/// and `connect` reaches through it, so there is nothing to unwrap.
type FetchClient = Arc<TorClient<TokioRustlsRuntime>>;

/// What came back, and what it cost.
pub struct Snapshot {
	address: String,
	status: u16,
	bytes: usize,
	elapsed_ms: u128,
	fetched_at: u64,
	html: String,
}

/// Fetch on a loop, forever. Spawned by `main`; never returns.
pub async fn run(address: OnionAddress, store: Arc<HmacClearanceStore>, cookie_name: &'static str, path: String) {
	tokio::time::sleep(SETTLE).await;

	let client = loop {
		match build_client().await {
			Ok(client) => break client,
			Err(error) => {
				tracing::warn!(%error, retry_s = RETRY.as_secs(), "could not bootstrap the fetch client");
				tokio::time::sleep(RETRY).await;
			}
		}
	};
	tracing::info!("fetch client bootstrapped");

	// Until the first success there is nothing on the page, so keep trying at the
	// warm-up spacing; afterwards a failure is survivable and can back off.
	let mut succeeded_once = false;

	loop {
		// Neither failure below is fatal, and neither replaces the last good
		// snapshot: the page keeps showing the previous one with its own
		// timestamp, which is honest — better than an empty frame or an error
		// page. They differ only in how soon to try again.
		let wait = match tokio::time::timeout(TIMEOUT, fetch_once(&client, &address, &store, cookie_name)).await {
			Ok(Ok(snap)) => {
				tracing::info!(status = snap.status, bytes = snap.bytes, elapsed_ms = snap.elapsed_ms, "fetched the site over tor");
				if let Err(error) = publish(&path, &snap) {
					tracing::warn!(%error, "could not write the snapshot");
				}
				succeeded_once = true;
				INTERVAL
			}
			Ok(Err(error)) => {
				let retry = if succeeded_once { RETRY } else { RETRY_WARMUP };
				tracing::warn!(%error, retry_s = retry.as_secs(), "tor self-fetch failed");
				retry
			}
			Err(_) => {
				let retry = if succeeded_once { RETRY } else { RETRY_WARMUP };
				tracing::warn!(timeout_s = TIMEOUT.as_secs(), retry_s = retry.as_secs(), "tor self-fetch timed out");
				retry
			}
		};
		tokio::time::sleep(wait).await;
	}
}

/// A Tor client that is allowed to dial onion addresses.
///
/// `allow_onion_addrs` is the non-obvious part: arti's address filter refuses
/// `.onion` by default, so a client built without it fails on the connect with
/// an error that does not mention the filter.
async fn build_client() -> Result<FetchClient, Box<dyn std::error::Error + Send + Sync>> {
	let mut cfg = TorClientConfigBuilder::from_directories(FETCH_STATE, FETCH_CACHE);
	cfg.address_filter().allow_onion_addrs(true);
	let cfg = cfg.build()?;

	// The service launch has already installed rustls' provider for arti by the
	// time this runs; this is built directly rather than through onyums, so do
	// not depend on that having happened.
	let _ = rustls_graviola::default_provider().install_default();

	let runtime = TokioRustlsRuntime::current()?;
	Ok(TorClient::with_runtime(runtime).config(cfg).create_bootstrapped().await?)
}

/// One HTTPS `GET /` against our own onion address, over Tor.
///
/// Rendezvous circuit, then TLS — the service's certificate is self-signed for
/// its own address, which is the norm for an onion service and is why the
/// verifier below accepts it — then HTTP/1.1.
async fn fetch_once(client: &FetchClient, address: &OnionAddress, store: &HmacClearanceStore, cookie_name: &str) -> Result<Snapshot, Box<dyn std::error::Error + Send + Sync>> {
	let started = Instant::now();

	let stream = client.connect((address.host(), 443)).await?;

	let tls_config = rustls::ClientConfig::builder().dangerous().with_custom_certificate_verifier(Arc::new(tls::AcceptOwnService)).with_no_client_auth();
	let connector = TlsConnector::from(Arc::new(tls_config));
	let server_name = rustls::pki_types::ServerName::try_from(address.host().to_string())?;
	let mut tls = connector.connect(server_name, stream).await?;

	// `Pow` rather than a lower tier so the gate does not treat this fetch
	// differently from a visitor who solved the challenge for real.
	let token = store.mint(ClearanceLevel::Pow, CLEARANCE_TTL);

	let request = format!("GET / HTTP/1.1\r\nHost: {host}\r\nUser-Agent: basicautomation.io self-check (onyums)\r\nAccept: text/html\r\nCookie: {cookie_name}={token}\r\nConnection: close\r\n\r\n", host = address.host());
	tls.write_all(request.as_bytes()).await?;
	// Arti transmits a partially-filled Tor cell only on flush, and this request
	// is smaller than one cell — without this it never leaves the client.
	tls.flush().await?;

	let mut raw = Vec::new();
	let mut buf = [0u8; 16 * 1024];
	loop {
		let n = tls.read(&mut buf).await?;
		if n == 0 {
			break;
		}
		raw.extend_from_slice(&buf[..n]);
		if raw.len() > MAX_BYTES {
			return Err(format!("response exceeded {MAX_BYTES} bytes").into());
		}
	}

	let elapsed_ms = started.elapsed().as_millis();
	let text = String::from_utf8_lossy(&raw).into_owned();
	let (head, body) = text.split_once("\r\n\r\n").ok_or("no header/body separator in the response")?;
	let status = head.split_whitespace().nth(1).and_then(|s| s.parse::<u16>().ok()).ok_or("no status code in the response")?;

	if status != 200 {
		return Err(format!("the service answered {status}").into());
	}

	Ok(Snapshot { address: address.as_str().to_string(), status, bytes: body.len(), elapsed_ms, fetched_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(), html: body.to_string() })
}

/// Write it where the site can read it, atomically — the site reads on demand,
/// and a partial write would be served to a visitor as the page.
fn publish(path: &str, snap: &Snapshot) -> std::io::Result<()> {
	let json = format!(
		r#"{{"address":{},"status":{},"bytes":{},"elapsedMs":{},"fetchedAt":{},"html":{}}}"#,
		json_string(&snap.address),
		snap.status,
		snap.bytes,
		snap.elapsed_ms,
		snap.fetched_at,
		json_string(&snap.html),
	);

	let p = std::path::Path::new(path);
	if let Some(dir) = p.parent() {
		std::fs::create_dir_all(dir)?;
	}
	let tmp = p.with_extension("tmp");
	std::fs::write(&tmp, json)?;
	std::fs::rename(&tmp, p)
}

/// Minimal JSON string escaping.
///
/// The payload is a whole HTML document full of quotes, backslashes and
/// newlines, so this has to be right: everything RFC 8259 requires and nothing
/// clever. A serde dependency for one struct of four scalars and a string is not
/// worth it in a binary this size.
fn json_string(s: &str) -> String {
	let mut out = String::with_capacity(s.len() + 2);
	out.push('"');
	for c in s.chars() {
		match c {
			'"' => out.push_str("\\\""),
			'\\' => out.push_str("\\\\"),
			'\n' => out.push_str("\\n"),
			'\r' => out.push_str("\\r"),
			'\t' => out.push_str("\\t"),
			c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
			c => out.push(c),
		}
	}
	out.push('"');
	out
}

mod tls {
	//! Accept the service's own self-signed certificate.
	//!
	//! An onion address *is* a public key: the rendezvous circuit proves we are
	//! talking to the holder of that key before any TLS happens, so the certificate
	//! authenticates nothing extra here — and no CA issues for `.onion` anyway.
	//! This verifier is only ever pointed at our own address, from inside our own
	//! process, which is the whole reason it is acceptable.
	use tokio_rustls::rustls;

	#[derive(Debug)]
	pub struct AcceptOwnService;

	impl rustls::client::danger::ServerCertVerifier for AcceptOwnService {
		fn verify_server_cert(&self, _end_entity: &rustls::pki_types::CertificateDer<'_>, _intermediates: &[rustls::pki_types::CertificateDer<'_>], _server_name: &rustls::pki_types::ServerName<'_>, _ocsp: &[u8], _now: rustls::pki_types::UnixTime) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
			Ok(rustls::client::danger::ServerCertVerified::assertion())
		}

		fn verify_tls12_signature(&self, _message: &[u8], _cert: &rustls::pki_types::CertificateDer<'_>, _dss: &rustls::DigitallySignedStruct) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
			Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
		}

		fn verify_tls13_signature(&self, _message: &[u8], _cert: &rustls::pki_types::CertificateDer<'_>, _dss: &rustls::DigitallySignedStruct) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
			Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
		}

		fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
			rustls_graviola::default_provider().signature_verification_algorithms.supported_schemes()
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn json_strings_escape_what_html_contains() {
		assert_eq!(json_string("<a href=\"x\">"), "\"<a href=\\\"x\\\">\"");
		assert_eq!(json_string("a\\b"), "\"a\\\\b\"");
		assert_eq!(json_string("line\nbreak"), "\"line\\nbreak\"");
		assert_eq!(json_string("tab\there"), "\"tab\\there\"");
	}

	#[test]
	fn control_characters_never_survive_raw() {
		assert_eq!(json_string("\u{1}"), "\"\\u0001\"");
		for raw in ["a\rb", "a\nb", "a\tb", "a\u{7}b"] {
			let escaped = json_string(raw);
			assert!(!escaped.chars().any(|c| (c as u32) < 0x20), "{raw:?} left a control character in {escaped:?}");
		}
	}
}
