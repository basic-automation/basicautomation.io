/**
 * One structured line per request, on stdout.
 *
 * Docker collects stdout, so JSON here is a log anyone can query without a
 * shipper in the middle: `docker logs basicautomation-site | jq 'select(.status
 * >= 400)'`. One object per line, no multi-line records, nothing that needs a
 * parser to reassemble.
 *
 * The container healthcheck hits `/healthz` every thirty seconds forever and
 * the hashed build assets are not interesting either, so neither is logged —
 * a log that is 90% noise does not get read.
 */

import { VIA_ONION, cameOverOnion } from '~~/shared/onion/via'

const SILENT = [/^\/healthz$/, /^\/_nuxt\//, /^\/fonts\//, /\.(?:ico|png|webp|svg|woff2?)$/]

/**
 * Rendering a page server-side calls the site's own `/api/projects` through
 * Nitro's internal `$fetch`, which never opens a socket. Counted as a request
 * it doubles every page view and invents traffic on routes nobody asked for:
 * one visit to `/` logged as a visit to `/` AND a visit to `/api/projects`,
 * and one 404 on `/projects/nope` logged twice.
 *
 * Measured rather than assumed — an internal call arrives with a mock socket
 * whose `remoteAddress` is the empty string, a real one carries its peer:
 *
 *   internal  { hasSocket: true, remote: "",          ctor: "A"      }
 *   external  { hasSocket: true, remote: "127.0.0.1", ctor: "Socket" }
 *
 * A real request always has a peer address — Nitro listens on TCP here, in the
 * container and out of it, and both Caddy and the onion gateway connect to it —
 * so no peer means internal. The socket alone decides, NOT `x-forwarded-for`:
 * rendering a page forwards the visitor's headers to those internal calls, so
 * every page view that came through Caddy used to log its internal `/api/*`
 * calls as visits too — each uptime check of `/` was three lines.
 */
function isInternal(event: InstanceType<typeof H3Event>): boolean {
  return !event.node?.req?.socket?.remoteAddress
}

/**
 * Which way in: `onion` through the Tor gateway, `web` through Caddy.
 *
 * The gateway marks what it forwards (`shared/onion/via.ts`) and strips
 * `x-forwarded-for`; Caddy always sets `x-forwarded-for`, and would pass a
 * clearnet visitor's forged mark straight through. So it is the mark AND no
 * forwarded address — neither side can be dressed up as the other.
 */
function via(event: InstanceType<typeof H3Event>): 'onion' | 'web' {
  return cameOverOnion(getRequestHeader(event, VIA_ONION)) && !getRequestHeader(event, 'x-forwarded-for')
    ? 'onion'
    : 'web'
}

/**
 * Who asked, and from where — on every line, the failed ones included. The
 * error line used to stop at `via`, so the 404s, nearly all of them scanners,
 * were the one kind of line with no address and no user agent.
 */
function requester(event: InstanceType<typeof H3Event>) {
  return {
    // Caddy terminates TLS and proxies in, so the real client is in the
    // forwarded header; the socket address is Caddy's every time.
    ip: getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    via: via(event),
    ua: getRequestHeader(event, 'user-agent') ?? null,
    ref: getRequestHeader(event, 'referer') ?? null,
  }
}

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    event.context.startedAt = performance.now()
  })

  nitro.hooks.hook('afterResponse', (event) => {
    const path = event.path.split('?')[0] ?? event.path
    if (SILENT.some((re) => re.test(path))) return
    if (isInternal(event)) return

    const started = event.context.startedAt as number | undefined

    console.log(JSON.stringify({
      t: new Date().toISOString(),
      // A HEAD is routed as a GET (see server/middleware/head.ts); the log says
      // what was asked for, not what it was rewritten to.
      method: event.context.originalMethod ?? event.method,
      path: event.path,
      status: getResponseStatus(event),
      ms: started === undefined ? null : Math.round(performance.now() - started),
      ...requester(event),
    }))
  })

  // `afterResponse` does not fire for a request that threw, so without this a
  // 404 — the single most useful thing to grep a web log for — would leave no
  // line carrying a status. Same fields as the line above, plus `level` and
  // `message`, so one jq filter reads both.
  nitro.hooks.hook('error', (error, { event }) => {
    if (event && isInternal(event)) return
    const started = event?.context.startedAt as number | undefined
    const status = (error as { statusCode?: number }).statusCode ?? 500

    console.error(JSON.stringify({
      t: new Date().toISOString(),
      level: status >= 500 ? 'error' : 'warn',
      method: event?.context.originalMethod ?? event?.method ?? null,
      path: event?.path ?? null,
      status,
      ms: started === undefined ? null : Math.round(performance.now() - started),
      ...(event ? requester(event) : { ip: null, via: null, ua: null, ref: null }),
      message: error.message,
    }))
  })
})
