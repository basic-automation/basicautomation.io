import { probeImageSize } from '~~/shared/markdown/image-probe'
import { sizeImages, unsizedImages, type ImageSize } from '~~/shared/markdown/image-size'

/**
 * One image's size, cached by URL for a day. The repo refresh that renders a
 * README runs every few minutes; the images it names almost never change shape,
 * and this keeps the refresh from re-reading every badge and screenshot each
 * time. A failure is not stored (`validate`), so the next refresh tries again
 * rather than rendering that image unsized for a day.
 *
 * Not GitHub's API: raw.githubusercontent.com, github.com's badge and
 * attachment URLs and img.shields.io, none of which draw on the REST quota.
 */
const cachedImageSize = defineCachedFunction(
  async (src: string): Promise<ImageSize | null> => probeImageSize(src),
  {
    name: 'readme-image-size',
    maxAge: 24 * 60 * 60,
    getKey: (src: string) => src,
    validate: (entry) => entry.value != null,
  },
)

/**
 * A rendered README with its images' sizes written in, so the page reserves
 * their space; see `shared/markdown/image-size.ts`. Never fails — an image it
 * cannot measure keeps the markup it had.
 */
export async function sizeReadmeImages(html: string): Promise<string> {
  const srcs = unsizedImages(html)
  if (!srcs.length) return html
  const sizes = new Map<string, ImageSize>()
  await Promise.all(srcs.map(async (src) => {
    const size = await cachedImageSize(src).catch(() => null)
    if (size) sizes.set(src, size)
  }))
  return sizeImages(html, sizes)
}
