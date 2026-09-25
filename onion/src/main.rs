//! Serves basicautomation.io as a Tor onion service.
//!
//! `onyums` serves an axum `Router`, and what that `Router` does is the
//! application's business — so this hands it one whose fallback forwards every
//! request to the running site. See `docs/onion.md` for why that shape was
//! chosen over a raw TCP tunnel.
//!
//! The site and this binary run in the same container: the proxy reaches the
//! site over loopback, and the onion address is written to a file the site
//! reads so it can advertise its own onion name.
//!
//!   ONION_UPSTREAM=http://127.0.0.1:3000 cargo run

mod gate;
mod proxy;

use std::path::Path;

use onyums::OnionService;

/// Where the site is. Same container, so loopback.
const DEFAULT_UPSTREAM: &str = "http://127.0.0.1:3000";
/// Names the identity key in the keystore. Change it and the address changes.
const DEFAULT_NICKNAME: &str = "basicautomation";
/// The site reads this to advertise the address it is being served on.
const DEFAULT_ADDRESS_FILE: &str = "/run/onion/address";
/// Bootstrapping a Tor client and publishing a descriptor is minutes, not
/// seconds, on a cold cache. Past this we carry on and let `status()` speak.
const READY_TIMEOUT_SECS: u64 = 600;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
	// One JSON object per line, the same shape the site's own request log
	// uses, so both halves of the onion path read with one filter.
	tracing_subscriber::fmt()
		.json()
		.with_env_filter(
			tracing_subscriber::EnvFilter::try_from_env("ONION_LOG").unwrap_or_else(|_| "info".into()),
		)
		.init();

	let upstream_url = std::env::var("ONION_UPSTREAM").unwrap_or_else(|_| DEFAULT_UPSTREAM.to_string());
	let nickname = std::env::var("ONION_NICKNAME").unwrap_or_else(|_| DEFAULT_NICKNAME.to_string());
	let address_file =
		std::env::var("ONION_ADDRESS_FILE").unwrap_or_else(|_| DEFAULT_ADDRESS_FILE.to_string());

	let app = proxy::router(proxy::Upstream::new(&upstream_url)?);

	tracing::info!(upstream = %upstream_url, %nickname, "bootstrapping tor; this takes a while cold");

	// The identity key lives in a persistent keystore under ./tor/onyums, so
	// the address survives restarts. That directory is a volume in the image —
	// lose it and the site gets a new name.
	// `.skin(...)` rather than the default gate: see `gate.rs`. The default one
	// blocks every web browser on this site's front page.
	let handle = OnionService::builder().router(app).nickname(&nickname).skin(gate::build()?).serve().await?;

	let address = handle.onion_address().as_str().to_string();
	tracing::info!(%address, "onion service launched");

	// Written before `ready()`: the address is final the moment the service
	// launches, and the site should be able to advertise it while the
	// descriptor is still propagating.
	if let Err(error) = publish_address(&address_file, &address) {
		// Not fatal. The service is up and reachable either way; only the
		// site's own advertisement of it is lost.
		tracing::warn!(%error, file = %address_file, "could not write the address file");
	}

	if handle.ready_timeout(std::time::Duration::from_secs(READY_TIMEOUT_SECS)).await {
		tracing::info!(%address, "descriptor published; reachable over tor");
	} else {
		tracing::warn!(
			status = ?handle.status(),
			problem = ?handle.problem(),
			"not reachable yet after {READY_TIMEOUT_SECS}s; still trying"
		);
	}

	shutdown().await;
	tracing::info!("shutting down");
	handle.shutdown().await;

	Ok(())
}

/// Write the address where the site can read it, atomically.
///
/// Atomically because the site reads this file on demand: a partial write would
/// be served to a visitor as the site's onion name. Rename is the cheap way to
/// make the file appear whole or not at all.
fn publish_address(path: &str, address: &str) -> std::io::Result<()> {
	let path = Path::new(path);
	if let Some(dir) = path.parent() {
		std::fs::create_dir_all(dir)?;
	}
	let tmp = path.with_extension("tmp");
	std::fs::write(&tmp, format!("{address}\n"))?;
	std::fs::rename(&tmp, path)
}

async fn shutdown() {
	let ctrl_c = async { let _ = tokio::signal::ctrl_c().await; };
	#[cfg(unix)]
	let term = async {
		if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
			s.recv().await;
		}
	};
	#[cfg(not(unix))]
	let term = std::future::pending::<()>();

	tokio::select! {
		_ = ctrl_c => {},
		_ = term => {},
	}
}
