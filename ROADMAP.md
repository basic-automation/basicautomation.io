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
      - [x] A re-cut is a new URL. The screenshot was served at a fixed address
            with `max-age=86400`, so a re-cut reached a repeat visitor up to a
            day late. Its `<img>` and its JSON-LD `screenshot` now carry
            `?v=<blob>` from `sources.json` (`shared/assets/shots.ts`), the way
            the social cards carry theirs. Re-cut 2026-10-05 (upstream
            `e6c3ee28`); the crop still sits in the gap above "Metadata".
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
- [x] …and every other line is JSON too. Seven warnings still printed plain
      text, the most useful of them a failed GitHub fetch falling back to stale
      or snapshot data (seen live 2026-10-03, Skidbladnir timing out), so
      `docker logs … | jq` choked on exactly the lines worth finding. They go
      through `logEvent` (`shared/log/event.ts`) now — `upstream.fetch_failed`
      with `repo`, `fallback` and `error`, `posts.ignored`, `posts.unreadable`,
      `onion.address_invalid`, `onion.snapshot_invalid`, `highlight.fallback` —
      and `test/log-lines.test.ts` fails a `console` call in `server/` or
      `shared/` that does not write JSON. Nitro's own "Listening on" line is
      the one left, and is not this app's to change.
- [x] …and a failed request says who asked. The error-hook line — every 404
      and 500 — stopped at `via`, though its comment promised the success
      line's shape, so the 627 404s in fifteen hours of live log (nearly all
      scanners) were the only lines with no `ip`, `ua` or `ref`. Both lines
      now take those fields from one `requester()`
      (`server/plugins/request-log.ts`); still one line per request, HEAD
      still logged as HEAD, onion requests still `ip: null`.
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
      `data.source: 'stale'`, and `/status` shows both. Nitro's cache docs
      describe errors thrown by a cached function as logged, not stored;
      what a function *returns* is cached, which is why the fallback must
      not be the snapshot whenever a newer answer exists.
      <https://nitro.build/docs/cache>
- [x] …and notice the failure that alert could not see. `source: 'live'` only
      ever meant the repo call succeeded; its README and its release history are
      separate calls that are each allowed to fail without sinking the repo. So a
      page could render live with no README and no release strip while `/healthz`
      and the status page both said everything was fine. `/healthz` now carries
      `data.incomplete`, the status becomes `degraded`, an `upstream.incomplete`
      line goes to the request log, and the status page says which repo is
      missing what.
- [x] …and a piece that failed keeps its last answer, not a hole. A refresh
      whose repo call succeeds is live even when its README, release list or
      crate call fails, and the page rendered without that section for the
      whole refresh window, though the process still held the last answer to
      it. Live logs, 2026-10-03/04: Enlil twice without its README and
      releases, onyums and Artiqwest without their crate numbers.
      `carryMissing` (`shared/github/carry.ts`, `test/carry.test.ts`) fills
      each failed piece from the previous live answer, never from the
      snapshot, whose releases can be versions old. `incomplete` still names
      every failed piece, so health stays `degraded`; `carried` names the
      ones filled, in `/healthz`, the `upstream.incomplete` log line and on
      `/status`. Proved behind a proxy refusing only crates.io once the cache
      was warm: past the TTL, onyums refreshed live and kept 0.5.0 and its
      19,736 downloads; a cold start under the same block still shows the
      hole.
- [x] Keep to crates.io's own limit. Its data-access policy allows the API
      "provided you abide by" a maximum of one request a second and an
      identifying user agent (the site already sent one). Each repo refreshes
      in its own cached function, and they resolve together and expire
      together, so every refresh window opened with one simultaneous
      crates.io request per published crate. `paced` (`shared/net/pace.ts`,
      `test/pace.test.ts`) now starts them at least a second apart, in the
      server and in `npm run sync`. The wait falls on a background
      revalidation; only a cold start's first render pays it (`/api/projects`
      cold: 1.57 s). The policy lists the sparse index first, but download
      counts are only in the API.
      <https://crates.io/data-access>
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
- [x] …and say it in the log, not only to whoever asks. On 2026-10-08 the
      gateway sat from 15:20 to 19:51 UTC with arti rejecting all 60 guards as
      down, its descriptor never published and not one self-fetch landed;
      `/healthz` said `unreachable` the whole time, and the log, which is what
      anyone reads afterwards, said nothing. Two `docker restart`s later (the
      first did not take) it published in six seconds. `watchOnion`
      (`shared/onion/state.ts`, five cases in `test/onion-state.test.ts`) now
      writes `onion.unreachable` on the way in and hourly while it lasts, and
      `onion.recovered` when a fetch over Tor lands — driven by the
      healthcheck's 30-second polling, the shape of `upstream.stale`. Proved on
      the built server with a stand-in gateway and a 40-minute-old snapshot:
      five polls, one line; a fresh snapshot, one `onion.recovered`.
- [ ] Arti 0.47 under the gateway (Arti 2.7.0, 2026-10-01), whose
      announcement says it fixes "low- to high-severity security issues"; the
      gateway is the site's Tor-facing binary and is on 0.46. Blocked on
      onyums: 0.5.0 depends on `arti-client = "0.46.0"`, which for a 0.x
      crate admits nothing past 0.46, so it needs an onyums release first
      (the org's own crate, another repo). No GitHub advisory names the fixed
      issues yet; CI's `cargo audit` will report them if RustSec files them.
      <https://blog.torproject.org/arti_2_7_0_released/>
- [x] Recover the gateway without a container restart. The 2026-10-08 outage
      ended only when someone ran `docker restart`, which took the clearnet
      site down with it. Arti keeps guard reachability in memory only
      (`reachable`, `retry_at` and `retry_schedule` are `#[serde(skip)]` in
      tor-guardmgr 0.46's `guard.rs`), so the 19:38 restart began with every
      guard untried and still failed for 13 minutes: the relays really were
      unreachable from the container, while its HTTPS egress to GitHub worked.
      What the 19:51 restart bought was an end to arti's backoff, which the
      guard spec caps at 6 hours for primary guards
      (<https://spec.torproject.org/guard-spec/appendices.html>); its
      all-guards-down recovery waits on a circuit succeeding
      (<https://spec.torproject.org/guard-spec/algorithm.html>), and
      `GuardMgr::mark_all_guards_retriable` is not reachable through
      `TorClient`. So `server/plugins/onion-gateway.ts` now restarts the
      gateway child in place once it has been up an hour without being reached
      over Tor (`shouldRestartGateway`, hourly at most, `onion.restarting` in
      the log), and the site stays up. A gateway that exits on its own still
      stops the container, as before. Proved on the built server with a
      stand-in gateway: restarted at exactly 60 minutes, new gateway pid under
      the same site pid, `/` answered 200 on all 126 polls across 63 minutes;
      a stand-in that exits with 3 still stops the site with 3.
- [x] …and a gateway that ignores SIGTERM cannot stall it. A restart waited on
      the old gateway's exit with no limit, so one deaf to the signal would
      have left the site with no gateway at all. `stop()` now kills it after
      9 s (`onion.killed`), inside Nitro's 30 s shutdown timeout and
      `docker stop`'s 10 s. Proved with a stand-in that traps SIGTERM: on the
      in-place restart, killed 9 s after `onion.restarting` and replaced 3 ms
      later, `/` 200 on all 126 polls; on site shutdown, killed after 9 s.
      A gateway that honours the signal still stops in milliseconds.
- [ ] Explain the network cause of the 2026-10-08 onion outage: four and a
      half hours in which no Tor relay was reachable from the container while
      HTTPS to GitHub was. Nothing in the host's journal for the window names
      it.
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
- [x] Back on `vue-tsc`, off Golar's `golar/unstable`. Plain TypeScript 7 still
      has no `lib/tsc` for vue-tsc to patch (checked through 3.3.12), which is
      why the project had moved to Golar. But TypeScript 7.0 ships no
      programmatic API at all, and its announcement says tools that embed
      TypeScript, Volar named, "can only currently rely on TypeScript 6.0" —
      Vue projects keep the 6.0 API until 7.1 ships a new one. vue-tsc 3.3.8
      supports exactly that install (vuejs/language-tools#6123), which earlier
      re-checks never tried: `typescript` is `npm:@typescript/typescript6`
      (6.0.3), and `golar`, `@golar/vue` and `golar.config.ts` are gone.
      `nuxt typecheck` is clean, and it still catches a planted error in a
      `.vue` template and in a `.ts` file. It costs time: ~11.6 s against
      Golar's ~2.7 s.
      <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>
      <https://github.com/vuejs/language-tools/pull/6123>
- [ ] Move the type checker to TypeScript 7 once 7.1 ships its API and vue-tsc
      adopts it — the 6.0 API is a bridge, not a destination.
      <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>
- [x] Nuxt 4.6, landed 2026-10-08 after two and a half days in the wild.
      Its security section is why it matters here: the internal error route
      reachable from outside, unhandled error data handed to the error page,
      error-render recursion tracked by a client-controllable header. On the
      upgraded tree (`npm install nuxt@^4.6.0`, `npm dedupe`): typecheck, 236
      tests, build, `audit:runtime`, `check`, `a11y` and `a11y:browser` clean;
      all 42 routes `verify` exercises answer as on 4.5.2, and every page body
      is the same size. `/__nuxt_error` probes answer 404 on both. No 4.6.1
      yet; the open 4.6.0 regressions (a `config.cjs` missing from the
      tarball for `require`, page-transition and scroll-reset edge cases,
      `nuxt/server` typing) touch nothing this site uses. Needs Node
      `^24.15.0`; the build image has 24.21.
      <https://github.com/nuxt/nuxt/releases/tag/v4.6.0>
      <https://github.com/nuxt/nuxt/issues/36514>
- [x] vue-router 5.4.0 (a direct dependency, published 2026-10-07), landed
      2026-10-09 after two days with no issue filed against it. It changes
      client navigation defaults this site relies on: the router now restores
      hashes and the top of the page by default, and history invalidates
      obsolete scroll positions. Typecheck, 246 tests, build, `check`, `a11y`,
      `a11y:browser` and `audit:runtime` clean, all 43 routes as on 5.3.1. In
      headless Chromium, side by side with 5.3.1's build on onyums and
      Skidbladnir: README anchor clicks, back and forward between anchors,
      about → blog → back → forward, a cross-project hop and back, and a cold
      load with a fragment land at the same positions on both, with no console
      output. Nuxt's own `scrollBehavior` governs all of it, so the new
      defaults change nothing a visitor sees here.
      <https://github.com/vuejs/router/releases/tag/v5.4.0>
- [x] Silenced Nitro's own `[request error]` stack-trace block on a 404, without
      replacing the error handler. Nitro logs it when the error is `fatal`, and
      `fatal` is only load-bearing on the client, where it is what makes a 404
      reached by in-app navigation show the error page at all. So both page-level
      404s now throw with `fatal: import.meta.client`, which the bundler resolves
      to `false` server-side and `true` client-side. A 404 is one structured JSON
      line again; `app/error.vue` still renders it and the status is still 404.
- [x] …and the three pages that arrived after it. The blog tab and both post
      pages (`/projects/<slug>/blog/<post>`, `/news/<post>`) threw `fatal: true`,
      so every unknown post logged a dozen-line `H3Error` stack beside its
      structured line (seen 2026-10-02). Now `import.meta.client` like the rest:
      one line each, the 404 page still rendered server-side and after an in-app
      navigation (checked in a browser through the router).
      `test/page-errors.test.ts` fails any page with `fatal: true`.
- [x] CI's actions off the Node 20 runtime, which GitHub now forces onto Node
      24 with a deprecation annotation on every run (seen on #17). Each moved
      to its first Node 24 major: `checkout` v5, `setup-node` v5,
      `build-push-action` v7, `setup-buildx-action` v4, `login-action` v4,
      `metadata-action` v6. Their breaking changes are the runtime itself,
      deprecated inputs this repo never set, and setup-node's automatic cache,
      which needs a `packageManager` field this repo does not have.
      <https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/>
      <https://github.com/actions/setup-node/releases/tag/v5.0.0>
      <https://github.com/docker/build-push-action/releases/tag/v7.0.0>

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
- [x] No `x-powered-by`, and a `Cross-Origin-Opener-Policy`. Nuxt's renderer,
      payload and island handlers set `x-powered-by: Nuxt` on every page
      themselves, after route rules apply, so it was on every response
      (live, 2026-10-05); `server/plugins/powered-by.ts` removes it in
      Nitro's `beforeResponse`. `Cross-Origin-Opener-Policy: same-origin`
      joins the `/**` headers: no page here keeps a handle on a window it
      opens, or is opened by one that should keep a handle on it. `npm run
      check` fails a response carrying `x-powered-by` and a page without the
      policy; against the previous build it failed on all 94 pages for each.
      <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy>
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
      `sizes:check` hold the cuts to the art. web.dev's LCP guidance agrees on
      both counts: never lazy-load the LCP image, and serve it at the size it
      is drawn. <https://web.dev/articles/optimize-lcp>
- [x] Every static file gets a `Cache-Control`. Eleven did not: the home
      page's LCP wallpaper (`/bg/hero.webp`) and the bevel map, all seven
      wordmarks, both shots and `/logo.svg` had none, so browsers fell back to
      heuristic freshness (a tenth of the time since `Last-Modified`, which is
      the image's build time). For a while after every nightly deploy, a repeat
      visit re-validated them. They now get `public, max-age=86400`, the same as
      the social cards. The wordmarks sit beside the pages
      (`/projects/<slug>.svg`) and the router has no in-segment `*.svg`
      pattern, so each one gets its own rule, generated from `data/projects.ts`.
      A dead `/logo.png` rule (no such file) is gone. `npm run check` now
      fails a referenced image, font, script or stylesheet with no
      `Cache-Control`, and fails a rendered page with a positive `max-age`. Both
      proved: the previous build fails on exactly the eleven files, and a
      deliberate `/projects/**` rule fails 16 pages.
- [x] Blog pages stop carrying the README they do not show. The blog tab and
      each post named their project through `useProject`, the about tab's
      fetch, and `useFetch` serializes its whole result into the page for
      hydration. So every blog page shipped the project's rendered README as
      a JSON string: Nanna's blog tab was 92.7 KB of HTML, 70 KB of it payload.
      `useProjectSummary` (`app/composables/useProjects.ts`) asks the same
      endpoint with `pick: ['slug', 'name', 'hero']`, under its own key. Blog
      tabs are now 22–23 KB, with payloads of 484–741 bytes. An unknown slug
      still 404s identically, and client navigation blog ↔ about still
      renders the README (checked in a browser, no console errors).
- [x] The about page ships its README once. It went twice: as rendered HTML,
      and again as a string in the hydration payload, which is serialized from
      whatever `useFetch` returns. `useProject` now takes the README out of the
      result on the server before it is serialized, keeps it in a closure for
      the render, and marks the payload `readmeOnServer`. Hydrating, the client
      binds no `innerHTML`, and Vue leaves the server's markup alone because it
      does not patch `innerHTML` during hydration. A client-side navigation
      fetches in the client and gets the string as before. About pages,
      2026-10-02: onyums 440 → 217 KB (gzipped 75 → 42 KB; payload 235 → 12.6
      KB), Skidbladnir 162 → 106 KB, WeftDB → 186 KB with a 146 KB README.
      Checked in a browser: README intact after hydration and when opened;
      client navigation onyums → Skidbladnir → back → blog → about renders
      each README; console empty. Also checked in snapshot-fallback mode
      (forced with a bad token). Phone LCP unchanged (~1350 ms, text that
      paints before the HTML ends); the win is bytes and JSON to parse.
- [x] Listing pages serialize card fields, not every project's whole copy.
      `useProjects` (home, `/projects`, `/status`) put every project's features,
      worked example, problem statement and download copy into the hydration
      payload, about 29 KB on each page; `/news` did the same to map slugs to
      names. They now keep `ProjectSummary` (`shared/types/project.ts`: the
      project less `PAGE_ONLY`), and `ProjectCard` is typed against it, so a
      card that starts reading a dropped field fails the typecheck rather than
      rendering empty. `/api/projects` itself is unchanged. Home 64.9 → 46.4 KB
      (gzipped 18.6 → 11.0), `/projects` 60.5 → 39.4, `/status` 57.0 → 35.8,
      `/news` 50.3 → 23.7. Visible text and JSON-LD are identical to main's on
      all four. Shaped-phone LCP: home 2208 → 2000 ms, `/projects` 2252 →
      2080 ms (median of 5).
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
- [x] …and the README renderer itself. `npm run sync` kept its own `marked`
      set-up with no highlighter, so every README in the snapshot had bare
      `<pre>` fences, and a page served from the fallback lost all its syntax
      colours. `renderMarkdown` and `highlight` moved from `server/utils/` to
      `shared/markdown/` (`server/utils/` re-exports them for Nitro's
      auto-imports), and the sync script renders with them. On 2026-10-02 all
      seven snapshot READMEs came out byte-identical to the live server's.
      `test/snapshot.test.ts` fails on a bare `<pre>`; it fails on main's
      snapshot. In forced-snapshot mode Nanna's about page has 16 Shiki blocks,
      and `check` and `a11y` are clean.
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
- [x] A copy button says it copied. `[copy]` turns `[copied]` on screen, but the
      button's name is pinned by its `aria-label`, so a screen reader heard
      nothing after pressing it (WCAG 4.1.3, status messages). `CodeLine` and
      `CodeBlock` each render an empty `role="status"` region, server-side so
      it exists before it changes, which reads "Copied to clipboard" for the
      same 1.6 s. Checked in headless Chromium over CDP with clipboard access
      granted: the polite region's text in the accessibility tree, the
      clipboard's contents, and the reset; `CodeBlock`'s region sits outside
      its `figcaption`, so it never becomes part of the figure's name.
      <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- [x] …and says when it could not. A refused clipboard write (denied
      permission, insecure context, a frame that forbids it) did nothing at
      all — the button stayed `[copy]` and whoever pressed it pasted what
      their clipboard already held. Found when the built-in browser's own
      clipboard refused it. `useCopy` (`app/composables/useCopy.ts`, now the
      one copy of the logic both components carried) selects the text
      instead, shows `[selected]` and announces "Could not copy. The text is
      selected; copy it with your keyboard." Checked over CDP with the
      permission denied: the selection is exactly the command, without the
      `$` sigil, and both buttons reset after 4 s.
- [x] Back returns a reader to the README they were reading. The about page
      folds its README, and a page reached by Back is rendered afresh, so it
      came back folded: the scroll position vue-router saved no longer
      existed, and a visitor 6,000 px down onyums' README landed at 2,700, the
      bottom of the folded page. `useReadmeFold`
      (`app/composables/useReadmeFold.ts`) keeps the fold in the history
      entry beside vue-router's own state, so Back and Forward reopen it
      before the page scrolls; a fresh visit by link still starts folded, and
      one folded again stays folded. A client navigation to a fragment inside
      the README opens it first (`hasAnchor`, `shared/markdown/anchor.ts`), as
      a browser does on a real one. A reload reopens it too, at the place the
      visitor was: Chromium drops a `replaceState` made while the page
      unloads, so that position goes to session storage on `pagehide`. Found
      by the vue-router 5.4 browser check; the same on 5.3.1. Proved in
      headless Chromium on onyums and Nanna, before and after: Back 2,700 →
      6,000, reload 2,700 → 6,000, a pushed `#heading` lands at the heading;
      the server's markup is unchanged.
- [x] …and a link to a README heading lands on it in Firefox. Chromium opens
      a closed `<details>` for a fragment by itself; Firefox does not, and Tor
      Browser is Firefox. So `/projects/onyums/about#how-onyums-compares`,
      followed from anywhere, left a Firefox visitor at the bottom of the
      folded page (y 2,701) with the heading hidden. `useReadmeFold` now looks
      the fragment up in the document once mounted, opens the fold and scrolls
      the heading in, unless the visitor already folded it in that entry.
      Proved in headless Firefox 155 over WebDriver BiDi on onyums and Nanna:
      the heading lands 80 px from the top (its scroll margin), Back and
      reload as in Chromium, no console output; Chromium unchanged, an
      encoded emoji slug included.
- [x] Run the browser pass in Firefox too — `npm run a11y:firefox`, in CI
      beside `a11y:browser`. Every browser check here was Chromium, and the
      onion service is reached in Tor Browser, which is Firefox; the bug
      above was visible only there. `scripts/lib/bidi.mjs` drives headless
      Firefox over WebDriver BiDi with Node's own WebSocket, the way
      `lib/cdp.mjs` drives Chromium, and `scripts/lib/browser.mjs` puts one
      page interface over both, so `check-a11y-browser.mjs` runs the same
      axe rules, the same read-to-the-bottom and the same console watch in
      either. First run: no violations and no console errors on 23 pages at
      both widths. Proved it bites on a stub server, in both engines: a
      console error, an uncaught exception, a CSP-refused inline script and
      two 8 px buttons each fail it; a clean page passes. Firefox reports a
      CSP refusal as a `javascript` log entry, so no listener is needed.
      <https://w3c.github.io/webdriver-bidi/>
- [x] Hold the README fold to its behaviour — `npm run check:navigation`
      (`scripts/check-navigation.mjs`), in CI in both engines. None of it runs
      on the server, so nothing else could see it break. On every about page
      whose README has a heading: unfold and read down, then Back, Forward and
      Back, and a reload all return to the same place (±4 px of where the
      reader was once the README's lazy images settled); a visit by link
      starts folded at the top; a cold load of `about#<heading>` lands on the
      heading; a client navigation to it shows it; a fold the visitor closed
      stays closed on Back. At 1280 and 390 px, 128 checks per engine, green
      on this build; at desktop width alone, main's build failed 32 in
      Chromium and 41 in Firefox. Firefox logs every cookie it refuses to a
      third-party response at error level (a README image from github.com
      sets three), which the driver ignores as the browser's notice, not the
      page's fault. It
      waits for scrolling to stop rather than a fixed time, because the site
      scrolls smoothly and a restore takes over a second. Writing it found a
      bug in the fix: the reload position was keyed by vue-router's entry
      number, which a fresh document load can reuse, so a cold link to a
      heading went to an older reading position instead; it is now read only
      on a reload or Back/Forward.
- [ ] A client navigation to a README heading stops short of it: Nuxt's hash
      scroll follows the stylesheet's `scroll-behavior: smooth`, and README
      images between here and the heading load while the page passes them
      and push it down, so it ends on screen (checked) but not at the top.
      Same before tonight's changes. Images with known sizes, or an instant
      hash scroll, would each fix it; the first needs the README's image
      sizes at render time.
- [x] No dead controls without script. Every page is server-rendered and
      reads fine with script off, which is how Tor Browser's "Safest" level
      serves the onion service — except the `[copy]` buttons, which were shown
      and did nothing when pressed. They carry `needs-script` now, and
      `@media (scripting: none)` in `main.css` hides them: the browser's own
      answer, so a visitor with script never sees a button arrive late.
      Checked in Firefox with `javascript.enabled` off (gone) and on (there),
      and in Chromium over CDP with script execution disabled (`display:
      none` on both, `flex` with script). `npm run check` fails a `<button>`
      on a public page without the class; on main's build it failed 12.
      <https://drafts.csswg.org/mediaqueries-5/#scripting>
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
      chunks, which their sourcemaps name. The registry filters by version
      itself; the script re-checks each range as a cross-check on what comes
      back. Proved by planting `braces@3.0.3` and
      `marked@4.0.9`: it fails on exactly the three advisories that apply.
- [x] …and the client bundle too. It has no sourcemaps (they would be served),
      so there was nothing to read its packages from. A client-only Vite plugin
      (`scripts/lib/client-packages.ts`) records every package with code
      rendered into a client chunk, with the version from its own
      `package.json`, and writes `.output/server/client-packages.json` once
      Nitro has compiled — inside the image, never under `public/` (a 404 from
      the server). `audit:runtime` asks the registry about those as well: 32
      today, 14 of them never seen by the server audit (`reka-ui`, `@nuxt/ui`,
      `@nuxt/icon`, `@nuxtjs/color-mode`…). It fails on a planted
      `marked@4.0.9`, on a missing inventory and on an empty one. Also learned:
      `@tiptap/markdown`'s `marked@17` never reaches a browser.
- [ ] Upstream: `@nuxt/devtools` 3.4.2 pins `simple-git ^3.36.0`, and
      `npm audit` reports four advisories against it (two critical, command
      execution through git options), patched only in `simple-git` 4. Not
      reachable here — `devtools: { enabled: false }`, and nothing of it
      ships — and Nuxt 4.6 still resolves the same versions. Moves when
      devtools does. <https://github.com/advisories/GHSA-858h-whjf-mvg5>
      Devtools' `launch-editor` also brought `shell-quote` 1.10.0 (critical,
      command injection in `quote()`); 1.12.0 is in range and the lockfile
      takes it since 2026-10-08. <https://github.com/advisories/GHSA-pqg4-j6r4-53mv>
      Still open, with no patched release at all: `braces` 3.0.3 (build-time,
      via `micromatch`) and `node-forge` 1.4.0 (via `listhen`, the dev
      server's TLS) — neither reaches the image; `audit:runtime` is clean.
      <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>
      <https://github.com/advisories/GHSA-86w9-cpqp-85rv>
- [x] …and the image's other binary. The onion gateway's 594 crates were
      audited by nothing. CI's onion job now runs `cargo audit --deny yanked
      --deny unsound`. First run, 2026-10-02: `yoke-derive` 0.8.3 was yanked,
      now bumped to 0.8.4 (a patch release, lockfile only). RUSTSEC-2023-0071
      (`rsa`, Marvin) has no patched release and comes in through arti. It is
      ignored in `onion/.cargo/audit.toml` with the evidence: it needs an RSA
      *private* key, and the live keystore holds only ed25519 and x25519 ones.
      Proved the check bites: exit 1 without the ignore, and exit 1 on the old
      lockfile. `bincode` (RUSTSEC-2025-0141) and `paste` (RUSTSEC-2024-0436)
      are unmaintained, reported but not failing; both are arti's to replace.
      <https://rustsec.org/advisories/RUSTSEC-2023-0071.html>
      <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>
      <https://github.com/advisories/GHSA-86w9-cpqp-85rv>

- [x] A README cannot stall the server. READMEs are fetched and rendered at
      request time, on the server's one thread, so a pattern that backtracks
      over one stalls every page the process serves. Two sources, both closed
      2026-10-05: marked 18.0.14's link-destination rule, cubic on a run of
      unicode whitespace (4 KB of U+00A0 after `[](`: 10.3 s here; 0.1 ms on
      18.1.0), and eight of this site's own patterns in
      `shared/markdown/readme.ts` and `slug.ts`, quadratic on input that opens
      and never closes (100 KB of `[`: 5.2 s; a 100 KB heading of `<a`: 2.5 s;
      about a millisecond each now). The eighth is the `<a href>` rule that
      arrived with splimes the same night, written in the old shape (100 KB of
      `<a `: 711 ms) and made linear in the merge. All 8 READMEs and the 76
      live posts render byte-identical before and after. `test/markdown-backtracking.test.ts`
      times each input; every case fails on the old code.
      <https://github.com/markedjs/marked/pull/4106>
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
- [ ] Upstream: the Skidbladnir README links `https://bitbucket.org/multicoreware/x265_git`,
      which Bitbucket redirects to the repo's wiki home, and that answers 404
      (`npm run check -- --external` against production, 2026-10-02). The
      repo itself is there: `…/x265_git/src` answers 200, so pointing the link
      at that path fixes it. The fix belongs in Skidbladnir's README; this
      page folds it in as-is.
- [ ] Upstream: the onyums README's table of contents links
      `#multiple-services-on-one-tor-client`, an anchor no heading in it produces.
- [ ] Upstream: three dead links in the WeftDB README, found by the weekly
      external-link check on 2026-10-08 (issue #16). A docs.rs badge points at
      `https://docs.rs/weftdb`, a 404 because the README itself says its library
      crates are "Not published yet"; and two links to
      `database/benches/{downsample_range,backup_cost}.rs` 404 because those
      files now live under `weftdb/benches/`. All three belong in WeftDB's
      README; this page folds it in as-is.
