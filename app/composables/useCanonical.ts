/**
 * Name the page's one address: `<link rel="canonical">` and `og:url`, from the
 * same value so they cannot disagree.
 *
 * The router matches paths case-insensitively and ignores a trailing slash and
 * any query string, so `/PROJECTS`, `/news/` and `/projects?utm_source=x` all
 * render a page that is also at `/projects` — duplicates a search engine would
 * otherwise have to guess between. Pages say which one is theirs by passing
 * the path they would link to themselves, never `route.path`, which is
 * whatever spelling the visitor typed.
 *
 * The path is written the way the sitemap writes it (`/` for the home page),
 * so the sitemap, the canonical link and `og:url` are one string each.
 */
export function useCanonical(path: MaybeRefOrGetter<string>): void {
	const siteUrl = useSiteOrigin()
	const href = computed(() => `${siteUrl}${toValue(path)}`)

	useHead({ link: [{ rel: 'canonical', href }] })
	useSeoMeta({ ogUrl: href })
}
