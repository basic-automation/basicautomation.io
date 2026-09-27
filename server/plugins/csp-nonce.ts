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
