/**
 * "3 days ago", measured against one clock both sides agree on.
 *
 * `Date.now()` is a different number on the server and in the browser, so
 * anything relative rendered from it disagrees at hydration whenever a unit
 * boundary falls between the two: the onion snapshot's "44 seconds ago" became
 * "45 seconds ago" in the browser, Vue reported a hydration mismatch, and the
 * same could happen on any "updated N minutes ago" at the turn of a minute.
 *
 * So `now` is the server's render time, carried to the client in the payload
 * by `useState`, and hydration reproduces the server's text exactly.
 * `plugins/render-now.client.ts` then moves it forward — once hydration is
 * over, and at the start of every client-side navigation — so the text is not
 * frozen at whenever the tab was first opened.
 */
export function useRenderNow() {
	return useState('render-now', () => Date.now())
}

export function useRelativeTime(): (iso: string | null | undefined) => string {
	const now = useRenderNow()
	// `now.value` is read inside the returned function, so a template or
	// computed that calls it re-renders when the plugin moves the clock.
	return (iso) => relativeTime(iso, now.value)
}
