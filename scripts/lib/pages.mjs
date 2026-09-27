/**
 * Which pages the accessibility checks visit: every page the running site's
 * own sitemap says exists, plus the error page.
 *
 * This used to be a typed list in `check-a11y.mjs`, and a typed list is right
 * only until somebody adds a project — Nanna was added and never audited. The
 * sitemap is generated from the same catalogue the pages are, so a new project
 * is covered the moment it is published, and `npm run check` already verifies
 * the sitemap itself.
 */

/** A path no route will ever match, so the error page gets audited too. */
export const NOT_FOUND_PATH = '/no-such-page-at-all'

export async function sitePages(base) {
	const res = await fetch(`${base}/sitemap.xml`)
	if (!res.ok) throw new Error(`${base}/sitemap.xml answered ${res.status}`)
	const xml = await res.text()

	// Paths, not the absolute `<loc>`s: the sitemap names the public origin, and
	// the pages are to be fetched from whichever build is under test.
	const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((m) => new URL(m[1].trim()).pathname)

	if (!paths.length) throw new Error(`${base}/sitemap.xml lists no pages`)
	return [...new Set(paths), NOT_FOUND_PATH]
}
