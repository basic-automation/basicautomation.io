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
}
