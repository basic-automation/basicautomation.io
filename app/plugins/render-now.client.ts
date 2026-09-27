/**
 * Moves `useRenderNow()` forward in the browser, without ever doing so while
 * hydrating — see `composables/useRelativeTime.ts` for why it is held still
 * until then.
 */
export default defineNuxtPlugin((nuxtApp) => {
	const now = useRenderNow()
	const tick = () => {
		now.value = Date.now()
	}

	// After hydration: a page served from a cache, or read a while after it
	// loaded, corrects itself.
	onNuxtReady(tick)

	// Before each client-side navigation renders, so a page reached by clicking
	// is measured from the click, not from the first load. `page:start` also
	// fires during the initial hydration, which is exactly when it must not move.
	nuxtApp.hook('page:start', () => {
		if (!nuxtApp.isHydrating) tick()
	})
})
