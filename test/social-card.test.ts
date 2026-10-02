import { describe, expect, it } from 'vitest'
import { SITE_SECTION, socialCardPath } from '~~/shared/posts/section'
import manifest from '~~/public/projects/og/cards.json'
import { projects } from '~~/data/projects'

describe('socialCardPath', () => {
	it('names every project card by the fingerprint it was rendered from', () => {
		for (const p of projects) {
			const version = (manifest.cards as Record<string, string>)[p.slug]
			expect(version, `${p.slug} has no card in cards.json`).toMatch(/^[0-9a-f]{16}$/)
			expect(socialCardPath(p.slug)).toBe(`/projects/og/${p.slug}.png?v=${version}`)
		}
	})

	it('keeps the bare URL for a card the manifest does not know', () => {
		expect(socialCardPath('no-such-project')).toBe('/projects/og/no-such-project.png')
	})

	it('names the organization card, unversioned, for the site news', () => {
		expect(socialCardPath(SITE_SECTION)).toBe('/og.png')
	})
})
