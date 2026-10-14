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
  // Two seconds, not the probe's default five: a repo refresh waits on these,
  // and only a cold start does so in front of a visitor (measured: +0.1–0.4 s
  // on Skidbladnir's first render). A host that hangs costs at most this, and
  // the image renders unsized until the next refresh.
  async (src: string): Promise<ImageSize | null> => probeImageSize(src, 2000),
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
 *
 * `known` is what an earlier render measured (the snapshot's copy of the same
 * README), used for any image the probe misses this time. A miss is not rare:
 * img.shields.io took 3.0 s to answer 1 request in 9 from here on 2026-10-13,
 * past the 2 s above, and a miss is not cached — so a cold start, which is
 * every deploy, could serve splimes' README with four of its badges at 0 × 0
 * until they loaded: the badge row rebuilt itself sideways, and everything
 * below it moved 2.3 px. A live answer still wins: it is the newer one.
 */
export async function sizeReadmeImages(html: string, known: ReadonlyMap<string, ImageSize> = new Map()): Promise<string> {
  const srcs = unsizedImages(html)
  if (!srcs.length) return html
  const sizes = new Map<string, ImageSize>()
  await Promise.all(srcs.map(async (src) => {
    const measured = await cachedImageSize(src).catch(() => null)
    const size = measured ?? known.get(src)
    recordReadmeImage(measured ? 'measured' : size ? 'kept' : 'unsized')
    if (size) sizes.set(src, size)
  }))
  return sizeImages(html, sizes)
}
