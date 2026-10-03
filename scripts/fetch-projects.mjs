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
import { projects } from '../data/projects.ts'
// The same helpers — and the same renderer, highlighter included — the site
// itself renders READMEs and releases with. They used to be copied here; a
// snapshot shaped differently from the live path is a fallback that changes the
// page when it takes over. The copied renderer had no highlighter, so it did.
import { absolutize, stripLeadingLogo } from '../shared/markdown/readme.ts'
import { renderMarkdown } from '../shared/markdown/render.ts'
import { normaliseReleases, pickDownload, pickLatest } from '../shared/github/releases.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../data/projects.generated.json')
const ORG = 'basic-automation'
// crates.io asks for a user agent that identifies the bot and carries contact
// information, and GitHub asks that the API version be stated rather than
// defaulted. Same reasoning as server/utils/github.ts, which has the sources.
const UA = 'basicautomation.io-build (+https://basicautomation.io)'
const GH_API_VERSION = '2026-03-10'
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
    const prepared = absolutize(stripLeadingLogo(md), ORG, repo, out.defaultBranch)
    out.readmeHtml = await renderMarkdown(prepared)
  }
  catch {
    out.readmeHtml = null
    console.warn(`  · ${repo}: no README`)
  }

  // Release history. One list call, not `releases/latest` plus a history call:
  // the newest full release and the download links are derived from the same
  // page, so neither costs anything extra against the rate limit. Drafts are dropped — they are
  // not public. Pre-releases stay: for several of these repos that is all
  // there is, and the strip marks them.
  try {
    const list = await getJSON(
      `https://api.github.com/repos/${ORG}/${repo}/releases?per_page=${MAX_RELEASES}`,
    )
    out.releases = normaliseReleases(list)
    out.latestRelease = pickLatest(out.releases)
    out.download = pickDownload(list)
  }
  catch {
    out.releases = []
    out.latestRelease = null
    out.download = null
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
