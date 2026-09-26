/**
 * The sitemap, built from the same project list the pages render from — so a
 * project added to `data/projects.ts` is in the sitemap on the next request,
 * with no build step and nothing to remember.
 *
 * `lastmod` on a project page is the repo's last push: the page's editorial
 * copy is only half of what it shows, and the live half moves when the repo
 * does. The static pages carry no `lastmod` rather than a made-up one.
 */

import { xmlEscape } from '~~/shared/xml/escape'

const STATIC_ROUTES = ['/', '/projects', '/status']

function urlEntry(loc: string, lastmod?: string | null): string {
  const mod = lastmod ? `\n    <lastmod>${xmlEscape(lastmod.split('T')[0] ?? '')}</lastmod>` : ''
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${mod}\n  </url>`
}

export default defineEventHandler(async (event) => {
  const base = siteOrigin(event)
  const projects = await getProjects()

  const entries = [
    ...STATIC_ROUTES.map((path) => urlEntry(`${base}${path}`)),
    ...projects.map((p) => urlEntry(`${base}/projects/${p.slug}`, p.meta?.pushedAt)),
  ]

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
})
