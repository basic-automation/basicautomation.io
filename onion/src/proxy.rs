//! The reverse proxy that the onion gateway serves.
//!
//! `onyums` serves an axum `Router`; it is explicitly not a reverse proxy for
//! an existing server, and its own README points at `tor-hsrproxy` for that.
//! But what the `Router` it is handed *does* is the application's business, so
//! the way to put this site on an onion service with onyums' TLS and abuse gate
//! in front of it is to hand onyums a `Router` that forwards to the site.
//!
//! That forwarding is this module, and it is the part with something to get
//! wrong: hop-by-hop headers, streaming bodies, status and header passthrough.
//! It is deliberately separate from the onion binding so it can be tested over
//! plain TCP against the real server, with no Tor involved.

use axum::{
	body::Body, extract::{Request, State}, http::{HeaderMap, HeaderName, HeaderValue, StatusCode, Uri}, response::{IntoResponse, Response}, Router
};
use futures_util::TryStreamExt;

/// Headers that describe one hop and must not be copied to the next.
/// RFC 9110 §7.6.1, plus `host`, which belongs to the connection being made.
const HOP_BY_HOP: &[&str] = &["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "trailers", "transfer-encoding", "upgrade", "host"];

fn is_hop_by_hop(name: &HeaderName) -> bool {
	HOP_BY_HOP.iter().any(|h| name.as_str().eq_ignore_ascii_case(h))
}

/// Everything the proxy needs: where the site is, and how to talk to it.
#[derive(Clone)]
pub struct Upstream {
	/// Origin of the running site, e.g. `http://basicautomation-site:3000`.
	base: String,
	client: reqwest::Client,
}

impl Upstream {
	/// `base` is an origin — scheme and authority, no trailing slash.
	pub fn new(base: impl Into<String>) -> Result<Self, reqwest::Error> {
		let client = reqwest::Client::builder()
			// The site renders per request and talks to GitHub while it does;
			// its own upstream timeout is 8s, so leave room above that.
			.timeout(std::time::Duration::from_secs(20))
			// Redirects belong to the visitor, not to the proxy: following one
			// here would hide it and rewrite the URL they think they are on.
			.redirect(reqwest::redirect::Policy::none())
			.build()?;
		Ok(Self { base: base.into().trim_end_matches('/').to_string(), client })
	}

	fn target(&self, uri: &Uri) -> String {
		format!("{}{}", self.base, uri.path_and_query().map(|p| p.as_str()).unwrap_or("/"))
	}
}

/// A router that forwards everything to the site.
///
/// There is no route table on purpose. The site owns its own routing, including
/// which paths are 404s, and a second table here would be one more thing to
/// keep in step with it.
pub fn router(upstream: Upstream) -> Router {
	Router::new().fallback(forward).with_state(upstream)
}

async fn forward(State(upstream): State<Upstream>, req: Request) -> Response {
	let (parts, body) = req.into_parts();
	let target = upstream.target(&parts.uri);

	let mut headers = HeaderMap::new();
	for (name, value) in parts.headers.iter() {
		if !is_hop_by_hop(name) {
			headers.insert(name.clone(), value.clone());
		}
	}

	// The site is behind Caddy in its other life and reads `x-forwarded-*`.
	// `x-forwarded-for` is deliberately NOT set: a visitor over an onion
	// service has no address to forward, and inventing one would put a
	// meaningless value in the site's request log where a human reads it.
	headers.remove("x-forwarded-for");
	headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));

	let stream = body_to_stream(body);

	let upstream_res = upstream.client.request(parts.method, &target).headers(headers).body(reqwest::Body::wrap_stream(stream)).send().await;

	let res = match upstream_res {
		Ok(res) => res,
		Err(err) => {
			tracing::warn!(target = %target, error = %err, "upstream request failed");
			// 502, not 500: the failure is the site's, and saying so tells a
			// visitor the onion service itself is up.
			return (StatusCode::BAD_GATEWAY, "The site is not answering.").into_response();
		}
	};

	let status = upstream_res_status(&res);
	let mut out = Response::builder().status(status);

	if let Some(dst) = out.headers_mut() {
		for (name, value) in res.headers().iter() {
			if !is_hop_by_hop(name) {
				dst.append(name.clone(), value.clone());
			}
		}
	}

	let body = Body::from_stream(res.bytes_stream());
	out.body(body).unwrap_or_else(|err| {
		tracing::error!(error = %err, "could not build the proxied response");
		(StatusCode::BAD_GATEWAY, "The site is not answering.").into_response()
	})
}

fn upstream_res_status(res: &reqwest::Response) -> StatusCode {
	StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY)
}

/// An axum body as the byte stream reqwest wants, so a large request is
/// forwarded as it arrives rather than buffered whole.
fn body_to_stream(body: Body) -> impl futures_util::Stream<Item = Result<axum::body::Bytes, std::io::Error>> + Send + 'static {
	use http_body_util::BodyStream;

	BodyStream::new(body).try_filter_map(|frame| async move { Ok(frame.into_data().ok()) }).map_err(std::io::Error::other)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn hop_by_hop_headers_are_recognised_case_insensitively() {
		for name in ["connection", "Connection", "TRANSFER-ENCODING", "Host"] {
			let header = HeaderName::from_bytes(name.to_ascii_lowercase().as_bytes()).unwrap();
			assert!(is_hop_by_hop(&header), "{name} should be hop-by-hop");
		}
	}

	#[test]
	fn end_to_end_headers_are_kept() {
		for name in ["content-type", "cache-control", "x-content-type-options", "etag"] {
			let header = HeaderName::from_static(name);
			assert!(!is_hop_by_hop(&header), "{name} should be forwarded");
		}
	}

	#[test]
	fn the_target_url_keeps_the_path_and_the_query() {
		let up = Upstream::new("http://site:3000/").unwrap();
		assert_eq!(up.target(&"/projects/onyums".parse().unwrap()), "http://site:3000/projects/onyums");
		assert_eq!(up.target(&"/?a=1&b=2".parse().unwrap()), "http://site:3000/?a=1&b=2");
		assert_eq!(up.target(&"/".parse().unwrap()), "http://site:3000/");
	}

	#[test]
	fn a_trailing_slash_on_the_base_does_not_double_up() {
		let a = Upstream::new("http://site:3000").unwrap();
		let b = Upstream::new("http://site:3000///").unwrap();
		let uri: Uri = "/healthz".parse().unwrap();
		assert_eq!(a.target(&uri), b.target(&uri));
	}
}
