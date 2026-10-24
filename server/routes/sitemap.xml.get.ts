/**
 * The sitemap, built from the same project list the pages render from — so a
 * project added to `data/projects.ts` is in the sitemap on the next request,
 * with no build step and nothing to remember.
 *
 * `lastmod` on a project page is the repo's last push: the page's editorial
 * copy is only half of what it shows, and the live half moves when the repo
 * does. A blog index's is its newest post's date. The static pages carry no
 * `lastmod` rather than a made-up one.
 */

import { defineEventHandler } from 'nuxt/server'
import { SITE_BLOG_PATH, postPath } from '~~/shared/posts/section'
import { docPath, docsIndexPath } from '~~/shared/docs/path'
import { xmlEscape } from '~~/shared/xml/escape'

const STATIC_ROUTES = ['/', '/projects', '/status']

function urlEntry(loc: string, lastmod?: string | null): string {
  const mod = lastmod ? `\n    <lastmod>${xmlEscape(lastmod.split('T')[0] ?? '')}</lastmod>` : ''
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${mod}\n  </url>`
}

export default defineEventHandler(async (event) => {
  const base = siteOrigin(event)
  const projects = await getProjects()

  // Drafts are deliberately absent. A draft is reachable by URL so it can be
  // previewed, which is not the same as asking a crawler to index it.
  const posts = (await allPosts()).filter((p) => !p.draft)

  // A blog index changes exactly when a post lands on it, so its newest post's
  // date is its `lastmod` — the same kind of honest as a post's own. `posts` is
  // newest first. `/news` lists every blog, so every post counts for it.
  const newest = (project?: string) => posts.find((p) => project === undefined || p.project === project)?.date

  // Documentation ships with the build, so it has no `lastmod` of its own to
  // report honestly; like the static pages, it carries none.
  const docPages = (await Promise.all(projects.filter((p) => p.docs).map(async (p) => ({
    index: docsIndexPath(p.slug),
    pages: (await listDocs(p.slug)).map((d) => docPath(p.slug, d.slug)),
  })))).flatMap((d) => [d.index, ...d.pages])

  const entries = [
    ...STATIC_ROUTES.map((path) => urlEntry(`${base}${path}`)),
    urlEntry(`${base}${SITE_BLOG_PATH}`, newest()),
    // `/about` rather than `/projects/<slug>`: the latter is a 301 to it, and a
    // sitemap listing redirects asks every crawler to make two requests to learn
    // one page.
    ...projects.map((p) => urlEntry(`${base}/projects/${p.slug}/about`, p.meta?.pushedAt)),
    ...projects.map((p) => urlEntry(`${base}/projects/${p.slug}/blog`, newest(p.slug))),
    // A post's own date is its `lastmod`, which is honest: the file is written
    // once and the date in its front matter is when the thing it describes
    // happened. `postPath` so the two URL shapes cannot diverge from the links
    // the pages render.
    ...docPages.map((path) => urlEntry(`${base}${path}`)),
    ...posts.map((p) => urlEntry(`${base}${postPath(p.project, p.slug)}`, p.date)),
  ]

  event.res.headers.set('content-type', 'application/xml; charset=utf-8')
  event.res.headers.set('cache-control', 'public, max-age=3600')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
})
