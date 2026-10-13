import type { RouterConfig } from 'nuxt/schema'
import { START_LOCATION } from 'vue-router'
// Nuxt's own router options, which this file would otherwise replace. Not an
// export of the package, so it is reached by path: if Nuxt moves it, the
// build fails here rather than the site quietly losing Nuxt's scrolling.
import nuxt from '../node_modules/nuxt/dist/pages/runtime/router.options.js'

/**
 * A restored scroll position is jumped to, not animated to.
 *
 * The site scrolls smoothly (`scroll-behavior: smooth` in `main.css`), which
 * is meant for a reader following a link down the page. vue-router restores
 * a saved position with a bare `scrollTo`, so the CSS turned every Back,
 * Forward and reload into an animation from wherever the page started —
 * traced on a reload of Skidbladnir's about page as `scrollTo({ left: 0, top:
 * 6537 })`. On an about page that animation races the README fold's own
 * restore (`useReadmeFold`), and on a slow machine it ends off the reader's
 * place: main's CI landed 7 and 21 px past it on a reload, and with the CPU
 * slowed 6× here, every one of 16 reloads landed 7–34 px past.
 *
 * Browsers put a reader back where they were in one jump, so this does too.
 * Nuxt's `scrollBehavior` — which waits for the page to finish loading and
 * handles hashes — is kept and only told to jump. It hands a saved position
 * back as the very object it was given, so that is what is matched. (A
 * plugin can't do this: Nuxt's router plugin sets `router.options.scrollBehavior`
 * back to these options once the first navigation is done.)
 */
export default <RouterConfig>{
	async scrollBehavior(to, from, saved) {
		// The page's own load. Nuxt runs one navigation through here as the app
		// starts, from `START_LOCATION`, and with no saved position its answer
		// is the top of the page. A fresh visit is already there; a reload, or
		// Back to the page from another site, is not — the browser is
		// restoring the reader's place (Nuxt leaves `scrollRestoration` at
		// `auto` for this document), and the jump to the top cancelled it. So
		// a reload of `/projects` at 1,200 px landed at 0. Only `/` was spared,
		// by Nuxt's same-path rule, because `START_LOCATION`'s path is `/`.
		// vue-router's own saved position never helps here: it is written on
		// `beforeunload`, and Chromium drops that write (`history.state.scroll`
		// is `false` on every reload). A hash is still Nuxt's to scroll to.
		if (from === START_LOCATION && !saved && !to.hash) return false
		const position = await nuxt.scrollBehavior?.(to, from, saved)
		return position && saved && position === saved ? { ...saved, behavior: 'instant' } : position
	},
}
