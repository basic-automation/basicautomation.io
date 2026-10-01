import { describe, expect, it } from 'vitest'
import {
	downloadableAssets,
	normaliseReleases,
	pickDownload,
	pickLatest,
	type RawAsset,
	type RawRelease,
} from '~~/shared/github/releases'
import { editionOf, formatSize, groupInstallers } from '~~/shared/github/installers'

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

/**
 * The file names a Skidbladnir release really carries — v0.14.0's, as GitHub
 * listed them, sizes included. Two editions, five installers each, and the
 * twelve files around them that nobody installs by hand.
 */
const SKIDBLADNIR_0_14_0: [string, number][] = [
	['latest-gpl.json', 6891],
	['latest.json', 6871],
	['Skidbladnir-0.14.0-source.tar.gz', 33996435],
	['Skidbladnir-GPL_0.14.0_aarch64.app.tar.gz', 16410994],
	['Skidbladnir-GPL_0.14.0_aarch64.app.tar.gz.sig', 432],
	['Skidbladnir-GPL_0.14.0_aarch64.dmg', 15919396],
	['Skidbladnir-GPL_0.14.0_amd64.AppImage', 95218168],
	['Skidbladnir-GPL_0.14.0_amd64.AppImage.sig', 444],
	['Skidbladnir-GPL_0.14.0_amd64.deb', 18653130],
	['Skidbladnir-GPL_0.14.0_amd64.deb.sig', 440],
	['Skidbladnir-GPL_0.14.0_x64-setup.exe', 10490273],
	['Skidbladnir-GPL_0.14.0_x64-setup.exe.sig', 444],
	['Skidbladnir-GPL_0.14.0_x64.app.tar.gz', 17488573],
	['Skidbladnir-GPL_0.14.0_x64.app.tar.gz.sig', 432],
	['Skidbladnir-GPL_0.14.0_x64.dmg', 17300121],
	['Skidbladnir_0.14.0_aarch64.app.tar.gz', 14047724],
	['Skidbladnir_0.14.0_aarch64.app.tar.gz.sig', 432],
	['Skidbladnir_0.14.0_aarch64.dmg', 13706591],
	['Skidbladnir_0.14.0_amd64.AppImage', 93411832],
	['Skidbladnir_0.14.0_amd64.AppImage.sig', 444],
	['Skidbladnir_0.14.0_amd64.deb', 16265786],
	['Skidbladnir_0.14.0_amd64.deb.sig', 440],
	['Skidbladnir_0.14.0_x64-setup.exe', 9778669],
	['Skidbladnir_0.14.0_x64-setup.exe.sig', 444],
	['Skidbladnir_0.14.0_x64.app.tar.gz', 15194711],
	['Skidbladnir_0.14.0_x64.app.tar.gz.sig', 432],
	['Skidbladnir_0.14.0_x64.dmg', 15051557],
]

const asset = (name: string, size = 1, over: Partial<RawAsset> = {}): RawAsset => ({
	name,
	browser_download_url: `https://github.com/basic-automation/Skidbladnir/releases/download/v0.14.0/${name}`,
	size,
	state: 'uploaded',
	...over,
})

const skidbladnirAssets = () => SKIDBLADNIR_0_14_0.map(([name, size]) => asset(name, size))

describe('downloadableAssets', () => {
	it('keeps the ten installers of a real release and nothing else', () => {
		expect(downloadableAssets(skidbladnirAssets()).map((a) => a.name)).toEqual([
			'Skidbladnir-GPL_0.14.0_aarch64.dmg',
			'Skidbladnir-GPL_0.14.0_amd64.AppImage',
			'Skidbladnir-GPL_0.14.0_amd64.deb',
			'Skidbladnir-GPL_0.14.0_x64-setup.exe',
			'Skidbladnir-GPL_0.14.0_x64.dmg',
			'Skidbladnir_0.14.0_aarch64.dmg',
			'Skidbladnir_0.14.0_amd64.AppImage',
			'Skidbladnir_0.14.0_amd64.deb',
			'Skidbladnir_0.14.0_x64-setup.exe',
			'Skidbladnir_0.14.0_x64.dmg',
		])
	})

	it('drops signatures, updater archives, updater manifests and the source archive', () => {
		const out = downloadableAssets([
			asset('App_1.0.0_amd64.deb.sig'),
			asset('App_1.0.0_amd64.deb.minisig'),
			asset('App_1.0.0_amd64.deb.asc'),
			asset('App_1.0.0_x64.app.tar.gz'),
			asset('latest.json'),
			asset('latest-gpl.json'),
			asset('App-1.0.0-source.tar.gz'),
			asset('app_1.0.0_source.zip'),
			asset('App_1.0.0_amd64.deb'),
		])
		expect(out.map((a) => a.name)).toEqual(['App_1.0.0_amd64.deb'])
	})

	it('carries the name, the direct URL and the size', () => {
		expect(downloadableAssets([asset('App_1.0.0_amd64.deb', 1234)])).toEqual([{
			name: 'App_1.0.0_amd64.deb',
			url: 'https://github.com/basic-automation/Skidbladnir/releases/download/v0.14.0/App_1.0.0_amd64.deb',
			size: 1234,
		}])
	})

	it('leaves out a file that is still uploading, whose URL does not answer yet', () => {
		expect(downloadableAssets([asset('App_1.0.0_amd64.deb', 1, { state: 'open' })])).toEqual([])
		// A payload without `state` at all (an older snapshot) is taken at its word.
		expect(downloadableAssets([asset('App_1.0.0_amd64.deb', 1, { state: undefined })])).toHaveLength(1)
	})

	it('survives no assets, junk entries and a missing size rather than throwing mid-render', () => {
		expect(downloadableAssets(undefined)).toEqual([])
		expect(downloadableAssets(null)).toEqual([])
		const junk = [null, {}, { name: 'App_1.0.0_amd64.deb' }, asset('App_1.0.0_x64-setup.exe', 1, { size: undefined })] as unknown as RawAsset[]
		expect(downloadableAssets(junk)).toEqual([{
			name: 'App_1.0.0_x64-setup.exe',
			url: 'https://github.com/basic-automation/Skidbladnir/releases/download/v0.14.0/App_1.0.0_x64-setup.exe',
			size: 0,
		}])
	})
})

describe('pickDownload', () => {
	const withFiles = (over: Partial<RawRelease> = {}) => release({ assets: [asset('App_1.0.0_amd64.deb')], ...over })

	it('is the newest full release with files, as /releases/latest would pick it', () => {
		const out = pickDownload([
			withFiles({ tag_name: 'v1.1.0-beta.1', prerelease: true }),
			withFiles({ tag_name: 'v1.0.0' }),
			withFiles({ tag_name: 'v0.15.0', prerelease: true }),
		])
		expect(out?.tag).toBe('v1.0.0')
		expect(out?.prerelease).toBe(false)
	})

	it('falls back to the newest pre-release when there is no full release — and says so', () => {
		const out = pickDownload([
			withFiles({ tag_name: 'v0.15.0', prerelease: true }),
			withFiles({ tag_name: 'v0.14.0', prerelease: true }),
		])
		expect(out?.tag).toBe('v0.15.0')
		expect(out?.prerelease).toBe(true)
	})

	it('skips a release with nothing to download, so the links never point at an empty one', () => {
		const out = pickDownload([
			release({ tag_name: 'v1.1.0', assets: [asset('latest.json'), asset('App-1.1.0-source.tar.gz')] }),
			withFiles({ tag_name: 'v1.0.0' }),
		])
		expect(out?.tag).toBe('v1.0.0')
	})

	it('never picks a draft, which a visitor cannot download', () => {
		expect(pickDownload([withFiles({ tag_name: 'v2.0.0', draft: true })])).toBeNull()
	})

	it('is null for no releases, no files, or a payload that is not a list', () => {
		expect(pickDownload([])).toBeNull()
		expect(pickDownload([release()])).toBeNull()
		expect(pickDownload(undefined)).toBeNull()
		expect(pickDownload({} as unknown as RawRelease[])).toBeNull()
		expect(pickDownload([null, undefined] as unknown as RawRelease[])).toBeNull()
	})

	it('carries what the section prints: tag, release page, date and the files', () => {
		expect(pickDownload([withFiles({ published_at: null })])).toEqual({
			tag: 'v1.0.0',
			url: 'https://github.com/basic-automation/onyums/releases/tag/v1.0.0',
			publishedAt: '2025-12-31T00:00:00Z',
			prerelease: false,
			assets: [{
				name: 'App_1.0.0_amd64.deb',
				url: 'https://github.com/basic-automation/Skidbladnir/releases/download/v0.14.0/App_1.0.0_amd64.deb',
				size: 1,
			}],
		})
	})
})

describe('editionOf', () => {
	it('is the product name before the first underscore', () => {
		expect(editionOf('Skidbladnir_0.14.0_x64-setup.exe')).toBe('Skidbladnir')
		expect(editionOf('Skidbladnir-GPL_0.14.0_x64-setup.exe')).toBe('Skidbladnir-GPL')
	})

	it('is empty for a name that is not a bundle name', () => {
		expect(editionOf('latest.json')).toBe('')
		expect(editionOf('_odd.deb')).toBe('')
	})
})

describe('groupInstallers', () => {
	const files = () => downloadableAssets(skidbladnirAssets())

	it('lists one installer per platform, in the order someone scans for their machine', () => {
		const [standard] = groupInstallers(files(), ['Skidbladnir', 'Skidbladnir-GPL'])
		expect(standard?.name).toBe('Skidbladnir')
		expect(standard?.installers.map((i) => [i.platform.id, i.asset.name])).toEqual([
			['windows-x64', 'Skidbladnir_0.14.0_x64-setup.exe'],
			['macos-arm64', 'Skidbladnir_0.14.0_aarch64.dmg'],
			['macos-x64', 'Skidbladnir_0.14.0_x64.dmg'],
			['linux-deb', 'Skidbladnir_0.14.0_amd64.deb'],
			['linux-appimage', 'Skidbladnir_0.14.0_amd64.AppImage'],
		])
	})

	it('never mixes the editions up, though one name starts with the other', () => {
		const [standard, gpl] = groupInstallers(files(), ['Skidbladnir', 'Skidbladnir-GPL'])
		expect(standard?.installers.every((i) => i.asset.name.startsWith('Skidbladnir_'))).toBe(true)
		expect(gpl?.name).toBe('Skidbladnir-GPL')
		expect(gpl?.installers.every((i) => i.asset.name.startsWith('Skidbladnir-GPL_'))).toBe(true)
		expect(gpl?.installers).toHaveLength(5)
	})

	it('keeps the editions in the order given, so the one to recommend comes first', () => {
		expect(groupInstallers(files(), ['Skidbladnir-GPL', 'Skidbladnir']).map((g) => g.name))
			.toEqual(['Skidbladnir-GPL', 'Skidbladnir'])
	})

	it('leaves out a platform with no file, and an edition with none at all', () => {
		const onlyLinux = files().filter((a) => a.name.endsWith('.deb'))
		const out = groupInstallers(onlyLinux, ['Skidbladnir', 'Nonexistent'])
		expect(out).toHaveLength(1)
		expect(out[0]?.installers.map((i) => i.platform.id)).toEqual(['linux-deb'])
	})

	it('ignores a file it does not recognise rather than guessing its platform', () => {
		const out = groupInstallers(
			[{ name: 'Skidbladnir_1.0.0_x86_64.rpm', url: 'u', size: 1 }, { name: 'Skidbladnir_1.0.0_x64_en-US.msi', url: 'u', size: 1 }],
			['Skidbladnir'],
		)
		expect(out).toEqual([])
	})
})

describe('formatSize', () => {
	it('prints binary megabytes the way GitHub\'s release page does', () => {
		expect(formatSize(9778669)).toBe('9.3 MB')
		expect(formatSize(93411832)).toBe('89.1 MB')
		expect(formatSize(209715200)).toBe('200 MB')
		expect(formatSize(440)).toBe('1 KB')
		expect(formatSize(512 * 1024)).toBe('512 KB')
	})

	it('is empty for a size GitHub did not report', () => {
		expect(formatSize(0)).toBe('')
		expect(formatSize(Number.NaN)).toBe('')
		expect(formatSize(-1)).toBe('')
	})
})
