/** What `/healthz` answers, and what the status page renders. */
export interface Health {
  /**
   * `degraded` means the pages are being rendered from the committed snapshot
   * because upstream is unreachable, or that a page rendered live with part of
   * it missing — still serving, just with stale or absent numbers. It is
   * deliberately not an unhealthy HTTP status; see server/routes/healthz.
   */
  status: 'ok' | 'degraded'
  uptimeSeconds: number
  startedAt: string
  data: {
    /** 'live' until a fetch falls back; 'snapshot' until one succeeds again. */
    source: 'live' | 'snapshot' | 'unknown'
    liveResolutions: number
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
  /** How long a repo's data is reused before it is fetched again — see `shared/github/budget.ts`. */
  refreshSeconds: number
  /** The worst case that interval allows: every repo refreshed as often as it can be, for an hour. */
  budgetedCallsPerHour: number
}
