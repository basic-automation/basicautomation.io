import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A mark is drawn, not typeset. An SVG served as an `<img>` cannot load a web
 * font, so live `<text>` is set in whatever the visitor's machine has — the
 * Skidbladnir wordmark named Roboto Slab Bold, which no one had, and from
 * 2026-09-24 to 2026-10-02 every visitor saw its lettering in their default
 * serif, light where it was drawn bold. Letters belong in the mark as paths.
 */
const ROOT = join(__dirname, '..', 'public')

function svgs(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return svgs(path)
		return entry.name.endsWith('.svg') ? [path] : []
	})
}

describe('the SVGs this site serves', () => {
	const files = svgs(ROOT)

	it('are found at all', () => {
		expect(files.length).toBeGreaterThanOrEqual(8)
	})

	it.each(files.map((f) => [relative(ROOT, f), f]))('%s draws its letters as outlines', (_, file) => {
		const svg = readFileSync(file, 'utf8')
		expect(svg).not.toMatch(/<(text|tspan|textPath)\b/)
		expect(svg).not.toMatch(/font-family|@font-face|\bfont\s*:/)
	})
})
