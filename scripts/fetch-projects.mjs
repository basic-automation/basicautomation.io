/**
 * Build-time data fetch.
 *
 * Pulls the parts of each project that change on their own — stars, last push,
 * license, topics, latest release, crate version and downloads, and the README —
 * and writes them to data/projects.generated.json, which is committed.
 *
 * The committed snapshot is the point: `nuxt generate` never touches the network,
 * so a GitHub or crates.io outage can't fail a deploy, and every data change
 * shows up as a reviewable diff. Refresh it with `npm run sync` (the deploy
 * workflow does this on a schedule and opens the result as a commit).
 *
 * Auth is optional. Set GITHUB_TOKEN to lift the 60 req/hour anonymous limit.
 */

import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Marked } from 'marked'
import { projects } from '../data/projects.ts'
import { createSlugger } from '../shared/markdown/slug.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../data/projects.generated.json')
const ORG = 'basic-automation'
// crates.io asks for a user agent that identifies the bot and carries contact
// information, and GitHub asks that the API version be stated rather than
// defaulted. Same reasoning as server/utils/github.ts, which has the sources.
const UA = 'basicautomation.io-build (+https://basicautomation.io)'
const GH_API_VERSION = '2022-11-28'
/** Keep this in step with MAX_RELEASES in server/utils/github.ts. */
const MAX_RELEASES = 5

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

/** Nothing here is fatal: a failed fetch falls back to the committed snapshot. */
async function getJSON(url, { accept = 'application/vnd.github+json', auth = true } = {}) {
  const headers = { 'user-agent': UA, accept }
  if (auth) headers['x-github-api-version'] = GH_API_VERSION
  if (auth && token) headers.authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

async function getText(url, accept) {
  const headers = { 'user-agent': UA, accept, 'x-github-api-version': GH_API_VERSION }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

/**
 * READMEs address their own repo with relative paths. Rewrite them to absolute
 * URLs — raw.githubusercontent for anything that renders as an image, the blob
 * view for anything you click.
 */
function absolutize(markdown, repo, branch) {
  const raw = `https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/`
  const blob = `https://github.com/${ORG}/${repo}/blob/${branch}/`
  const isRelative = (u) => u && !/^([a-z]+:)?\/\//i.test(u) && !u.startsWith('#') && !u.startsWith('data:')
  const clean = (u) => u.replace(/^\.\//, '').replace(/^\//, '')

  return markdown
    // ![alt](./path) — images resolve against raw
    .replace(/(!\[[^\]]*\]\()([^)\s]+)(\)|\s)/g, (m, head, url, tail) =>
      isRelative(url) ? `${head}${raw}${clean(url)}${tail}` : m)
    // [text](./path) — links resolve against the blob view
    .replace(/(?<!!)(\[[^\]]*\]\()([^)\s]+)(\)|\s)/g, (m, head, url, tail) =>
      isRelative(url) ? `${head}${blob}${clean(url)}${tail}` : m)
    // <img src="./path">
    .replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi, (m, head, url, tail) =>
      isRelative(url) ? `${head}${raw}${clean(url)}${tail}` : m)
}

/**
 * The page renders its own title, tagline and badges, so drop the README's
 * leading logo block to avoid showing the same thing twice.
 */
function stripLeadingLogo(markdown) {
  return markdown
    .replace(/^\s*!\[[^\]]*\]\([^)]*(?:logo|banner)[^)]*\)\s*/i, '')
    .replace(/^(?:\s*<br\s*\/?>\s*)+/i, '')
}

/**
 * These repos are first-party, so the README's own HTML is rendered as-is.
 *
 * One renderer per README, because the slugger has to number duplicate heading
 * text from 1 within a document rather than across the whole run. Headings get
 * GitHub's own anchor so a README's table of contents still works here — the
 * same treatment the live renderer in server/utils/github.ts gives them.
 */
function markdownRenderer() {
  const slug = createSlugger()
  return new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      // The slug comes from the heading's raw text, never from the rendered
      // inline HTML: `Identity & address helpers` renders as `&amp;`, and
      // slugging that gives `identity-amp-address-helpers` instead of the
      // `identity--address-helpers` GitHub minted and the README links to.
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens)
        return `<h${depth} id="${slug(text)}">${inner}</h${depth}>\n`
      },
    },
  })
}

async function fetchRepo(project) {
  const { repo } = project
  const out = { repo, fetchedAt: new Date().toISOString() }

  const meta = await getJSON(`https://api.github.com/repos/${ORG}/${repo}`)
  Object.assign(out, {
    description: meta.description ?? null,
    htmlUrl: meta.html_url,
    homepage: meta.homepage || null,
    language: meta.language ?? null,
    topics: meta.topics ?? [],
    stars: meta.stargazers_count ?? 0,
    forks: meta.forks_count ?? 0,
    openIssues: meta.open_issues_count ?? 0,
    license: meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION'
      ? meta.license.spdx_id
      : null,
    defaultBranch: meta.default_branch || 'main',
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    archived: !!meta.archived,
  })

  // README — optional; a repo without one still gets a page.
  try {
    const md = await getText(
      `https://api.github.com/repos/${ORG}/${repo}/readme`,
      'application/vnd.github.raw',
    )
    const prepared = absolutize(stripLeadingLogo(md), repo, out.defaultBranch)
    out.readmeHtml = markdownRenderer().parse(prepared)
  }
  catch {
    out.readmeHtml = null
    console.warn(`  · ${repo}: no README`)
  }

  // Release history. One list call, not `releases/latest` plus a history call:
  // the newest full release is derived from the same page, so the changelog
  // costs nothing extra against the rate limit. Drafts are dropped — they are
  // not public. Pre-releases stay: for several of these repos that is all
  // there is, and the strip marks them.
  try {
    const list = await getJSON(
      `https://api.github.com/repos/${ORG}/${repo}/releases?per_page=${MAX_RELEASES}`,
    )
    out.releases = list
      .filter((r) => r && !r.draft && r.tag_name)
      .map((r) => ({
        tag: r.tag_name,
        title: r.name && r.name !== r.tag_name ? r.name : null,
        url: r.html_url,
        publishedAt: r.published_at || r.created_at,
        prerelease: !!r.prerelease,
      }))
    const full = out.releases.find((r) => !r.prerelease)
    out.latestRelease = full
      ? { tag: full.tag, url: full.url, publishedAt: full.publishedAt }
      : null
  }
  catch {
    out.releases = []
    out.latestRelease = null
  }

  // crates.io, for the published Rust crates.
  if (project.crate) {
    try {
      const c = await getJSON(`https://crates.io/api/v1/crates/${project.crate}`, {
        accept: 'application/json',
        auth: false,
      })
      out.crateVersion = c.crate.max_stable_version || c.crate.max_version
      out.crateDownloads = c.crate.downloads ?? 0
      out.crateUrl = `https://crates.io/crates/${project.crate}`
      out.docsUrl = `https://docs.rs/${project.crate}`
    }
    catch (err) {
      console.warn(`  · ${repo}: crates.io lookup failed — ${err.message}`)
    }
  }

  return out
}

async function previous() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'))
  }
  catch {
    return { repos: {} }
  }
}

const snapshot = await previous()
const repos = { ...snapshot.repos }
let failures = 0

console.log(`Fetching ${projects.length} projects from ${ORG}${token ? ' (authenticated)' : ' (anonymous)'}…`)

for (const project of projects) {
  try {
    repos[project.repo] = await fetchRepo(project)
    const r = repos[project.repo]
    console.log(`  ✓ ${project.repo} — ${r.stars}★${r.crateVersion ? `, v${r.crateVersion}` : ''}`)
  }
  catch (err) {
    failures++
    if (repos[project.repo]) {
      console.warn(`  ! ${project.repo} — ${err.message} (keeping previous snapshot)`)
    }
    else {
      console.error(`  ✗ ${project.repo} — ${err.message} (no previous snapshot)`)
    }
  }
}

await writeFile(
  OUT,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), org: ORG, repos }, null, 2)}\n`,
)

console.log(`\nWrote ${OUT}`)
if (failures) {
  console.warn(`${failures} of ${projects.length} failed; the previous snapshot was kept for those.`)
}
