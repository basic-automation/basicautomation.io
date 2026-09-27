/**
 * The intrinsic size of an image, read from its own bytes.
 *
 * An `<img>` with no `width`/`height` gives the browser nothing to reserve
 * space with, so the page reflows around it the moment it arrives. On this site
 * the project screenshot is the one that would hurt: it is `w-full`, and its
 * height is unknown until the file lands, so everything below it moves.
 *
 * Reading the headers directly rather than adding an image library: these are
 * three fixed formats and the parsers are a few lines each, against a
 * dependency that would be in the lockfile forever for this.
 * https://www.w3.org/TR/png-3/#11IHDR
 * https://developers.google.com/speed/webp/docs/riff_container
 */

export interface Dimensions {
	width: number
	height: number
}

/**
 * From the `viewBox`, which is what actually sets an SVG's aspect ratio, and
 * only from `width`/`height` when there is no viewBox to prefer.
 */
export function svgDimensions(svg: string): Dimensions | null {
	const box = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
	if (box) {
		const width = Number(box[1])
		const height = Number(box[2])
		if (width > 0 && height > 0) return { width, height }
	}
	const w = svg.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i)
	const h = svg.match(/\bheight\s*=\s*["']\s*([\d.]+)/i)
	if (w && h && Number(w[1]) > 0 && Number(h[1]) > 0) {
		return { width: Number(w[1]), height: Number(h[1]) }
	}
	return null
}

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]

/** PNG puts IHDR first, and IHDR opens with two big-endian 32-bit sizes. */
export function pngDimensions(bytes: Uint8Array): Dimensions | null {
	if (bytes.length < 24) return null
	if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return null
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	// 8 magic + 4 length + 4 "IHDR" = 16.
	return { width: view.getUint32(16), height: view.getUint32(20) }
}

const ascii = (bytes: Uint8Array, at: number, len: number) =>
	String.fromCharCode(...bytes.subarray(at, at + len))

/**
 * WebP is a RIFF container with three encodings that each state their size
 * differently. All three are handled because which one a file is depends on
 * whatever flags the encoder was run with, not on anything visible.
 */
export function webpDimensions(bytes: Uint8Array): Dimensions | null {
	if (bytes.length < 30) return null
	if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

	switch (ascii(bytes, 12, 4)) {
		// Lossy. The VP8 keyframe header carries 14-bit sizes at byte 26.
		case 'VP8 ':
			return {
				width: view.getUint16(26, true) & 0x3FFF,
				height: view.getUint16(28, true) & 0x3FFF,
			}
		// Lossless. 14 bits each, packed across four bytes from 21, minus one.
		case 'VP8L': {
			const bits = view.getUint32(21, true)
			return {
				width: (bits & 0x3FFF) + 1,
				height: ((bits >> 14) & 0x3FFF) + 1,
			}
		}
		// Extended (alpha, animation). Canvas size as 24-bit values, minus one.
		case 'VP8X':
			return {
				width: (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1,
				height: (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1,
			}
		default:
			return null
	}
}

/** Dispatch on the bytes, not on the file name — an extension can lie. */
export function imageDimensions(bytes: Uint8Array, text?: string): Dimensions | null {
	return pngDimensions(bytes)
		?? webpDimensions(bytes)
		?? svgDimensions(text ?? ascii(bytes, 0, Math.min(bytes.length, 4096)))
}
