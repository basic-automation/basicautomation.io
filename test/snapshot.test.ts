import { describe, expect, it } from 'vitest'
import snapshot from '~~/data/projects.generated.json'
import { projects } from '~~/data/projects'

/**
 * The committed fallback has to look like the live path, or the day it takes
 * over it reshapes the pages. It went stale once already: the snapshot on main
 * was rendered before README headings were demoted, so five of its READMEs
 * still opened with an `<h1>` — and a project page served from it had two.
 * Nothing noticed until GitHub rate-limited the site and the fallback was used.
 */

const repos = (snapshot as { repos: Record<string, { readmeHtml?: string | null }> }).repos

describe('data/projects.generated.json', () => {
	it('has an entry for every project in the catalogue', () => {
		for (const p of projects) expect(repos[p.repo], p.repo).toBeTruthy()
	})

	it('renders READMEs a level down, as the live path does — the page owns the one h1', () => {
		for (const [repo, meta] of Object.entries(repos)) {
			expect(meta.readmeHtml ?? '', repo).not.toMatch(/<h1[\s>]/i)
		}
	})

	// It went stale a second way: `npm run sync` had its own `marked` set-up with
	// no highlighter, so a page served from the fallback lost every README's
	// syntax colours. It renders with the site's own renderer now.
	it('highlights README code fences, as the live path does', () => {
		for (const [repo, meta] of Object.entries(repos)) {
			expect(meta.readmeHtml ?? '', repo).not.toMatch(/<pre>/)
		}
		expect(Object.values(repos).some((m) => m.readmeHtml?.includes('class="shiki'))).toBe(true)
	})
})
