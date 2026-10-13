import { foldWillRestore } from '~/composables/useReadmeFold'

/**
 * A page the README fold puts back is not also put back by the browser.
 *
 * Nuxt's router plugin sets `history.scrollRestoration` to `auto` for the
 * first document, so the browser restores a reload itself, and sets `manual`
 * only at the first client navigation. On an about page reloaded with its
 * README open that made two restores: the fold's own (`useReadmeFold`), once
 * it has opened the README, and then Chromium's, still pending until the open
 * fold made the page tall enough, which landed a couple of pixels past the
 * fold's. The next reload saved that position and crept on: onyums at 390 px,
 * +2 px on 14 of 42 reloads, and `check:navigation` red now and then.
 *
 * Chromium settles it in the very task that sets `auto`. `manual` set again
 * in a microtask after Nuxt's write: no drift in 26 reloads; in the next
 * task, from a plugin after the router's, or once mounted: 13 of 28, 16 of
 * 42, 17 of 42. So this runs before the router plugin (`order` -25, ahead of
 * its `pre`, -20) and holds `manual` through that write, for this document
 * only and only when the fold will restore it; every other page keeps the
 * browser's restore. Once the app has mounted the native setter is back, so
 * the `manual` Nuxt sets at the first navigation lands as before.
 *
 * The other half is in `useReadmeFold`: the entry must also leave the
 * previous document as `manual`, which the fold sets when it opens. With
 * both, 0 of 42.
 */
export default defineNuxtPlugin({
	name: 'readme-restore',
	order: -25,
	setup(nuxtApp) {
		if (!foldWillRestore()) return
		const native = Object.getOwnPropertyDescriptor(History.prototype, 'scrollRestoration')
		if (!native?.get || !native.set) return
		const { get, set } = native
		try {
			Object.defineProperty(history, 'scrollRestoration', {
				configurable: true,
				get: () => get.call(history),
				set: () => set.call(history, 'manual'),
			})
		}
		catch {
			// Someone else already owns the property: leave theirs alone.
			return
		}
		set.call(history, 'manual')
		nuxtApp.hooks.hookOnce('app:mounted', () => {
			Reflect.deleteProperty(history, 'scrollRestoration')
		})
	},
})
