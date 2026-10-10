/**
 * Intrinsic sizes for a README's images, so the page reserves their space.
 *
 * A README's `<img>`s arrive with no `width` or `height` — markdown has no way
 * to say them — so each one is a zero-height box until its file lands, and
 * everything below it moves when it does. The site's own images have carried
 * their sizes since `npm run sizes`; these are somebody else's URLs, so their
 * sizes are read from the first bytes of the file itself, once, at render time
 * (`server/utils/readmeImages.ts`), and written into the markup. With both
 * attributes and `.readme img { height: auto }`, the browser reserves the
 * right shape before the file arrives and still scales it to the column.
 *
 * Everything here is pure: the bytes come from the caller.
 */

export interface ImageSize { width: number, height: number }

/** How much of a file is read to find its size. Every format here says it early. */
export const PROBE_BYTES = 64 * 1024

/**
 * The size an image's own header declares: PNG, GIF, JPEG, WebP, or an SVG's
 * root `width`/`height` (or its `viewBox`). `null` for anything else, or a
 * header cut short.
 */
export function measureImage(bytes: Uint8Array): ImageSize | null {
  const b = bytes
  const u16be = (i: number) => (b[i]! << 8) | b[i + 1]!
  const u16le = (i: number) => b[i]! | (b[i + 1]! << 8)
  const u24le = (i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16)
  const u32be = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))
  const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null)

  // PNG: the signature, then IHDR — always the first chunk.
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    return ok(u32be(16), u32be(20))
  }
  // GIF: the logical screen size, little-endian, straight after the version.
  if (b.length >= 10 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) {
    return ok(u16le(6), u16le(8))
  }
  // JPEG: walk the segments to the first start-of-frame.
  if (b.length >= 4 && b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) return null
      const marker = b[i + 1]!
      if (marker === 0xFF) { // fill byte
        i++
        continue
      }
      // SOF0–SOF15, less DHT (C4), JPG (C8) and DAC (CC), which share the range.
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return ok(u16be(i + 7), u16be(i + 5))
      }
      i += 2 + u16be(i + 2)
    }
    return null
  }
  // WebP: lossy (VP8), lossless (VP8L) or extended (VP8X).
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') return ok(u16le(26) & 0x3FFF, u16le(28) & 0x3FFF)
    if (chunk === 'VP8L') {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)
      return ok((bits & 0x3FFF) + 1, ((bits >>> 14) & 0x3FFF) + 1)
    }
    if (chunk === 'VP8X') return ok(u24le(24) + 1, u24le(27) + 1)
    return null
  }
  return measureSvg(new TextDecoder().decode(b))
}

/** An SVG's root element: its `width` and `height` in px, else its `viewBox`. */
function measureSvg(text: string): ImageSize | null {
  const root = /<svg\b([^<>]*)>/i.exec(text.slice(0, PROBE_BYTES))?.[1]
  if (!root) return null
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1]
  // Unitless or px only: `100%` or `2em` says nothing about pixels.
  const px = (v: string | undefined) => (v && /^\s*[\d.]+\s*(px)?\s*$/i.test(v) ? Number.parseFloat(v) : Number.NaN)
  const width = px(attr('width'))
  const height = px(attr('height'))
  if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) }
  const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (box?.length === 4 && box[2]! > 0 && box[3]! > 0) {
    // One dimension given: keep it and take the shape from the viewBox.
    if (width > 0) return { width: Math.round(width), height: Math.round(width * box[3]! / box[2]!) }
    if (height > 0) return { width: Math.round(height * box[2]! / box[3]!), height: Math.round(height) }
    return { width: Math.round(box[2]!), height: Math.round(box[3]!) }
  }
  return null
}

// `[^<>]`, not `[^>]`: a README of unclosed `<img` would otherwise be re-scanned
// to its end from every one of them (see test/markdown-backtracking.test.ts).
const IMG = /<img\b([^<>]*)>/gi

/** The `src` of every `<img>` that does not already state both dimensions. */
export function unsizedImages(html: string): string[] {
  const out = new Set<string>()
  for (const [, attrs] of html.matchAll(IMG)) {
    const a = attrs!
    if (/\swidth=/i.test(a) && /\sheight=/i.test(a)) continue
    const src = /\ssrc="([^"]+)"/i.exec(a)?.[1]
    if (src) out.add(decodeEntities(src))
  }
  return [...out]
}

/**
 * Write the sizes in. An image with neither dimension gets both; one with only
 * a `width` (a README's `<img width="420">`) gets the `height` that keeps its
 * shape, and the other way round. Images with no known size are left as they
 * were.
 */
export function sizeImages(html: string, sizes: ReadonlyMap<string, ImageSize>): string {
  return html.replace(IMG, (tag, attrs: string) => {
    const src = /\ssrc="([^"]+)"/i.exec(attrs)?.[1]
    const size = src ? sizes.get(decodeEntities(src)) : undefined
    if (!size) return tag
    const w = /\swidth="(\d+)"/i.exec(attrs)?.[1]
    const h = /\sheight="(\d+)"/i.exec(attrs)?.[1]
    if (w && h) return tag
    // A unit or a percentage on either one is the author's layout, not a size.
    if (/\s(width|height)="(?!\d+")/i.test(attrs)) return tag
    const width = w ? Number(w) : h ? Math.round(Number(h) * size.width / size.height) : size.width
    const height = h ? Number(h) : w ? Math.round(Number(w) * size.height / size.width) : size.height
    const add = `${w ? '' : ` width="${width}"`}${h ? '' : ` height="${height}"`}`
    return tag.replace(/^<img\b/i, `<img${add}`)
  })
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
