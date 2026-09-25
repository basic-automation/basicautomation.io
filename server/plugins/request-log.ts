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

const SILENT = [/^\/healthz$/, /^\/_nuxt\//, /^\/fonts\//, /\.(?:ico|png|webp|svg|woff2?)$/]

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    event.context.startedAt = performance.now()
  })

  nitro.hooks.hook('afterResponse', (event) => {
    const path = event.path.split('?')[0] ?? event.path
    if (SILENT.some((re) => re.test(path))) return

    const started = event.context.startedAt as number | undefined

    console.log(JSON.stringify({
      t: new Date().toISOString(),
      method: event.method,
      path: event.path,
      status: getResponseStatus(event),
      ms: started === undefined ? null : Math.round(performance.now() - started),
      // Caddy terminates TLS and proxies in, so the real client is in the
      // forwarded header; the socket address is Caddy's every time.
      ip: getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      ua: getRequestHeader(event, 'user-agent') ?? null,
      ref: getRequestHeader(event, 'referer') ?? null,
    }))
  })

  // `afterResponse` does not fire for a request that threw, so without this a
  // 404 — the single most useful thing to grep a web log for — would leave no
  // line carrying a status. Same shape as the line above, so one jq filter
  // reads both.
  nitro.hooks.hook('error', (error, { event }) => {
    const started = event?.context.startedAt as number | undefined
    const status = (error as { statusCode?: number }).statusCode ?? 500

    console.error(JSON.stringify({
      t: new Date().toISOString(),
      level: status >= 500 ? 'error' : 'warn',
      method: event?.method ?? null,
      path: event?.path ?? null,
      status,
      ms: started === undefined ? null : Math.round(performance.now() - started),
      message: error.message,
    }))
  })
})
