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
