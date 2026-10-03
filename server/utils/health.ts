/**
 * What the process knows about itself: how long it has been up, and whether the
 * pages it is rendering are built on live upstream data or on the committed
 * fallback snapshot.
 *
 * The distinction matters operationally. A site serving from the snapshot is
 * still serving — the copy, the layout and the links are all correct, and only
 * the numbers are stale — so it must never fail a healthcheck and get itself
 * restarted. It is degraded, not down, and the two need different words.
 */

import type { Health } from '~~/shared/types/health'

/**
 * Stale for this long stops being a blip and starts being something someone
 * should look at. Upstream is cached for `githubRefresh.ttl` — at most 30
 * minutes at seven projects — and served stale for six hours, so an hour of
 * snapshot-only answers means at least two refresh windows have come and gone
 * with GitHub still unreachable.
 */
const STALE_ALERT_AFTER = 60 * 60 * 1000 // 1 hour

const startedAt = Date.now()

let liveCount = 0
let staleCount = 0
let snapshotCount = 0
/** When the current run of fallback answers began. Null while any is live. */
let degradedSince: number | null = null
/** Whether any answer in that run came from the committed snapshot. */
let degradedToSnapshot = false
/** So the alert below is an hourly line, not one per request. */
let lastAlertAt = 0
/**
 * Per repo, which optional upstream calls came back empty on its last live
 * resolution. A repo that resolved completely is deleted rather than kept with
 * an empty list, so "is anything missing" is `incomplete.size`.
 */
const incomplete = new Map<string, string[]>()

/** The last `x-ratelimit-*` GitHub sent, and when. */
let rateLimit: { limit: number, remaining: number, reset: number, at: number } | null = null

/**
 * Called by `github.ts` with the headers of every GitHub response it gets,
 * refusals included — a 403 carries the headers that explain it.
 *
 * Without this, the only sign that the site had spent its quota was a README
 * missing from a page. It is also shared: every process on this host's public
 * address draws on the same anonymous 60, so a local build being tested can
 * empty it for the deployed one.
 */
export function recordRateLimit(headers: Headers | undefined): void {
  if (!headers) return
  const limit = Number(headers.get('x-ratelimit-limit'))
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (!headers.has('x-ratelimit-limit') || [limit, remaining, reset].some(Number.isNaN)) return

  if (remaining === 0 && rateLimit?.remaining !== 0) {
    console.warn(JSON.stringify({
      t: new Date().toISOString(),
      level: 'warn',
      event: 'upstream.rate_limited',
      limit,
      resetsAt: new Date(reset * 1000).toISOString(),
      message: `GitHub quota spent (${limit}/hour); refusals until it resets`,
    }))
  }
  rateLimit = { limit, remaining, reset, at: Date.now() }
}

let githubCalls = 0
let githubNotModified = 0

/**
 * Called once per GitHub request, by `gh()` in `github.ts`. `notModified` is a
 * `304` to a conditional request — one that cost no quota.
 */
export function recordGithubCall(notModified: boolean): void {
  githubCalls++
  if (notModified) githubNotModified++
}

/** Called once per resolved repo, by the cached fetch in `github.ts`. */
export function recordSource(source: 'live' | 'stale' | 'snapshot'): void {
  if (source === 'live') {
    liveCount++
    if (degradedSince !== null) {
      console.warn(JSON.stringify({
        t: new Date().toISOString(),
        level: 'warn',
        event: 'upstream.recovered',
        degradedForSeconds: Math.round((Date.now() - degradedSince) / 1000),
        message: 'upstream reachable again; serving live data',
      }))
    }
    degradedSince = null
    degradedToSnapshot = false
    lastAlertAt = 0
  }
  else {
    if (source === 'stale') staleCount++
    else {
      snapshotCount++
      degradedToSnapshot = true
    }
    degradedSince ??= Date.now()
    alertIfStale()
  }
}

/**
 * Called once per live repo resolution, with whatever GitHub refused.
 *
 * `source: 'live'` only ever meant the repo call itself succeeded. Its README
 * and its release history are separate calls, each allowed to fail without
 * sinking the repo — so a page could render live, with no README and no release
 * strip, while `/healthz` and the status page both said everything was fine.
 * Usually it is the anonymous rate limit, which is exactly the thing an
 * operator wants told rather than left to notice.
 */
export function recordIncomplete(repo: string, missing: string[]): void {
  const had = incomplete.has(repo)
  if (missing.length) {
    if (!had || incomplete.get(repo)!.join() !== missing.join()) {
      console.warn(JSON.stringify({
        t: new Date().toISOString(),
        level: 'warn',
        event: 'upstream.incomplete',
        repo,
        missing,
        message: `${repo} resolved live without ${missing.join(' or ')}`,
      }))
    }
    incomplete.set(repo, missing)
  }
  else if (had) {
    incomplete.delete(repo)
    console.warn(JSON.stringify({
      t: new Date().toISOString(),
      level: 'warn',
      event: 'upstream.complete',
      repo,
      message: `${repo} resolved live and complete again`,
    }))
  }
}

/**
 * One line an hour, for as long as the site is answering from the snapshot.
 * It shares the request log's shape, so whatever reads that reads this too and
 * nothing new has to be wired up to notice.
 */
function alertIfStale(): void {
  if (degradedSince === null) return
  const now = Date.now()
  const degradedFor = now - degradedSince
  if (degradedFor < STALE_ALERT_AFTER) return
  if (now - lastAlertAt < STALE_ALERT_AFTER) return

  lastAlertAt = now
  console.warn(JSON.stringify({
    t: new Date().toISOString(),
    level: 'warn',
    event: 'upstream.stale',
    degradedSince: new Date(degradedSince).toISOString(),
    degradedForSeconds: Math.round(degradedFor / 1000),
    to: degradedToSnapshot ? 'snapshot' : 'stale',
    message: degradedToSnapshot
      ? 'serving from the committed snapshot; GitHub has been unreachable for over an hour'
      : 'serving the last live answers; GitHub has been unreachable for over an hour',
  }))
}

export async function health(): Promise<Health> {
  alertIfStale()

  const now = Date.now()
  const onion = await onionHealth(now)
  const source = degradedSince !== null
    ? (degradedToSnapshot ? 'snapshot' : 'stale')
    : liveCount > 0 ? 'live' : 'unknown'

  return {
    // Degraded is a 200. The healthcheck restarts a process that cannot serve,
    // and a process serving from the snapshot — or one serving a page with its
    // README missing — can serve perfectly well.
    status: degradedSince === null && incomplete.size === 0 && onion.state !== 'unreachable' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round((now - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    data: {
      source,
      liveResolutions: liveCount,
      staleResolutions: staleCount,
      snapshotResolutions: snapshotCount,
      degradedSince: degradedSince === null ? null : new Date(degradedSince).toISOString(),
      degradedForSeconds: degradedSince === null ? null : Math.round((now - degradedSince) / 1000),
      incomplete: [...incomplete]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([repo, missing]) => ({ repo, missing })),
    },
    github: rateLimit && {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetsAt: new Date(rateLimit.reset * 1000).toISOString(),
      resetsInSeconds: Math.max(0, Math.round(rateLimit.reset - now / 1000)),
      observedAt: new Date(rateLimit.at).toISOString(),
    },
    githubCalls: { made: githubCalls, notModified: githubNotModified },
    onion,
    authenticated: githubRefresh.authenticated,
    refreshSeconds: githubRefresh.ttl,
    budgetedCallsPerHour: githubRefresh.callsPerHour,
  }
}
