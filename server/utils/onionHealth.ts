/**
 * Whether the onion service is answering, for `/healthz` and the status page.
 *
 * The gateway is started by the site (`server/plugins/onion-gateway.ts`), so a
 * gateway that dies takes the container with it and the healthcheck notices.
 * What nothing noticed was a gateway that is running but not reachable — a
 * descriptor that never published, or rendezvous circuits that stopped
 * completing. Only the onyums page showed that, as a frame that went stale.
 *
 * The evidence is the gateway's own self-fetch: every ten minutes it fetches
 * this site through a real circuit to its own address and writes the result to
 * disk only if it came back 200. So the age of that file is the time since the
 * service was last proven reachable from the Tor network.
 */
import type { Health } from '~~/shared/types/health'
import { onionState } from '~~/shared/onion/state'

let gatewayStartedAt: number | null = null

/** Called by the plugin that starts the gateway. Never called means `off`. */
export function markGatewayStarted() {
  gatewayStartedAt = Date.now()
}

export async function onionHealth(now = Date.now()): Promise<Health['onion']> {
  if (gatewayStartedAt === null) {
    return { state: 'off', address: null, lastReachedAt: null, lastReachedSecondsAgo: null, circuitMs: null }
  }

  const [address, snapshot] = await Promise.all([onionAddress(), onionSnapshot()])
  const lastReached = snapshot ? snapshot.fetchedAt * 1000 : null
  const state = onionState({ gatewayStartedAt, hasAddress: !!address, lastReachedAt: lastReached, now })

  return {
    state,
    address,
    lastReachedAt: lastReached === null ? null : new Date(lastReached).toISOString(),
    lastReachedSecondsAgo: lastReached === null ? null : Math.max(0, Math.round((now - lastReached) / 1000)),
    circuitMs: snapshot?.elapsedMs ?? null,
  }
}
