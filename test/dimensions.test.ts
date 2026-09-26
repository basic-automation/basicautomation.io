import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { imageDimensions, pngDimensions, svgDimensions, webpDimensions } from '~~/shared/assets/dimensions'

const file = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const bytes = async (path: string) => new Uint8Array(await readFile(file(path)))

describe('svgDimensions', () => {
	it('prefers the viewBox, which is what sets the aspect ratio', () => {
		expect(svgDimensions('<svg viewBox="0 0 335.79 84.12">')).toEqual({ width: 335.79, height: 84.12 })
		// A width/height in px alongside a viewBox is a drawn size, not an
		// intrinsic one — the viewBox still wins.
		expect(svgDimensions('<svg width="16" height="16" viewBox="0 0 500 600">'))
			.toEqual({ width: 500, height: 600 })
	})

	it('reads a comma-separated or negative-origin viewBox', () => {
		expect(svgDimensions('<svg viewBox="-10,-10,100,50">')).toEqual({ width: 100, height: 50 })
	})

	it('falls back to width and height when there is no viewBox', () => {
		expect(svgDimensions('<svg width="120" height="40">')).toEqual({ width: 120, height: 40 })
	})

	it('is null when it cannot tell, rather than guessing a square', () => {
		expect(svgDimensions('<svg>')).toBeNull()
		expect(svgDimensions('<svg viewBox="0 0 0 0">')).toBeNull()
		expect(svgDimensions('not an svg at all')).toBeNull()
	})
})

describe('pngDimensions', () => {
	it('reads IHDR', async () => {
		expect(pngDimensions(await bytes('public/favicon-32.png'))).toEqual({ width: 32, height: 32 })
		// The social cards are rendered at exactly Open Graph's recommendation,
		// so this doubles as a check that they still are.
		expect(pngDimensions(await bytes('public/projects/og/artiqwest.png'))).toEqual({ width: 1200, height: 630 })
	})

	it('refuses something that is not a PNG', async () => {
		expect(pngDimensions(await bytes('public/projects/shots/skidbladnir-screenshot.webp'))).toBeNull()
		expect(pngDimensions(new Uint8Array(4))).toBeNull()
	})
})

describe('webpDimensions', () => {
	it('reads a lossy VP8 frame header', async () => {
		expect(webpDimensions(await bytes('public/projects/shots/skidbladnir-screenshot.webp')))
			.toEqual({ width: 2292, height: 1088 })
		expect(webpDimensions(await bytes('public/bg/hero.webp'))).toEqual({ width: 2000, height: 1250 })
	})

	it('reads VP8L and VP8X, which encode the size differently', () => {
		// Hand-built headers: the real files are all VP8, so these two branches
		// would otherwise never run until the day someone re-encodes one.
		const riff = (fourcc: string, tail: number[]) => {
			const b = new Uint8Array(40)
			b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
			b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
			b.set([...fourcc].map((c) => c.charCodeAt(0)), 12)
			b.set(tail.slice(0, 40 - 20), 20)
			return b
		}
		// VP8L: 14 bits width then 14 bits height, each minus one, from byte 21.
		// 0 => 1x1.
		expect(webpDimensions(riff('VP8L', [0, 0, 0, 0, 0]))).toEqual({ width: 1, height: 1 })
		// VP8X: 24-bit canvas sizes minus one, at bytes 24 and 27. 799 -> 800.
		const x = riff('VP8X', [])
		x[24] = 799 & 0xFF; x[25] = (799 >> 8) & 0xFF; x[26] = 0
		x[27] = 599 & 0xFF; x[28] = (599 >> 8) & 0xFF; x[29] = 0
		expect(webpDimensions(x)).toEqual({ width: 800, height: 600 })
	})

	it('is null for a RIFF that is not a WebP, and for an unknown chunk', () => {
		const b = new Uint8Array(40)
		b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
		b.set([...'WAVE'].map((c) => c.charCodeAt(0)), 8)
		expect(webpDimensions(b)).toBeNull()
	})
})

describe('imageDimensions', () => {
	it('dispatches on the bytes for every image the pages render', async () => {
		expect(imageDimensions(await bytes('public/projects/weftdb.svg'))).toEqual({ width: 267, height: 168 })
		expect(imageDimensions(await bytes('public/projects/shots/skidbladnir-screenshot.webp')))
			.toEqual({ width: 2292, height: 1088 })
		expect(imageDimensions(await bytes('public/favicon-32.png'))).toEqual({ width: 32, height: 32 })
	})

	it('is null for something that is not an image', () => {
		expect(imageDimensions(new TextEncoder().encode('# just a readme'))).toBeNull()
	})
})
