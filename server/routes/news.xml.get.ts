/**
 * One Atom feed for every published post, across every blog on the site.
 *
 * The same list `/news` renders — the organization's own news and each
 * project's, newest first — so a reader subscribed here sees what a visitor
 * to `/news` sees. Drafts are never in it: `latestPosts` filters them, as it
 * does for every listing.
 *
 * Summaries, not bodies. Rendering a body means Shiki over every fence in every
 * entry on every poll, for a reader that will follow the link anyway; the
 * releases feed makes the same trade.
 */

import { bySlug } from '~~/data/projects'
import { SITE_BLOG_PATH, blogIndexPath, isSiteSection, postPath } from '~~/shared/posts/section'
import { xmlEscape } from '~~/shared/xml/escape'

/** How many entries the feed carries. A reader wants recent, not complete. */
const MAX_ENTRIES = 30

export default defineEventHandler(async (event) => {
  const base = siteOrigin(event)
  const posts = await latestPosts(MAX_ENTRIES)

  // An empty feed is still a valid feed; `updated` falls back to now so a
  // reader polling before the first post sees a well-formed document.
  const updated = posts[0]?.date ?? new Date().toISOString()

  const items = posts.map((post) => {
    const url = `${base}${postPath(post.project, post.slug)}`
    const blog = isSiteSection(post.project)
      ? 'basic automation'
      : (bySlug(post.project)?.name ?? post.project)

    return `  <entry>
    <title>${xmlEscape(post.title)}</title>
    <id>${xmlEscape(url)}</id>
    <link rel="alternate" type="text/html" href="${xmlEscape(url)}"/>
    <link rel="related" type="text/html" href="${xmlEscape(`${base}${blogIndexPath(post.project)}`)}"/>
    <published>${xmlEscape(post.date)}</published>
    <updated>${xmlEscape(post.date)}</updated>
    <category term="${xmlEscape(post.project)}" label="${xmlEscape(blog)}"/>
    <summary>${xmlEscape(post.summary || post.title)}</summary>
  </entry>`
  })

  setResponseHeader(event, 'content-type', 'application/atom+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=900')

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Basic Automation — news</title>
  <subtitle>Every post from Basic Automation and its projects.</subtitle>
  <id>${xmlEscape(`${base}/news.xml`)}</id>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(`${base}/news.xml`)}"/>
  <link rel="alternate" type="text/html" href="${xmlEscape(`${base}${SITE_BLOG_PATH}`)}"/>
  <updated>${xmlEscape(updated)}</updated>
  <author>
    <name>Basic Automation</name>
    <uri>${xmlEscape(base)}</uri>
  </author>
${items.join('\n')}
</feed>
`
})
