import { describe, expect, it } from 'vitest'
import { hasAnchor } from '~~/shared/markdown/anchor'
import { renderMarkdown } from '~~/shared/markdown/render'

describe('hasAnchor', () => {
	const html = '<h3 id="install">Install</h3><p id="a&amp;b">x</p><h3 id="⚡-quick-start-5-minutes">⚡ Quick start</h3>'

	it('finds an id, with or without the #', () => {
		expect(hasAnchor(html, '#install')).toBe(true)
		expect(hasAnchor(html, 'install')).toBe(true)
	})

	it('decodes a percent-encoded fragment, as a URL carries an emoji slug', () => {
		expect(hasAnchor(html, `#${encodeURIComponent('⚡-quick-start-5-minutes')}`)).toBe(true)
		expect(hasAnchor(html, '#⚡-quick-start-5-minutes')).toBe(true)
	})

	it('matches an id the serializer escaped', () => {
		expect(hasAnchor(html, '#a&b')).toBe(true)
	})

	it('is false for an id that is not there, a prefix of one, or nothing at all', () => {
		expect(hasAnchor(html, '#usage')).toBe(false)
		expect(hasAnchor(html, '#inst')).toBe(false)
		expect(hasAnchor(html, '#')).toBe(false)
		expect(hasAnchor(html, '')).toBe(false)
		expect(hasAnchor(null, '#install')).toBe(false)
	})

	it('survives a fragment that is not valid percent-encoding', () => {
		expect(hasAnchor('<h3 id="50%">x</h3>', '#50%')).toBe(true)
	})

	it('finds the ids the README renderer actually mints', async () => {
		const rendered = await renderMarkdown('# Nanna\n\n## First launch & troubleshooting\n\n## ⚡ Quick start\n')
		expect(hasAnchor(rendered, '#first-launch--troubleshooting')).toBe(true)
		expect(hasAnchor(rendered, `#${encodeURIComponent('⚡-quick-start')}`)).toBe(true)
	})
})
