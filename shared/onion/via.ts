/**
 * How the site tells a request that came through the onion gateway from one
 * that came through Caddy.
 *
 * It matters for exactly one thing: the post editor. `/admin` and
 * `/api/admin/*` are authenticated by basic auth in Caddy, and the onion
 * gateway does not go through Caddy — it proxies straight to the site over
 * loopback. So a request that arrives over Tor has passed no authentication at
 * all, and the onion address is printed on this site's own pages.
 *
 * The gateway (`onion/src/proxy.rs`, `VIA_ONION`) sets this header on every
 * request it forwards and overwrites any copy a visitor sent, so its presence
 * cannot be removed by someone on Tor. Someone on the clearnet can add it
 * through Caddy, which only locks themselves out of the editor.
 *
 * The host name is NOT used for this: `x-forwarded-host` over the gateway is
 * whatever `Host` the Tor client chose to send, and "arrived on the onion
 * name" is a different question from "arrived through the onion gateway".
 */
export const VIA_ONION = 'x-via-onion'

/**
 * Whether a request carries the gateway's mark. Any value counts, including an
 * empty one: the gateway only ever sends `1`, so anything else present under
 * this name is a request trying to be read as not-over-Tor.
 */
export function cameOverOnion(value: string | string[] | null | undefined): boolean {
  return value !== undefined && value !== null
}
