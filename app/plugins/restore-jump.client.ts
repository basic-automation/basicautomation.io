/**
 * The browser's own restore is a jump, not an animation.
 *
 * The site scrolls smoothly (`scroll-behavior: smooth` in `main.css`), for a
 * reader following a link down the page, and Chromium applies that to its own
 * restore too: a reload of the home page at 1,200 px scrolled from the top to
 * 1,200 over ~550 ms, 34 scroll events. Firefox puts the reader back in one.
 * vue-router's restores were already made instant (`router.options.ts`), but
 * the browser's cannot be asked to be: so on a reload, or Back or Forward to
 * a document, the page holds `scroll-behavior: auto` until scrolling has been
 * still for a moment, then gives the stylesheet's smooth scrolling back. A
 * fresh visit is not touched; neither is a page without script, which keeps
 * the stylesheet's behaviour throughout.
 */
export default defineNuxtPlugin({
	name: 'restore-jump',
	order: -25,
	setup() {
		const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
		if (nav?.type !== 'reload' && nav?.type !== 'back_forward') return

		const root = document.documentElement
		root.style.setProperty('scroll-behavior', 'auto')

		let still: ReturnType<typeof setTimeout> | undefined
		const release = () => {
			clearTimeout(still)
			clearTimeout(limit)
			removeEventListener('scroll', onScroll)
			root.style.removeProperty('scroll-behavior')
		}
		// The restore can land in more than one step while the page is still
		// growing, so wait for quiet rather than for the first scroll event.
		const onScroll = () => {
			clearTimeout(still)
			still = setTimeout(release, 300)
		}
		addEventListener('scroll', onScroll, { passive: true })
		// A page that was at the top, or that the browser does not restore,
		// never scrolls: give the smooth scrolling back regardless.
		const limit = setTimeout(release, 3000)
	},
})
