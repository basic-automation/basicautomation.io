/**
 * A fresh nonce on every rendered page, so `script-src` and `style-src-elem`
 * can stop trusting inline script and style blocks in general and trust only
 * the ones Nuxt wrote.
 *
 * The nonce goes on the `<script>`s in the document head and the body's tail —
 * where Nuxt puts the colour-mode bootstrap, the runtime config and the import
 * map — and deliberately NOT on anything in the rendered app body. That body is
 * where a project page's README HTML lands, fetched at request time and
 * rendered as-is, so a script tag or an inline handler that arrives in a README
 * is exactly what this is meant to stop.
 *
 * The header is replaced in `render:response` rather than set once in a route
 * rule, because a nonce is only worth anything if it changes on every response
 * and matches the one in the document it was sent with.
 */

import { randomBytes } from 'node:crypto'
import { contentSecurityPolicy, stampNonce } from '~~/shared/security/csp'

declare module 'h3' {
	interface H3EventContext {
		/** Set while rendering a page; read back when its response is sent. */
		cspNonce?: string
	}
}

function stamp(chunks: string[], nonce: string): string[] {
	return chunks.map((c) => stampNonce(c, nonce))
}

export default defineNitroPlugin((nitroApp) => {
	// Not in development. Vite serves CSS by injecting `<style>` elements from
	// JavaScript, and those carry no nonce — so a nonce'd `style-src-elem` (which
	// makes the browser ignore `'unsafe-inline'`) blocks every one of them and the
	// dev server renders unstyled. The built site has a real `<link rel=stylesheet>`
	// and one nonce'd `<style>`, so this only ever bit the one environment where
	// nobody is attacking you.
	//
	// Checked here rather than by not registering the plugin, so the code path is
	// the same shape in both and this comment is where someone looks.
	if (import.meta.dev) return

	nitroApp.hooks.hook('render:html', (html, { event }) => {
		const nonce = randomBytes(16).toString('base64')
		event.context.cspNonce = nonce
		html.head = stamp(html.head, nonce)
		html.bodyAppend = stamp(html.bodyAppend, nonce)
		// html.body is left alone on purpose — see above.
	})

	nitroApp.hooks.hook('render:response', (response, { event }) => {
		const nonce = event.context.cspNonce
		if (!nonce) return
		response.headers ??= {}
		// Whatever casing the route rule used, there must be exactly one.
		for (const key of Object.keys(response.headers)) {
			if (key.toLowerCase() === 'content-security-policy') delete response.headers[key]
		}
		setResponseHeader(event, 'content-security-policy', contentSecurityPolicy(nonce))
	})
})
