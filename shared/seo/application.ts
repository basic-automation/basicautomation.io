/**
 * `SoftwareApplication` structured data for an app the page offers to download.
 *
 * The project page already describes the repository as `SoftwareSourceCode`.
 * For a desktop app that is half the story: what a searcher wants is the
 * program — which systems it runs on, which version, where to get it, that it
 * is free. Every field here comes from what the page's download section itself
 * renders, so the markup cannot claim a platform the page has no link for, and
 * it is absent whenever that section is: no release with installers, or a
 * fallback snapshot from before downloads were recorded.
 */

import type { OsFamily, Installer } from '~~/shared/github/installers'
import type { DownloadRelease } from '~~/shared/types/project'

/** How each system is named to a reader, in the order the download list uses. */
const OS_NAME: Record<OsFamily, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' }

export interface ApplicationInput {
	/** The page's own absolute URL; the node's `@id` hangs off it */
	pageUrl: string
	name: string
	description: string
	/** schema.org `applicationCategory`, e.g. `MultimediaApplication` */
	category: string
	/** The release the download links point at */
	release: DownloadRelease
	/** The recommended edition's installers, as the page lists them */
	installers: readonly Installer[]
	/** Absolute URLs, when the page has them */
	screenshot?: string
	image?: string
	/** Who publishes it — a reference, see `organizationRef` */
	publisher?: Record<string, unknown>
}

/** The `@id` of the application a page describes, so other nodes can name it. */
export function applicationId(pageUrl: string): string {
	return `${pageUrl}#application`
}

/** `Windows, macOS, Linux` — each system with at least one installer, once. */
export function operatingSystems(installers: readonly Installer[]): string {
	const seen: OsFamily[] = []
	for (const { platform } of installers) if (!seen.includes(platform.os)) seen.push(platform.os)
	return seen.map((os) => OS_NAME[os]).join(', ')
}

export function softwareApplicationLd(input: ApplicationInput): Record<string, unknown> | null {
	if (!input.installers.length) return null
	const data: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		'@id': applicationId(input.pageUrl),
		'name': input.name,
		'description': input.description,
		'url': input.pageUrl,
		'applicationCategory': input.category,
		'operatingSystem': operatingSystems(input.installers),
		'softwareVersion': input.release.tag.replace(/^v(?=\d)/, ''),
		'datePublished': input.release.publishedAt,
		// The release page: every installer, both editions and the notes.
		'downloadUrl': input.release.url,
		'isAccessibleForFree': true,
		'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
	}
	if (input.screenshot) data.screenshot = input.screenshot
	if (input.image) data.image = input.image
	if (input.publisher) data.publisher = input.publisher
	return data
}
