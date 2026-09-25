/** What `/healthz` answers, and what the status page renders. */
export interface Health {
  /**
   * `degraded` means the pages are being rendered from the committed snapshot
   * because upstream is unreachable — still serving, just with stale numbers.
   * It is deliberately not an unhealthy HTTP status; see server/routes/healthz.
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
  }
}
