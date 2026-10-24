import { contentSecurityPolicy } from './shared/security/csp.ts'
import { projects } from './data/projects.ts'
import { clientPackages } from './scripts/lib/client-packages.ts'

// Which packages the client bundle is made of, for `npm run audit:runtime`.
const shippedToBrowsers = clientPackages()

export default defineNuxtConfig({
  // Nuxt UI carries its own Tailwind v4 pipeline, so the standalone
  // @tailwindcss/vite plugin is gone — running both processed main.css twice.
  modules: ['@nuxt/ui'],

  // The library's components are used for behaviour (focus, keyboard, ARIA),
  // never for their looks; app.config.ts strips them back to the flat house
  // style. `ui.theme.colors` maps Nuxt UI's semantic slots onto Paleday.
  ui: {
    theme: {
      colors: ['primary', 'neutral', 'success', 'info', 'warning', 'error'],
    },
  },

  compatibilityDate: '2026-09-24',
  // Nuxt 5's defaults, on request only — never what ships. CI typechecks the
  // tree this way too, so code that only works with Nitro's auto-imports, or
  // with any other v4-only default, fails a pull request rather than the
  // eventual move. https://nuxt.com/docs/4.x/getting-started/upgrade
  ...(process.env.NUXT_TRY_V5 === '1' ? { future: { compatibilityVersion: 5 as const } } : {}),
  devtools: { enabled: false },

  // Every page is rendered on the server, per request. The GitHub and
  // crates.io calls behind that rendering are cached (see server/utils/github.ts),
  // so the HTML is always fresh even though upstream is only polled occasionally.
  ssr: true,

  // Routing ignores case, said out loud: `/PROJECTS` renders `/projects` and
  // names it as its canonical address (`npm run check` holds that). It is v4's
  // default; Nuxt 5 makes routing case-sensitive, which would turn every such
  // link into a 404 (seen on a `NUXT_TRY_V5` build, 2026-10-19).
  router: { options: { sensitive: false } },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Optional. Lifts GitHub's anonymous 60 req/hour limit, and shortens the
    // refresh from 30 minutes to 5 (shared/github/budget.ts). Nuxt reads it from
    // NUXT_GITHUB_TOKEN only — a bare GITHUB_TOKEN is not mapped; the compose
    // file sets it from BASICAUTOMATION_GITHUB_TOKEN.
    githubToken: '',
    // The post editor's credential, checked by the app itself
    // (server/utils/adminGuard.ts): the same user and bcrypt hash as Caddy's
    // `admin_auth_gate`, from NUXT_ADMIN_USER and NUXT_ADMIN_PASSWORD_HASH.
    // No user or no hash, no editor — it answers 404 outside `nuxt dev`.
    adminUser: '',
    adminPasswordHash: '',
    public: {
      siteUrl: 'https://basicautomation.io',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#d8d8d0' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // So a reader finds the releases feed from any page on the site.
        {
          rel: 'alternate',
          type: 'application/atom+xml',
          title: 'Basic Automation — releases',
          href: '/releases.xml',
        },
        // …and the posts feed, the same way: `/news` as Atom.
        {
          rel: 'alternate',
          type: 'application/atom+xml',
          title: 'Basic Automation — news',
          href: '/news.xml',
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          // The core cut, not the full font: it is what every page sets.
          href: '/fonts/FiraCode-VF-core.woff2',
          crossorigin: 'anonymous',
        },
      ],
    },
  },

  nitro: {
    preset: 'node-server',

    // The documentation pages ship inside the server bundle: they are reviewed
    // and edited like code, so they should change only with a build — unlike
    // posts, which the admin page writes to a volume. See
    // `server/utils/projectDocs.ts`.
    serverAssets: [{ baseName: 'projectdocs', dir: './project-docs' }],

    // Caddy terminates TLS and proxies in; trust its forwarded headers so
    // request URLs and client IPs are the real ones.
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Frame-Options': 'DENY',
          'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
          // No page here is opened by, or opens, a window it should keep a
          // handle on, so none shares a browsing-context group with a
          // cross-origin one: a page that `window.open`s this site gets no
          // reference back into it.
          'Cross-Origin-Opener-Policy': 'same-origin',
          // What a page may load — see `shared/security/csp.ts`. This is the
          // nonce-less form every response gets; rendered pages have it
          // replaced with one carrying a per-request nonce by
          // `server/plugins/csp-nonce.ts`.
          'Content-Security-Policy': contentSecurityPolicy(),
        },
      },
      // Hashed build output is content-addressed and safe to cache forever.
      '/_nuxt/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      '/og.png': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      // Every other file in public/ is named, not hashed, so a day — the same as
      // the cards — rather than forever. Without a rule these had no
      // Cache-Control at all and fell back to heuristic freshness: a tenth of
      // the time since Last-Modified, which is the image's build time, so for
      // minutes after each nightly deploy a repeat visitor re-validated the
      // home page's LCP wallpaper before painting it.
      '/bg/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      '/projects/shots/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      // The wordmarks sit beside the pages (`/projects/<slug>.svg` next to
      // `/projects/<slug>/about`), so this must not widen to `/projects/**`:
      // that would hand every rendered project page a day-long cache. The
      // router has no `*.svg` pattern within a segment either, so each one is
      // named, from the same list the pages are built from.
      ...Object.fromEntries(projects.flatMap((p) => (p.logo
        ? [[p.logo, { headers: { 'Cache-Control': 'public, max-age=86400' } }]]
        : []))),
      '/logo.svg': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      '/onion-splash.webp': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      // The per-project social cards, generated by `npm run og`.
      '/projects/og/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      '/favicon.ico': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      '/favicon-32.png': { headers: { 'Cache-Control': 'public, max-age=86400' } },
      '/fonts/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      '/apple-touch-icon.png': { headers: { 'Cache-Control': 'public, max-age=86400' } },
    },

    compressPublicAssets: { brotli: true, gzip: true },
  },

  vite: {
    plugins: [shippedToBrowsers.plugin],
  },

  hooks: {
    'nitro:init'(nitro) {
      nitro.hooks.hook('compiled', () => shippedToBrowsers.write(nitro.options.output.serverDir))
    },
  },
})
