/**
 * Everything here is meant to be found. The only rule is the pointer to the
 * sitemap, which is what a crawler actually needs from this file.
 *
 * `/api/` is disallowed: it serves the same data the pages already render, so
 * indexing it would only compete with the pages for the same queries.
 */

export default defineEventHandler((event) => {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=86400')

  return `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`
})
