//! Serves basicautomation.io as a Tor onion service.
//!
//! # Where this is
//!
//! Slice one of the roadmap's "serve the site as a Tor onion service too, via
//! `onyums`". What is here and working is the reverse proxy — the part that
//! forwards a request to the running site and hands the answer back, tested
//! over plain TCP against the real server. What is NOT here is the onion
//! binding itself; see `docs/onion.md` for why that is a separate slice and
//! what it needs.
//!
//! Running it now binds the proxy to a local TCP port, which is how the
//! forwarding is exercised without a Tor circuit in the way. In the next slice
//! the same `Router` is handed to `OnionService::builder().router(..)` instead,
//! and that is the only line here that changes.
//!
//!   ONION_UPSTREAM=http://127.0.0.1:3000 cargo run

mod proxy;

use std::net::SocketAddr;

/// Where the site is. On the DeepStack network that is the container name.
const DEFAULT_UPSTREAM: &str = "http://basicautomation-site:3000";
/// Only used by the plain-TCP mode below, which exists to test the proxy.
const DEFAULT_BIND: &str = "127.0.0.1:3080";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
	// One JSON object per line, the same shape the site's own request log
	// uses, so both halves of the onion path read with one filter.
	tracing_subscriber::fmt().json().with_env_filter(tracing_subscriber::EnvFilter::try_from_env("ONION_LOG").unwrap_or_else(|_| "info".into())).init();

	let upstream_url = std::env::var("ONION_UPSTREAM").unwrap_or_else(|_| DEFAULT_UPSTREAM.to_string());
	let bind: SocketAddr = std::env::var("ONION_BIND").unwrap_or_else(|_| DEFAULT_BIND.to_string()).parse()?;

	let app = proxy::router(proxy::Upstream::new(&upstream_url)?);

	// ── Slice two replaces this block ───────────────────────────────────────
	// let handle = OnionService::builder().router(app).nickname("basicautomation").serve().await?;
	// println!("serving on https://{}", handle.onion_address());
	// handle.ready().await;
	let listener = tokio::net::TcpListener::bind(bind).await?;
	tracing::info!(%bind, upstream = %upstream_url, "proxy listening (plain TCP; no onion yet)");
	axum::serve(listener, app).with_graceful_shutdown(shutdown()).await?;

	Ok(())
}

async fn shutdown() {
	let _ = tokio::signal::ctrl_c().await;
	tracing::info!("shutting down");
}
