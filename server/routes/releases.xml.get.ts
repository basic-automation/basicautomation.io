/**
 * One Atom feed for every release across the organization.
 *
 * The same `getProjects()` call the pages render from, flattened: each
 * project's release history merged into one stream, newest first. Atom rather
 * than RSS because `updated`, `id` and the date format are actually specified —
 * a reader does not have to guess what a `pubDate` meant.
 *
 * The releases come from the cached GitHub call, so the feed costs no upstream
 * request of its own and degrades to the committed snapshot with everything
 * else when GitHub is unreachable.
 */

/** How many entries the feed carries. A reader wants recent, not complete. */
const MAX_ENTRIES = 30

/** A release tag is data, not a pattern — neutralise it before it becomes one. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const projects = await getProjects()

  const entries = projects
    .flatMap((p) => (p.meta?.releases ?? []).map((r) => ({ project: p, release: r })))
    .sort((a, b) =>
      new Date(b.release.publishedAt).getTime() - new Date(a.release.publishedAt).getTime())
    .slice(0, MAX_ENTRIES)

  // An empty feed is still a valid feed; `updated` falls back to now so a
  // reader polling before the first release sees a well-formed document.
  const updated = entries[0]?.release.publishedAt ?? new Date().toISOString()

  const items = entries.map(({ project, release }) => {
    // The entry title already carries the tag, so a release title that opens by
    // repeating it — "v0.1.1 — builds on stable Rust" — is trimmed back to the
    // part that says something. The pre-release marker leads, so a beta never
    // arrives in a reader looking finished.
    const title = release.title
      ?.replace(new RegExp(`^${escapeRegExp(release.tag)}\\s*[—:\\-–]\\s*`), '')
      .trim()

    const summary = [
      release.prerelease ? 'Pre-release.' : null,
      title || null,
      project.tagline,
    ].filter(Boolean).join(' — ')

    return `  <entry>
    <title>${xmlEscape(`${project.name} ${release.tag}`)}</title>
    <id>${xmlEscape(release.url)}</id>
    <link rel="alternate" type="text/html" href="${xmlEscape(release.url)}"/>
    <link rel="related" type="text/html" href="${xmlEscape(`${base}/projects/${project.slug}`)}"/>
    <updated>${xmlEscape(release.publishedAt)}</updated>
    <category term="${xmlEscape(project.slug)}"/>
    <summary>${xmlEscape(summary)}</summary>
  </entry>`
  })

  setResponseHeader(event, 'content-type', 'application/atom+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=900')

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Basic Automation — releases</title>
  <subtitle>Every release across every project Basic Automation publishes.</subtitle>
  <id>${xmlEscape(`${base}/releases.xml`)}</id>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(`${base}/releases.xml`)}"/>
  <link rel="alternate" type="text/html" href="${xmlEscape(`${base}/projects`)}"/>
  <updated>${xmlEscape(updated)}</updated>
  <author>
    <name>Basic Automation</name>
    <uri>${xmlEscape(base)}</uri>
  </author>
${items.join('\n')}
</feed>
`
})
