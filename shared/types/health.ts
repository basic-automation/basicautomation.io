import type { OnionState } from '~~/shared/onion/state'

/** What `/healthz` answers, and what the status page renders. */
export interface Health {
  /**
   * `degraded` means the pages are being rendered from fallback data — the
   * last live answer, or the committed snapshot — because upstream is
   * unreachable, that a page rendered live with part of
   * it missing, or that the onion service has not been reachable over Tor for
   * half an hour — still serving, just not all of it. It is
   * deliberately not an unhealthy HTTP status; see server/routes/healthz.
   */
  status: 'ok' | 'degraded'
  uptimeSeconds: number
  startedAt: string
  data: {
    /**
     * 'live' until a fetch falls back. Then, until one succeeds again,
     * 'snapshot' if any page has been served from the committed snapshot, or
     * 'stale' if every fallback was to the last live answer the process had.
     */
    source: 'live' | 'stale' | 'snapshot' | 'unknown'
    liveResolutions: number
    /** Failed refreshes answered with the last live data this process had. */
    staleResolutions: number
    snapshotResolutions: number
    degradedSince: string | null
    degradedForSeconds: number | null
    /**
     * Repos whose page rendered, from live data, with a part of it missing —
     * a README or a release history that GitHub refused. Usually the anonymous
     * rate limit. Empty is the healthy state.
     */
    incomplete: { repo: string, missing: string[] }[]
  }
  /**
   * GitHub's own account of the rate limit, from the `x-ratelimit-*` headers on
   * the most recent response — including a refusal, which is when it matters.
   * Null until the process has made a call.
   */
  github: {
    /** 60 anonymous, 5,000 with a token. */
    limit: number
    remaining: number
    resetsAt: string
    /** Measured on the server, so the status page never computes it from its own clock. */
    resetsInSeconds: number
    observedAt: string
  } | null
  /**
   * GitHub requests since this process started, and how many were answered
   * `304 Not Modified` to a conditional request — which, authorized, cost no
   * quota. See `shared/github/conditional.ts`.
   */
  githubCalls: {
    made: number
    notModified: number
  }
  /**
   * The onion service, judged by the gateway's own self-fetch over Tor.
   * `off` where no gateway runs (outside the image, or `ONION_ENABLED=0`);
   * `starting` until it has an address; `launched` until the first fetch over
   * Tor succeeds; `reachable` while one has in the last 30 minutes; and
   * `unreachable` once none has for 30 minutes, which makes `status` degraded.
   */
  onion: {
    state: OnionState
    address: string | null
    lastReachedAt: string | null
    lastReachedSecondsAgo: number | null
    /** How long the last successful fetch over Tor took, end to end. */
    circuitMs: number | null
  }
  /** Whether the process holds a GitHub token — it decides the two numbers below. */
  authenticated: boolean
  /** How long a repo's data is reused before it is fetched again — see `shared/github/budget.ts`. */
  refreshSeconds: number
  /** The worst case that interval allows: every repo refreshed as often as it can be, for an hour. */
  budgetedCallsPerHour: number
}
