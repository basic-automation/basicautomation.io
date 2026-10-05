/**
 * The address a project screenshot is served at, fingerprinted by what it was
 * cut from.
 *
 * Screenshots are cut from upstream by `npm run shot` and served with
 * `max-age=86400`, like the social cards. At a fixed URL a re-cut reaches a
 * repeat visitor up to a day late, and a crawler that indexed the JSON-LD
 * `screenshot` keeps the old file for as long as it likes. The cards solved
 * this with `?v=<fingerprint>` (`socialCardPath`); a screenshot already has a
 * fingerprint, the upstream git blob `public/projects/shots/sources.json`
 * records for it, so a re-cut is a new URL and nothing else needs touching.
 *
 * A screenshot that is not cut from upstream keeps its bare URL.
 */
import sources from '~~/public/projects/shots/sources.json'

export function screenshotPath(src: string): string {
	const file = src.slice(src.lastIndexOf('/') + 1)
	const cut = (sources.cuts as Record<string, { sha?: string }>)[file]
	return cut?.sha ? `${src}?v=${cut.sha.slice(0, 12)}` : src
}
