/**
 * Turning GitHub's releases list into what the changelog strip prints.
 *
 * One list call serves both the strip and the "latest release" link, so the
 * history costs nothing extra against the 60-requests-an-hour rate limit. The
 * shaping is pure, which is the only reason it can be tested — see
 * `test/releases.test.ts`.
 */

import type { Release } from '~~/shared/types/project'

/** One entry as GitHub's releases list returns it. Only what is read here. */
export interface RawRelease {
	tag_name?: string
	name?: string | null
	html_url?: string
	published_at?: string | null
	created_at?: string
	draft?: boolean
	prerelease?: boolean
}

/**
 * Drafts are dropped: they are not public, and the site only shows what a
 * visitor could actually download.
 */
export function normaliseReleases(raw: RawRelease[]): Release[] {
	return raw
		.filter((r) => r && !r.draft && r.tag_name)
		.map((r) => ({
			tag: r.tag_name as string,
			// A release whose title is just its tag says nothing twice.
			title: r.name && r.name !== r.tag_name ? r.name : null,
			url: r.html_url as string,
			publishedAt: (r.published_at || r.created_at) as string,
			prerelease: !!r.prerelease,
		}))
}

/**
 * The newest full release, matching what `/releases/latest` used to return:
 * drafts and pre-releases don't count. A repo that has only tagged
 * pre-releases gets null here and relies on the strip to show its history.
 */
export function pickLatest(releases: Release[]): { tag: string, url: string, publishedAt: string } | null {
	const r = releases.find((x) => !x.prerelease)
	return r ? { tag: r.tag, url: r.url, publishedAt: r.publishedAt } : null
}
