import { describe, expect, it } from 'vitest'
import { screenshotPath } from '~~/shared/assets/shots'
import sources from '~~/public/projects/shots/sources.json'
import { projects } from '~~/data/projects'

describe('screenshotPath', () => {
	it('names every cut screenshot by the upstream blob it was cut from', () => {
		const cuts = sources.cuts as Record<string, { sha: string }>
		let checked = 0
		for (const p of projects) {
			if (!p.screenshot) continue
			const file = p.screenshot.slice(p.screenshot.lastIndexOf('/') + 1)
			const cut = cuts[file]
			if (!cut) continue
			expect(screenshotPath(p.screenshot)).toBe(`${p.screenshot}?v=${cut.sha.slice(0, 12)}`)
			checked++
		}
		expect(checked, 'no project screenshot is in sources.json').toBeGreaterThan(0)
	})

	it('keeps the bare URL for a screenshot not cut from upstream', () => {
		expect(screenshotPath('/projects/shots/hand-made.webp')).toBe('/projects/shots/hand-made.webp')
	})
})
