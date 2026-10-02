import { describe, expect, it } from 'vitest'
import { groupInstallers } from '~~/shared/github/installers'
import { applicationId, operatingSystems, softwareApplicationLd } from '~~/shared/seo/application'
import type { DownloadRelease } from '~~/shared/types/project'
import { projects } from '~~/data/projects'

const asset = (name: string) => ({ name, url: `https://github.com/x/releases/download/v1.1.0/${name}`, size: 1 })

const release: DownloadRelease = {
	tag: 'v1.1.0',
	url: 'https://github.com/basic-automation/Skidbladnir/releases/tag/v1.1.0',
	publishedAt: '2026-10-01T20:56:30Z',
	prerelease: false,
	assets: [
		asset('Skidbladnir_1.1.0_x64-setup.exe'),
		asset('Skidbladnir_1.1.0_aarch64.dmg'),
		asset('Skidbladnir_1.1.0_x64.dmg'),
		asset('Skidbladnir_1.1.0_amd64.deb'),
		asset('Skidbladnir_1.1.0_amd64.AppImage'),
		asset('Skidbladnir-GPL_1.1.0_x64-setup.exe'),
	],
}

const standard = groupInstallers(release.assets, ['Skidbladnir'])[0]!.installers
const page = 'https://basicautomation.io/projects/skidbladnir/about'

describe('operatingSystems', () => {
	it('names each system with an installer once, in the download list\'s order', () => {
		expect(operatingSystems(standard)).toBe('Windows, macOS, Linux')
	})

	it('claims no system the page has no link for', () => {
		const windowsOnly = groupInstallers([asset('App_1.0.0_x64-setup.exe')], ['App'])[0]!.installers
		expect(operatingSystems(windowsOnly)).toBe('Windows')
	})
})

describe('softwareApplicationLd', () => {
	const base = { pageUrl: page, name: 'Skidbladnir', description: 'd', category: 'MultimediaApplication', release }

	it('describes the release the download links point at, as free', () => {
		const ld = softwareApplicationLd({ ...base, installers: standard })!
		expect(ld['@type']).toBe('SoftwareApplication')
		expect(ld['@id']).toBe(applicationId(page))
		expect(ld['@id']).toBe(`${page}#application`)
		expect(ld.softwareVersion).toBe('1.1.0')
		expect(ld.downloadUrl).toBe(release.url)
		expect(ld.datePublished).toBe(release.publishedAt)
		expect(ld.offers).toEqual({ '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' })
		expect(ld).not.toHaveProperty('screenshot')
	})

	it('is absent when there is nothing to download', () => {
		expect(softwareApplicationLd({ ...base, installers: [] })).toBeNull()
	})
})

describe('meta descriptions', () => {
	it('fit a search result without being cut off', () => {
		for (const p of projects) {
			const text = p.metaDescription ?? p.summary
			expect(text.length, `${p.slug}: ${text.length} characters`).toBeLessThanOrEqual(160)
		}
	})

	it('give a category to every app with a download section', () => {
		for (const p of projects.filter((x) => x.downloads)) expect(p.applicationCategory, p.slug).toBeTruthy()
	})
})
