/**
 * Smaller cuts of a card's campaign art, for `srcset`.
 *
 * A card image is drawn at most 568 CSS px wide (half of `max-w-7xl` less the
 * grid gap) and as little as ~350 on a phone, but the art is cut once, at
 * whatever size it was made. Skidbladnir's is 1224 px and 200 KB, and on
 * /projects it is the first thing on screen, so it was the page's LCP: 2.9 s
 * on a throttled phone, where the text it replaced had been ~1.2 s.
 *
 * Each cut sits beside its original as `<name>-<width>.<ext>`, made by
 * `npm run cuts`, and is recorded in `data/asset-sizes.generated.json` like
 * every other image, so `sizes:check` fails when one is missing or stale.
 */
export const CARD_CUTS = [560, 800] as const

/** `/projects/shots/x.webp` → `/projects/shots/x-560.webp` */
export function cutPath(src: string, width: number): string {
	const dot = src.lastIndexOf('.')
	const slash = src.lastIndexOf('/')
	if (dot <= slash) return `${src}-${width}`
	return `${src.slice(0, dot)}-${width}${src.slice(dot)}`
}
