/**
 * Taking the scripts out of the Tor-fetched page before it goes in the frame
 * (`server/routes/onion-frame.get.ts`).
 *
 * Deliberately blunt. This is defence in depth behind the frame's CSP, not the
 * other way round: if a regex here misses something exotic, `script-src 'none'`
 * still stops it running. The alternative — parsing the document properly —
 * would mean a DOM implementation in the request path to delete tags a header
 * already neutralises.
 */

/**
 * A `<link>` that only exists to fetch a script ahead of time: Nuxt's
 * `modulepreload`s, and a `preload`/`prefetch` marked `as="script"`.
 *
 * Stripping `<script>` alone left nine of these in every snapshot, and the
 * frame's own `script-src 'none'` refused each one — nine CSP errors in the
 * console of every visitor to the two pages that show the frame, for fetches
 * that could never have been used. A stylesheet, a font preload or an icon is
 * not matched: the frame needs those to look like the site.
 */
const SCRIPT_LINK = /<link\b(?=[^>]*\brel\s*=\s*["']?(?:modulepreload|preload|prefetch)\b)(?=[^>]*\b(?:rel\s*=\s*["']?modulepreload|as\s*=\s*["']?script)\b)[^>]*>/gi

/** Remove every `<script>` element, and every `<link>` that preloads one. */
export function stripScripts(html: string): string {
	return html
		.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
		.replace(/<script\b[^>]*\/>/gi, '')
		.replace(SCRIPT_LINK, '')
}
