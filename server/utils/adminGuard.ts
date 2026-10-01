import { createHash, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'

import { EDITOR_CHALLENGE, parseBasicAuth } from '~~/shared/admin/basicAuth'
import { VIA_ONION, cameOverOnion } from '~~/shared/onion/via'

/**
 * Refuse the post editor to any request that came through the onion gateway.
 *
 * The gateway reaches the site without passing through Caddy — see
 * `shared/onion/via.ts`. Called first by `requireEditor`, which every handler
 * under `server/api/admin/` calls first, rather than a middleware matching on
 * the path: a handler only runs when the router actually resolved to it, so
 * there is no spelling of the URL (case, encoding, doubled slashes) that
 * reaches the handler and skips the check. `test/admin-guard.test.ts` fails if
 * a handler is added without it.
 *
 * 404 rather than 403: over Tor the editor does not exist.
 */
export function refuseOverOnion(event: H3Event): void {
  if (cameOverOnion(event.node.req.headers[VIA_ONION])) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}

/**
 * The editor's own authentication: refuse the onion gateway, then demand the
 * editor's credential.
 *
 * Caddy's basic auth used to be the only lock, which made the lock a property
 * of the network path rather than of the app. The onion gateway was one way
 * around it (closed by `refuseOverOnion`); any other container on
 * `caddy-shared-network` was another, reaching `basicautomation-site:3000`
 * with neither. So the app checks the credential itself — the same user and
 * the same bcrypt hash as Caddy's `admin_auth_gate`, which the browser already
 * sends on every request after Caddy's prompt, so there is still one prompt.
 *
 * Configured by `NUXT_ADMIN_USER` and `NUXT_ADMIN_PASSWORD_HASH`. With no hash
 * the editor does not exist (404) — fail closed — except under `nuxt dev`.
 * Both are required: a hash with no user would accept an empty user name.
 */
export async function requireEditor(event: H3Event): Promise<void> {
  refuseOverOnion(event)

  const { adminUser, adminPasswordHash } = useRuntimeConfig(event)
  if (!adminPasswordHash || !adminUser) {
    if (import.meta.dev) return
    warnUnconfiguredOnce()
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const header = getRequestHeader(event, 'authorization')
  if (header && await accepted(header, adminUser, adminPasswordHash)) return

  setResponseHeader(event, 'WWW-Authenticate', EDITOR_CHALLENGE)
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}

/**
 * bcrypt at Caddy's cost of 14 is ~0.8 s of CPU in pure JS, and the editor
 * makes a request per click. A header that verified is remembered by its
 * SHA-256 for a few minutes, so only the first request of a session pays.
 * Only successes are remembered; a changed password stops matching at the
 * next expiry, and a restart forgets everything.
 */
const REMEMBER_MS = 10 * 60_000
const remembered = new Map<string, number>()

/**
 * Verifications run one at a time, at most a few waiting. A failed guess
 * costs the same 0.8 s as a right one, so without a bound a stream of bad
 * credentials from inside the network is a way to occupy the site's one
 * thread. Beyond the queue, a 401 without trying.
 */
const MAX_WAITING = 4
let waiting = 0
let chain: Promise<unknown> = Promise.resolve()

async function accepted(header: string, user: string, hash: string): Promise<boolean> {
  const key = createHash('sha256').update(header).digest('hex')
  const until = remembered.get(key)
  if (until !== undefined) {
    if (until > Date.now()) return true
    remembered.delete(key)
  }

  const cred = parseBasicAuth(header)
  if (!cred || !sameString(cred.user, user)) return false
  if (waiting >= MAX_WAITING) return false

  waiting++
  const run = chain.then(() => bcrypt.compare(cred.password, hash))
  chain = run.catch(() => false)
  let ok = false
  try {
    ok = await run
  }
  catch {
    ok = false
  }
  finally {
    waiting--
  }

  if (ok) {
    if (remembered.size > 64) remembered.clear()
    remembered.set(key, Date.now() + REMEMBER_MS)
  }
  return ok
}

function sameString(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest()
  const db = createHash('sha256').update(b).digest()
  return timingSafeEqual(da, db)
}

let warned = false
function warnUnconfiguredOnce(): void {
  if (warned) return
  warned = true
  console.warn(JSON.stringify({
    t: new Date().toISOString(),
    level: 'warn',
    event: 'admin.unconfigured',
    message: 'NUXT_ADMIN_USER or NUXT_ADMIN_PASSWORD_HASH is not set, so the post editor is disabled',
  }))
}
