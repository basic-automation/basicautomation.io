/**
 * The onion service's state from what the gateway has left on disk — pure, so
 * the thresholds can be tested without a Tor network. See
 * `server/utils/onionHealth.ts` for where the inputs come from.
 */

export type OnionState = 'off' | 'starting' | 'launched' | 'reachable' | 'unreachable'

/** Three of the gateway's ten-minute self-fetches in a row have not landed. */
export const UNREACHABLE_AFTER_S = 30 * 60

export function onionState(input: {
  /** Epoch ms the gateway was started by this process, or null if it was not. */
  gatewayStartedAt: number | null
  hasAddress: boolean
  /** Epoch ms of the last successful fetch over Tor, or null if none yet. */
  lastReachedAt: number | null
  now: number
}): OnionState {
  const { gatewayStartedAt, hasAddress, lastReachedAt, now } = input
  if (gatewayStartedAt === null) return 'off'
  // From the last success, or — before there has been one — from when the
  // gateway started, which covers a cold Tor bootstrap and the first descriptor
  // upload with room to spare.
  const since = (now - (lastReachedAt ?? gatewayStartedAt)) / 1000
  if (since > UNREACHABLE_AFTER_S) return 'unreachable'
  if (lastReachedAt !== null) return 'reachable'
  return hasAddress ? 'launched' : 'starting'
}

/** While the service stays unreachable, the alert repeats this often. */
export const UNREACHABLE_REALERT_S = 60 * 60

/** What the watcher remembers between two looks at the state. */
export interface OnionWatch {
  /** When this process first saw `unreachable`, or null while it has not. */
  unreachableSince: number | null
  /** When the last `onion.unreachable` line was written. */
  lastAlertAt: number
}

export const QUIET: OnionWatch = { unreachableSince: null, lastAlertAt: 0 }

export type OnionAlert = 'onion.unreachable' | 'onion.recovered' | null

/**
 * Whether this look at the state is worth a log line.
 *
 * `unreachable` only ever reached `/healthz` and the status page, so an outage
 * nobody polled for left nothing behind: on 2026-10-08 the gateway sat for
 * four and a half hours with every guard rejected as down and its descriptor
 * unpublished, and the site's own log said nothing. The healthcheck asks for
 * the state every 30 s, which is what makes it safe to decide here: one line
 * on the way in (the state already means 30 minutes without a fetch over Tor),
 * one an hour while it lasts, and one when a fetch lands again.
 *
 * `launched` and `starting` after an outage are not a recovery — only a fetch
 * over Tor proves one — so they keep the outage open without repeating it.
 */
export function watchOnion(watch: OnionWatch, state: OnionState, now: number): { watch: OnionWatch, alert: OnionAlert } {
  if (state === 'unreachable') {
    const since = watch.unreachableSince ?? now
    if (now - watch.lastAlertAt >= UNREACHABLE_REALERT_S * 1000) {
      return { watch: { unreachableSince: since, lastAlertAt: now }, alert: 'onion.unreachable' }
    }
    return { watch: { ...watch, unreachableSince: since }, alert: null }
  }
  if (watch.unreachableSince === null) return { watch, alert: null }
  if (state === 'reachable') return { watch: QUIET, alert: 'onion.recovered' }
  // `off` means the process is no longer running a gateway at all: nothing
  // left to recover, and nothing to say about it.
  if (state === 'off') return { watch: QUIET, alert: null }
  return { watch, alert: null }
}
