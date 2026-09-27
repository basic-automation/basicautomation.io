/**
 * The site's Content-Security-Policy, built in one place so the route rule in
 * `nuxt.config.ts` (every response) and the nonce plugin in
 * `server/plugins/csp-nonce.ts` (rendered pages) cannot drift apart.
 *
 * Every project page folds in that repo's README and renders its HTML as-is.
 * The repos are first-party, but their content arrives at request time and
 * changes without a deploy here — so the page is told what it may load, rather
 * than trusting each README to stay well behaved.
 *
 * `font-src 'self'` is the locked "one self-hosted typeface" rule stated where
 * a browser enforces it. `connect-src 'self'` is the same for "no third-party
 * analytics". `default-src 'self'` rather than `'none'` deliberately: a
 * directive nobody thought of falls back to same-origin instead of to a blank
 * page.
 *
 * `img-src` allows any https host because a README's badges and screenshots
 * are somebody else's URLs, and an allowlist here turns "a repo added a badge"
 * into a silently broken image on this site.
 *
 * Scripts: with a nonce, only the inline scripts Nuxt itself emitted run — the
 * colour-mode bootstrap, the runtime config, the import map — and an inline
 * `<script>` or `onerror=` that arrived inside a README does not. A browser
 * that understands nonces ignores `'unsafe-inline'` when one is present
 * (CSP Level 2 onward); it stays in the list only for one that does not, and
 * for responses rendered without a nonce, such as the error page.
 * https://www.w3.org/TR/CSP3/#allow-all-inline
 *
 * Styles split the same way, using CSP Level 3's two halves of `style-src`.
 * `style-src-attr 'unsafe-inline'`: Shiki colours every token with a `style`
 * attribute and Vue binds accents through `:style`, and an attribute cannot
 * carry a nonce — but an attribute also cannot hold a selector, so it cannot
 * be used to read the page. `style-src-elem` takes the nonce: the one `<style>`
 * Nuxt UI writes into the head is allowed, and a `<style>` block arriving in a
 * README — the element that can — is not. A browser without CSP3 reads the
 * plain `style-src`, which is what every browser read before.
 * https://www.w3.org/TR/CSP3/#directive-style-src-elem
 */
export function contentSecurityPolicy(nonce?: string): string {
	const inline = ["'self'", "'unsafe-inline'"]
	const script = nonce ? [...inline, `'nonce-${nonce}'`] : inline
	const styleSplit = nonce
		? [`style-src-elem ${[...inline, `'nonce-${nonce}'`].join(' ')}`, "style-src-attr 'unsafe-inline'"]
		: []
	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		`script-src ${script.join(' ')}`,
		"style-src 'self' 'unsafe-inline'",
		...styleSplit,
		"img-src 'self' data: https:",
		"font-src 'self'",
		"connect-src 'self'",
	].join('; ')
}

/**
 * An opening `<script>` or `<style>` tag with no nonce yet — Nuxt's scripts,
 * and the one `<style id="nuxt-ui-colors">` Nuxt UI writes into the head. The
 * lookahead keeps it to those two elements exactly (`<scripts>` or
 * `<styled-thing>` are not them), and a tag that already has a nonce is left
 * as it is.
 */
const OPEN_TAG = /<(script|style)(?![^>]*\snonce=)(?=[\s>])/g

/** Put `nonce` on every script and style tag in `html` that lacks one. */
export function stampNonce(html: string, nonce: string): string {
	return html.replace(OPEN_TAG, `<$1 nonce="${nonce}"`)
}
