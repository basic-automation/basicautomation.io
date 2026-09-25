/**
 * The origin to use when a page has to name itself — see
 * `server/utils/siteOrigin.ts` for why this is not simply the configured domain.
 *
 * Two halves, because the trustworthy answer is different on each side. On the
 * server it is whatever the request middleware decided, which it decided by
 * comparing against the gateway's real published address. In the browser it is
 * `location`, which is the browser's own idea of where it is and so cannot be
 * spoofed by a header at all.
 *
 * Both halves have to agree or hydration will complain, and they do: the
 * middleware only names the onion origin for a request that arrived on it, which
 * is exactly when `location` says the same thing.
 */
export function useSiteOrigin(): string {
	const configured = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')

	if (import.meta.server) {
		return useRequestEvent()?.context.siteOrigin ?? configured
	}

	const { host, origin } = window.location
	return host.toLowerCase().endsWith('.onion') ? origin : configured
}
