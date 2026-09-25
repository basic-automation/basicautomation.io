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

const startedAt = Date.now()

let liveCount = 0
let snapshotCount = 0
/** When the current run of snapshot-only answers began. Null while any is live. */
let degradedSince: number | null = null

/** Called once per resolved repo, by the cached fetch in `github.ts`. */
export function recordSource(source: 'live' | 'snapshot'): void {
  if (source === 'live') {
    liveCount++
    degradedSince = null
  }
  else {
    snapshotCount++
    degradedSince ??= Date.now()
  }
}

export interface Health {
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

export function health(): Health {
  const now = Date.now()
  const source = degradedSince !== null
    ? 'snapshot'
    : liveCount > 0 ? 'live' : 'unknown'

  return {
    // Degraded is a 200. The healthcheck restarts a process that cannot serve,
    // and a process serving from the snapshot can serve perfectly well.
    status: degradedSince === null ? 'ok' : 'degraded',
    uptimeSeconds: Math.round((now - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    data: {
      source,
      liveResolutions: liveCount,
      snapshotResolutions: snapshotCount,
      degradedSince: degradedSince === null ? null : new Date(degradedSince).toISOString(),
      degradedForSeconds: degradedSince === null ? null : Math.round((now - degradedSince) / 1000),
    },
  }
}
