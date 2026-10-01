/**
 * Sorting a release's files into "which one is for my machine".
 *
 * A desktop app built with Tauri names every bundle
 * `<productName>_<version>_<arch><suffix>` — `Skidbladnir_1.0.0_x64-setup.exe`,
 * `Skidbladnir-GPL_1.0.0_aarch64.dmg` — so the platform is the end of the name
 * and the edition is the start of it. Reading both off the name means the
 * download links follow whatever the release actually carries: a platform with
 * no file is simply not listed, and nothing here has to know a version number.
 *
 * Pure, and tested in `test/releases.test.ts`.
 */

import type { ReleaseAsset } from '~~/shared/types/project'

export type OsFamily = 'windows' | 'macos' | 'linux'

export interface Platform {
	id: string
	os: OsFamily
	/** The link's text where it stands alone, one per line */
	label: string
	/** The link's text in a run of several on one line */
	short: string
	/** Matched against the end of the file name */
	suffix: RegExp
}

/** In the order someone scans for their own machine: the common case first. */
export const PLATFORMS: readonly Platform[] = [
	{ id: 'windows-x64', os: 'windows', label: 'windows · 64-bit installer', short: 'windows', suffix: /_x64-setup\.exe$/i },
	{ id: 'macos-arm64', os: 'macos', label: 'macos · apple silicon', short: 'macos apple silicon', suffix: /_aarch64\.dmg$/i },
	{ id: 'macos-x64', os: 'macos', label: 'macos · intel', short: 'macos intel', suffix: /_x64\.dmg$/i },
	{ id: 'linux-deb', os: 'linux', label: 'linux · .deb (debian, ubuntu)', short: '.deb', suffix: /_amd64\.deb$/i },
	{ id: 'linux-appimage', os: 'linux', label: 'linux · appimage', short: 'appimage', suffix: /_amd64\.AppImage$/i },
]

export interface Installer {
	platform: Platform
	asset: ReleaseAsset
}

export interface EditionInstallers {
	/** The product name the edition's files start with */
	name: string
	/** One per platform that has a file, in `PLATFORMS` order */
	installers: Installer[]
}

/**
 * The product name a bundle was built as: everything before the first
 * underscore. `Skidbladnir_…` and `Skidbladnir-GPL_…` are two editions, and
 * neither is a prefix match for the other.
 */
export function editionOf(fileName: string): string {
	const i = fileName.indexOf('_')
	return i > 0 ? fileName.slice(0, i) : ''
}

/**
 * The installers for each named edition, in the order the editions are given.
 * An edition with no file for any known platform is left out, and so is any
 * file that is not one of the known installers — those stay one click away on
 * the release page, which a page linking here always also links.
 */
export function groupInstallers(assets: readonly ReleaseAsset[], editions: readonly string[]): EditionInstallers[] {
	const out: EditionInstallers[] = []
	for (const name of editions) {
		const installers: Installer[] = []
		for (const platform of PLATFORMS) {
			const asset = assets.find((a) => editionOf(a.name) === name && platform.suffix.test(a.name))
			if (asset) installers.push({ platform, asset })
		}
		if (installers.length) out.push({ name, installers })
	}
	return out
}

/**
 * A file size the way GitHub's own release page prints it — binary megabytes,
 * labelled MB — so the two agree for someone comparing them. Empty for a size
 * GitHub did not report, rather than "0 KB".
 */
export function formatSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return ''
	const mb = bytes / (1024 * 1024)
	if (mb >= 100) return `${Math.round(mb)} MB`
	if (mb >= 1) return `${mb.toFixed(1)} MB`
	return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
