/**
 * Answer HEAD wherever GET is answered.
 *
 * Nitro routes by filename suffix, so `healthz.get.ts` binds GET and nothing
 * else — and a HEAD request for it fell through to the catch-all and came back
 * 404. Every non-page route on this site was in that state: `/healthz`,
 * `/sitemap.xml`, `/robots.txt`, `/releases.xml` and both `/api` routes. The
 * pages were fine only because the Vue renderer does not look at the method.
 *
 * That is not a nicety. `/healthz` is what says whether this site is up, and an
 * uptime monitor configured for HEAD — a normal thing to configure, because it
 * is the method that exists for exactly this — was being told the endpoint does
 * not exist. A feed reader polling `/releases.xml` with HEAD was being told the
 * feed was gone. HTTP has required general-purpose servers to support both
 * methods since forever, and this one did not.
 * https://www.rfc-editor.org/rfc/rfc9110#section-9.1
 *
 * So a HEAD is routed as the GET it is the head of. Node's own `ServerResponse`
 * drops the body for a HEAD request without being asked — it remembers the
 * method of the request it was created for — so the handler can write its
 * response normally and the client receives the headers alone, which is the
 * whole contract. Only the method h3 ROUTES on is changed; the original is kept
 * in the context so the request log still records what was actually asked.
 */
declare module 'h3' {
	interface H3EventContext {
		/** Set here when a HEAD was routed as a GET. Read by the request log. */
		originalMethod?: string
	}
}

export default defineEventHandler((event) => {
	// Read through the node request, NOT `event.method`. h3's getter memoises
	// into a private `_method` on first read, so asking it here would freeze the
	// answer at HEAD and the rewrite below would change nothing — which is
	// exactly what the first version of this did.
	const req = event.node?.req
	if (req?.method !== 'HEAD') return

	event.context.originalMethod = 'HEAD'
	req.method = 'GET'
	// And clear the memo in case something upstream has already read it. Reaching
	// for a private field is not nice; being wrong about whether anything read it
	// first is worse, and this is cheap and self-correcting if h3 renames it.
	delete (event as unknown as { _method?: string })._method
})
