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
 * `style-src 'unsafe-inline'` stays: Shiki colours every token with a `style`
 * attribute, and attributes cannot carry a nonce.
 */
export function contentSecurityPolicy(nonce?: string): string {
	const script = ["'self'", "'unsafe-inline'"]
	if (nonce) script.push(`'nonce-${nonce}'`)
	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		`script-src ${script.join(' ')}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https:",
		"font-src 'self'",
		"connect-src 'self'",
	].join('; ')
}
