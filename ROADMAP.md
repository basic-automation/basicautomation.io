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
- [ ] Keep Skidbladnir's screenshot in step with the app. It is the top 1,304 px
      of the Skidbladnir README's `resources/images/screenshot.webp` (the 1.0.0
      window since 2026-10-01), cut at the gap above "Metadata". A screenshot two
      releases behind the copy beside it — the v0.9.0 window, two formats and no
      flag labels — is what this replaced.
      - [x] Repeatable: `npm run shot` (`scripts/cut-screenshot.mjs`) fetches,
            cuts, squares the window's rounded top corners — on this page they were
            two black notches — with the window's own sampled background, and
            records the upstream blob in `public/projects/shots/sources.json`;
            `npm run shot:check` says when upstream has moved on.
      - [x] `shot:check` runs weekly, as the `screenshots` job of
            `.github/workflows/links.yml`, and keeps one issue in sync — opened
            while a screenshot is behind upstream, closed once it is re-cut.
            A report, not a gate, like the link check beside it. Still eyeball
            each re-cut: a release that adds a row moves the gap the crop sits in.
- [x] Skidbladnir's page, ready for its first public campaign: the parity claim
      scoped the way its README scopes it (still images, the four named tools,
      the exceptions in the readme below, no typed case count), the full input
      list, the two editions, macOS marked experimental, the 0.14 window as its
      screenshot with a real `alt`, and a download section with a direct link per
      platform, read from the release list the page already fetches
      (`pickDownload`, `groupInstallers`). The home page's lede names it in one
      sentence. Its `status` is `stable` from 1.0.0, its first release that is not
      a prerelease, so the badge and the social card say "Stable". This copy is
      held back until 1.0.0 is published, because before then it is untrue.
- [x] Skidbladnir as the first card (`order: 1` in `data/projects.ts`) for the
      campaign — **decided by the owner 2026-10-01: yes.** It also reorders the
      footer, `/projects` and `/api/projects`; the rest keep their order. The
      card leads with the longship illustration
      (`public/projects/shots/skidbladnir-hero.webp`, until then referenced
      nowhere) through a new `cardImage` field, also the owner's call; the
      wordmark still heads the project's own page.
- [x] Refreshed the fallback snapshot once Skidbladnir 1.0.0 was published and
      its GitHub description and topics updated (2026-10-01; it is at 1.1.0).
      The snapshot had predated the download section and still carried the
      Electron-era description and topics. Proved by forcing the fallback with a
      bad token: `/projects/skidbladnir/about` from the snapshot has the v1.1.0
      download section and its `SoftwareApplication`, and `npm run check` is
      clean.
- [x] The Skidbladnir wordmark is drawn the way it was designed. Its lettering
      was a live `<text>` naming `'RobotoSlab-Bold'`, left over from an
      Illustrator export. An SVG served as an `<img>` cannot load a web font, and
      no visitor had that one installed, so from 2026-09-24 every page and the
      social card set "SKIDBLADNIR" in the machine's default serif, light where
      the mark is bold. The letters are now outlines, cut with fontTools from
      Roboto Slab Bold (Apache-2.0, via `@fontsource/roboto-slab`, used only to
      cut them and not shipped). Against Chromium's own rendering of the old
      `<text>` with the real font loaded, 420 of 1.2M pixels differ, which is
      antialiasing; the fallback differed by 34k. The card is re-rendered, and
      its `?v=` fingerprint moved with it. `test/wordmarks.test.ts` fails any SVG
      under `public/` that has live text or names a font.
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
- [x] `BlogPosting` JSON-LD on every post, naming the blog it is part of by
      `@id`, so the site's news and each project's news are distinguishable
      without parsing URLs. The project page's `SoftwareSourceCode.url` had been
      left pointing at `/projects/<slug>`, a 301 since the about/blog tabs; it
      names `/about` now.
- [x] …and each blog describes itself: `/news` and every blog tab emit the
      `Blog` node their posts' `isPartOf` names, with `blogPost` listing what
      the index lists. `npm run check` fails on a bare `@id` reference no page
      describes — the organization is referenced that way from every page.
- [x] `/news.xml` — an Atom feed of every published post across every blog,
      advertised in every page's head and the footer. Both feeds get the same
      checks, matched by content rather than by file name.
- [x] Posts and blog pages preview with a card when shared. Five page kinds
      arrived with the blogs naming an `og:url` and no `og:image`; they carry
      their blog's card now, and drafts are `noindex`. `npm run check` fails a
      page with one and not the other, and fetches the image.
- [x] One address per page: `<link rel="canonical">` everywhere, equal to
      `og:url` and to the sitemap `<loc>`. The router is case-, slash- and
      query-insensitive, so `/PROJECTS` and `/news/` were live duplicates.
- [x] An unknown `/projects/<slug>` is a 404, not a 301 to one; `npm run check`
      no longer follows redirects when it asks for a 404.
- [x] Blog indexes carry their newest post's date as `lastmod` in the sitemap.
- [x] Every social card states its size and what it shows. `/`, `/projects` and
      `/status` named an `og:image` with no `og:image:width`, `og:image:height` or
      `og:image:alt`, and the blogs had no alt. `npm run check` fails a card
      without all three.
- [x] `/projects/<slug>` hands its query string on with its 301 to `/about`, so a
      campaign link's `utm_*` tags survive the short address; the canonical link
      stays query-free. `npm run check` asserts it for every project.

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
- [ ] Give the site a token of its own — **owner decision**. A personal
      token's 5,000 an hour is one pool per user, shared with every other
      token and OAuth app acting for that user; the live container's quota
      resets on the same second as the routine's own `gh` token, so the site's
      252 an hour and the owner's own tooling draw on one pool. A GitHub App
      installation token has its own 5,000-an-hour limit and needs only
      read access to public repos' metadata.
      <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
- [x] Conditional requests (`If-None-Match`) for the GitHub calls: a `304` to an
      authorized request does not count against the limit. Parked as unneeded
      at 252 of 5,000 — but the token is a person's, and its pool had spent 990
      of the hour when this was checked on 2026-09-28, so every call the site
      saves is theirs. `shared/github/conditional.ts` keeps each answer's ETag;
      three `304`s left GitHub's `x-ratelimit-used` where it was while one plain
      request moved it. All three endpoints the site calls (repo, raw README,
      releases) answer `304`. `/healthz` and `/status` count them.
      <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>

- [x] Structured request logging, and a `status` page fed by `/healthz`
- [x] …logging each request once. Internal SSR calls to `/api/*` inherit the
      visitor's `x-forwarded-for`, which the internal-call filter trusted, so
      every page view through Caddy logged its API calls as visits too — each
      uptime check of `/` was three lines. And each line now carries `via`
      (`onion` or `web`), unforgeable from either side.
- [x] `/api/posts?project=<unknown>` is a 404, like `/api/projects/<unknown>`,
      not an empty list.
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
- [x] A failed refresh no longer rolls a page back to the snapshot. Nitro caches
      whatever the repo function returns, and on an upstream failure that was the
      committed snapshot, so one timed-out refresh replaced a live entry with
      data from the last `npm run sync` for a whole refresh window. Proved
      2026-10-02 behind a proxy switched off after the cache was warm: once the
      TTL ran out, the old build's Skidbladnir page went from v1.3.0 to the
      snapshot's v1.1.0, with download links to match. `server/utils/github.ts`
      now keeps each repo's last live answer and serves it, marked `stale`, with
      its own `fetchedAt`. The new build kept v1.3.0. The snapshot is still the
      fallback for a repo the process has never reached. It still counts as
      degraded (and still triggers the hourly `upstream.stale` alert, which now
      says which kind). `/healthz` adds `staleResolutions` and
      `data.source: 'stale'`, and `/status` shows both.
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
- [x] Say whether the onion service is actually reachable. A gateway that dies
      takes the container with it, but one that runs without being reachable —
      a descriptor that never published, circuits that stopped completing — was
      visible only as a stale frame on the onyums page. `/healthz` now carries
      `onion` (`off`, `starting`, `launched`, `reachable`, `unreachable`), judged
      by the age of the gateway's own last successful fetch of the site over
      Tor; 30 minutes without one (three missed self-fetches) makes `status`
      `degraded`, and `/status` prints it ("reached over tor 4 minutes ago, in
      11.2 s"). Thresholds are pure and tested (`shared/onion/state.ts`).
- [x] Trim the image: the runtime layer is no longer a full `node:24-alpine`
- [x] The Dockerfile's `alpine:3.24` runtime must stay in step with whatever base
      `node:24-alpine` uses, because the node binary is copied out of that image
      and linked against its musl. No longer a thing to remember on a base bump:
      `npm run bases` (`scripts/check-base-images.mjs`) reads both tags out of the
      Dockerfile, asks the node image for `/etc/alpine-release`, and fails on a
      mismatch. CI's `image` job runs it, which pulls an image that job needs
      anyway. Today: node:24-alpine is Alpine 3.24.2, runtime is 3.24 — in step.
- [ ] Move the runtime to distroless — **needs an owner decision, because the
      size case for it is gone.** Measured 2026-09-27: the same build on
      `gcr.io/distroless/nodejs24-debian13:nonroot` is 73.0 MB of image content
      against 71.0 MB for today's trimmed Alpine runtime — 2 MB larger, not the
      ~60 MB smaller this item was written for, because the Alpine trim above
      already took what distroless would have. It does run (healthy, all
      routes, the gateway started and stopped cleanly, exit 0). What is left
      is attack surface — no shell, no package manager in the image — weighed
      against a glibc runtime replacing musl. Distroless has no shell, and the
      image needed one in three places:
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
            the runtime stage can change base. (Harmless to do either way: the
            exec form works on the Alpine runtime too.)
- [x] Claude Code's worktrees (`.claude/worktrees/`) were in the image's build
      context — 11 of its 14 MB, other sessions' in-progress source. Ignored.
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
      Re-checked 2026-09-27: both still the latest published (vue-tsc 3.3.11,
      golar 0.1.10, TypeScript 7.0.2). Upstream, the exact failure was filed as
      vuejs/language-tools#6124 and closed as a duplicate of #5381, the
      TypeScript 7 / `tsgo` support request, which is closed too — so there is
      no open issue to watch. Check the release notes instead.
      Re-checked 2026-09-28 and 2026-10-01 (twice): unchanged (vue-tsc 3.3.11 is
      still the latest release, of 2026-08-21; golar 0.1.10, still only
      `./unstable` and `./unstable-tsgo`; TypeScript 7.0.2).
      <https://github.com/vuejs/language-tools/issues/6124>
      <https://github.com/vuejs/language-tools/issues/5381>
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
- [x] `SoftwareApplication` JSON-LD for the desktop apps, beside
      `SoftwareSourceCode` (which names it as its `targetProduct`): operating
      systems, version, release page, screenshot, free — built by
      `shared/seo/application.ts` from exactly what the download section
      renders, so a system with no installer is never claimed and an app with
      no download section (Nisaba today) gets none. And a `metaDescription` per
      project, at most 160 characters: every summary ran 218–322, Skidbladnir's
      the longest. `test/application.test.ts` holds both.
      What it does NOT buy: Google's software-app rich result requires an
      `aggregateRating` or a `review` as well as `offers.price`, and this site
      has neither to give — none will be invented. The markup is valid schema.org
      for every other consumer; `MultimediaApplication` is one of Google's
      supported categories.
      <https://developers.google.com/search/docs/appearance/structured-data/software-app>
- [x] Cache-bust the social cards. A project card's `og:image`,
      `twitter:image` and JSON-LD `image` now carry `?v=<fingerprint>` from
      `public/projects/og/cards.json` (`socialCardPath()`,
      `shared/posts/section.ts`), so a re-rendered card is a new URL and a
      network's cached copy of the old one — Skidbladnir's "In development"
      card, before 1.0.0 — is no longer what that URL names. The about page,
      which had built its own path, goes through the same function.
      `test/social-card.test.ts` pins it. The organization's `/og.png` is not
      generated, has no fingerprint, and keeps its bare URL. Facebook documents
      exactly this: images are cached by URL, so a new image needs a new URL.
      <https://developers.facebook.com/docs/sharing/webmasters/images/>

## Cross-cutting

- [x] Reconcile the masthead with the flat design language — **decided by the
      owner 2026-10-01: the masthead is an exception.** `843aae8` and `0d1cb73`
      made it a "glass" pane with a bevel, a drop shadow and rounded ends; it
      stays that way, and the README now says so. Everything below the masthead
      is still one flat background, no shadows, no rounded corners, no blur.

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
      One response is deliberately outside all of this: `/onion-frame` strips the
      Tor snapshot's scripts and then serves `script-src 'none'`, so there is no
      script left for a nonce to name. `npm run check` exempts a response whose
      `script-src` is `'none'` — strictly stricter than a nonce, not a hole in the
      rule — and holds the rest of that policy, `frame-ancestors`, `base-uri`,
      `form-action` and `default-src`, to the letter instead.
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
- [x] A folded README costs no third-party request. Its images had no `loading`
      attribute, and an eager image inside a closed `<details>` is fetched anyway,
      so every visit to the Skidbladnir page fetched two screenshots from
      raw.githubusercontent.com. `lazyImages` (`shared/markdown/readme.ts`) makes
      README images lazy, live and in the snapshot. Checked in headless Chromium:
      scrolling the whole page with the README folded requested nothing from
      GitHub; opening it loaded the first screenshot.
- [x] The organization's own repositories can see a visit came from here. Links
      to `github.com/basic-automation/*` on the about pages carry `noopener`
      without `noreferrer` on the clearnet site (`shared/html/rel.ts`), so
      GitHub's "Referring sites" can count them; the `Referrer-Policy` sends the
      origin alone. Over Tor every link keeps `noreferrer`.
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
- [x] `/projects` back to a good phone LCP after the campaign art arrived. With
      Skidbladnir's longship leading the grid, the page's LCP became a 200 KB,
      1224 px, `loading="lazy"` image: 2880 ms on the shaped phone profile
      (`npm run vitals --shaped`, median of 7), where the text before it had
      measured ~1.2 s. Making the first card eager with `fetchpriority="high"`
      alone moved it to 2860 ms, so the size was the cost, not the lazy load.
      The art is now also cut to 560 and 800 px (`npm run cuts`,
      `shared/assets/cuts.ts`; 27 KB and 77 KB). The card is a `<picture>`
      whose phone source offers only the cuts (800 px is still 2.3× a 350 px
      slot), while from `sm` up a 2× screen still gets the original. Result:
      2256 ms, "good"; desktop unchanged (84 ms). The home page keeps every card
      lazy, because there the hero is the LCP. `test/card-cuts.test.ts` and
      `sizes:check` hold the cuts to the art.
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
- [x] Posts skipped a heading level — `PostCard` was an `h3` straight under the
      page `h1`, and post bodies were demoted like READMEs though their title is
      not in the body. Found by axe the moment CI had posts to render: CI now
      starts the server on `test/fixtures/content/` (three test posts, one a
      draft), so `check`, `a11y` and `a11y:browser` see post pages at all, and
      `check` asserts no draft is listed.
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
- [x] The post editor was open to anyone on Tor. `/admin` and `/api/admin/*`
      are guarded by basic auth in Caddy, and the onion gateway proxies straight
      to the site over loopback without going through Caddy — so over the onion
      address, which this site prints on two of its own pages, anyone could list
      drafts and write or delete posts on a volume that is their only copy. The
      classic onion-service mistake: whatever a front proxy or a loopback-only
      rule protects is exposed once the onion service reaches the app from
      inside. <https://riseup.net/en/security/network-security/tor/onionservices-best-practices>
      The gateway now marks every request it forwards `x-via-onion: 1`,
      overwriting any copy a visitor sent (`onion/src/proxy.rs`, unit-tested),
      and every handler under `server/api/admin/` refuses a marked request with
      a 404 before doing anything (`refuseOverOnion`), as does the editor page.
      In the handler rather than by path in a middleware, because a handler only
      runs when the router resolved to it, whatever the spelling — Nuxt itself
      fixed route rules matching encoded rather than decoded paths as recently
      as 4.5.2. <https://github.com/nuxt/nuxt/releases/tag/v4.5.2>
      `test/admin-guard.test.ts` fails if a new handler forgets the guard, and
      `npm run check` sends the mark to six spellings of the editor's URLs and
      fails on anything but 404 or 401.
- [x] Authenticate the editor in the app, not by where the request came from.
      Caddy and the onion mark covered the two public ways in, but any other
      container on `caddy-shared-network` reached `basicautomation-site:3000`
      directly with neither, and the editor is a write API. Every handler under
      `server/api/admin/` now calls `requireEditor` (`server/utils/adminGuard.ts`)
      first: 404 over the onion gateway, then a `Basic` credential checked
      against `NUXT_ADMIN_USER` / `NUXT_ADMIN_PASSWORD_HASH` — the same user and
      bcrypt hash as Caddy's `admin_auth_gate`, so the browser that answered
      Caddy's prompt is not asked twice. Without both settings the editor is a
      404 outside `nuxt dev`. The `/admin` page asks `/api/admin/session` before
      rendering, so a stranger gets a 401 rather than an empty editor. bcrypt at
      Caddy's cost of 14 is ~0.8 s in pure JS: a verified header is remembered
      for ten minutes, and verifications are serialized with at most four
      waiting, so bad guesses from inside the network cannot occupy the site.
      This also retires the rule that every Caddy restriction be repeated in
      the app: the app no longer depends on Caddy for this one.

- [x] Audit what ships, not what builds — `npm run audit:runtime`
      (`scripts/audit-runtime.mjs`, `shared/security/advisories.ts`), in CI after
      the build. On 2026-10-02 `npm audit` reported 11 high findings, and none of
      them could reach a visitor: `braces` (GHSA-vfj7-8cjw-p6xm) under
      nitropack's build-time globbing, and `node-forge` (GHSA-86w9-cpqp-85rv)
      under the dev server's certificate helper. Neither has a patched release,
      so that report stays red, and a report that is always red stops being
      read. The new check asks the registry only about the 57 packages traced
      into `.output/server/node_modules` and the 25 inlined into the server
      chunks, which their sourcemaps name. It does its own range matching,
      because the bulk endpoint returns every advisory for a name whatever
      version was asked about. Proved by planting `braces@3.0.3` and
      `marked@4.0.9`: it fails on exactly the three advisories that apply. The
      client bundle has no sourcemaps and the gateway's crates are cargo's, so
      neither is covered.
      <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>
      <https://github.com/advisories/GHSA-86w9-cpqp-85rv>

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
- [x] Upstream: the Skidbladnir README linked to `blob/master/LICENSE`, a file that
      repo did not contain — a 404 on this site's Skidbladnir page. Fixed
      upstream: the repo has a LICENSE now (GitHub reads it as ISC), the link
      answers 200, and `npm run check -- --external` against production found
      no dead link on 2026-10-01.
- [ ] Upstream: the onyums README's table of contents links
      `#multiple-services-on-one-tor-client`, an anchor no heading in it produces.
