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
 * should look at. Upstream is cached for fifteen minutes and served stale for
 * six hours, so an hour of snapshot-only answers means several refresh windows
 * have come and gone with GitHub still unreachable.
 */
const STALE_ALERT_AFTER = 60 * 60 * 1000 // 1 hour

const startedAt = Date.now()

let liveCount = 0
let snapshotCount = 0
/** When the current run of snapshot-only answers began. Null while any is live. */
let degradedSince: number | null = null
/** So the alert below is an hourly line, not one per request. */
let lastAlertAt = 0

/** Called once per resolved repo, by the cached fetch in `github.ts`. */
export function recordSource(source: 'live' | 'snapshot'): void {
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
    lastAlertAt = 0
  }
  else {
    snapshotCount++
    degradedSince ??= Date.now()
    alertIfStale()
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
    message: 'serving from the committed snapshot; GitHub has been unreachable for over an hour',
  }))
}

export function health(): Health {
  alertIfStale()

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
