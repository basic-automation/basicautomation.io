import generated from '~~/data/asset-sizes.generated.json'

// The JSON is typed by its literal contents, so the arrays come back as
// `number[]` rather than a pair. Read defensively instead of asserting a shape
// onto a generated file.
const SIZES: Record<string, number[]> = generated.sizes
const VERSIONS: Record<string, string> = generated.versions

/**
 * The intrinsic `width` and `height` for one of this repo's own images, to
 * `v-bind` onto the `<img>`.
 *
 * Without them the browser has nothing to reserve space with and the page
 * reflows around the image the moment it arrives. With them it knows the aspect
 * ratio, so a CSS width alone is enough to hold the right amount of room —
 * which is why the attributes do not fight the `h-24 w-auto` and `w-full`
 * classes on these images. The CSS still decides the drawn size.
 *
 * Returns nothing for an image that is not in the manifest, so a README's
 * remote image or a logo added without running `npm run sizes` renders exactly
 * as it did before rather than with a wrong shape.
 */
export function assetSize(src?: string): { width: number, height: number } | Record<string, never> {
	const d = src ? SIZES[src] : undefined
	const [width, height] = d ?? []
	return width && height ? { width, height } : {}
}

/**
 * The URL to request one of this repo's own images by: its path with a hash of
 * its bytes as `?v=`.
 *
 * These files are named rather than hashed, and served with a day's
 * `Cache-Control` (`nuxt.config.ts`), so a logo replaced under the same name
 * stayed on screen, old, for anyone whose browser had it. The hash makes the new
 * file a new URL. The server ignores the query and serves the file at the path.
 *
 * An image not in the manifest comes back as it went in, like `assetSize`.
 */
export function assetUrl(src: string): string {
	const v = VERSIONS[src]
	return v ? `${src}?v=${v}` : src
}
