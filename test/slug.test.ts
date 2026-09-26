import { describe, expect, it } from 'vitest'
import { createSlugger, slugify } from '~~/shared/markdown/slug'

/**
 * These are not invented cases. A README's own table of contents links to
 * anchors GitHub minted, so the only correct answer is whatever
 * github-slugger produces — including the parts that look like bugs.
 */
describe('slugify', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('Getting Started')).toBe('getting-started')
	})

	it('keeps - and _ but drops the rest of the punctuation', () => {
		expect(slugify('read_me.now')).toBe('read_menow')
		expect(slugify('well-known paths')).toBe('well-known-paths')
		expect(slugify('What? Why! (really)')).toBe('what-why-really')
	})

	it('does NOT collapse runs of whitespace — GitHub does not either', () => {
		// The ampersand is dropped and both spaces around it become hyphens, so
		// this is two hyphens, not one. Collapsing them breaks every contents
		// list that links to a heading with an `&` in it.
		expect(slugify('First launch & troubleshooting')).toBe('first-launch--troubleshooting')
		expect(slugify('Identity & address helpers')).toBe('identity--address-helpers')
	})

	it('strips HTML before slugging', () => {
		expect(slugify('A <code>fn</code> name')).toBe('a-fn-name')
	})

	it('slugs the raw text, not the rendered entity', () => {
		// `&` renders as `&amp;`; slugging that gives `-amp-` and points at
		// nothing. This is the case the renderer comment in server/utils/github.ts
		// calls out.
		expect(slugify('Identity &amp; address helpers')).not.toBe(slugify('Identity & address helpers'))
	})

	it('trims the ends rather than minting leading hyphens', () => {
		expect(slugify('  Spaced out  ')).toBe('spaced-out')
	})

	it('keeps non-ASCII letters, which are not punctuation', () => {
		expect(slugify('Über alles')).toBe('über-alles')
	})

	it('turns a tab or a newline into a hyphen like any other whitespace', () => {
		expect(slugify('a\tb')).toBe('a-b')
	})
})

describe('createSlugger', () => {
	it('numbers duplicate headings from 1, as GitHub does', () => {
		const slug = createSlugger()
		expect(slug('Usage')).toBe('usage')
		expect(slug('Usage')).toBe('usage-1')
		expect(slug('Usage')).toBe('usage-2')
	})

	it('counts by slug, not by the text that produced it', () => {
		const slug = createSlugger()
		expect(slug('Usage')).toBe('usage')
		expect(slug('usage!')).toBe('usage-1')
	})

	it('has memory per document, so one README cannot renumber the next', () => {
		const a = createSlugger()
		const b = createSlugger()
		expect(a('Usage')).toBe('usage')
		expect(b('Usage')).toBe('usage')
	})
})
