import { describe, expect, it } from 'vitest'
import { projects } from '~~/data/projects'
import sizes from '~~/data/asset-sizes.generated.json'
import { CARD_CUTS, cutPath } from '~~/shared/assets/cuts'

const SIZES: Record<string, number[]> = sizes.sizes

describe('cutPath', () => {
	it('puts the width before the extension', () => {
		expect(cutPath('/projects/shots/a-hero.webp', 560)).toBe('/projects/shots/a-hero-560.webp')
		expect(cutPath('/a.b/c', 800)).toBe('/a.b/c-800')
	})
})

// `sizes:check` proves the manifest matches the files; this proves the files
// are the cuts the card's srcset says they are.
describe.each(projects.filter((p) => p.cardImage).map((p) => [p.slug, p.cardImage!]))('%s card art', (_, src) => {
	const [w, h] = SIZES[src] ?? []

	it('is in the size manifest', () => {
		expect(w && h).toBeTruthy()
	})

	it.each([...CARD_CUTS])('has a %i px cut of the same shape', (width) => {
		const cut = SIZES[cutPath(src, width)]
		expect(cut, `${cutPath(src, width)} — run npm run cuts && npm run sizes`).toBeDefined()
		expect(cut![0]).toBe(width)
		expect(Math.abs(cut![1]! / cut![0]! - h! / w!)).toBeLessThan(0.01)
	})

	it('is wider than its widest cut, or the original is not worth offering', () => {
		expect(w).toBeGreaterThan(Math.max(...CARD_CUTS))
	})
})
