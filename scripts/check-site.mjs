/**
 * Crawl a running build and check every route, every internal link and every
 * asset it references.
 *
 * `npm run build` proves the bundle compiles. It does not prove a page renders,
 * that a link in the footer still points somewhere, or that a 404 is a 404 —
 * and a broken internal link is exactly the kind of thing a build is happy to
 * ship. This walks the site the way a visitor would and fails on anything that
 * does not answer.
 *
 *   node .output/server/index.mjs &
 *   npm run check                       # against http://127.0.0.1:3000
 *   npm run check -- http://host:3421   # or wherever it is listening
 *
 * External links are not followed by default: they are somebody else's uptime,
 * and a flaky third party should not fail this check. `--external` opts in, and
 * even then only a hard 404 fails — a host this machine cannot reach at all is
 * reported as a warning, because that is a verdict on the network, not the link.
 */

const args = process.argv.slice(2)
const CHECK_EXTERNAL = args.includes('--external')
const BASE = (args.find((a) => !a.startsWith('--'))
  ?? process.env.CHECK_BASE_URL
  ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/** Routes that no page links to, but that have to work anyway. */
const UNLINKED_ROUTES = ['/healthz', '/sitemap.xml', '/robots.txt', '/releases.xml', '/api/projects']

/** Paths that must answer 404 — a soft 200 on a missing page is the bug. */
const MUST_404 = ['/projects/no-such-project', '/no-such-page-at-all', '/api/projects/nope']

/**
 * crates.io serves its app only to something that says it wants HTML; asked
 * with the default `*\/*` it answers 404 for a crate that plainly exists. Every
 * request here sends a browser's Accept so a link check reports the link and
 * not the negotiation.
 */
const HEADERS = {
  'user-agent': 'basicautomation.io-check',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const failures = []
const warnings = []
const notes = []
const seen = new Map()

function fail(where, message) {
  failures.push(`${where}: ${message}`)
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`)
}

async function fetchOnce(url) {
  if (seen.has(url)) return seen.get(url)
  const promise = (async () => {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: HEADERS })
      const type = res.headers.get('content-type') ?? ''
      const body = type.includes('html') || type.includes('xml') || type.includes('text')
        ? await res.text()
        : null
      return { status: res.status, type, body }
    }
    catch (err) {
      return { status: 0, type: '', body: null, error: err.message }
    }
  })()
  seen.set(url, promise)
  return promise
}

/** Every `href` and `src` in the markup, plus the `srcset` candidates. */
function extractRefs(html) {
  const out = new Set()
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) out.add(m[1])
  for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url) out.add(url)
    }
  }
  return [...out]
}

const isCrawlable = (url) =>
  url.origin === new URL(BASE).origin
  && !UNLINKED_ROUTES.includes(url.pathname)
  && !url.pathname.startsWith('/api/')
  && !/\.(png|jpe?g|webp|svg|ico|woff2?|css|js|mjs|map|xml|txt)$/i.test(url.pathname)

console.log(`Checking ${BASE}${CHECK_EXTERNAL ? ' (following external links)' : ''}\n`)

const queue = ['/']
const crawled = new Set()
const external = new Set()

while (queue.length) {
  const path = queue.shift()
  if (crawled.has(path)) continue
  crawled.add(path)

  const res = await fetchOnce(BASE + path)
  if (res.status !== 200) {
    fail(path, res.error ? `unreachable — ${res.error}` : `expected 200, got ${res.status}`)
    continue
  }
  if (!res.body) {
    fail(path, `no body to read (content-type: ${res.type || 'none'})`)
    continue
  }
  console.log(`  200  ${path}`)

  // Fragment links point at an id on the page that emitted them.
  const ids = new Set([...res.body.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]))

  for (const ref of extractRefs(res.body)) {
    if (/^(mailto|tel|data|javascript):/i.test(ref)) continue

    if (ref.startsWith('#')) {
      const id = decodeURIComponent(ref.slice(1))
      if (id && !ids.has(id)) fail(path, `fragment link ${ref} has no matching id on the page`)
      continue
    }

    let url
    try {
      url = new URL(ref, BASE + path)
    }
    catch {
      fail(path, `unparseable reference ${ref}`)
      continue
    }

    if (url.origin !== new URL(BASE).origin) {
      external.add(url.href)
      continue
    }

    if (isCrawlable(url)) {
      if (!crawled.has(url.pathname)) queue.push(url.pathname)
    }
    else {
      const asset = await fetchOnce(url.origin + url.pathname + url.search)
      if (asset.status !== 200) {
        fail(path, `references ${url.pathname} which answered ${asset.status || 'nothing'}`)
      }
    }
  }
}

console.log('')

// ── Routes nothing links to ─────────────────────────────────────────────────
for (const path of UNLINKED_ROUTES) {
  const res = await fetchOnce(BASE + path)
  if (res.status !== 200) fail(path, `expected 200, got ${res.status}`)
  else console.log(`  200  ${path}`)
}

// ── Every URL the sitemap promises ──────────────────────────────────────────
const sitemap = await fetchOnce(`${BASE}/sitemap.xml`)
if (sitemap.status === 200 && sitemap.body) {
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  if (!locs.length) fail('/sitemap.xml', 'contains no <loc> entries')
  for (const loc of locs) {
    // The sitemap carries the public origin; check the same path here.
    const path = new URL(loc).pathname
    const res = await fetchOnce(BASE + path)
    if (res.status !== 200) fail('/sitemap.xml', `promises ${path}, which answered ${res.status}`)
  }
  notes.push(`sitemap lists ${locs.length} urls, all reachable`)
}

// ── A 404 has to be a 404 ───────────────────────────────────────────────────
for (const path of MUST_404) {
  const res = await fetchOnce(BASE + path)
  if (res.status !== 404) fail(path, `expected 404, got ${res.status}`)
  else console.log(`  404  ${path}`)
}

// ── External links, only when asked ─────────────────────────────────────────
if (CHECK_EXTERNAL) {
  console.log(`\nChecking ${external.size} external links…`)
  for (const href of external) {
    const res = await fetchOnce(href)
    // A 403 or 405 from a site that dislikes being crawled is not a broken
    // link. A 404 is. A host that does not answer at all is a verdict on this
    // machine's network as much as on the link, so it only warns.
    if (res.status === 404 || res.status === 410) fail('external', `${href} answered ${res.status}`)
    else if (res.status === 0) warn('external', `${href} could not be reached — ${res.error}`)
  }
}
else {
  notes.push(`${external.size} external links found, not followed (pass --external)`)
}

console.log('')
for (const note of notes) console.log(`  · ${note}`)

if (warnings.length) {
  console.warn(`\n${warnings.length} warning(s):`)
  for (const w of warnings) console.warn(`  ! ${w}`)
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(`\n✓ ${crawled.size} pages crawled, ${seen.size} urls checked, no problems.`)
