import { describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, relativeLuminance, wcagLevel } from '~~/shared/theme/contrast'

describe('parseHex', () => {
	it('reads both lengths, with or without the hash', () => {
		expect(parseHex('#ffffff')).toEqual([255, 255, 255])
		expect(parseHex('000000')).toEqual([0, 0, 0])
		expect(parseHex('#f00')).toEqual([255, 0, 0])
		expect(parseHex('  #D8D8D0  ')).toEqual([216, 216, 208])
	})

	it('refuses anything that is not one', () => {
		for (const bad of ['', '#', 'red', '#12345', 'oklch(50% 0 0)']) {
			expect(() => parseHex(bad)).toThrow()
		}
	})
})

describe('relativeLuminance', () => {
	it('is 0 for black and 1 for white, as WCAG defines it', () => {
		expect(relativeLuminance('#000000')).toBe(0)
		expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
	})

	it('weights green heaviest', () => {
		expect(relativeLuminance('#00ff00')).toBeGreaterThan(relativeLuminance('#ff0000'))
		expect(relativeLuminance('#ff0000')).toBeGreaterThan(relativeLuminance('#0000ff'))
	})
})

describe('contrastRatio', () => {
	it('is 21 for black on white and 1 for a colour on itself', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
		expect(contrastRatio('#d8d8d0', '#d8d8d0')).toBeCloseTo(1, 10)
	})

	it('does not care which way round the two colours come', () => {
		expect(contrastRatio('#5ea500', '#d8d8d0')).toBeCloseTo(contrastRatio('#d8d8d0', '#5ea500'), 12)
	})

	/**
	 * The numbers ROADMAP.md carried as a hand-measured table, before
	 * scripts/check-contrast.mjs took the measurement over. They are the
	 * check that this implementation agrees with whatever measured them.
	 */
	it('reproduces the palette measurements the roadmap recorded', () => {
		const GROUND = '#d8d8d0'
		const expected: Record<string, number> = {
			'#7c7c67': 2.97, // pn-muted
			'#5ea500': 2.14, // pn-accent
			'#fb2c36': 2.66, // pn-bright-cyan
			'#497d00': 3.47, // pn-magenta
			'#7f22fe': 4.11, // pn-bright-green
			'#5b5b4b': 4.82, // pn-dim
			'#abab9c': 1.62, // pn-rule
		}
		for (const [hex, ratio] of Object.entries(expected)) {
			expect(contrastRatio(hex, GROUND)).toBeCloseTo(ratio, 2)
		}
	})
})

describe('wcagLevel', () => {
	it('names the strongest level a ratio clears, at the boundaries', () => {
		expect(wcagLevel(21)).toBe('AAA')
		expect(wcagLevel(7)).toBe('AAA')
		expect(wcagLevel(6.99)).toBe('AA')
		expect(wcagLevel(4.5)).toBe('AA')
		expect(wcagLevel(4.49)).toBe('AA large')
		expect(wcagLevel(3)).toBe('AA large')
		expect(wcagLevel(2.99)).toBe('fail')
		expect(wcagLevel(1)).toBe('fail')
	})
})
