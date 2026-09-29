/**
 * The organization, described once.
 *
 * Every page that emits structured data has to say who published it, and the
 * project pages were each describing the organization inline. Naming it with an
 * `@id` instead does two things: the description lives in one place, and a
 * consumer reading two pages of this site can tell it is the same organization
 * rather than two with matching names.
 *
 * The `@id` is a URL by convention — it is an identifier, not a link to fetch,
 * which is why it carries a fragment that resolves to nothing.
 */

import { blogIndexPath, isSiteSection, postPath } from '~~/shared/posts/section'

export const ORG_ID = '#organization'
export const SITE_ID = '#website'

const GITHUB = 'https://github.com/basic-automation'
const CRATES = 'https://crates.io/users/basic-automation'

/** The full description, emitted once per document by whoever owns the page. */
export function organizationLd(siteUrl: string): Record<string, unknown> {
	return {
		'@type': 'Organization',
		'@id': `${siteUrl}/${ORG_ID}`,
		'name': 'Basic Automation',
		'url': siteUrl,
		'logo': `${siteUrl}/logo.svg`,
		'description':
			'Basic Automation designs and builds software tools for businesses, and '
			+ 'publishes the sharp ones as open source.',
		// Where else this organization is the same organization.
		'sameAs': [GITHUB, CRATES],
	}
}

/** A reference to it, for a page that is not the one describing it. */
export function organizationRef(siteUrl: string): Record<string, unknown> {
	return { '@id': `${siteUrl}/${ORG_ID}` }
}

/**
 * A post, as a `BlogPosting` in the blog it belongs to.
 *
 * `isPartOf` names the blog by `@id` so that every post in one blog points at
 * the same node — the site's own news and each project's news are separate
 * blogs, and a consumer should be able to tell which a post came from without
 * parsing its URL. The image is the social card the post's page already
 * advertises: its project's card, or the organization's for the site's own.
 */
export function blogPostingLd(siteUrl: string, post: PostSummary, blogName: string): Record<string, unknown> {
	const url = `${siteUrl}${postPath(post.project, post.slug)}`
	const blogUrl = `${siteUrl}${blogIndexPath(post.project)}`
	const data: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		'headline': post.title,
		'url': url,
		'mainEntityOfPage': url,
		'datePublished': post.date,
		'inLanguage': 'en',
		'author': organizationRef(siteUrl),
		'publisher': organizationRef(siteUrl),
		'image': isSiteSection(post.project) ? `${siteUrl}/og.png` : `${siteUrl}/projects/og/${post.project}.png`,
		'isPartOf': { '@type': 'Blog', '@id': `${blogUrl}#blog`, 'name': blogName, 'url': blogUrl },
	}
	if (post.summary) data.description = post.summary
	return data
}
