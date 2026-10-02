/**
 * Which blog a post belongs to, and where it lives on the site.
 *
 * Every post has a `project`, and one value of it is not a project: `site` is
 * the organisation's own news — release announcements, things that span
 * products, anything that is about Basic Automation rather than about one of
 * its tools. It reads as a section name in a file path and in the editor's
 * dropdown, which is why it is a sentinel value rather than a separate field.
 *
 * Shared because three places have to agree on it: the reader deciding whether
 * a directory is legitimate, the pages building links, and the sitemap.
 */

import ogCards from '~~/public/projects/og/cards.json'

/** The reserved `project` value for the site's own blog. */
export const SITE_SECTION = 'site'

/** Where the site's own blog lives. Project blogs hang off their project page. */
export const SITE_BLOG_PATH = '/news'

export function isSiteSection(project: string): boolean {
  return project === SITE_SECTION
}

/**
 * A post's canonical path.
 *
 * The two shapes are deliberate rather than incidental: a project's news
 * belongs under that project, because that is where someone looking for it
 * will be, and the site's own news belongs at the top level for the same
 * reason. One function so a link cannot be built the wrong way in one of the
 * four places that build them.
 */
export function postPath(project: string, slug: string): string {
  return isSiteSection(project) ? `${SITE_BLOG_PATH}/${slug}` : `/projects/${project}/blog/${slug}`
}

/** The index a post's siblings are listed on. */
export function blogIndexPath(project: string): string {
  return isSiteSection(project) ? SITE_BLOG_PATH : `/projects/${project}/blog`
}

/** What to call the blog a post is in, when a mixed list has to say. */
export function sectionLabel(project: string, projectName: string | undefined): string {
  return isSiteSection(project) ? 'basic automation' : (projectName ?? project)
}

/**
 * The social card a project's pages preview with: its own card, or the
 * organization's for the site's news. Both are 1200×630. One function because
 * the Open Graph tags and the JSON-LD `image` must name the same picture.
 *
 * A project card's URL carries the fingerprint `npm run og` recorded for it in
 * `public/projects/og/cards.json` — of the data it was rendered from and of the
 * card recipe — so a re-rendered card is a new URL. Networks cache a preview
 * image by its URL, often for far longer than our own `max-age`, so under a
 * fixed URL a card that changed ("In development" → "Stable") could go on
 * being shown as it was. A card the manifest does not know keeps its bare URL.
 * The organization's card is not generated and has no fingerprint.
 */
export function socialCardPath(project: string): string {
  if (isSiteSection(project)) return '/og.png'
  const version = (ogCards.cards as Record<string, string>)[project]
  return version ? `/projects/og/${project}.png?v=${version}` : `/projects/og/${project}.png`
}

/** What the organization's card (`/og.png`) shows, for its `og:image:alt`. */
export const ORG_CARD_ALT = 'The Basic Automation mark: //basic on a dark square'

/**
 * The `og:image:alt` for the card `socialCardPath` names: the organization's
 * mark, or the project's own card, which carries its name and its hero line —
 * the same words the project page gives its own card.
 */
export function socialCardAlt(project: string, projectName?: string, hero?: string): string {
  if (isSiteSection(project)) return ORG_CARD_ALT
  const name = projectName ?? project
  return hero ? `${name} — ${hero}` : name
}

/** A blog's name, the same everywhere it is named — its index and every post in it. */
export function blogName(project: string, projectName: string | undefined): string {
  return `${sectionLabel(project, projectName)} news`
}
