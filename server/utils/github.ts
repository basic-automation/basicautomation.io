/**
 * Live project data, fetched at request time and cached.
 *
 * Every page is rendered per request, but GitHub's anonymous API allows 60
 * requests an hour — so the upstream calls sit behind Nitro's cache and the
 * rendered HTML reads from that. A visitor always gets freshly rendered markup;
 * the numbers inside it are at most `CACHE_TTL` old.
 *
 * If GitHub or crates.io is unreachable, `data/projects.generated.json` — the
 * snapshot committed by `npm run sync` — is served instead, so an upstream
 * outage degrades the numbers rather than the site.
 */

import { Marked } from 'marked'
// Nitro's `$fetch` carries typed-route overloads for the app's OWN routes;
// handed an external URL it recurses through every route key and trips the
// type-instantiation depth limit. These calls go off-site, so use ofetch
// directly — it is the same client without the internal-route inference.
import { ofetch } from 'ofetch'
import { projects, type Project } from '~~/data/projects'
import type { EnrichedProject, Release, RepoMeta } from '~~/shared/types/project'
import { createSlugger } from '~~/shared/markdown/slug'
import snapshot from '~~/data/projects.generated.json'

const ORG = 'basic-automation'
const UA = 'basicautomation.io'

/** How long upstream responses are reused. Short enough to feel live. */
const CACHE_TTL = 60 * 15 // 15 minutes
/** Serve stale while revalidating for this much longer, so no visitor waits. */
const STALE_TTL = 60 * 60 * 6 // 6 hours
/**
 * How many releases the changelog strip keeps. One list call replaces the old
 * `releases/latest` call, so the history is free against the rate limit — but
 * the payload still has to stay small enough to hydrate without thinking.
 */
const MAX_RELEASES = 5

/**
 * The snapshot on disk was written by whatever version of `npm run sync` last
 * ran, so a field added since then may simply be absent. Anything optional here
 * is a field `fromSnapshot` has to fill in — declaring it that way means adding
 * a field without a fallback fails the typecheck instead of the render.
 */
type SnapshotRepo = Omit<RepoMeta, 'source' | 'releases'> & { releases?: Release[] }

const snapshotRepos = (snapshot as { repos: Record<string, SnapshotRepo> }).repos ?? {}

/**
 * README code fences go through the same highlighter as the site's own
 * examples, so a repo's code reads the same as the code beside it. Shiki is
 * async to initialise, so fences are collected on the first pass and swapped in
 * on a second — `marked` itself stays synchronous.
 *
 * Headings carry GitHub's own anchor, so a README's table of contents still
 * works once it is rendered here. The slugger is per-document: duplicate
 * heading text numbers from 1 within one README, not across all of them.
 */
async function renderMarkdown(md: string): Promise<string> {
  const fences: { lang: string | undefined, code: string }[] = []
  const slug = createSlugger()

  const collecting = new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      code({ text, lang }) {
        fences.push({ lang, code: text })
        return `\u0000FENCE${fences.length - 1}\u0000`
      },
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

  const html = collecting.parse(md) as string
  if (!fences.length) return html

  const rendered = await Promise.all(fences.map((f) => highlight(f.code, f.lang)))
  return html.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => rendered[Number(i)] ?? '')
}

function token(): string {
  const config = useRuntimeConfig()
  return (config.githubToken as string) || ''
}

async function gh<T>(
  path: string,
  accept = 'application/vnd.github+json',
  /**
   * GitHub serves raw files as `application/vnd.github.raw`, which ofetch reads
   * as a JSON media type and quietly parses into `{}`. Anything not returning
   * real JSON has to say so explicitly.
   */
  responseType: 'json' | 'text' = 'json',
): Promise<T> {
  const headers: Record<string, string> = { 'user-agent': UA, accept }
  const t = token()
  if (t) headers.authorization = `Bearer ${t}`
  return ofetch(`https://api.github.com${path}`, {
    headers,
    timeout: 8000,
    responseType: responseType as 'json',
  }) as Promise<T>
}

/**
 * READMEs address their own repo with relative paths. Rewrite them to absolute
 * URLs — raw.githubusercontent for images, the blob view for links.
 */
function absolutize(markdown: string, repo: string, branch: string): string {
  const raw = `https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/`
  const blob = `https://github.com/${ORG}/${repo}/blob/${branch}/`
  const isRelative = (u: string) => u && !/^([a-z]+:)?\/\//i.test(u) && !u.startsWith('#') && !u.startsWith('data:')
  const clean = (u: string) => u.replace(/^\.\//, '').replace(/^\//, '')

  return markdown
    .replace(/(!\[[^\]]*\]\()([^)\s]+)(\)|\s)/g, (m, head, url, tail) =>
      isRelative(url) ? `${head}${raw}${clean(url)}${tail}` : m)
    .replace(/(?<!!)(\[[^\]]*\]\()([^)\s]+)(\)|\s)/g, (m, head, url, tail) =>
      isRelative(url) ? `${head}${blob}${clean(url)}${tail}` : m)
    .replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi, (m, head, url, tail) =>
      isRelative(url) ? `${head}${raw}${clean(url)}${tail}` : m)
}

/** The page prints its own title and tagline; don't repeat the README's logo. */
function stripLeadingLogo(markdown: string): string {
  return markdown
    .replace(/^\s*!\[[^\]]*\]\([^)]*(?:logo|banner)[^)]*\)\s*/i, '')
    .replace(/^(?:\s*<br\s*\/?>\s*)+/i, '')
}

/**
 * GitHub's releases list, trimmed to what the strip prints. Drafts are dropped:
 * they are not public, and the site only shows what a visitor could download.
 */
function normaliseReleases(raw: any[]): Release[] {
  return raw
    .filter((r) => r && !r.draft && r.tag_name)
    .map((r) => ({
      tag: r.tag_name as string,
      // A release whose title is just its tag says nothing twice.
      title: r.name && r.name !== r.tag_name ? (r.name as string) : null,
      url: r.html_url as string,
      publishedAt: (r.published_at || r.created_at) as string,
      prerelease: !!r.prerelease,
    }))
}

/**
 * The newest full release, matching what `/releases/latest` used to return:
 * drafts and pre-releases don't count. A repo that has only tagged
 * pre-releases gets null here and relies on the strip to show its history.
 */
function pickLatest(releases: Release[]): RepoMeta['latestRelease'] {
  const r = releases.find((x) => !x.prerelease)
  return r ? { tag: r.tag, url: r.url, publishedAt: r.publishedAt } : null
}

async function fetchRepo(project: Project): Promise<RepoMeta> {
  const { repo } = project

  const meta = await gh<any>(`/repos/${ORG}/${repo}`)
  const defaultBranch: string = meta.default_branch || 'main'

  const out: RepoMeta = {
    repo,
    fetchedAt: new Date().toISOString(),
    source: 'live',
    description: meta.description ?? null,
    htmlUrl: meta.html_url,
    homepage: meta.homepage || null,
    language: meta.language ?? null,
    topics: meta.topics ?? [],
    stars: meta.stargazers_count ?? 0,
    forks: meta.forks_count ?? 0,
    openIssues: meta.open_issues_count ?? 0,
    license:
      meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION'
        ? meta.license.spdx_id
        : null,
    defaultBranch,
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    archived: !!meta.archived,
    readmeHtml: null,
    latestRelease: null,
    releases: [],
  }

  // README, latest release and crate data are all optional — a failure in any
  // one of them leaves that field empty rather than sinking the whole repo.
  const [readme, release, crate] = await Promise.allSettled([
    gh<string>(`/repos/${ORG}/${repo}/readme`, 'application/vnd.github.raw', 'text'),
    // One list call, not `releases/latest` plus a history call: `latestRelease`
    // is derived from the same page, so the changelog costs no extra request.
    gh<any[]>(`/repos/${ORG}/${repo}/releases?per_page=${MAX_RELEASES}`),
    project.crate
      ? ofetch<any>(`https://crates.io/api/v1/crates/${project.crate}`, {
          headers: { 'user-agent': UA },
          timeout: 8000,
        })
      : Promise.reject(new Error('not a crate')),
  ])

  if (readme.status === 'fulfilled' && typeof readme.value === 'string') {
    out.readmeHtml = await renderMarkdown(
      absolutize(stripLeadingLogo(readme.value), repo, defaultBranch),
    )
  }

  if (release.status === 'fulfilled' && Array.isArray(release.value)) {
    out.releases = normaliseReleases(release.value)
    out.latestRelease = pickLatest(out.releases)
  }

  if (crate.status === 'fulfilled' && crate.value?.crate && project.crate) {
    out.crateVersion = crate.value.crate.max_stable_version || crate.value.crate.max_version
    out.crateDownloads = crate.value.crate.downloads ?? 0
    out.crateUrl = `https://crates.io/crates/${project.crate}`
    out.docsUrl = `https://docs.rs/${project.crate}`
  }

  return out
}

function fromSnapshot(repo: string): RepoMeta | null {
  const s = snapshotRepos[repo]
  // A snapshot written before `releases` existed has no such key; the strip
  // renders nothing rather than throwing on an undefined array.
  return s ? { ...s, source: 'snapshot', releases: s.releases ?? [] } : null
}

/**
 * Cached across requests by Nitro. `getKey` keeps one entry per repo so a
 * single slow project page doesn't invalidate the landing page's data.
 */
const cachedRepo = defineCachedFunction(
  async (project: Project): Promise<RepoMeta | null> => {
    try {
      return await fetchRepo(project)
    }
    catch (err) {
      console.warn(`[github] ${project.repo} fetch failed, using snapshot:`, (err as Error).message)
      return fromSnapshot(project.repo)
    }
  },
  {
    name: 'repo',
    maxAge: CACHE_TTL,
    staleMaxAge: STALE_TTL,
    swr: true,
    getKey: (project: Project) => project.repo,
  },
)

/** Every project, in display order, with live metadata attached. */
export async function getProjects(): Promise<EnrichedProject[]> {
  const ordered = [...projects].sort((a, b) => a.order - b.order)
  return Promise.all(
    ordered.map(async (p) => ({ ...p, meta: await cachedRepo(p) })),
  )
}

/** One project by slug, or null if there is no such slug. */
export async function getProject(slug: string): Promise<EnrichedProject | null> {
  const p = projects.find((x) => x.slug === slug)
  if (!p) return null
  return { ...p, meta: await cachedRepo(p) }
}
