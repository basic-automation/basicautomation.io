import { describe, expect, it } from 'vitest'
import { PROBE_BYTES, measureImage, sizeImages, unsizedImages } from '~~/shared/markdown/image-size'
import { probeImageSize, probeable } from '~~/shared/markdown/image-probe'

const bytes = (...parts: (number[] | string)[]) =>
	new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const le16 = (n: number) => [n & 255, (n >>> 8) & 255]
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255]
const zeros = (n: number) => Array.from({ length: n }, () => 0)

describe('measureImage', () => {
	it('reads a PNG header', () => {
		expect(measureImage(bytes([0x89], 'PNG\r\n\x1A\n', be32(13), 'IHDR', be32(1224), be32(765), zeros(5)))).toEqual({ width: 1224, height: 765 })
	})

	it('reads a GIF header', () => {
		expect(measureImage(bytes('GIF89a', le16(320), le16(200), zeros(4)))).toEqual({ width: 320, height: 200 })
	})

	it('walks a JPEG to its start-of-frame, past an APP0 segment', () => {
		const app0 = [0xFF, 0xE0, 0, 16, ...zeros(14)]
		const sof0 = [0xFF, 0xC0, 0, 17, 8, 0x02, 0x58, 0x03, 0x20, 3, ...zeros(9)] // height 600, width 800
		expect(measureImage(bytes([0xFF, 0xD8], app0, sof0))).toEqual({ width: 800, height: 600 })
	})

	it('does not take a DHT segment for a frame', () => {
		const dht = [0xFF, 0xC4, 0, 4, 0, 0]
		const sof2 = [0xFF, 0xC2, 0, 17, 8, 0, 10, 0, 20, 3, ...zeros(9)]
		expect(measureImage(bytes([0xFF, 0xD8], dht, sof2))).toEqual({ width: 20, height: 10 })
	})

	it('reads all three kinds of WebP', () => {
		const riff = (chunk: string, body: number[]) => bytes('RIFF', zeros(4), 'WEBP', chunk, zeros(4), body)
		// VP8: frame tag (3), start code (3), then 14-bit width and height.
		expect(measureImage(riff('VP8 ', [...zeros(3), 0x9D, 0x01, 0x2A, ...le16(1224), ...le16(765), ...zeros(4)]))).toEqual({ width: 1224, height: 765 })
		// VP8L: signature byte, then width-1 and height-1 in 14 bits each.
		const bits = (1224 - 1) | ((765 - 1) << 14)
		expect(measureImage(riff('VP8L', [0x2F, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255, ...zeros(8)]))).toEqual({ width: 1224, height: 765 })
		// VP8X: flags (4), then width-1 and height-1 in 24 bits each.
		expect(measureImage(riff('VP8X', [...zeros(4), ...le24(2447), ...le24(1529), ...zeros(4)]))).toEqual({ width: 2448, height: 1530 })
	})

	it('reads an SVG root, as shields.io writes its badges', () => {
		expect(measureImage(bytes('<svg xmlns="http://www.w3.org/2000/svg" width="78" height="20" role="img">'))).toEqual({ width: 78, height: 20 })
	})

	it('falls back to an SVG viewBox, and keeps a lone dimension', () => {
		expect(measureImage(bytes('<?xml version="1.0"?>\n<svg viewBox="0 0 840 240">'))).toEqual({ width: 840, height: 240 })
		expect(measureImage(bytes('<svg width="420" viewBox="0 0 840 240">'))).toEqual({ width: 420, height: 120 })
		expect(measureImage(bytes('<svg width="100%" height="100%" viewBox="0 0 10 5">'))).toEqual({ width: 10, height: 5 })
	})

	it('is null for what it cannot read', () => {
		expect(measureImage(bytes('<html><body>not an image</body></html>'))).toBeNull()
		expect(measureImage(bytes([0x89], 'PNG'))).toBeNull()
		expect(measureImage(bytes('<svg width="2em" height="1em">'))).toBeNull()
		expect(measureImage(new Uint8Array())).toBeNull()
	})
})

describe('sizeImages', () => {
	const sizes = new Map([
		['https://x/a.png', { width: 1200, height: 600 }],
		['https://x/b.svg?a=1&b=2', { width: 78, height: 20 }],
	])

	it('writes both dimensions into an image that has neither', () => {
		expect(sizeImages('<img loading="lazy" src="https://x/a.png" alt="">', sizes))
			.toBe('<img width="1200" height="600" loading="lazy" src="https://x/a.png" alt="">')
	})

	it('matches a src written with entities', () => {
		expect(sizeImages('<img src="https://x/b.svg?a=1&amp;b=2">', sizes))
			.toBe('<img width="78" height="20" src="https://x/b.svg?a=1&amp;b=2">')
	})

	it('keeps the author\'s width and adds the height that keeps the shape', () => {
		expect(sizeImages('<img src="https://x/a.png" width="420">', sizes))
			.toBe('<img height="210" src="https://x/a.png" width="420">')
		expect(sizeImages('<img src="https://x/a.png" height="100">', sizes))
			.toBe('<img width="200" src="https://x/a.png" height="100">')
	})

	it('leaves alone an image with both, a percentage, or no known size', () => {
		for (const tag of [
			'<img src="https://x/a.png" width="10" height="10">',
			'<img src="https://x/a.png" width="50%">',
			'<img src="https://x/a.png" width="420" height="auto">',
			'<img src="https://x/unknown.png">',
		]) expect(sizeImages(tag, sizes)).toBe(tag)
	})

	it('lists only the images still missing a dimension, decoded, once each', () => {
		expect(unsizedImages('<img src="https://x/a.png"><img src="https://x/a.png" width="5"><img src="https://x/c" width="1" height="1"><img src="https://x/b.svg?a=1&amp;b=2">'))
			.toEqual(['https://x/a.png', 'https://x/b.svg?a=1&b=2'])
	})

	it('runs in linear time over a README of unclosed tags', () => {
		const junk = '<img '.repeat(20_000)
		const started = performance.now()
		unsizedImages(junk)
		sizeImages(junk, sizes)
		measureImage(new TextEncoder().encode('<svg '.repeat(13_000)))
		expect(performance.now() - started).toBeLessThan(100)
	})
})

describe('probeImageSize', () => {
	it('asks only the hosts a GitHub README\'s images come from, over https', () => {
		expect(probeable('https://img.shields.io/crates/v/onyums')).toBe(true)
		expect(probeable('https://raw.githubusercontent.com/o/r/main/a.png')).toBe(true)
		expect(probeable('https://github.com/o/r/actions/workflows/ci.yml/badge.svg')).toBe(true)
		expect(probeable('https://private-user-images.githubusercontent.com/1/a.png')).toBe(true)
		expect(probeable('http://raw.githubusercontent.com/o/r/main/a.png')).toBe(false)
		expect(probeable('https://example.com/a.png')).toBe(false)
		expect(probeable('https://githubusercontent.com.evil.test/a.png')).toBe(false)
		expect(probeable('https://127.0.0.1/a.png')).toBe(false)
		expect(probeable('/relative.png')).toBe(false)
	})

	it('reads at most PROBE_BYTES, even from a server that ignores Range', async () => {
		let pulled = 0
		let range: string | null = null
		const png = bytes([0x89], 'PNG\r\n\x1A\n', be32(13), 'IHDR', be32(64), be32(32), zeros(5))
		const fake = (async (_url: string, init?: RequestInit) => {
			range = new Headers(init?.headers).get('range')
			const body = new ReadableStream<Uint8Array>({
				pull(c) {
					pulled++
					c.enqueue(pulled === 1 ? png : new Uint8Array(16 * 1024))
					if (pulled > 1000) c.close()
				},
			})
			return new Response(body, { status: 200 })
		}) as typeof fetch
		expect(await probeImageSize('https://raw.githubusercontent.com/o/r/main/a.png', 1000, fake)).toEqual({ width: 64, height: 32 })
		expect(range).toBe(`bytes=0-${PROBE_BYTES - 1}`)
		expect(pulled).toBeLessThan(10)
	})

	it('is null, never a throw, for a failure, a refusal or a host off the list', async () => {
		const fails = (async () => { throw new Error('offline') }) as typeof fetch
		const refuses = (async () => new Response('no', { status: 404 })) as typeof fetch
		const never = (async () => { throw new Error('must not be called') }) as typeof fetch
		expect(await probeImageSize('https://img.shields.io/x', 1000, fails)).toBeNull()
		expect(await probeImageSize('https://img.shields.io/x', 1000, refuses)).toBeNull()
		expect(await probeImageSize('https://example.com/x.png', 1000, never)).toBeNull()
	})
})
