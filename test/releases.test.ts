import { describe, expect, it } from 'vitest'
import { normaliseReleases, pickLatest, type RawRelease } from '~~/shared/github/releases'

const release = (over: Partial<RawRelease> = {}): RawRelease => ({
	tag_name: 'v1.0.0',
	name: 'v1.0.0',
	html_url: 'https://github.com/basic-automation/onyums/releases/tag/v1.0.0',
	published_at: '2026-01-01T00:00:00Z',
	created_at: '2025-12-31T00:00:00Z',
	draft: false,
	prerelease: false,
	...over,
})

describe('normaliseReleases', () => {
	it('drops drafts — a visitor cannot download one', () => {
		const out = normaliseReleases([release({ tag_name: 'v2', draft: true }), release()])
		expect(out.map((r) => r.tag)).toEqual(['v1.0.0'])
	})

	it('drops an entry with no tag, which is all the strip has to link to', () => {
		expect(normaliseReleases([release({ tag_name: undefined }), release()])).toHaveLength(1)
	})

	it('survives a null or undefined entry rather than throwing mid-render', () => {
		const raw = [null, undefined, release()] as unknown as RawRelease[]
		expect(normaliseReleases(raw).map((r) => r.tag)).toEqual(['v1.0.0'])
	})

	it('nulls a title that only repeats the tag', () => {
		expect(normaliseReleases([release({ name: 'v1.0.0' })])[0]!.title).toBeNull()
		expect(normaliseReleases([release({ name: '' })])[0]!.title).toBeNull()
		expect(normaliseReleases([release({ name: null })])[0]!.title).toBeNull()
		expect(normaliseReleases([release({ name: 'The onion release' })])[0]!.title).toBe('The onion release')
	})

	it('falls back to created_at for a release that was never published', () => {
		expect(normaliseReleases([release({ published_at: null })])[0]!.publishedAt).toBe('2025-12-31T00:00:00Z')
		expect(normaliseReleases([release()])[0]!.publishedAt).toBe('2026-01-01T00:00:00Z')
	})

	it('keeps pre-releases, and marks them', () => {
		const out = normaliseReleases([release({ tag_name: 'v2.0.0-rc1', prerelease: true })])
		expect(out).toHaveLength(1)
		expect(out[0]!.prerelease).toBe(true)
	})

	it('keeps GitHub order, which is newest first', () => {
		const out = normaliseReleases([release({ tag_name: 'v3' }), release({ tag_name: 'v2' }), release({ tag_name: 'v1' })])
		expect(out.map((r) => r.tag)).toEqual(['v3', 'v2', 'v1'])
	})
})

describe('pickLatest', () => {
	it('is the newest release that is not a pre-release', () => {
		const out = normaliseReleases([
			release({ tag_name: 'v2.0.0-rc1', prerelease: true }),
			release({ tag_name: 'v1.9.0' }),
			release({ tag_name: 'v1.8.0' }),
		])
		expect(pickLatest(out)?.tag).toBe('v1.9.0')
	})

	it('is null when a repo has only ever tagged pre-releases', () => {
		expect(pickLatest(normaliseReleases([release({ tag_name: 'v0.1.0-alpha', prerelease: true })]))).toBeNull()
	})

	it('is null for a repo with no releases at all', () => {
		expect(pickLatest([])).toBeNull()
	})

	it('carries only what the link needs', () => {
		expect(pickLatest(normaliseReleases([release()]))).toEqual({
			tag: 'v1.0.0',
			url: 'https://github.com/basic-automation/onyums/releases/tag/v1.0.0',
			publishedAt: '2026-01-01T00:00:00Z',
		})
	})
})
