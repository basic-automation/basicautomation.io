/**
 * Turning GitHub's releases list into what the changelog strip prints, and
 * into the files a download link points at.
 *
 * One list call serves the strip, the "latest release" link and the download
 * links — each release in it already carries its assets — so none of them
 * costs anything extra against the 60-requests-an-hour rate limit. The shaping
 * is pure, which is the only reason it can be tested — see
 * `test/releases.test.ts`.
 */

import type { DownloadRelease, Release, ReleaseAsset } from '~~/shared/types/project'

/** One file on a release, as GitHub's releases list returns it. */
export interface RawAsset {
	name?: string
	browser_download_url?: string
	size?: number
	/** `uploaded` once the file is complete; `open` while an upload is still running. */
	state?: string
}

/** One entry as GitHub's releases list returns it. Only what is read here. */
export interface RawRelease {
	tag_name?: string
	name?: string | null
	html_url?: string
	published_at?: string | null
	created_at?: string
	draft?: boolean
	prerelease?: boolean
	assets?: RawAsset[] | null
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

/**
 * Files a release carries that nobody installs by hand. A Tauri app's release
 * is mostly these: a signature beside every installer and the macOS updater
 * archives (both read by the app's own updater), the updater's manifests, and
 * a source archive for people who build from source. Left in, they bury the
 * five files a person actually wants among twenty-odd that look just as
 * plausible.
 */
const NOT_FOR_DOWNLOAD: RegExp[] = [
	/\.(sig|minisig|asc)$/i,
	/\.app\.tar\.gz$/i,
	/^latest[^/]*\.json$/i,
	/[-_]source\.(tar\.(gz|xz|bz2|zst)|tgz|zip)$/i,
]

/**
 * The files on a release a person would download, in GitHub's order. A file
 * still uploading is left out: its URL does not answer yet.
 */
export function downloadableAssets(raw: RawAsset[] | null | undefined): ReleaseAsset[] {
	if (!Array.isArray(raw)) return []
	return raw
		.filter((a) => a && a.name && a.browser_download_url && (a.state === undefined || a.state === 'uploaded'))
		.filter((a) => !NOT_FOR_DOWNLOAD.some((re) => re.test(a.name as string)))
		.map((a) => ({
			name: a.name as string,
			url: a.browser_download_url as string,
			size: Number.isFinite(a.size) ? Number(a.size) : 0,
		}))
}

/**
 * The release download links should point at: the newest full release with a
 * file to download, as `/releases/latest` would pick it. A repo that has only
 * tagged pre-releases gets the newest of those instead, marked as one, rather
 * than nothing — a page that has a download section but no release behind it
 * is the one outcome that helps nobody. Null when no release has any file.
 *
 * Only the releases in the list are considered, which is the newest few: a
 * full release older than all of them is not found, and the newest
 * pre-release stands in.
 */
export function pickDownload(raw: RawRelease[] | null | undefined): DownloadRelease | null {
	if (!Array.isArray(raw)) return null
	const candidates = raw
		.filter((r) => r && !r.draft && r.tag_name && r.html_url)
		.map((r) => ({ r, assets: downloadableAssets(r.assets) }))
		.filter((c) => c.assets.length > 0)
	const chosen = candidates.find((c) => !c.r.prerelease) ?? candidates[0]
	if (!chosen) return null
	return {
		tag: chosen.r.tag_name as string,
		url: chosen.r.html_url as string,
		publishedAt: (chosen.r.published_at || chosen.r.created_at || '') as string,
		prerelease: !!chosen.r.prerelease,
		assets: chosen.assets,
	}
}
