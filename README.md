# basicautomation.io

The public site for [Basic Automation](https://github.com/basic-automation) — a
showcase for every open-source project the organization publishes.

The framing throughout is **toolmaker**: Basic Automation designs and builds
software tools for businesses, and publishes the sharp ones. An artificer makes
the instruments other people work with, and is the first to use them. Copy should
read that way — the projects are instruments with one job each, evidence of the
work, not products with feature lists.

Nuxt 4 with server-side rendering, Tailwind v4, and the **Paleday Tailwind**
palette from the Omarchy theme set. One flat background, no cards, no borders,
no rounded corners, Fira Code throughout: structure comes from rules and accent
bars the way a terminal does it. The one deliberate exception is the masthead,
a "glass" pane with a bevel, a drop shadow and rounded ends; everything below
it is flat.

## What renders where

| Route | What it is |
| --- | --- |
| `/` | The pitch, live project stats, and the catalogue |
| `/projects` | Every public project |
| `/projects/<slug>/about` | A marketing page per project: hero, why it exists, features, a worked example, the recent releases, and the repo's README folded away underneath. A desktop app's page also gets a download section: a direct link per platform to the newest release's installers. `/projects/<slug>` redirects here |
| `/projects/<slug>/blog` | That project's news, and `/projects/<slug>/blog/<post>` for one post |
| `/news` | The organization's own news, for what is about Basic Automation rather than one tool |
| `/admin` | The post editor — behind a login the app checks itself, and absent over Tor (below) |
| `/status` | Whether the site is rendering live data or the fallback snapshot, whether the onion service was last reached over Tor, and how long it has been up |
| `/releases.xml` | An Atom feed of every release across every project |
| `/news.xml` | An Atom feed of every published post, the site's own and every project's — `/news` as a feed |
| `/sitemap.xml` | Built from the same project list the pages render from |
| `/robots.txt` | Allows everything, points at the sitemap |
| `/api/projects` | Card-level JSON for every project |
| `/api/projects/<slug>` | One project, README and release history included |
| `/healthz` | Liveness for the container healthcheck, plus the data source, the onion service's state and uptime |

Each project page also carries `SoftwareSourceCode` JSON-LD and its own Open
Graph card, so a link to it previews as itself rather than as the organization.
An app with a download section adds `SoftwareApplication` beside it — the
systems it has installers for, the version they are, the release page, free —
built from exactly what that section renders, so it is absent whenever the
section is. A project's search-result description is its `metaDescription`, at
most 160 characters so it is not cut off; the longer `summary` is the lede and
the social preview's text.
Every page that names a card also gives its size and a text alternative
(`og:image:width`, `og:image:height`, `og:image:alt`). A project card's URL
carries the fingerprint it was rendered from (`?v=…`, from
`public/projects/og/cards.json`), so a re-rendered card is a new URL rather than
one a network has already cached the old picture under.
Each post carries `BlogPosting` JSON-LD naming the blog it belongs to. Every
page names its one address with `<link rel="canonical">`, the same string as its
`og:url` and its sitemap entry, so `/PROJECTS` or `/news/` or a tracking query
string is never mistaken for a second page. `/projects/<slug>`, a permanent
redirect to the project's about tab, hands its query string on, so a campaign
link's `utm_*` tags are not lost on the way.

## Posts

Posts are markdown files at `$CONTENT_DIR/posts/<project>/<slug>.md`, on the
named volume `basicautomation-content` — that volume is the only copy, so it
belongs in the backup set. `site` is the reserved section for `/news`. They are
rendered at request time by the same `marked` + Shiki pipeline as the READMEs,
so a post needs no rebuild — except that a post's headings keep their level
(its title is the page's `h1`, so its `##` is an `h2`), where a README's are
demoted one. Drafts are hidden from every listing, the feed and the sitemap,
and carry `noindex`, but are reachable by URL, for previewing.

Every post and blog page names one canonical address, previews with its
blog's card (the project's own, or the organization's for `/news`), and
carries structured data: `BlogPosting` per post, `Blog` on each blog's index.
`/news.xml` is the feed. CI renders all of this against a few test posts in
`test/fixtures/content/` — never the live content.

`/admin` writes them. The app authenticates the editor itself: `/admin` and
`/api/admin/*` answer 401 without the editor's credential, which is the same
user and bcrypt hash as the basic auth Caddy asks for in front, so a browser is
prompted once. That makes the network path irrelevant — a request that reached
the container without going through Caddy, from another container on its
network, is asked for the credential too. Set `NUXT_ADMIN_USER` and
`NUXT_ADMIN_PASSWORD_HASH` (a bcrypt hash, as `caddy hash-password` prints);
without both, the editor is a 404 everywhere but `nuxt dev`.

Over Tor the editor does not exist at all, credential or not: the onion gateway
marks everything it forwards `x-via-onion`, overwriting any copy a visitor sent,
and a marked request is a 404. Every handler under `server/api/admin/` calls
`requireEditor` first, and a unit test fails if one does not.

## How the data works

Each page is rendered per request. Stars, versions, downloads, licenses,
release tags and READMEs come from the GitHub and crates.io APIs at render time —
nothing is baked in at build.

Those upstream calls sit behind Nitro's cache (`server/utils/github.ts`),
stale-while-revalidate for 6 hours. How long a response counts as fresh is
worked out from the number of projects (`shared/github/budget.ts`): each repo
costs three GitHub calls per refresh, and the site keeps itself to 54 of
GitHub's 60 anonymous requests an hour. Seven projects gives 30 minutes — 42
calls an hour. With a token the site allows itself 300 of GitHub's 5,000 and
the same seven projects refresh every 5 minutes — 252 calls an hour; the
deployed site has one. A visitor always gets freshly rendered markup, and adding
a project lengthens the freshness window instead of quietly running the site
into the rate limit. `/status` says which of the two it is running on.

The download section on an app's page comes out of that same releases call,
since each release in it lists its files: `pickDownload`
(`shared/github/releases.ts`) takes the newest full release that has
installers — or the newest pre-release, while there is no full one — and drops
the files nobody installs by hand (signatures, updater archives and manifests,
the source archive). `groupInstallers` (`shared/github/installers.ts`) sorts the
rest by platform and edition from their Tauri bundle names. What the section
says around the links — which edition to take, what the first launch looks like
on an unsigned build — is editorial, in the project's `downloads` entry in
`data/projects.ts`. With no release carrying installers, the section is not
drawn, and the hero's link and the release strip still lead to the release page.

Each GitHub request is conditional: the site keeps the ETag of the last answer
and sends `If-None-Match`, and a repo that has not changed comes back
`304 Not Modified` — which, with a token, costs none of the quota
(`shared/github/conditional.ts`). `/status` shows how many of its calls were.

If GitHub or crates.io is unreachable, the render keeps the last answer it had
for that repo, marked `stale`. A process that has not reached upstream since
it started falls back to `data/projects.generated.json` instead, a committed
snapshot refreshed by `npm run sync`. Either way an upstream outage degrades the
numbers, not the site. A failed refresh never swaps live numbers for older
snapshot ones.

Set `NUXT_GITHUB_TOKEN` in the server's environment to lift the anonymous rate
limit (the compose file fills it from `BASICAUTOMATION_GITHUB_TOKEN`; a bare
`GITHUB_TOKEN` is read by `npm run sync` but not by the server). It is optional;
nothing needs it to work.

`/status` shows which of the three is happening right now (live, stale or snapshot), per project, along with
GitHub's own count of the rate limit — how many calls are left this hour and when
it resets, read from the headers of its last response — and when the onion
service was last reached over Tor, from the gateway's own ten-minute self-fetch.
Thirty minutes without one turns `/healthz`'s `status` to `degraded` (still a
200: the clearnet site is serving). The server
also logs one JSON object per request on stdout — `docker logs
basicautomation-site | jq 'select(.status >= 400)'`, or `select(.via == "onion")`
for the visits that came over Tor — and warns once an hour for
as long as it has been answering from the snapshot, and once when the GitHub
quota runs out (`event: "upstream.rate_limited"`).

## Adding a project

1. Add an entry to `data/projects.ts`. That file is the editorial layer: the
   pitch, the feature copy, and the code sample that shows what the thing feels
   like to use. Everything that moves on its own is fetched, not typed. Give it
   a `metaDescription` of 160 characters or fewer (a test fails otherwise), and
   an app with `downloads` an `applicationCategory`.
2. If it has a wordmark, drop it in `public/projects/<slug>.svg` and set `logo`.
   Same for a screenshot in `public/projects/shots/`. A card shows the
   wordmark; set `cardImage` (16:10) only when the card should lead with art
   instead, as Skidbladnir's does for its 1.0 campaign. Then run `npm run sizes`,
   which records each image's intrinsic size in
   `data/asset-sizes.generated.json` so the page can reserve its space before
   the file arrives. CI fails if that file and the images disagree.
3. Run `npm run og` to render its social card into `public/projects/og/`, and
   commit it. Cards are generated rather than rendered per request: everything
   on one is editorial, and nothing live belongs in an image a social network
   caches for a month.
4. Run `npm run sync` to refresh the offline fallback snapshot.

Editing an existing project's name, kind, hero line, tagline, status, accent or
wordmark changes its card too, so re-render it the same way. CI will tell you if
you forget: `npm run og:check` recomputes what every committed card was rendered
from and fails when one no longer matches `data/projects.ts`.

## Development

```sh
npm install
npm run dev          # http://localhost:3000
npm run build        # .output/ — a self-contained Nitro node server
npm run start        # serve the build
npm run typecheck
npm test             # unit tests over the pure helpers in shared/
npm run sync         # refresh data/projects.generated.json
npm run og           # re-render the per-project social cards (needs Chromium)
npm run og:check     # are the committed cards still current? (no Chromium)
npm run shot         # re-cut the screenshots from their READMEs' own (needs ImageMagick)
npm run shot:check   # has an upstream screenshot changed since its cut? (network)
npm run bases        # runtime Alpine still matches the node base (needs docker)
npm run contrast     # WCAG contrast for every palette colour, against the ground
npm run sizes        # re-read every image's intrinsic size
npm run audit:runtime # advisories for what .output/server ships (after a build)
```

`npm test` is Vitest over the pure functions in `shared/` — README rewriting,
release shaping, heading slugs — and nothing else. It boots no Nitro and renders
no component: what a running server does is what `npm run check` asserts.

`npm run check` walks a running build: every page, every internal link and
asset, every URL the sitemap promises, and every social card (which must state
its size and alt text), plus three paths that must answer 404 and every
project's `/projects/<slug>`, which must redirect with its query string intact. It also asserts the structural accessibility of each page
— one `h1`, one `main`, a language, a named `nav` when there is more than one,
an `alt` on every image, no positive `tabindex`. It is what CI runs after the build, because a bundle that
compiles is not the same as a site that renders.

```sh
npm run start &
npm run check                      # against http://127.0.0.1:3000
npm run check -- --external        # also follow links off the site
npm run a11y                       # axe-core over every page, through jsdom
npm run a11y:browser               # the layout rules, in headless Chromium
npm run vitals                     # LCP and CLS, phone and desktop, median of 3
npm run font                       # re-cut the preloaded core of Fira Code
```

`npm run a11y` runs roughly ninety axe-core rules against the markup each page
actually served. The rules that need a layout engine are named and skipped
rather than silently failing — jsdom has none — so this is "every axe rule that
can be judged from markup". `npm run a11y:browser` runs those skipped rules —
touch-target size, keyboard access to scrollable regions, the viewport meta —
in headless Chromium at a desktop and a phone width (set `CHROME_PATH` if
Chromium is not on `PATH`), reading each page to the bottom so lazy content
loads, and fails on any console error, uncaught exception or CSP refusal the
page produces along the way. Both walk every page the sitemap lists, so a new
project is audited the moment it is published. Colour contrast is measured
separately and more directly by `npm run contrast`.

`npm run vitals` measures Largest Contentful Paint and Cumulative Layout Shift
the same way — headless Chromium, every sitemap page, cold loads — at a
throttled phone profile and at desktop, and reports each against web.dev's
thresholds. It is lab data, not field data, and a report rather than a gate
unless run with `--strict`. Point it at the live site to measure what is
deployed: `npm run vitals -- https://basicautomation.io`. For comparing two local
builds, add `--shaped`: the phone profile then goes through a real shaped link
(one shared 1.6 Mbps pipe) instead of DevTools' throttling, which has produced
differences a real link does not have.

Fira Code is served in two cuts of one family: a 61 KB core — Latin-1, Greek,
punctuation, arrows, maths and box drawing, which is everything the pages and
READMEs set — that every page preloads, and the full 113 KB font behind it by
`unicode-range`, which a browser fetches only for a character the core lacks.
`npm run font:check` (in CI) fails if either cut or its declared range drifts.

`npm run audit:runtime` (in CI, after the build) is `npm audit` narrowed to the
code a visitor's request can reach: the packages Nitro traced into
`.output/server/node_modules`, plus the ones it inlined into the server chunks,
read from their sourcemaps. It fails on a high or critical advisory that applies
to one of them. Plain `npm audit` reports the whole lockfile, so it also counts
the build's file globbing and the dev server's certificate helper, and it can
stay red on advisories nobody can patch.

External links are followed weekly instead, by `.github/workflows/links.yml`,
which keeps a single issue in sync with what it finds. They are a report rather
than a gate: the project pages fold in each repo's README, so most dead links
here are somebody else's to fix, and none of them should fail a pull request.

## Deployment

The site runs as a container in the DeepStack compose project, behind Caddy,
which terminates TLS for `basicautomation.io` and proxies to it.

```sh
docker build -t ghcr.io/basic-automation/basicautomation.io:latest .
docker run --rm -p 3000:3000 ghcr.io/basic-automation/basicautomation.io:latest
```

`deploy/compose.yaml` holds the service definition as it appears in DeepStack.

Every response carries a Content-Security-Policy, built in
`shared/security/csp.ts`. It matters here because each project page folds in
that repo's README and renders its HTML as-is: the content arrives at request
time and changes without a deploy. Rendered pages get a fresh script nonce per
request (`server/plugins/csp-nonce.ts`), stamped on the scripts Nuxt emits and
never on the page body, so an inline script, event handler or `<style>` block
that arrives in a README does not apply. `font-src 'self'` and `connect-src 'self'` also state two of the
site's own rules — one self-hosted typeface, no third-party calls — somewhere a
browser enforces them. `img-src` allows any https host, because a README's
badges are somebody else's URLs. Those images load lazily, so a README left
folded costs the visitor no request to another host until it is opened.

Links that leave the site carry `rel="noreferrer noopener"`, except links on the
clearnet site to the organization's own repositories, which carry `noopener`
alone (`shared/html/rel.ts`). GitHub's traffic page counts only visits that
arrive with a referrer, and the site's `Referrer-Policy` sends the origin alone,
never the page or its query. Over the onion service every link keeps
`noreferrer`.

The runtime image is plain Alpine with the node binary copied in rather than
`node:24-alpine`: Nitro bundles its dependencies into `.output`, so npm, yarn
and the addon headers exist only to build something.

`onion/` is a small Rust crate that serves the same site as a Tor onion service
through the organization's own `onyums`. It is built into this image by a second
stage and started by the site itself (`server/plugins/onion-gateway.ts`, when
`ONION_GATEWAY` names the binary); if it exits, the site exits with it. It proxies to the site
over loopback and writes its `.onion` address to `/run/onion/address`, which the
site reads back through `/api/onion` to advertise the address on the onyums
project page. The identity key lives in the named volume `basicautomation-onion`
— that volume *is* the address, so losing it renames the service.

`docs/onion.md` is the design note: why a forwarding `Router` rather than a raw
TCP tunnel, and what each slice actually answered.

## Theme

`app/assets/css/main.css` carries the whole palette. Paleday Tailwind is the
photographic negative of Palenight Tailwind: every role's colour is complemented
channel-wise, so hue flips to its opposite rather than lightness alone — the
violet accent becomes lime, the gray-800 ground becomes warm olive parchment —
then snapped back onto the nearest Tailwind v4 colour in OKLab. Every value in
the theme block is a literal Tailwind v4 colour.

To switch the site to the dark Palenight variant, swap the values in the
`@theme` block and the `ACCENT_HEX` map in `app/utils/projects.ts`.

## License

MIT.
