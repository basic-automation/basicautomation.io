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
- [ ] Regenerate the social cards whenever `data/projects.ts` changes — `npm run og`
      is manual today, so an edited hero line and its card can drift apart

## Phase 2 — Discovery ✅

- [x] `sitemap.xml` and `robots.txt`
- [x] JSON-LD `SoftwareSourceCode` per project page
- [x] RSS/Atom feed of releases across the org — `/releases.xml`

## Phase 3 — Operations

- [ ] Create the `glance.basicautomation.io` DNS record in Cloudflare — the Caddy
      site block exists and validates, but the name does not resolve yet, so
      Glance is only reachable on the LAN at `:5188` since it moved off the apex

- [ ] Ship `GITHUB_TOKEN` to the container so the rate limit stops being a factor
      (the wiring is already there — `deploy/compose.yaml` reads
      `BASICAUTOMATION_GITHUB_TOKEN`; what is missing is the secret itself, which
      is the owner's to create)
- [x] Structured request logging, and a `status` page fed by `/healthz`
- [x] Alert when the site has been serving from the fallback snapshot for more than an hour
- [x] Trim the image: the runtime layer is no longer a full `node:24-alpine`
- [ ] Keep `onion/`-adjacent: the Dockerfile's `alpine:3.24` runtime must stay in
      step with whatever base `node:24-alpine` uses, because the node binary is
      linked against that Alpine's musl. Check on every node base bump:
      `docker run --rm node:24-alpine cat /etc/alpine-release`
- [ ] Move the runtime to distroless — roughly another 60 MB off. BLOCKED on the
      healthcheck: `deploy/compose.yaml` uses `CMD-SHELL`, and distroless has no
      shell, so this needs the compose healthcheck converted to exec form first,
      which touches the live DeepStack stack
- [ ] Evaluate GitHub REST API version `2026-03-10`. The calls now pin
      `2022-11-28` explicitly, which GitHub supports until **10 March 2028**; the
      breaking changes in the newer version (`has_downloads` removed from
      Repository, `merge_commit_sha` removed from PRs, `cvss_severities`) do not
      touch any field this site reads, so the upgrade looks free — but verify
      before the sunset rather than after.
      <https://docs.github.com/en/rest/about-the-rest-api/api-versions>
- [ ] Revisit the type checker: `vue-tsc` does not support TypeScript 7 (it still
      reaches for `typescript/lib/tsc`, which TS 7 no longer exports), so the
      project uses Golar via its `golar/unstable` entrypoint — move off `unstable`
      once a stable one exists, or back to `vue-tsc` once it supports TS 7
- [ ] Silence Nitro's own `[request error]` stack-trace block on a 404. The
      vue-router half is fixed (`app/pages/[...slug].vue`), but Nitro still prints
      six unstructured lines per 404 beside the JSON request log. Suppressing it
      means replacing the error handler that renders the 404 page, so it needs a
      way to keep that rendering — not worth breaking the error page for.

## Phase 4 — Reach

- [ ] Serve the site as a Tor onion service too, via `onyums` — the org's own crate, on the org's own site
      - [x] **Slice 1** — the reverse proxy `onyums` will serve (`onion/`), tested
            over plain TCP against the real server. See `docs/onion.md`.
      - [ ] **Slice 2 — next** — swap the `TcpListener` in `onion/src/main.rs` for
            `OnionService::builder().router(app)`. The real risk is whether arti
            bootstraps from the DeepStack network at all; answer that before any
            deploy. Also needs a decision on keystore persistence (the onion
            address is only stable if the keystore is) and on whether an onion
            visitor should be served HTML whose canonical links point at the
            clearnet domain.
      - [ ] **Slice 3** — compose service, keystore volume, and an
            `Onion-Location` header on the clearnet site. Tor Browser only
            honours that header when the page is served over HTTPS, is not itself
            an onion site, and the value is a valid `http(s)://…onion` URL; a
            subdomain in the onion address suppresses the banner.
            <https://community.torproject.org/onion-services/advanced/onion-location/>
- [ ] Decide what happens to `basic-automation.github.io`, which still serves the old page.
      This is now load-bearing: the Skidbladnir README embeds a screenshot from
      `https://basicautomation.io/ba-nextGenIMG/…`, a path the old site served and
      this one does not, so that project's page renders a broken image. Either
      serve the legacy path or fix the README upstream.

## Cross-cutting

- [x] Accessibility, structural: a skip link, a real `h1` on every project page,
      named `nav` landmarks, reduced-motion
- [ ] Accessibility, contrast — **needs an owner decision**, because the palette is
      locked and fixing this means changing what a colour role *is*. Measured
      against the single `#d8d8d0` ground:

      | token            | hex       | ratio | AA normal |
      | ---              | ---       | ---   | ---       |
      | `pn-muted`       | `#7c7c67` | 2.97  | FAIL      |
      | `pn-accent`      | `#5ea500` | 2.14  | FAIL      |
      | `pn-bright-cyan` | `#fb2c36` | 2.66  | FAIL      |
      | `pn-magenta`     | `#497d00` | 3.47  | large only |
      | `pn-bright-green`| `#7f22fe` | 4.11  | large only |

      `pn-muted` carries every label and date on the site and `pn-accent` carries
      link text. `pn-rule` (1.62) is decorative separators only and is exempt.
      The options are: retire `pn-muted` in favour of `pn-dim` (4.82, passes)
      wherever it carries information, or change the values — which the locked
      palette rule forbids without the owner saying so.
- [x] A real 404 check: every internal link, every render, on every route — `npm run check`
- [ ] Check external links on a schedule. `npm run check -- --external` exists but
      nothing runs it; today it reports two genuinely dead links in fetched
      READMEs (the Skidbladnir screenshot above, and a `LICENSE` the Skidbladnir
      repo does not contain) and one stale table-of-contents anchor in the onyums
      README. All three are upstream fixes, which is exactly why this wants to be
      a periodic report rather than a CI gate.
