import type { H3Event } from 'h3'

import { VIA_ONION, cameOverOnion } from '~~/shared/onion/via'

/**
 * Refuse the post editor to any request that came through the onion gateway.
 *
 * Caddy's basic auth is what guards `/admin` and `/api/admin/*`, and the
 * gateway reaches the site without passing through Caddy — see
 * `shared/onion/via.ts`. Every handler under `server/api/admin/` calls this
 * first, rather than a middleware matching on the path: a handler only runs
 * when the router actually resolved to it, so there is no spelling of the URL
 * (case, encoding, doubled slashes) that reaches the handler and skips the
 * check. `test/admin-guard.test.ts` fails if a handler is added without it.
 *
 * 404 rather than 403: over Tor the editor does not exist.
 */
export function refuseOverOnion(event: H3Event): void {
  if (cameOverOnion(event.node.req.headers[VIA_ONION])) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}
