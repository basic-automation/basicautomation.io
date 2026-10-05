/**
 * The site as it came back over Tor.
 *
 * The onion gateway (`onion/`) fetches this site through a real rendezvous
 * circuit to its own `.onion` address every ten minutes and writes what came
 * back here. The onyums page renders it in a browser frame — the point being
 * that the page shows the thing working rather than asserting that it does.
 *
 * Read from disk for the same reason as the address itself: the first snapshot
 * does not exist until Tor has bootstrapped and the descriptor has published,
 * which is minutes after the site starts and long after its environment is
 * fixed. The file appears when it appears.
 */
import type { H3Event } from 'h3'
import { readFile } from 'node:fs/promises'
import { logEvent } from '~~/shared/log/event'

const SNAPSHOT_FILE = process.env.ONION_SNAPSHOT_FILE || '/run/onion/snapshot.json'

/** A v3 onion address: 56 characters of base32, then `.onion`. */
const V3_ONION = /^[a-z2-7]{56}\.onion$/

/**
 * Re-read this often. Ten times finer than the gateway's own interval, so a new
 * snapshot shows up promptly without the page stat-ing a file per request.
 */
const TTL_MS = 60_000

export interface OnionSnapshot {
  address: string
  status: number
  bytes: number
  elapsedMs: number
  /** Unix seconds. */
  fetchedAt: number
  html: string
}

/**
 * The build the snapshot was captured from, out of the payload Nuxt inlines.
 *
 * The document is rendered in a frame served from this origin, so its
 * stylesheet, fonts and chunks are fetched from *this* build. A snapshot taken
 * from a different build references asset URLs this one does not have, they
 * 404, and the frame renders as unstyled markup — which is a worse outcome than
 * no frame, because it looks like the site is broken rather than like the demo
 * is warming up.
 */
function buildIdOf(html: string): string | null {
  return html.match(/buildId:"([^"]+)"/)?.[1] ?? null
}

let cached: { value: OnionSnapshot | null, at: number } | null = null

/**
 * Validated rather than merely parsed: every field of this is rendered into a
 * page as a claim about a live system, and `html` is served into an iframe. A
 * half-written or malformed file must produce nothing, not a broken frame.
 */
function parse(raw: string): OnionSnapshot | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  }
  catch {
    return null
  }

  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>

  if (typeof d.address !== 'string' || !V3_ONION.test(d.address)) return null
  if (typeof d.status !== 'number' || d.status !== 200) return null
  if (typeof d.bytes !== 'number' || d.bytes <= 0) return null
  if (typeof d.elapsedMs !== 'number' || d.elapsedMs < 0) return null
  if (typeof d.fetchedAt !== 'number' || d.fetchedAt <= 0) return null
  if (typeof d.html !== 'string' || !d.html.trim()) return null

  return { address: d.address, status: d.status, bytes: d.bytes, elapsedMs: d.elapsedMs, fetchedAt: d.fetchedAt, html: d.html }
}

/**
 * The snapshot, but only if this build can actually render it.
 *
 * Everything that shows the frame goes through here rather than `onionSnapshot`
 * directly, so the check cannot be forgotten in one of the two places.
 */
export async function renderableSnapshot(event: H3Event): Promise<OnionSnapshot | null> {
  const snapshot = await onionSnapshot()
  if (!snapshot) return null

  const captured = buildIdOf(snapshot.html)
  const current = useRuntimeConfig(event).app?.buildId
  if (captured && current && captured !== current) {
    // Normal for a few minutes after a deploy, and permanent in dev, where the
    // snapshot necessarily comes from somewhere else.
    return null
  }

  return snapshot
}

export async function onionSnapshot(): Promise<OnionSnapshot | null> {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return cached.value

  let value: OnionSnapshot | null = null
  try {
    value = parse(await readFile(SNAPSHOT_FILE, 'utf8'))
    if (!value) logEvent('warn', 'onion.snapshot_invalid', `${SNAPSHOT_FILE} is not a usable snapshot; ignoring`, { file: SNAPSHOT_FILE })
  }
  catch {
    // Absent is the normal state for the first few minutes after a cold start,
    // and the permanent state anywhere the gateway is not running.
    value = null
  }

  cached = { value, at: now }
  return value
}
