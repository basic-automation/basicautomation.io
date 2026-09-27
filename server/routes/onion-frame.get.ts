/**
 * The Tor-fetched page, for the frame on the onyums project page.
 *
 * Served from this origin rather than handed to the browser as an onion URL,
 * because a visitor's browser has no Tor: the circuit is the *server's*, and
 * this is the document that came back over it.
 *
 * Two things are done to it on the way out, both of which the page says out
 * loud rather than hiding:
 *
 *   - Scripts are stripped. Without this the frame boots a second copy of the
 *     whole application inside the first — a second hydration, a second set of
 *     `backdrop-filter` and SVG-filter stacks compositing every frame. The page
 *     renders fully on the server, so what is left is what a visitor sees before
 *     hydration, which for this site is the whole thing.
 *   - A strict CSP goes on the response. Scripts are already gone; this makes
 *     that a guarantee rather than a consequence of a regex, and stops anything
 *     but this site framing it.
 *
 * Relative URLs in the document — the stylesheet, the fonts, the images — are
 * left alone deliberately. They resolve against this origin and load normally,
 * which is why the frame looks like the site instead of like unstyled markup.
 * The absolute URLs in its `<head>` still name the `.onion`, because that is
 * what the onion service served; nothing fetches them.
 */

import { stripScripts } from '~~/shared/html/strip'

export default defineEventHandler(async (event) => {
  const snapshot = await renderableSnapshot(event)

  if (!snapshot) {
    // 503 rather than 404: the route exists and the answer is "not yet". The
    // page never requests this until it knows a snapshot exists, so reaching
    // here means the gateway has not completed a fetch — a cold start, or Tor
    // is having a bad day.
    setResponseStatus(event, 503)
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return 'No snapshot yet: the gateway has not completed a fetch over Tor.'
  }

  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  setResponseHeader(
    event,
    'content-security-policy',
    // `frame-ancestors 'self'` so only this site can frame it; `script-src
    // 'none'` so the stripping above cannot be the only thing standing between
    // a visitor and a second application booting in a frame.
    //
    // `style-src` has to allow inline, and it is not a loosening worth avoiding:
    // the page carries a `<style id="nuxt-ui-colors">` block and sets the hero
    // wallpaper through a `style=` attribute, so without it the frame renders as
    // unstyled markup — a broken-looking demo of a working thing. With scripts
    // already at `'none'` and everything else pinned to `'self'`, inline CSS here
    // can neither execute nor reach off-origin.
    "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  )
  setResponseHeader(event, 'x-frame-options', 'SAMEORIGIN')
  // The snapshot changes every ten minutes and is cheap to re-fetch; let a
  // reload get the current one rather than a stale frame.
  setResponseHeader(event, 'cache-control', 'no-store')

  return stripScripts(snapshot.html)
})
