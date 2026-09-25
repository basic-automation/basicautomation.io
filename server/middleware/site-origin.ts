/**
 * Decide, once per request, which of its two names the site is answering under.
 *
 * `x-forwarded-host` is the only evidence available — the onion gateway proxies
 * over loopback, so the connection's own `Host` is `127.0.0.1:3000` — and a
 * forwarded header is, in general, whatever the client felt like sending. This
 * does not trust it as a name. It compares it against the address the gateway
 * actually published, which the site reads from disk and no visitor can
 * influence: either the request came in on our onion address or it did not, and
 * anything else falls back to the configured domain.
 *
 * Shape-checking the header instead (`looks like a v3 onion`) would be enough to
 * stop it being a redirect, but it would still let a visitor choose the address
 * this site prints as its own in `og:url` and JSON-LD. Comparing against the
 * real one costs a memoised file read and leaves nothing to choose.
 */
declare module 'h3' {
	interface H3EventContext {
		/** Set by this middleware; read through `siteOrigin(event)`. */
		siteOrigin?: string
	}
}

export default defineEventHandler(async (event) => {
	// This runs on every request, including each static asset, so the common
	// case gets out before touching anything: behind Caddy the forwarded host is
	// the clearnet domain, which cannot be the answer here.
	const forwarded = getRequestHeader(event, 'x-forwarded-host')?.trim().toLowerCase()
	if (!forwarded?.endsWith('.onion')) return

	const ours = await onionAddress()
	// onyums terminates TLS inside the circuit, so the onion origin is https.
	if (ours && forwarded === ours) event.context.siteOrigin = `https://${ours}`
})
