/**
 * WCAG 2.1 contrast, for the palette.
 *
 * The site has exactly one background, so every colour's legibility is a single
 * number rather than a matrix — which makes it cheap enough to check on every
 * change instead of measuring by hand once and letting the answer rot in a
 * markdown table.
 *
 * The formulas are from the spec itself, not from a library: `relativeLuminance`
 * is WCAG's own definition, and the ratio is `(L1 + 0.05) / (L2 + 0.05)`.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** `#rgb` or `#rrggbb` to three 0–255 channels. */
export function parseHex(hex: string): [number, number, number] {
	const h = hex.trim().replace(/^#/, '')
	const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
	if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`)
	return [
		Number.parseInt(full.slice(0, 2), 16),
		Number.parseInt(full.slice(2, 4), 16),
		Number.parseInt(full.slice(4, 6), 16),
	]
}

/** WCAG's relative luminance: sRGB linearised, then weighted by channel. */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = parseHex(hex).map((c) => {
		const s = c / 255
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
	}) as [number, number, number]
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 1 for two identical colours, 21 for black on white. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a)
	const lb = relativeLuminance(b)
	const [hi, lo] = la > lb ? [la, lb] : [lb, la]
	return (hi + 0.05) / (lo + 0.05)
}

export type Level = 'AAA' | 'AA' | 'AA large' | 'fail'

/**
 * The strongest level a ratio clears. "Large" is 18.66px bold or 24px plain —
 * which on this site is the hero lines and the section headings, not the labels.
 */
export function wcagLevel(ratio: number): Level {
	if (ratio >= 7) return 'AAA'
	if (ratio >= 4.5) return 'AA'
	if (ratio >= 3) return 'AA large'
	return 'fail'
}
