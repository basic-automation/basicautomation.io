/**
 * Everything here is meant to be found. The only rule is the pointer to the
 * sitemap, which is what a crawler actually needs from this file.
 *
 * `/api/` is disallowed: it serves the same data the pages already render, so
 * indexing it would only compete with the pages for the same queries. So is
 * `/onion-frame`, for the same reason and more so — it is a byte-for-byte copy
 * of the home page, fetched back over Tor for the frame on the onyums page, and
 * an indexer that found it would be looking at the home page's own content under
 * a second URL.
 */

export default defineEventHandler((event) => {
  const base = siteOrigin(event)

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=86400')

  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /onion-frame

Sitemap: ${base}/sitemap.xml
`
})
