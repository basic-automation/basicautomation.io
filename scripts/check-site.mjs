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
const UNLINKED_ROUTES = ['/healthz', '/sitemap.xml', '/robots.txt', '/releases.xml', '/news.xml', '/api/projects']

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
      return { status: res.status, type, body, csp: res.headers.get('content-security-policy') }
    }
    catch (err) {
      return { status: 0, type: '', body: null, error: err.message }
    }
  })()
  seen.set(url, promise)
  return promise
}

/**
 * Every `href` and `src` in the markup, plus the `srcset` candidates, each with
 * the offset it was found at — so a reference can be told apart from one inside
 * the rendered README, which is somebody else's content.
 */
function extractRefs(html) {
  const out = new Map()
  const add = (url, index) => { if (!out.has(url)) out.set(url, index) }
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) add(m[1], m.index)
  for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url) add(url, m.index)
    }
  }
  return [...out]
}

/**
 * The structured data, checked for the same reason the feed is: nobody looks at
 * it. A `<script type="application/ld+json">` that does not parse is ignored in
 * silence by every consumer, and the page still looks perfect.
 *
 * Not a schema validator — it does not know what a `SoftwareSourceCode` needs.
 * It knows the three ways this breaks: JSON that does not parse, a block with
 * no `@context`/`@type` for a consumer to dispatch on, and a relative URL where
 * an absolute one was meant, which is the failure mode of building these out of
 * a request-derived origin.
 */
function checkJsonLd(path, html) {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]
  if (!blocks.length) return

  for (const [i, block] of blocks.entries()) {
    let parsed
    try {
      parsed = JSON.parse(block[1])
    }
    catch (err) {
      fail(path, `ld+json block ${i + 1} does not parse — ${err.message}`)
      continue
    }

    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!node || typeof node !== 'object') {
        fail(path, `ld+json block ${i + 1} is not an object`)
        continue
      }
      if (!String(node['@context'] ?? '').includes('schema.org')) {
        fail(path, `ld+json ${node['@type'] ?? `block ${i + 1}`} has no schema.org @context`)
      }
      if (!node['@type']) fail(path, `ld+json block ${i + 1} has no @type`)

      // Any absolute-looking field that came out relative means the origin was
      // lost somewhere, and a consumer has no base URL to resolve it against.
      const walk = (value, key) => {
        if (typeof value === 'string') {
          if ((key === 'url' || key === '@id' || key === 'logo' || key === 'image')
            && !/^https?:\/\//.test(value)) {
            fail(path, `ld+json ${key} is relative: ${value}`)
          }
          return
        }
        if (Array.isArray(value)) return value.forEach((v) => walk(v, key))
        if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) walk(v, k)
        }
      }
      walk(node, null)
    }
  }
  notes.push(`${path}: ${blocks.length} structured-data block(s), all parsed`)
}

/**
 * The sources a CSP names for one directive, lowercased and space-joined, or
 * `undefined` if the policy does not mention it. Directive names are
 * case-insensitive, and so are the `'self'` and `'none'` keywords this is used
 * to read.
 */
function cspDirective(csp, name) {
  for (const part of (csp ?? '').split(';')) {
    const [directive, ...sources] = part.trim().split(/\s+/)
    if (directive.toLowerCase() === name) return sources.join(' ').toLowerCase()
  }
  return undefined
}

/**
 * JSON and ld+json blocks are data, never executed, and CSP does not apply to
 * them; everything else a <script> can be is code.
 */
function executes(attrs) {
  const type = attrs.match(/\btype=["']([^"']*)["']/i)?.[1]?.toLowerCase()
  return !type || type === 'module' || type === 'importmap' || type.includes('javascript')
}

/**
 * The one response that runs no JavaScript, held to the policy that lets it get
 * away with carrying no nonce.
 *
 * `/onion-frame` serves the document this server fetched over Tor, for the frame
 * on the onyums page. Everything the nonce does elsewhere — deciding what in a
 * document assembled from someone else's content may act — is done here by the
 * directives below instead, so they are checked rather than assumed: only this
 * site may frame it, the snapshot may not re-point relative URLs or submit
 * anywhere, and a directive nobody thought of falls back to same-origin.
 */
function checkScriptlessCsp(path, html, csp) {
  const required = {
    'default-src': "'self'",
    'frame-ancestors': "'self'",
    'base-uri': "'none'",
    'form-action': "'none'",
  }
  for (const [name, expected] of Object.entries(required)) {
    const sources = cspDirective(csp, name)
    if (sources === undefined) fail(path, `CSP forbids scripts but names no ${name} — here it has to be ${expected}`)
    else if (sources !== expected) fail(path, `CSP forbids scripts but ${name} is ${sources}, not ${expected}`)
  }

  // The header is the guarantee and the stripping is defence in depth, so a
  // script that survived the strip is still a bug: the browser refuses it and
  // logs a CSP error in the console of every visitor to the pages that show the
  // frame, for a fetch that could never have been used.
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (executes(m[1])) fail(path, `a <script${m[1].slice(0, 40)}> survived the strip — the frame forbids scripts`)
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/\brel=["']?modulepreload/i.test(m[0]) || /\bas=["']?script/i.test(m[0])) {
      fail(path, `a script preload survived the strip: ${m[0].slice(0, 60)}`)
    }
  }
}

/**
 * The script nonce holds together, on every page.
 *
 * `server/plugins/csp-nonce.ts` stamps a per-request nonce on the scripts and
 * styles Nuxt writes into the head and body tail, and never on the app body,
 * where README HTML lands. If a Nuxt upgrade moved one of its own scripts into
 * the body, or changed how the tail is assembled, the browser would refuse it
 * and the page would silently stop hydrating — and a crawler that runs no
 * JavaScript would see nothing wrong. So the invariant is checked here, in the
 * markup: the header names a nonce, every script that executes and every style
 * block carries that same nonce, and nothing inside the app body carries any.
 */
function checkNonces(path, html, csp) {
  // A response that forbids scripts outright needs no nonce, and this is not a
  // hole in the rule below: a nonce says *which* scripts may run, and
  // `script-src 'none'` says none may, which is strictly stricter than any list
  // of permitted ones. `/onion-frame` is the case — it strips the scripts out of
  // the Tor snapshot and then forbids them in the header, so there is no script
  // left for a nonce to be about. Such a response is not waved through; it is
  // held to the rest of the policy instead, which is what an ordinary page that
  // arrived here by mistake would fail.
  if (cspDirective(csp, 'script-src') === "'none'") {
    checkScriptlessCsp(path, html, csp)
    return
  }

  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1]
  if (!nonce) {
    fail(path, 'Content-Security-Policy carries no nonce — the CSP plugin did not run')
    return
  }
  if (!/style-src-elem [^;]*'nonce-/.test(csp)) fail(path, 'style-src-elem carries no nonce')

  const appAt = html.indexOf('<div id="__nuxt"')
  const appEnd = appAt === -1 ? -1 : html.indexOf('<div id="teleports"', appAt)

  for (const m of html.matchAll(/<(script|style)\b([^>]*)>/gi)) {
    const [, tag, attrs] = m
    const inApp = appAt !== -1 && m.index > appAt && (appEnd === -1 || m.index < appEnd)
    const has = attrs.match(/\bnonce=["']([^"']*)["']/i)?.[1]
    if (inApp) {
      if (has) fail(path, `a <${tag}> inside the app body carries the nonce — README content would be trusted`)
      continue
    }
    if (tag.toLowerCase() === 'script' && !executes(attrs)) continue
    if (has !== nonce) {
      fail(path, `a <${tag}${attrs.slice(0, 40)}> ${has ? 'carries a different nonce' : 'has no nonce'} — the browser will refuse it`)
    }
  }
}

/**
 * Structural accessibility, over the markup that was actually served.
 *
 * Not a substitute for an audit — it cannot see colour, focus order or whether
 * a label says anything useful. What it does catch is the class of regression
 * that is invisible in a browser and obvious to a screen reader, on every page,
 * for free: two `h1`s, an unnamed second landmark, an image with no `alt`.
 *
 * Both of the first two were real here. A project page carries its own `h1` and
 * then folds in a README that opens with `# ProjectName`, so four of six pages
 * served two — which is why READMEs are now rendered a heading level down. And
 * the site nav had no name while the per-project nav did, so a screen reader
 * announced "navigation" twice with nothing to tell them apart.
 */
function checkAccessibility(path, html, isUpstream) {
  const tag = (name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))]
  const attr = (attrs, name) => attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1]

  // A document says what it is about once.
  const h1s = tag('h1')
  if (h1s.length !== 1) {
    fail(path, `${h1s.length} <h1> elements — a page has exactly one`)
  }

  // Without it a screen reader guesses the language, and pronounces accordingly.
  const html_ = html.match(/<html\b([^>]*)>/i)?.[1] ?? ''
  if (!attr(html_, 'lang')) fail(path, '<html> has no lang attribute')

  // One main landmark, or "skip to content" has nowhere to point.
  const mains = tag('main')
  if (mains.length !== 1) fail(path, `${mains.length} <main> elements — a page has exactly one`)

  // Two landmarks of the same kind need names to be told apart. One does not.
  const navs = tag('nav')
  if (navs.length > 1) {
    for (const nav of navs) {
      if (!attr(nav[1], 'aria-label') && !attr(nav[1], 'aria-labelledby')) {
        fail(path, `a <nav> has no accessible name, and this page has ${navs.length} of them`)
      }
    }
  }

  // `alt=""` is a valid answer — it says "decorative". No `alt` at all is not.
  for (const img of tag('img')) {
    if (/\balt=/i.test(img[1])) continue
    const report = isUpstream(img.index) ? warn : fail
    report(path, `an <img> has no alt attribute${
      isUpstream(img.index) ? " — it is in the repo's own README" : ` (${attr(img[1], 'src') ?? '?'})`}`)
  }

  // A positive tabindex takes an element out of document order and puts it in
  // front of everything, which is almost never what anyone meant.
  for (const m of html.matchAll(/\btabindex=["'](\d+)["']/gi)) {
    if (Number(m[1]) > 0) fail(path, `tabindex="${m[1]}" — positive values reorder the whole page`)
  }
}

/**
 * The two XML documents, checked the way the HTML pages are.
 *
 * Nobody looks at a feed. It is read by software, and when it breaks it breaks
 * silently for every subscriber at once — so the failure that matters is the
 * one a person would never notice. Both documents carry text this site did not
 * write (a GitHub release title, an editorial tagline), which is exactly where
 * an unescaped `&`, or a control character XML forbids outright, comes from.
 *
 * Not a schema validator: these are the assertions that catch a document no
 * reader can parse, plus the Atom elements a reader actually needs.
 */
function checkXml(path, xml) {
  // XML 1.0 forbids these characters outright — they cannot be escaped into
  // legality, so one of them means the document simply does not parse.
  // eslint-disable-next-line no-control-regex
  const illegal = xml.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/)
  if (illegal) {
    fail(path, `contains U+${illegal[0].codePointAt(0).toString(16).padStart(4, '0').toUpperCase()}, which XML 1.0 forbids — no reader can parse this`)
  }

  // An unescaped `&` is the classic one: `&` that is not the start of an entity.
  for (const m of xml.matchAll(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g)) {
    fail(path, `unescaped & at offset ${m.index}`)
    break
  }

  // A tag opened and never closed, the other way a document stops parsing.
  const opens = [...xml.matchAll(/<([a-zA-Z][\w:-]*)(?:\s[^>]*?)?(\/?)>/g)]
  const stack = []
  for (const m of opens) {
    if (m[2] === '/') continue
    stack.push(m[1])
  }
  const closes = [...xml.matchAll(/<\/([a-zA-Z][\w:-]*)>/g)].map((m) => m[1])
  for (const name of closes) {
    const at = stack.lastIndexOf(name)
    if (at === -1) fail(path, `closing </${name}> with nothing open`)
    else stack.splice(at, 1)
  }
  if (stack.length) fail(path, `unclosed <${stack[stack.length - 1]}>`)

  // Every Atom feed — `/releases.xml` and `/news.xml` — by what it is, not by
  // name, so a third one is checked the day it exists.
  if (/<feed\b/.test(xml)) {
    // What a reader needs to identify the feed and to de-duplicate entries.
    for (const el of ['title', 'id', 'updated']) {
      if (!new RegExp(`<${el}>`).test(xml)) fail(path, `the feed has no <${el}>`)
    }
    if (!/<link\b[^>]*rel="self"/.test(xml)) fail(path, 'the feed has no rel="self" link')

    const ids = []
    for (const entry of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const body = entry[1]
      for (const el of ['title', 'id', 'updated']) {
        if (!new RegExp(`<${el}>`).test(body)) fail(path, `an <entry> has no <${el}>`)
      }
      const id = body.match(/<id>([^<]*)<\/id>/)?.[1]
      if (id) ids.push(id)
      const updated = body.match(/<updated>([^<]*)<\/updated>/)?.[1]
      // A reader sorts on this. "Recently" is not a date.
      if (updated && Number.isNaN(Date.parse(updated))) {
        fail(path, `<updated>${updated}</updated> is not a date a reader can parse`)
      }
    }
    // Two entries sharing an id is how a reader loses one of them.
    const seenIds = new Set()
    for (const id of ids) {
      if (seenIds.has(id)) fail(path, `two entries share the id ${id}`)
      seenIds.add(id)
    }
    notes.push(`${path}: ${ids.length} feed entries, each with an id, a title and a date`)
  }

  if (path.endsWith('sitemap.xml')) {
    for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      // Sitemaps take W3C Datetime; a bare date is the shortest legal form.
      if (!/^\d{4}-\d{2}-\d{2}(T|$)/.test(m[1])) fail(path, `<lastmod>${m[1]}</lastmod> is not a W3C date`)
    }
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
    const seenLocs = new Set()
    for (const loc of locs) {
      if (!/^https:\/\//.test(loc)) fail(path, `<loc>${loc}</loc> is not an absolute https URL`)
      if (seenLocs.has(loc)) fail(path, `<loc>${loc}</loc> appears twice`)
      seenLocs.add(loc)
    }
  }
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

  // A social card lives only in a `<meta>` tag, so nothing above would ever
  // fetch it — and an `og:image` pointing at a 404 fails silently, in someone
  // else's preview, where nobody sees it. These carry the public origin, so
  // check the same path here the way the sitemap's `<loc>` entries are checked.
  const socialImages = new Set([...res.body.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  )].map((m) => m[1]))

  // A page names the same card as both `og:image` and `twitter:image`; report
  // a broken one once, not once per tag.
  for (const ref of socialImages) {
    let image
    try {
      image = new URL(ref, BASE + path)
    }
    catch {
      fail(path, `unparseable social image ${ref}`)
      continue
    }
    const asset = await fetchOnce(BASE + image.pathname)
    if (asset.status !== 200) {
      fail(path, `social image ${image.pathname} answered ${asset.status || 'nothing'}`)
    }
    else if (asset.type && !asset.type.startsWith('image/')) {
      fail(path, `social image ${image.pathname} is ${asset.type}, not an image`)
    }
  }

  // Fragment links point at an id on the page that emitted them.
  const ids = new Set([...res.body.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]))

  // Everything from the rendered README onwards is a repo's own markdown, not
  // this site's markup. A stale contents link in there is upstream's to fix and
  // must not turn this check red, so it warns.
  const readmeAt = res.body.indexOf('class="readme')
  const isUpstream = (index) => readmeAt !== -1 && index >= readmeAt

  checkAccessibility(path, res.body, isUpstream)
  checkJsonLd(path, res.body)
  checkNonces(path, res.body, res.csp)

  for (const [ref, index] of extractRefs(res.body)) {
    if (/^(mailto|tel|data|javascript):/i.test(ref)) continue

    if (ref.startsWith('#')) {
      const id = decodeURIComponent(ref.slice(1))
      if (!id || ids.has(id)) continue
      const report = isUpstream(index) ? warn : fail
      report(path, `fragment link ${ref} has no matching id on the page${
        isUpstream(index) ? " — it is in the repo's own README" : ''}`)
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
  if (res.status !== 200) {
    fail(path, `expected 200, got ${res.status}`)
    continue
  }
  console.log(`  200  ${path}`)
  if (path.endsWith('.xml') && res.body) checkXml(path, res.body)
}

// ── Every URL the sitemap promises ──────────────────────────────────────────
const sitemap = await fetchOnce(`${BASE}/sitemap.xml`)
if (sitemap.status === 200 && sitemap.body) {
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  if (!locs.length) fail('/sitemap.xml', 'contains no <loc> entries')
  for (const loc of locs) {
    // The sitemap carries the public origin; check the same path here. A `<loc>`
    // that is not an absolute URL is a sitemap error, not a crash: `new URL`
    // throws on one, and this used to take the whole check down with it.
    let path
    try {
      path = new URL(loc).pathname
    }
    catch {
      fail('/sitemap.xml', `<loc>${loc}</loc> is not a URL — a sitemap carries absolute ones`)
      continue
    }
    const res = await fetchOnce(BASE + path)
    if (res.status !== 200) fail('/sitemap.xml', `promises ${path}, which answered ${res.status}`)
  }
  notes.push(`sitemap lists ${locs.length} urls, all reachable`)
}

// ── Drafts are listed nowhere ───────────────────────────────────────────────
// A draft is reachable by its URL for previewing and must not appear in any
// listing. Every listing — the home page, /news, each project's blog — is
// built from /api/posts, so a draft there is a draft on all of them.
const postList = await fetch(`${BASE}/api/posts`, { headers: HEADERS })
  .catch((err) => ({ status: 0, error: err.message }))
if (postList.status !== 200) {
  fail('/api/posts', `expected 200, got ${postList.status || postList.error}`)
}
else {
  const posts = (await postList.json()).posts ?? []
  for (const p of posts.filter((p) => p.draft)) {
    fail('/api/posts', `lists the draft ${p.project}/${p.slug}`)
  }
  notes.push(`${posts.length} published post(s) listed, no drafts among them`)
}

// ── HEAD answers wherever GET does ──────────────────────────────────────────
// Nitro routes by filename suffix, so `healthz.get.ts` binds GET alone and a
// HEAD for it used to fall through to the catch-all as a 404. That is the
// method an uptime monitor reaches for, on the endpoint that says whether the
// site is up. See server/middleware/head.ts.
for (const path of ['/', '/projects', ...UNLINKED_ROUTES]) {
  const res = await fetch(BASE + path, { method: 'HEAD', headers: HEADERS })
    .catch((err) => ({ status: 0, error: err.message }))
  const get = await fetchOnce(BASE + path)
  if (res.status !== get.status) {
    fail(path, `HEAD answered ${res.status || res.error}, GET answered ${get.status}`)
  }
}
notes.push('HEAD answers the same as GET on every route')

// ── The editor does not exist over Tor ──────────────────────────────────────
// Caddy's basic auth guards /admin and /api/admin/*, and the onion gateway
// reaches the site without going through Caddy — it marks every request it
// forwards with `x-via-onion` instead (shared/onion/via.ts). Sent here with that
// mark, the editor has to be refused: 404 from the site itself, or 401 where
// Caddy is in front and asks first. A 200 is the editor open to anyone on Tor.
// The odd spellings are routes the router still resolves to the same handler.
for (const path of ['/admin', '/ADMIN', '/admin/', '/api/admin/posts', '/api/admin/posts/', '/api/admin/post?project=site&slug=x']) {
  const res = await fetch(BASE + path, { headers: { ...HEADERS, 'x-via-onion': '1' }, redirect: 'manual' })
    .catch((err) => ({ status: 0, error: err.message }))
  if (res.status !== 404 && res.status !== 401) {
    fail(path, `over the onion gateway the editor answered ${res.status || res.error}; it must be refused`)
  }
}
notes.push('the editor is refused to requests from the onion gateway')

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
