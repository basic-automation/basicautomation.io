import { describe, expect, it } from 'vitest'
import { createSlugger, slugify } from '~~/shared/markdown/slug'
import { MAX_HEADING, demote, postHeading, readmeHeading, underTitle } from '~~/shared/markdown/heading'

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

describe('demote', () => {
	it('moves a README one level down so it nests under the page h1', () => {
		expect(demote(1)).toBe(2)
		expect(demote(2)).toBe(3)
		expect(demote(5)).toBe(6)
	})

	it('flattens at h6 rather than emitting an h7 that does not exist', () => {
		expect(demote(6)).toBe(MAX_HEADING)
		expect(demote(6)).toBe(6)
	})
})

describe('readmeHeading', () => {
	// Marked calls the renderer with itself as `this`; this is the part of it
	// the renderer touches.
	const ctx = { parser: { parseInline: (tokens: unknown[]) => (tokens as { raw: string }[])[0]!.raw } }
	const render = (depth: number, text: string) =>
		readmeHeading(createSlugger()).call(ctx as never, { depth, text, tokens: [{ raw: text }] })

	it('demotes the level and keeps the id GitHub minted', () => {
		expect(render(1, 'Skidbladnir')).toBe('<h2 id="skidbladnir">Skidbladnir</h2>\n')
		expect(render(3, 'Build from source')).toBe('<h4 id="build-from-source">Build from source</h4>\n')
	})

	it('numbers duplicates within the one document, as GitHub does', () => {
		const heading = readmeHeading(createSlugger())
		expect(heading.call(ctx as never, { depth: 2, text: 'Usage', tokens: [{ raw: 'Usage' }] }))
			.toContain('id="usage"')
		expect(heading.call(ctx as never, { depth: 2, text: 'Usage', tokens: [{ raw: 'Usage' }] }))
			.toContain('id="usage-1"')
	})
})

describe('underTitle', () => {
	it('keeps a post section at its own level, directly under the page h1', () => {
		expect(underTitle(2)).toBe(2)
		expect(underTitle(3)).toBe(3)
	})

	it('lifts a stray # to h2, so a post never has a second h1', () => {
		expect(underTitle(1)).toBe(2)
	})

	it('stops at h6', () => {
		expect(underTitle(6)).toBe(MAX_HEADING)
	})
})

describe('postHeading', () => {
	const ctx = { parser: { parseInline: (tokens: unknown[]) => (tokens as { raw: string }[])[0]!.raw } }

	it('renders ## as an h2 with the same anchor a README heading would get', () => {
		expect(postHeading(createSlugger()).call(ctx as never, { depth: 2, text: 'Where to find them', tokens: [{ raw: 'Where to find them' }] }))
			.toBe('<h2 id="where-to-find-them">Where to find them</h2>\n')
	})
})
