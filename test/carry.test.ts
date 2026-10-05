import { describe, expect, it } from 'vitest'
import { carryMissing } from '~~/shared/github/carry'
import type { RepoMeta } from '~~/shared/types/project'

function repo(over: Partial<RepoMeta> = {}): RepoMeta {
	return {
		repo: 'enlil',
		fetchedAt: '2026-10-05T10:00:00.000Z',
		source: 'live',
		description: null,
		htmlUrl: 'https://github.com/basic-automation/enlil',
		homepage: null,
		language: 'Rust',
		topics: [],
		stars: 1,
		forks: 0,
		openIssues: 0,
		license: 'MIT',
		defaultBranch: 'main',
		createdAt: '2024-01-01T00:00:00Z',
		pushedAt: '2026-10-01T00:00:00Z',
		archived: false,
		readmeHtml: null,
		latestRelease: null,
		releases: [],
		download: null,
		...over,
	}
}

const release = { tag: 'v1.4.2', url: 'https://github.com/x/releases/v1.4.2', publishedAt: '2026-10-05T00:00:00Z' }

const previous = repo({
	fetchedAt: '2026-10-05T09:55:00.000Z',
	stars: 0,
	readmeHtml: '<p>old readme</p>',
	releases: [{ ...release, name: 'v1.4.2', prerelease: false }] as RepoMeta['releases'],
	latestRelease: release,
	crateVersion: '0.3.0',
	crateDownloads: 1200,
	crateUrl: 'https://crates.io/crates/enlil',
	docsUrl: 'https://docs.rs/enlil',
})

describe('carryMissing', () => {
	it('leaves a complete refresh alone', () => {
		const fresh = repo({ readmeHtml: '<p>new</p>' })
		expect(carryMissing(fresh, previous)).toBe(fresh)
	})

	it('leaves the hole when there is no previous live answer', () => {
		const fresh = repo({ incomplete: ['readme'] })
		expect(carryMissing(fresh, undefined)).toBe(fresh)
	})

	it('fills each failed piece from the previous answer, and only those', () => {
		const fresh = repo({ stars: 5, readmeHtml: '<p>new</p>', incomplete: ['releases', 'crate'] })
		const out = carryMissing(fresh, previous)
		expect(out.releases).toBe(previous.releases)
		expect(out.latestRelease).toBe(previous.latestRelease)
		expect(out.download).toBe(previous.download)
		expect(out).toMatchObject({ crateVersion: '0.3.0', crateDownloads: 1200, crateUrl: previous.crateUrl, docsUrl: previous.docsUrl })
		// This refresh's own answer is kept for everything that did not fail.
		expect(out).toMatchObject({ stars: 5, readmeHtml: '<p>new</p>', fetchedAt: fresh.fetchedAt, source: 'live' })
		expect(out.incomplete).toEqual(['releases', 'crate'])
		expect(out.carried).toEqual(['releases', 'crate'])
	})

	it('does not claim to carry a piece the previous answer lacked too', () => {
		const fresh = repo({ incomplete: ['readme', 'releases'] })
		const out = carryMissing(fresh, repo({ readmeHtml: '<p>old</p>' }))
		expect(out.readmeHtml).toBe('<p>old</p>')
		expect(out.releases).toEqual([])
		expect(out.carried).toEqual(['readme'])
		expect(out.incomplete).toEqual(['readme', 'releases'])
	})

	it('does not modify either input', () => {
		const fresh = repo({ incomplete: ['readme'] })
		const before = JSON.stringify(fresh)
		carryMissing(fresh, previous)
		expect(JSON.stringify(fresh)).toBe(before)
		expect(previous.readmeHtml).toBe('<p>old readme</p>')
	})
})
