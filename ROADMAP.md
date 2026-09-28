# basicautomation.io — roadmap

A pure phase-ordered task queue. Every item is a `[ ]` or `[x]` checkbox. Done
or to-do, nothing else: shipped consumer-facing capability becomes a feature in
`README.md`, everything not-done goes here, and git history plus the PRs are the
record. There is no run log.

## Phase 0 — Foundations ✅

- [x] Nuxt 4 + Tailwind v4 + Paleday Tailwind theme, flat terminal design language
- [x] Server-rendered pages with live GitHub + crates.io data, Nitro-cached
- [x] Committed fallback snapshot so an upstream outage can't take the site down
- [x] Per-project marketing pages: hero, why, features, worked example, folded README
- [x] Self-hosted Fira Code, org logo, favicons, Open Graph card
- [x] Container image + DeepStack service + Caddy route for the apex domain
- [x] Server-side syntax highlighting (Shiki) in a Paleday TextMate theme, for both
      the worked examples and the READMEs — no highlighter in the client bundle
- [x] Borderless card grid with project wordmarks and screenshots
- [x] The real Basic Automation mark, inlined as SVG so it takes the theme colour

## Phase 1 — Content

- [x] Per-project Open Graph cards instead of one shared org card
- [x] A short changelog strip per project, from the GitHub releases API
- [x] Copy pass on `data/projects.ts` for Nisaba and Skidbladnir — both are thinner than the two crates
- [ ] Screenshots for Nisaba and Enlil — Skidbladnir has one, the rest are all type
      (BLOCKED — needs someone who can run the two apps and capture them; the
      routine cannot produce these and will not fabricate them)
- [x] A card and its data can no longer drift apart. Rendering still needs a local
      Chromium, so it stays manual — but every render records what it was rendered
      from in `public/projects/og/cards.json`, and `npm run og:check` recomputes
      those fingerprints and fails when one no longer matches `data/projects.ts`.
      CI runs the check on every pull request; it needs neither Chromium nor network.

## Phase 2 — Discovery ✅

- [x] `sitemap.xml` and `robots.txt`
- [x] JSON-LD `SoftwareSourceCode` per project page
- [x] …and on the two pages that had none. The organization's own home page said
      nothing about the organization: `/` now carries `Organization` and
      `WebSite`, `/projects` carries a `CollectionPage` whose `mainEntity` is the
      `ItemList` it renders. The organization is described once, on `/`, and
      referenced by `@id` everywhere else — so a consumer reading two pages can
      tell it is one organization rather than two with matching names.
- [x] The structured data is checked by `npm run check`, for the same reason the
      feed is: a block that does not parse is ignored in silence and the page
      still looks perfect. It asserts every block parses, carries a schema.org
      `@context` and an `@type`, and that no `url`, `@id`, `logo` or `image` came
      out relative — which is the failure mode of building these from a
      request-derived origin. All five were proved against broken markup.
- [x] RSS/Atom feed of releases across the org — `/releases.xml`

## Phase 3 — Operations

- [x] Create the `glance.basicautomation.io` DNS record in Cloudflare — the Caddy
      site block exists and validates, but the name does not resolve yet, so
      Glance is only reachable on the LAN at `:5188` since it moved off the apex
      — done by the owner. Checked 2026-09-26: it resolves publicly (Cloudflare)
      and answers 200 with a valid certificate from both the public address and
      the LAN override.

- [x] Ship `GITHUB_TOKEN` to the container so the rate limit stops being a factor
      — done by the owner: `BASICAUTOMATION_GITHUB_TOKEN` is set, and the live
      `/healthz` reported `github.limit: 5000` on 2026-09-26 and 2026-09-27.
- [x] …and let the token buy something a visitor can see. With it shipped the
      site was still refreshing every 30 minutes — the anonymous arithmetic,
      applied to a limit 80 times larger. `refreshPolicy` in
      `shared/github/budget.ts` now budgets 300 of the 5,000 with a token (a
      person's token: whatever else they run shares the hour), floored at 5
      minutes so a bad token cannot hammer GitHub's sign-in; seven projects
      refresh every 5 minutes, 252 calls an hour. `/healthz` carries
      `authenticated`, and `/status` says "with a token" or "anonymously".
- [ ] Conditional requests (`If-None-Match`) for the GitHub calls: a `304` to an
      authorized request does not count against the limit, so with the token
      live, refreshes of unchanged repos would be nearly free. Not needed for
      the budget at 252 of 5,000; worth it only if the refresh shortens again.
      <https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api>

- [x] Structured request logging, and a `status` page fed by `/healthz`
- [x] Answer HEAD wherever GET is answered. Nitro routes by filename suffix, so
      `healthz.get.ts` bound GET alone and every non-page route — `/healthz`,
      `/sitemap.xml`, `/robots.txt`, `/releases.xml` and both `/api` routes —
      returned 404 to a HEAD. An uptime monitor configured for HEAD was being
      told the health endpoint does not exist. `server/middleware/head.ts` routes
      a HEAD as the GET it is the head of, and `npm run check` now asserts parity
      on every route.
- [x] Alert when the site has been serving from the fallback snapshot for more than an hour
- [x] …and make sure the fallback is worth serving. The committed snapshot had
      been rendered before README headings were demoted, so five of its seven
      READMEs still opened with an `<h1>`, and any page served from it had two.
      Regenerated, and `test/snapshot.test.ts` now fails CI on a snapshot with an
      `h1` in it or a project missing from it. Proved end to end by forcing all
      seven repos onto the fallback with a bad token: `npm run check` and
      `npm run a11y` both clean.
- [x] …and notice the failure that alert could not see. `source: 'live'` only
      ever meant the repo call succeeded; its README and its release history are
      separate calls that are each allowed to fail without sinking the repo. So a
      page could render live with no README and no release strip while `/healthz`
      and the status page both said everything was fine. `/healthz` now carries
      `data.incomplete`, the status becomes `degraded`, an `upstream.incomplete`
      line goes to the request log, and the status page says which repo is
      missing what.
- [x] Stop the site out-running GitHub's own rate limit. Six repos × three calls
      is 18 per refresh, and a 15-minute TTL is four refresh windows an hour — 72
      calls against an anonymous limit of 60, so the site spent part of every hour
      rate-limited and quietly serving pages with no README. `CACHE_TTL` is 20
      minutes: three windows, 54 calls, with headroom. The arithmetic is written
      into the constant so the next edit has to face it.
- [x] …and the next edit did not face it. Nanna was the seventh project, and
      seven repos at 20 minutes is 63 calls an hour — over again, silently. The
      TTL is now computed from the project count (`shared/github/budget.ts`):
      the shortest whole-hour divisor that keeps a full hour of worst-case
      refreshes inside 54 of the 60. Seven projects gives 30 minutes and 42
      calls; `test/budget.test.ts` proves the budget holds for every count up to
      18 and pins the numbers the comments quote.
- [x] Show the quota, not just its symptoms. Every GitHub response's
      `x-ratelimit-*` headers — refusals included, which is when they matter —
      are recorded; `/healthz` carries `github` (limit, remaining, reset) plus
      the computed refresh interval and its hourly budget, `/status` prints both,
      and the log gets one `upstream.rate_limited` line when the quota hits zero.
      Before this, the only sign of a spent quota was a README missing from a
      page. It is also shared: a local build being tested draws on the same
      anonymous 60 as the deployed site, which is how this run found it.
- [x] Trim the image: the runtime layer is no longer a full `node:24-alpine`
- [x] The Dockerfile's `alpine:3.24` runtime must stay in step with whatever base
      `node:24-alpine` uses, because the node binary is copied out of that image
      and linked against its musl. No longer a thing to remember on a base bump:
      `npm run bases` (`scripts/check-base-images.mjs`) reads both tags out of the
      Dockerfile, asks the node image for `/etc/alpine-release`, and fails on a
      mismatch. CI's `image` job runs it, which pulls an image that job needs
      anyway. Today: node:24-alpine is Alpine 3.24.2, runtime is 3.24 — in step.
- [ ] Move the runtime to distroless — roughly another 60 MB off. Distroless
      has no shell, and the image needed one in three places:
      - [x] The entrypoint. `docker-entrypoint.sh` ran the site and the onion
            gateway side by side; the site now starts the gateway itself
            (`server/plugins/onion-gateway.ts`), stops it on SIGTERM through
            Nitro's `close` hook, and exits with it if it dies. The image's
            command is `node .output/server/index.mjs` in exec form. Not a node
            supervisor: that is a second heap (~40 MB) against 145 MB for the
            whole container today.
      - [x] The image's own `HEALTHCHECK`, and `deploy/compose.yaml`'s, are exec
            form now.
      - [ ] BLOCKED — the live healthcheck in `compose-linux/infra.yaml` is still
            `CMD-SHELL`, and it overrides the image's. It is the owner's stack:
            convert it to the exec form `deploy/compose.yaml` now carries, then
            the runtime stage can change base.
- [x] The onion gateway ignored SIGTERM until it was ready: `shutdown()` in
      `onion/src/main.rs` registered its handlers only after `ready_timeout`
      returned — up to 600 s after start — so a stop in that window killed it
      outright instead of letting onyums withdraw its service. Found while
      verifying the entrypoint change above (`docker stop` ~30 s after a cold
      start: the gateway ended by SIGTERM, not "shutting down"). The handlers
      are now registered first, and both the bootstrap and the readiness wait
      race them. Checked on a cold keystore, stopped at 3, 8, 13, 15 and 20 s:
      "stopped while bootstrapping", "stopped before the descriptor was
      published", and "stop requested" respectively, every one exit 0.
- [x] Evaluated GitHub REST API version `2026-03-10` and moved to it. Its breaking
      changes touch `GET /repos/{owner}/{repo}` only, and only fields this site has
      never read (`has_downloads`, `use_squash_pr_title_as_default`,
      `secret_scanning_push_protection_custom_link_enabled`, and the beta media
      type's `master_branch`/`user` aliases, which these calls do not request).
      Checked live on 2026-09-25 against both versions, field by field: the repo
      payload, the releases list and the raw README came back identical. It has no
      end-of-support date, where `2022-11-28` sunsets 10 March 2028.
      <https://docs.github.com/en/rest/about-the-rest-api/api-versions>
      <https://docs.github.com/en/rest/about-the-rest-api/breaking-changes>
- [x] Watch for `2026-03-10` actually dropping the fields it documents as removed.
      On 2026-09-25 an unauthenticated `GET /repos/{owner}/{repo}` still returned
      `has_downloads` and `use_squash_pr_title_as_default` under
      `x-github-api-version-selected: 2026-03-10`. On 2026-09-26 both are gone,
      authenticated and not. Nothing here read either, so nothing changed.
- [ ] Revisit the type checker: `vue-tsc` does not support TypeScript 7 (it still
      reaches for `typescript/lib/tsc`, which TS 7 no longer exports), so the
      project uses Golar via its `golar/unstable` entrypoint — move off `unstable`
      once a stable one exists, or back to `vue-tsc` once it supports TS 7.
      Re-checked 2026-09-26: `vue-tsc` 3.3.11 against TypeScript 7.0.2 still
      dies with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `./lib/tsc`, and `golar`
      0.1.10 still exports only `./unstable` and `./unstable-tsgo`.
- [x] Silenced Nitro's own `[request error]` stack-trace block on a 404, without
      replacing the error handler. Nitro logs it when the error is `fatal`, and
      `fatal` is only load-bearing on the client, where it is what makes a 404
      reached by in-app navigation show the error page at all. So both page-level
      404s now throw with `fatal: import.meta.client`, which the bundler resolves
      to `false` server-side and `true` client-side. A 404 is one structured JSON
      line again; `app/error.vue` still renders it and the status is still 404.

## Phase 4 — Reach

- [x] Serve the site as a Tor onion service too, via `onyums` — the org's own crate, on the org's own site
      - [x] **Slice 1** — the reverse proxy `onyums` will serve (`onion/`), tested
            over plain TCP against the real server. See `docs/onion.md`.
      - [x] **Slice 2** — `OnionService::builder().router(app)` in
            `onion/src/main.rs`. arti bootstraps fine from this network (about
            six seconds cold); the keystore is the named volume
            `basicautomation-onion` at `/app/tor`; and absolute URLs now follow
            the request's own host via `siteOrigin()` / `useSiteOrigin()`, so an
            onion visitor is not handed clearnet links.
      - [x] **Slice 3** — the gateway ships in the site's own image, started
            beside Nitro (by `docker-entrypoint.sh` then; by the site's own
            `server/plugins/onion-gateway.ts` since 2026-09-27), with the keystore volume in
            `compose-linux/infra.yaml`. The onyums project page advertises the
            address, read live from `/api/onion`.
- [ ] `Onion-Location` on the clearnet site, so Tor Browser offers the onion address
      in its own banner rather than only the onyums page's copy. Deliberately left
      out of the deploy above: it changes what every clearnet visitor using Tor
      Browser is shown. Tor Browser only honours the header when the page is served
      over HTTPS, is not itself an onion site, and the value is a valid
      `http(s)://…onion` URL; a subdomain in the onion address suppresses the banner.
      <https://community.torproject.org/onion-services/advanced/onion-location/>
      An implementation is written and parked, not merged: commit `f6b387e` on
      the local branch `routine/site-2026-09-25` (`server/plugins/onion-location.ts`,
      on `render:response`, checking every one of the conditions above). It was
      dropped from the 2026-09-26 PR because the owner's own note on main says
      this is a bigger decision than page copy. Cherry-pick it if the answer is yes.
- [ ] `Strict-Transport-Security` on the clearnet host — **needs an owner
      decision**, because it is sticky in every visitor's browser for its
      `max-age`. Neither Caddy nor the app sends it today (checked 2026-09-26;
      plain HTTP already 308s to HTTPS). Two constraints if it is done: never on
      a response to the `.onion` host, because HSTS forbids clicking through a
      certificate warning and the onion service's self-signed certificate is a
      warning every visitor is told to accept; and no `includeSubDomains` while
      any subdomain (Glance) is not HTTPS-only.
      <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security>
- [ ] Decide what happens to `basic-automation.github.io`, which still serves the
      old page (200, `<title>Basic Automation</title>`). No longer load-bearing:
      the Skidbladnir README used to embed a screenshot from
      `https://basicautomation.io/ba-nextGenIMG/…`, a path only the old site
      served, and it now points at `raw.githubusercontent.com` instead (200,
      verified 2026-09-25). So this is a plain decision — retire it, redirect it,
      or leave it — with nothing on this site depending on the answer.

## Cross-cutting

- [x] A Content-Security-Policy, in `nuxt.config.ts`'s `/**` route rule. The
      project pages render each repo's README HTML as-is, fetched at request
      time, so the page states what it may load rather than trusting every
      README to stay well behaved. `font-src 'self'` and `connect-src 'self'`
      put two locked principles somewhere a browser enforces them. The two
      `'unsafe-inline'`s are Nuxt's own importmap, hydration payload and Shiki
      style attributes, and are the weak part of the policy.
- [x] Per-request nonces for `script-src`, without a security module:
      `server/plugins/csp-nonce.ts` mints one in `render:html`, stamps it on the
      `<script>`s in the head and body tail — Nuxt's colour-mode bootstrap,
      runtime config and import map — and never on the app body where README
      HTML lands, then swaps the header in `render:response`. The policy itself
      moved to `shared/security/csp.ts` so the route rule and the plugin share
      it. Proved in a browser: an inline `<script>` and an `onerror=` handler
      injected into the page ran under the old policy and are refused now, while
      hydration, colour mode and client navigation log nothing.
      `'unsafe-inline'` stays in the list only as the CSP1 fallback, which a
      nonce-aware browser ignores. <https://www.w3.org/TR/CSP3/#allow-all-inline>
- [x] …and styles, split with CSP Level 3's `style-src-elem` (nonced: Nuxt UI's
      one head `<style>` is allowed, a README's `<style>` block is refused) and
      `style-src-attr 'unsafe-inline'` (Shiki's per-token colours and Vue's
      `:style` accents, which cannot carry a nonce and cannot hold a selector).
      Proved in a browser: an injected `<style>` rule is refused, an injected
      `style=` attribute and every Shiki colour still apply.
      <https://www.w3.org/TR/CSP3/#directive-style-src-elem>
- [x] Reserve space for the images the pages render. Every `<img>` this repo
      controls now carries its intrinsic `width`/`height`, read out of the file
      itself by `npm run sizes` into `data/asset-sizes.generated.json`, with a
      `sizes:check` in CI so a replaced image cannot leave the manifest behind.
      The project screenshot is the one that mattered: it is `w-full` and
      block-level, so without an aspect ratio everything below it sat too high
      until the file landed. The cards were already safe — their media sits in an
      `aspect-16/10` box — and are left alone.
      NOTE: the improvement itself was not measured. `PerformanceObserver` for
      `layout-shift` does not fire in the routine's headless browser, even on a
      deliberate 300px shift, so there is no before/after CLS number here. What
      was verified is that the attributes render, that the remote README images
      are untouched, and that the layout is unchanged.
- [x] Measure Core Web Vitals for real — `npm run vitals`
      (`scripts/measure-vitals.mjs`): LCP and CLS in headless Chromium over CDP,
      every sitemap page, median of N cold loads, at a throttled phone profile
      (150 ms RTT, 1.6 Mbps, 4× CPU) and unthrottled desktop. `layout-shift`
      observers do fire under `--headless=new` driven this way; they did not in
      the screenshot-mode headless that left the CLS work above unmeasured.
      Live site, 2026-09-26, phone: CLS 0.000 on all ten pages; LCP good
      (1.3–1.6 s) everywhere but the home page, at 2508 ms — the wallpaper.
      Desktop: everything under 120 ms, CLS 0. Lab data from one machine, not
      field data; this site is too small to appear in CrUX.
      <https://web.dev/articles/vitals#core-web-vitals>
      <https://web.dev/articles/optimize-cls>
- [x] Preload the wallpaper on the home page (phone LCP 2580 → 2484 ms, median
      of 9, twice) and preload a 61 KB core cut of Fira Code instead of the
      113 KB full font (`npm run font`, `font:check` in CI). The full font stays
      declared behind it by `unicode-range`, fetched only by a page that sets a
      character only it has — checked with Cyrillic in a browser; none of the
      ten pages does today. Rendering pixel-identical at 1280 and 390 wherever
      the data matched. Home phone LCP 2484 → 2248 ms. Honest cost: the two
      text-LCP pages measured rose 1144 → 1192 ms and 1200 → 1248 ms,
      reproducibly under DevTools throttling — an artefact of it (below).
- [x] Explained the ~48 ms the font split appeared to add to text-LCP pages:
      an artefact of DevTools' simulated throttling, not a real cost. Under it,
      the stylesheet landed ~45 ms later with the core preloaded, and not
      because of its size — shrinking the full face's `unicode-range` from
      1,656 characters to ~250 moved nothing. Through a real shaped link
      instead (a Node proxy: one shared 200 KB/s pipe, 150 ms per response,
      DevTools throttling off), `/projects` FCP is 1168 ms with either font,
      median of 7, twice — and the home page's LCP gain grows to 2448 → 2120 ms.
- [x] A test framework, and unit tests over the pure helpers — Vitest,
      `test/*.test.ts`, run by CI. Scoped deliberately: only the functions in
      `shared/` that a running server cannot exercise, because `npm run check`
      already walks the real site. Writing them turned up two real bugs in the
      README rewriter, both fixed and both now regression-tested: a `mailto:`
      link was rewritten into a repo path, and a badge — an image inside a link —
      left its link target relative.
- [x] One copy of the README rewriter and the release shaper, in `shared/`.
      `server/utils/github.ts` and `scripts/fetch-projects.mjs` each carried
      their own; a snapshot shaped differently from the live path is a fallback
      that changes the page when it takes over.

- [x] Accessibility, structural: a skip link, a real `h1` on every project page,
      named `nav` landmarks, reduced-motion
- [x] …and the two places that claim was not actually true. Four of six project
      pages served TWO `<h1>`s, because the page has its own and then folds in a
      README that opens with `# ProjectName` — so READMEs now render a heading
      level down (`shared/markdown/heading.ts`), which also nests them under the
      page's heading where they belong. And the site nav had no accessible name
      while the per-project nav did, so a screen reader announced "navigation"
      twice with nothing to tell the two apart.
- [x] Structural accessibility is now checked on every page by `npm run check`,
      so neither can come back: one `h1`, one `main`, `html[lang]`, an accessible
      name on every `nav` when a page has more than one, an `alt` on every image
      (a README's missing `alt` warns, since it is upstream's), and no positive
      `tabindex`. Each of the six was proved to fail against deliberately broken
      markup. It is not an audit — it cannot see colour, focus order, or whether
      a label says anything useful.
- [x] axe-core over every page, in CI — `npm run a11y`, via jsdom. It found two
      real defects on the first run: the landing page and `/projects` went from
      `h1` straight to `h3` on the project cards (the dashed "projects" rule
      between them is a `role="separator"`, not a heading), and the status badge
      carried an `aria-label` on a bare `span`, which ARIA prohibits and screen
      readers are entitled to drop — so the word "Status" was being lost. Both
      fixed; the run is clean.
- [x] Run axe in a real browser too — `npm run a11y:browser`
      (`scripts/check-a11y-browser.mjs`), headless Chromium over the DevTools
      Protocol with Node's own WebSocket, no framework. It runs the four layout
      rules jsdom cannot (`target-size`, `scrollable-region-focusable`, both
      `meta-viewport`s) on every page at 1280px and 390px, in CI. First run: 91
      failing nodes. The footer's project names were 15px-tall targets stacked
      6px apart on every page, now 24px rows at the same pitch; and a long
      unbroken `CodeLine` — the onion address — overflowed into a scroll region
      a keyboard could not reach on a phone, and now wraps instead, which also
      shows the whole address. Both a11y scripts now take their pages from the
      sitemap: the typed list had never included Nanna.
      <https://dequeuniversity.com/rules/axe/4.13/target-size>
- [ ] Run axe's `color-contrast` in the browser pass too, once the contrast item
      below is decided. Left out deliberately: it would be red today on the
      shortfalls already waiting on that decision.
- [x] Stop measuring the contrast by hand. `npm run contrast`
      (`scripts/check-contrast.mjs`) reads the `@theme` block, measures every
      token against the one `#d8d8d0` ground, and prints the table this item used
      to carry as typed text. `--strict` fails only on a NEW shortfall, against a
      baseline of the ones already known — an always-red check is a check nobody
      reads. CI runs it. It reproduces every number that was typed here, and it
      found two the typed table had missed: `pn-red` (2.56) and `pn-orange`
      (2.62), both below AA, and `pn-red` is a live project accent today.
- [ ] Accessibility, contrast — **needs an owner decision**, because the palette
      is locked and fixing this means changing what a colour role *is*. Seven
      tokens are below AA against the ground; run `npm run contrast` for the
      current numbers rather than trusting a copy of them here. `pn-muted`
      carries every label and date on the site and `pn-accent` carries link text;
      `pn-rule` (1.62) is decorative separators only and is exempt.
      The options are: retire `pn-muted` in favour of `pn-dim` (4.82, passes)
      wherever it carries information, or change the values — which the locked
      palette rule forbids without the owner saying so. Until then the shortfalls
      sit in the script's `BASELINE`, which records the number each was measured
      at, not an endorsement of it.
      The same decision covers the focus ring: every one of the 39 tab stops on
      a project page shows one (checked by tabbing through it in Chromium), but
      it is 1px of `pn-accent` (2.14:1) or, on the header links, `pn-muted`
      (2.97:1) — both under the 3:1 WCAG 1.4.11 asks of a focus indicator at AA.
      `pn-fg` or `pn-dim` would pass without leaving the palette.
      <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- [x] A real 404 check: every internal link, every render, on every route — `npm run check`
- [x] …and the two XML documents nobody looks at, checked the same way. A feed
      breaks silently for every subscriber at once, and both documents carry
      text this site did not write. `npm run check` now asserts that neither
      contains a character XML 1.0 forbids outright, that no `&` is unescaped,
      that every tag closes, that the feed has its `id`/`title`/`updated` and a
      `rel="self"` link, that every entry has an id, a title and a parseable
      date, that no two entries share an id, and that the sitemap's `<loc>`s are
      absolute, unique and carry W3C dates. One real bug behind this: a stray
      control character in a GitHub release title made the whole feed
      unparseable, which `shared/xml/escape.ts` now strips — and a malformed
      sitemap used to crash the checker rather than fail it.
- [x] Check external links on a schedule — `.github/workflows/links.yml`, weekly
      on Thursdays. It follows every external link and keeps ONE issue in sync:
      opened or updated while links are dead, closed the week they are all fixed.
      A dead link never fails the job, because almost none of them are ours to
      fix; only a build or a server that will not come up does, since that means
      the report itself is not trustworthy.
- [ ] Upstream: the Skidbladnir README links to `blob/master/LICENSE`, a file that
      repo does not contain — a 404 on this site's Skidbladnir page. Not fixable
      here; the weekly report will keep saying so until someone commits a LICENSE.
- [ ] Upstream: the onyums README's table of contents links
      `#multiple-services-on-one-tor-client`, an anchor no heading in it produces.
