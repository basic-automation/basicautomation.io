/**
 * Live project data, fetched at request time and cached.
 *
 * Every page is rendered per request, but GitHub's anonymous API allows 60
 * requests an hour — so the upstream calls sit behind Nitro's cache and the
 * rendered HTML reads from that. A visitor always gets freshly rendered markup;
 * the numbers inside it are at most `CACHE_TTL` old.
 *
 * If GitHub or crates.io is unreachable, the last live answer this process had
 * is served instead, marked `stale`; and if it has had none since it started,
 * `data/projects.generated.json` — the snapshot committed by `npm run sync`.
 * Either way an upstream outage degrades the numbers rather than the site.
 */

// Nitro's `$fetch` carries typed-route overloads for the app's OWN routes;
// handed an external URL it recurses through every route key and trips the
// type-instantiation depth limit. These calls go off-site, so use ofetch
// directly — it is the same client without the internal-route inference.
import { ofetch } from 'ofetch'
import { ConditionalCache } from '~~/shared/github/conditional'
import { projects, type Project } from '~~/data/projects'
import type { DownloadRelease, EnrichedProject, Release, RepoMeta } from '~~/shared/types/project'
import { absolutize, stripLeadingLogo } from '~~/shared/markdown/readme'
import { normaliseReleases, pickDownload, pickLatest } from '~~/shared/github/releases'
import { refreshPolicy } from '~~/shared/github/budget'
import { paced } from '~~/shared/net/pace'
import snapshot from '~~/data/projects.generated.json'
import { logEvent } from '~~/shared/log/event'

const ORG = 'basic-automation'

/**
 * crates.io requires a user agent that identifies the bot rather than the HTTP
 * client, and asks for contact information with it — its own guidance grades
 * `my_crawler` as "Better" and `my_crawler (my_crawler.com/info)` as "Best",
 * and says a bot without one may be blocked.
 * https://github.com/rust-lang/crates.io/blob/main/src/middleware/no_user_agent_message.txt
 */
const UA = 'basicautomation.io (+https://basicautomation.io)'

/** The other of crates.io's two limits: at most one request a second. */
const cratesIo = paced(1000)

/**
 * GitHub's REST API is versioned by header, and a request without one silently
 * rides the `2022-11-28` default — supported only until 10 March 2028. Pinning
 * it makes the version this site is using a decision rather than a default that
 * will move on its own one day.
 *
 * `2026-03-10` is the current version and has no end-of-support date yet. Its
 * breaking changes touch `GET /repos/{owner}/{repo}` only, and only fields this
 * site has never read: `has_downloads`, `use_squash_pr_title_as_default`,
 * `secret_scanning_push_protection_custom_link_enabled`, and the beta media
 * type's `master_branch`/`user` aliases — and the requests here ask for
 * `application/vnd.github+json`, not that beta type. Checked field by field
 * against both versions live on 2026-09-25: every value this site reads out of
 * the repo, the releases list and the raw README was identical, so the move
 * costs nothing and buys a version that is not counting down.
 * https://docs.github.com/en/rest/about-the-rest-api/api-versions
 * https://docs.github.com/en/rest/about-the-rest-api/breaking-changes
 */
const GH_API_VERSION = '2026-03-10'

/**
 * How long upstream responses are reused. Short enough to feel live, long
 * enough that the site does not out-run GitHub's rate limit.
 *
 * Computed from the project count by `refreshPolicy` rather than typed in,
 * because a typed TTL is right only for the number of repos it was worked out
 * against: 20 minutes was 54 calls an hour for six repos, and Nanna made it 63.
 * See `shared/github/budget.ts` for the arithmetic, and `test/budget.test.ts`
 * for the numbers it gives today.
 *
 * It also depends on whether `BASICAUTOMATION_GITHUB_TOKEN` reached the
 * container: anonymously the budget is 54 of 60 and seven repos refresh every
 * 30 minutes; with a token it is 300 of 5,000 and they refresh every 5. The
 * token is read once, here, because Nitro fixes `maxAge` when the cached
 * function is defined — the container is restarted to change it anyway.
 *
 * Adding a call per repo means changing `CALLS_PER_REPO` there too.
 */
export const githubRefresh = refreshPolicy(projects.length, !!token())
const CACHE_TTL = githubRefresh.ttl
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
type SnapshotRepo = Omit<RepoMeta, 'source' | 'releases' | 'download'>
  & { releases?: Release[], download?: DownloadRelease | null }

const snapshotRepos = (snapshot as { repos: Record<string, SnapshotRepo> }).repos ?? {}

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
  const headers: Record<string, string> = {
    'user-agent': UA,
    'accept': accept,
    'x-github-api-version': GH_API_VERSION,
  }
  const t = token()
  if (t) headers.authorization = `Bearer ${t}`

  // Conditional: a `304` to an authorized request costs no quota, and most
  // refreshes change nothing. See `shared/github/conditional.ts`.
  const key = `${accept} ${path}`
  const etag = conditional.etag(key)
  if (etag) headers['if-none-match'] = etag

  let notModified = false
  try {
    const res = await ofetch.raw(`https://api.github.com${path}`, {
      headers,
      timeout: 8000,
      responseType: responseType as 'json',
      // Every response, refusals included: ofetch runs this before it decides
      // the status is an error, and a 403 is exactly when the numbers matter.
      onResponse: ({ response }) => recordRateLimit(response.headers),
    })
    // ofetch only throws from 400 up, so a `304` arrives here as a "success"
    // with no body; `answer` turns it back into the stored one.
    const answer = conditional.answer(key, res.status, res.headers.get('etag'), res._data)
    notModified = answer.notModified
    return answer.body as T
  }
  finally {
    recordGithubCall(notModified)
  }
}

const conditional = new ConditionalCache()

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
    download: null,
  }

  // README, latest release and crate data are all optional — a failure in any
  // one of them leaves that field empty rather than sinking the whole repo.
  const [readme, release, crate] = await Promise.allSettled([
    gh<string>(`/repos/${ORG}/${repo}/readme`, 'application/vnd.github.raw', 'text'),
    // One list call, not `releases/latest` plus a history call: `latestRelease`
    // and the download links are derived from the same page — each release in
    // it carries its assets — so neither costs an extra request.
    gh<any[]>(`/repos/${ORG}/${repo}/releases?per_page=${MAX_RELEASES}`),
    project.crate
      ? cratesIo(() => ofetch<any>(`https://crates.io/api/v1/crates/${project.crate}`, {
          headers: { 'user-agent': UA },
          timeout: 8000,
        }))
      : Promise.reject(new Error('not a crate')),
  ])

  // Each of these is allowed to fail without sinking the repo — but a failure
  // is recorded rather than swallowed, so a page rendering with no README is
  // something the status page can say out loud instead of something only a
  // visitor notices.
  const incomplete: NonNullable<RepoMeta['incomplete']> = []

  if (readme.status === 'fulfilled' && typeof readme.value === 'string') {
    out.readmeHtml = await renderMarkdown(
      absolutize(stripLeadingLogo(readme.value), ORG, repo, defaultBranch),
    )
  }
  else {
    incomplete.push('readme')
  }

  if (release.status === 'fulfilled' && Array.isArray(release.value)) {
    out.releases = normaliseReleases(release.value)
    out.latestRelease = pickLatest(out.releases)
    out.download = pickDownload(release.value)
  }
  else {
    incomplete.push('releases')
  }

  if (crate.status === 'fulfilled' && crate.value?.crate && project.crate) {
    out.crateVersion = crate.value.crate.max_stable_version || crate.value.crate.max_version
    out.crateDownloads = crate.value.crate.downloads ?? 0
    out.crateUrl = `https://crates.io/crates/${project.crate}`
    out.docsUrl = `https://docs.rs/${project.crate}`
  }
  // A project that is not published to crates.io has nothing to fetch, and a
  // rejection there is this function's own `not a crate`, not an outage.
  else if (project.crate) {
    incomplete.push('crate')
  }

  if (incomplete.length) out.incomplete = incomplete

  return out
}

function fromSnapshot(repo: string): RepoMeta | null {
  const s = snapshotRepos[repo]
  // A snapshot written before `releases` or `download` existed has no such
  // key; the strip and the download section render nothing rather than
  // throwing on an undefined.
  return s ? { ...s, source: 'snapshot', releases: s.releases ?? [], download: s.download ?? null } : null
}

/**
 * Each repo's last successful answer, kept for when a refresh fails.
 *
 * Nitro caches whatever the function below returns, fallback or not. When it
 * fell straight back to the snapshot, one timed-out refresh replaced a live
 * entry with data from the last `npm run sync` for a whole refresh window —
 * on 2026-10-02 that would have taken Skidbladnir's download section from
 * v1.3.0 back to the snapshot's v1.1.0. The last live answer is never older
 * than the snapshot and usually much newer, so it goes first.
 */
const lastLive = new Map<string, RepoMeta>()

/**
 * Cached across requests by Nitro. `getKey` keeps one entry per repo so a
 * single slow project page doesn't invalidate the landing page's data.
 */
const cachedRepo = defineCachedFunction(
  async (project: Project): Promise<RepoMeta | null> => {
    try {
      const meta = await fetchRepo(project)
      lastLive.set(project.repo, meta)
      recordSource('live')
      recordIncomplete(project.repo, meta.incomplete ?? [])
      return meta
    }
    catch (err) {
      const kept = lastLive.get(project.repo)
      logEvent('warn', 'upstream.fetch_failed', `${project.repo} fetch failed, using ${kept ? `the last live answer, from ${kept.fetchedAt}` : 'the snapshot'}`, {
        repo: project.repo,
        fallback: kept ? 'stale' : 'snapshot',
        ...(kept ? { staleFrom: kept.fetchedAt } : {}),
        error: (err as Error).message,
      })
      if (kept) {
        recordSource('stale')
        return { ...kept, source: 'stale' }
      }
      const meta = fromSnapshot(project.repo)
      // Only a fetch that actually produced a page's worth of data counts as
      // degraded. A repo with no snapshot either is a different problem.
      if (meta) recordSource('snapshot')
      return meta
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
