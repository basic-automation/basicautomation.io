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
mod snapshot;

use std::path::Path;

use onyums::OnionService;

/// Where the site is. Same container, so loopback.
const DEFAULT_UPSTREAM: &str = "http://127.0.0.1:3000";
/// Names the identity key in the keystore. Change it and the address changes.
const DEFAULT_NICKNAME: &str = "basicautomation";
/// The site reads this to advertise the address it is being served on.
const DEFAULT_ADDRESS_FILE: &str = "/run/onion/address";
/// And this, to show the site as it comes back over Tor. See `snapshot.rs`.
const DEFAULT_SNAPSHOT_FILE: &str = "/run/onion/snapshot.json";
/// Bootstrapping a Tor client and publishing a descriptor is minutes, not
/// seconds, on a cold cache. Past this we carry on and let `status()` speak.
const READY_TIMEOUT_SECS: u64 = 600;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
	// One JSON object per line, the same shape the site's own request log
	// uses, so both halves of the onion path read with one filter.
	tracing_subscriber::fmt().json().with_env_filter(tracing_subscriber::EnvFilter::try_from_env("ONION_LOG").unwrap_or_else(|_| "info".into())).init();

	let upstream_url = std::env::var("ONION_UPSTREAM").unwrap_or_else(|_| DEFAULT_UPSTREAM.to_string());
	let nickname = std::env::var("ONION_NICKNAME").unwrap_or_else(|_| DEFAULT_NICKNAME.to_string());
	let address_file = std::env::var("ONION_ADDRESS_FILE").unwrap_or_else(|_| DEFAULT_ADDRESS_FILE.to_string());
	let snapshot_file = std::env::var("ONION_SNAPSHOT_FILE").unwrap_or_else(|_| DEFAULT_SNAPSHOT_FILE.to_string());

	let app = proxy::router(proxy::Upstream::new(&upstream_url)?);

	// Registered first, before anything slow. The handlers used to be installed
	// only once `ready_timeout` returned — up to ten minutes after start — and a
	// SIGTERM before then met the default action and killed this process
	// outright, never reaching `handle.shutdown()`.
	let mut stop = Stop::new()?;

	tracing::info!(upstream = %upstream_url, %nickname, "bootstrapping tor; this takes a while cold");

	// The identity key lives in a persistent keystore under ./tor/onyums, so
	// the address survives restarts. That directory is a volume in the image —
	// lose it and the site gets a new name.
	// `.skin(...)` rather than the default gate: see `gate.rs`. The default one
	// blocks every web browser on this site's front page.
	let gate = gate::build()?;
	let store = gate.store.clone();
	let cookie_name = gate.cookie_name;

	// A stop during bootstrap has nothing to withdraw yet: there is no service
	// until `serve()` returns, so it is enough to go.
	let handle = tokio::select! {
		handle = OnionService::builder().router(app).nickname(&nickname).skin(gate.skin).serve() => handle?,
		signal = stop.recv() => {
			tracing::info!(signal, "stopped while bootstrapping");
			return Ok(());
		}
	};

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

	let ready = tokio::select! {
		ready = handle.ready_timeout(std::time::Duration::from_secs(READY_TIMEOUT_SECS)) => Some(ready),
		signal = stop.recv() => {
			tracing::info!(signal, "stopped before the descriptor was published");
			None
		}
	};

	match ready {
		Some(true) => {
			tracing::info!(%address, "descriptor published; reachable over tor");

			// Only once the descriptor is up: before that a self-fetch cannot succeed
			// and would only log a failure the operator would have to explain away.
			// Shares the client onyums has already bootstrapped rather than building a
			// second one — see `snapshot.rs`.
			tokio::spawn(snapshot::run(handle.onion_address().clone(), store, cookie_name, snapshot_file));
		}
		Some(false) => {
			tracing::warn!(
				status = ?handle.status(),
				problem = ?handle.problem(),
				"not reachable yet after {READY_TIMEOUT_SECS}s; still trying"
			);
		}
		None => {}
	}

	if ready.is_some() {
		let signal = stop.recv().await;
		tracing::info!(signal, "stop requested");
	}
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

/// SIGTERM or SIGINT, whichever comes first — the container runtime sends the
/// one, a terminal the other. Built by `new()` so the handlers exist from the
/// moment it is called, not from the first time something awaits it.
struct Stop {
	term: tokio::signal::unix::Signal,
	int: tokio::signal::unix::Signal,
}

impl Stop {
	fn new() -> std::io::Result<Self> {
		use tokio::signal::unix::{signal, SignalKind};
		Ok(Self { term: signal(SignalKind::terminate())?, int: signal(SignalKind::interrupt())? })
	}

	/// Which one arrived, for the log.
	async fn recv(&mut self) -> &'static str {
		tokio::select! {
			_ = self.term.recv() => "SIGTERM",
			_ = self.int.recv() => "SIGINT",
		}
	}
}
