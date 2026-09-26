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
bars the way a terminal does it.

## What renders where

| Route | What it is |
| --- | --- |
| `/` | The pitch, live project stats, and the catalogue |
| `/projects` | Every public project |
| `/projects/<slug>` | A marketing page per project: hero, why it exists, features, a worked example, the recent releases, and the repo's README folded away underneath |
| `/status` | Whether the site is rendering live data or the fallback snapshot, and how long it has been up |
| `/releases.xml` | An Atom feed of every release across every project |
| `/sitemap.xml` | Built from the same project list the pages render from |
| `/robots.txt` | Allows everything, points at the sitemap |
| `/api/projects` | Card-level JSON for every project |
| `/api/projects/<slug>` | One project, README and release history included |
| `/healthz` | Liveness for the container healthcheck, plus the data source and uptime |

Each project page also carries `SoftwareSourceCode` JSON-LD and its own Open
Graph card, so a link to it previews as itself rather than as the organization.

## How the data works

Each page is rendered per request. Stars, versions, downloads, licenses,
release tags and READMEs come from the GitHub and crates.io APIs at render time —
nothing is baked in at build.

Those upstream calls sit behind Nitro's cache (`server/utils/github.ts`): 15
minutes fresh, stale-while-revalidate for 6 hours. A visitor always gets freshly
rendered markup; the numbers inside it are at most 15 minutes old. That keeps the
site under GitHub's anonymous rate limit of 60 requests an hour without making
anyone wait on a cache miss.

If GitHub or crates.io is unreachable, the render falls back to
`data/projects.generated.json` — a committed snapshot refreshed by `npm run sync`.
An upstream outage degrades the numbers, not the site.

Set `GITHUB_TOKEN` (or `NUXT_GITHUB_TOKEN`) in the environment to lift the
anonymous rate limit. It is optional; nothing needs it to work.

`/status` shows which of the two is happening right now, per project. The server
also logs one JSON object per request on stdout — `docker logs
basicautomation-site | jq 'select(.status >= 400)'` — and warns once an hour for
as long as it has been answering from the snapshot.

## Adding a project

1. Add an entry to `data/projects.ts`. That file is the editorial layer: the
   pitch, the feature copy, and the code sample that shows what the thing feels
   like to use. Everything that moves on its own is fetched, not typed.
2. If it has a wordmark, drop it in `public/projects/<slug>.svg` and set `logo`.
   Same for a screenshot in `public/projects/shots/`. Then run `npm run sizes`,
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
npm run bases        # runtime Alpine still matches the node base (needs docker)
npm run contrast     # WCAG contrast for every palette colour, against the ground
npm run sizes        # re-read every image's intrinsic size
```

`npm test` is Vitest over the pure functions in `shared/` — README rewriting,
release shaping, heading slugs — and nothing else. It boots no Nitro and renders
no component: what a running server does is what `npm run check` asserts.

`npm run check` walks a running build: every page, every internal link and
asset, every URL the sitemap promises, and every social card, plus three paths
that must answer 404. It is what CI runs after the build, because a bundle that
compiles is not the same as a site that renders.

```sh
npm run start &
npm run check                      # against http://127.0.0.1:3000
npm run check -- --external        # also follow links off the site
```

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

The runtime image is plain Alpine with the node binary copied in rather than
`node:24-alpine`: Nitro bundles its dependencies into `.output`, so npm, yarn
and the addon headers exist only to build something.

`onion/` is a small Rust crate that serves the same site as a Tor onion service
through the organization's own `onyums`. It is built into this image by a second
stage and started beside Nitro by `docker-entrypoint.sh`: it proxies to the site
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
