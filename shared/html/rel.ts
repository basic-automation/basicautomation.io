/**
 * The `rel` of a link that leaves the site.
 *
 * `noreferrer` hides where a visit came from, which is right for somebody
 * else's site and wrong for the organization's own repositories: GitHub's
 * traffic page, "Referring sites", is the only place the owner can see that a
 * visit to a repo or one of its releases came from here, and it counts only a
 * visit that arrives with a referrer. The site's `Referrer-Policy`
 * (`strict-origin-when-cross-origin`, in `nuxt.config.ts`) sends the origin
 * alone — never the page, never a query string.
 *
 * Over the onion service the origin is the `.onion` address, and a visitor who
 * chose Tor did not choose to announce it, so there every link keeps
 * `noreferrer`. `noopener` stays on everything either way.
 */

const OWN_REPOS = /^https:\/\/github\.com\/basic-automation\//i

export function outboundRel(href: string, siteOrigin: string): string {
	let onion = true
	try {
		onion = new URL(siteOrigin).hostname.toLowerCase().endsWith('.onion')
	}
	catch {
		// An origin that does not parse is not one to make an exception for.
	}
	return !onion && OWN_REPOS.test(href) ? 'noopener' : 'noreferrer noopener'
}
