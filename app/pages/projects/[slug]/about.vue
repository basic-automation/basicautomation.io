<script setup lang="ts">
import { formatSize, groupInstallers, type OsFamily } from '~~/shared/github/installers'
import { outboundRel } from '~~/shared/html/rel'
import { socialCardPath } from '~~/shared/posts/section'
import { screenshotPath } from '~~/shared/assets/shots'
import { applicationId, softwareApplicationLd } from '~~/shared/seo/application'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { project, error, readmeHtml, hasReadme } = await useProject(slug)
const readmeFold = useReadmeFold(readmeHtml)

if (error.value || !project.value) {
  // Client-only `fatal`, for the reason spelled out in `app/pages/[...slug].vue`:
  // on the server it buys a Nitro stack trace and nothing else.
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'No such project',
    fatal: import.meta.client,
  })
}

const meta = computed(() => project.value?.meta ?? null)

// Only the pages that render the address ask for it; every other page would be
// paying for a request whose answer it never shows. Serving this site implies
// showing the demo, so one flag covers both.
const showsTorDemo = computed(() => project.value?.servesThisSite === true || project.value?.showsTorDemo === true)

// Same key as OnionFrame's own request, so this is deduped rather than a second
// round trip. The page needs it because the copy below refers to the frame, and
// the frame is absent whenever the snapshot was captured from another build.
type SnapshotResponse =
  | { available: false }
  | { available: true, address: string, status: number, bytes: number, elapsedMs: number, fetchedAt: number }

const { data: snapshotData } = await useFetch<SnapshotResponse>('/api/onion-snapshot', {
  key: 'onion-snapshot',
  immediate: showsTorDemo.value,
  default: (): SnapshotResponse => ({ available: false }),
})

/** Passed to `OnionFrame`, which renders nothing when it is null. */
const torSnapshot = computed(() => (snapshotData.value?.available ? snapshotData.value : null))
const hasTorFrame = computed(() => torSnapshot.value !== null)

const { data: onionData } = await useFetch<{ address: string | null }>('/api/onion', {
  key: 'onion-address',
  immediate: showsTorDemo.value,
  default: () => ({ address: null }),
})
const onion = computed(() => onionData.value?.address ?? null)

const links = computed(() => {
  const p = project.value
  if (!p) return []
  const m = p.meta
  const out: { label: string, href: string }[] = [
    { label: 'source', href: m?.htmlUrl ?? `https://github.com/basic-automation/${p.repo}` },
  ]
  if (m?.crateUrl) out.push({ label: 'crates.io', href: m.crateUrl })
  if (m?.docsUrl) out.push({ label: 'docs', href: m.docsUrl })
  if (m?.latestRelease) out.push({ label: `release ${m.latestRelease.tag}`, href: m.latestRelease.url })
  for (const l of p.links ?? []) out.push({ label: l.label.toLowerCase(), href: l.href })
  return out
})

/**
 * The changelog strip: the most recent releases GitHub reports, newest first.
 * Pre-releases are in — for enlil, nisaba and Skidbladnir that is the whole
 * history — and marked, so "v0.1.1" doesn't read as a finished thing.
 */
const releases = computed(() => meta.value?.releases ?? [])

const releasesUrl = computed(() =>
  `https://github.com/basic-automation/${project.value?.repo}/releases`)

/**
 * The download section: a direct link per platform for the edition to
 * recommend, a quieter line for any other, from the release `pickDownload`
 * chose — the newest full release, or the newest pre-release when there is no
 * full one yet. Null, and the section absent, whenever there is nothing to
 * link: no `downloads` in the project's data, no release with installers, or a
 * fallback snapshot from before downloads were recorded. The hero's link and
 * the release strip still lead to the release page then.
 *
 * It also stays absent when the recommended edition has no files of its own,
 * because "take the standard one above" over a list with no standard one in
 * it would be advice the page cannot follow.
 */
const download = computed(() => {
  const config = project.value?.downloads
  const release = meta.value?.download
  if (!config || !release?.assets?.length || !config.editions.length) return null
  const groups = groupInstallers(release.assets, config.editions.map((e) => e.name))
  const first = groups[0]
  if (!first || first.name !== config.editions[0]!.name) return null
  const labelOf = (name: string) => config.editions.find((e) => e.name === name)?.label ?? name
  return {
    release,
    primary: { ...first, label: labelOf(first.name) },
    others: groups.slice(1).map((g) => ({ ...g, label: labelOf(g.name) })),
    note: config.editionNote ?? null,
    firstLaunch: config.firstLaunch ?? [],
  }
})

const caveatFor = (os: OsFamily) => project.value?.downloads?.caveats?.[os] ?? null

const ago = useRelativeTime()

/** Kept deliberately small and late: this is a pitch, not a package listing. */
const facts = computed(() => {
  const m = meta.value
  const rows: { label: string, value: string }[] = []
  if (!m) return rows
  if (m.crateVersion) rows.push({ label: 'version', value: `v${m.crateVersion}` })
  else if (m.latestRelease) rows.push({ label: 'release', value: m.latestRelease.tag })
  if (m.language) rows.push({ label: 'language', value: m.language })
  if (m.license) rows.push({ label: 'license', value: m.license })
  if (m.stars) rows.push({ label: 'stars', value: String(m.stars) })
  if (m.crateDownloads) rows.push({ label: 'downloads', value: compactNumber(m.crateDownloads) })
  if (m.pushedAt) rows.push({ label: 'updated', value: ago(m.pushedAt) })
  return rows
})

/**
 * Structured data for the page, as `SoftwareSourceCode` — which is what this
 * is: a page about a published body of source, not a product listing. Every
 * field is something the page already states; nothing is asserted here that a
 * reader could not also see.
 */
const siteUrl = useSiteOrigin()

/** `noopener` alone for the org's own repos on the clearnet site; see shared/html/rel.ts. */
const relFor = (href: string) => outboundRel(href, siteUrl)

const aboutUrl = computed(() => `${siteUrl}/projects/${slug.value}/about`)

/**
 * For an app with a download section, the program itself, as
 * `SoftwareApplication` — built from exactly what that section renders, so it
 * is absent whenever the section is. See `shared/seo/application.ts`.
 */
const applicationLd = computed(() => {
  const p = project.value
  const d = download.value
  if (!p?.applicationCategory || !d) return null
  return softwareApplicationLd({
    pageUrl: aboutUrl.value,
    name: p.name,
    description: p.metaDescription ?? p.summary,
    category: p.applicationCategory,
    release: d.release,
    installers: d.primary.installers,
    screenshot: p.screenshot ? `${siteUrl}${screenshotPath(p.screenshot)}` : undefined,
    image: `${siteUrl}${socialCardPath(p.slug)}`,
    publisher: organizationRef(siteUrl),
  })
})

const jsonLd = computed(() => {
  const p = project.value
  if (!p) return ''
  const m = p.meta

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    'name': p.name,
    'alternateName': p.repo,
    'headline': p.hero,
    'description': p.summary,
    // The tab's own address: `/projects/<slug>` is a 301 to it.
    'url': aboutUrl.value,
    'codeRepository': m?.htmlUrl ?? `https://github.com/basic-automation/${p.repo}`,
    // Referenced, not repeated: the description lives on the landing page, and
    // a consumer reading two pages of this site can tell it is one organization.
    'author': organizationRef(siteUrl),
    'publisher': organizationRef(siteUrl),
    'isAccessibleForFree': true,
    'image': `${siteUrl}${socialCardPath(p.slug)}`,
  }

  if (m?.language) data.programmingLanguage = m.language
  if (m?.license) data.license = `https://spdx.org/licenses/${m.license}.html`
  if (m?.createdAt) data.dateCreated = m.createdAt
  if (m?.pushedAt) data.dateModified = m.pushedAt
  if (m?.topics?.length) data.keywords = m.topics.join(', ')
  // The crate version is the one a reader can actually install; a release tag
  // is the fallback for the projects that aren't published to crates.io.
  if (m?.crateVersion) data.version = m.crateVersion
  else if (m?.latestRelease) data.version = m.latestRelease.tag
  if (m?.crateUrl) data.downloadUrl = m.crateUrl
  if (m?.docsUrl) data.documentation = m.docsUrl
  // The source is the source of the program described beside it.
  if (applicationLd.value) data.targetProduct = { '@id': applicationId(aboutUrl.value) }

  return ldJson(data)
})

useHead({
  script: computed(() => [
    { type: 'application/ld+json' as const, innerHTML: jsonLd.value },
    ...(applicationLd.value ? [{ type: 'application/ld+json' as const, innerHTML: ldJson(applicationLd.value) }] : []),
  ]),
})

/**
 * The project's own social card, generated from this same editorial data by
 * `npm run og` and committed under `public/projects/og/`. The dimensions are
 * declared because several networks lay the preview out before they have
 * fetched the image.
 */
const ogImage = computed(() => `${siteUrl}${socialCardPath(slug.value)}`)

useCanonical(() => `/projects/${slug.value}/about`)

useSeoMeta({
  title: () => `${project.value?.name} — ${project.value?.tagline}`,
  description: () => project.value?.metaDescription ?? project.value?.summary,
  ogTitle: () => `${project.value?.name} — ${project.value?.hero}`,
  ogDescription: () => project.value?.summary,
  ogType: 'article',
  ogImage: () => ogImage.value,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => `${project.value?.name} — ${project.value?.hero}`,
  twitterCard: 'summary_large_image',
  twitterImage: () => ogImage.value,
})
</script>

<template>
  <article v-if="project" :style="accentVar(project.accent)" class="mx-auto max-w-7xl px-5 sm:px-6">
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <header class="pt-12 pb-16 sm:pt-16">
      <p class="text-xs text-pn-muted">
        <NuxtLink to="/projects" class="transition-colors hover:text-pn-fg-bright">
          ../projects
        </NuxtLink>
        <span class="text-pn-rule"> / </span>{{ project.slug }}
      </p>

      <!-- The wordmark IS the title on projects that have one, so it is set at
           display scale rather than treated as a badge beside the name — and it
           is marked up as the h1 it is, with the alt text carrying the name.
           Every project has a wordmark, so without this no project page has a
           heading of its own and the only h1 on the page comes out of the
           fetched README. -->
      <div v-if="project.logo" class="mt-10">
        <h1>
          <img
            :src="project.logo"
            :alt="project.name"
            v-bind="assetSize(project.logo)"
            class="h-24 w-auto max-w-full sm:h-36 lg:h-44"
          >
        </h1>
        <StatusDot :status="project.status" class="mt-6" />
      </div>
      <div v-else class="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 class="text-4xl text-pn-fg-bright sm:text-5xl">
          {{ project.name }}
        </h1>
        <StatusDot :status="project.status" />
      </div>

      <p class="mt-9 max-w-4xl text-3xl leading-tight text-pn-fg-bright sm:text-5xl">
        {{ project.hero }}
      </p>

      <p class="mt-6 max-w-2xl text-sm leading-relaxed text-pn-dim sm:text-base">
        {{ project.summary }}
      </p>

      <div v-if="project.install" class="mt-9 max-w-xl">
        <CodeLine :code="project.install.code" />
      </div>

      <nav aria-label="Project links" class="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          target="_blank"
          :rel="relFor(link.href)"
          class="transition-colors hover:text-pn-fg-bright"
          :style="{ color: 'var(--accent)' }"
        >→ {{ link.label }}</a>

      </nav>

      <ProjectTabs :slug="slug" current="about" />
    </header>

    <!-- ── Download ─────────────────────────────────────────────────────── -->
    <!-- Straight under the pitch, because it answers the next question. A
         direct link per platform rather than the release page: a release of a
         desktop app carries its updater's signatures and archives and a source
         archive beside the five files a person wants, in two editions. Plain
         accent links, no buttons. -->
    <section v-if="download" id="download" class="mb-32">
      <TermRule label="download" />
      <p class="mt-7 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-pn-muted">
        <a
          :href="download.release.url"
          target="_blank"
          :rel="relFor(download.release.url)"
          class="transition-colors hover:text-pn-fg-bright"
          :style="{ color: 'var(--accent)' }"
        >{{ download.release.tag }}</a>
        <time :datetime="download.release.publishedAt">{{ isoDate(download.release.publishedAt) }}</time>
        <span v-if="download.release.prerelease">pre-release</span>
        <span>{{ download.primary.label }}</span>
      </p>

      <ul class="mt-5 max-w-3xl space-y-3">
        <li
          v-for="item in download.primary.installers"
          :key="item.asset.name"
          class="flex flex-wrap items-baseline gap-x-4 gap-y-1"
        >
          <a
            :href="item.asset.url"
            :title="item.asset.name"
            :rel="relFor(item.asset.url)"
            class="text-sm transition-colors hover:text-pn-fg-bright sm:text-base"
            :style="{ color: 'var(--accent)' }"
          >→ {{ item.platform.label }}</a>
          <span class="text-xs text-pn-muted">{{ formatSize(item.asset.size) }}</span>
          <span v-if="caveatFor(item.platform.os)" class="text-xs text-pn-dim">{{ caveatFor(item.platform.os) }}</span>
        </li>
      </ul>

      <p
        v-for="other in download.others"
        :key="other.name"
        class="mt-6 flex max-w-3xl flex-wrap gap-x-4 text-xs leading-7 text-pn-muted"
      >
        <span>{{ other.label }}:</span>
        <a
          v-for="item in other.installers"
          :key="item.asset.name"
          :href="item.asset.url"
          :title="`${item.asset.name}, ${formatSize(item.asset.size)}`"
          :rel="relFor(item.asset.url)"
          class="text-pn-dim transition-colors hover:text-pn-fg-bright"
        >{{ item.platform.short }}</a>
      </p>

      <p v-if="download.note" class="mt-6 max-w-3xl text-sm leading-relaxed text-pn-dim">
        {{ download.note }}
      </p>

      <div v-if="download.firstLaunch.length" class="mt-10 max-w-3xl">
        <h2 class="text-sm text-pn-fg-bright">
          <span aria-hidden="true" :style="{ color: 'var(--accent)' }">▸ </span>The first time you open it
        </h2>
        <dl class="mt-3 space-y-3 text-sm leading-relaxed">
          <div v-for="step in download.firstLaunch" :key="step.os" class="sm:flex sm:gap-6">
            <dt class="shrink-0 text-pn-muted sm:w-20">
              {{ step.os }}
            </dt>
            <dd class="text-pn-dim">
              {{ step.text }}
            </dd>
          </div>
        </dl>
      </div>

      <a
        :href="releasesUrl"
        target="_blank"
        :rel="relFor(releasesUrl)"
        class="mt-8 inline-block text-xs leading-6 text-pn-muted transition-colors hover:text-pn-fg-bright"
      >→ all releases</a>
    </section>

    <!-- ── Screenshot ───────────────────────────────────────────────────── -->
    <section v-if="project.screenshot" class="mb-32">
      <TermRule label="screenshot" />
      <!-- The one image on the site that can move the page: it is `w-full` and
           block-level, so until it lands the browser has nothing to reserve its
           height with and everything below it sits too high. `assetSize` gives
           it the aspect ratio; the classes still decide the drawn size.

           The border is load-bearing rather than decorative. A screenshot of a
           light-themed app sits on a light page at almost the same value — the
           Skidbladnir window's own background is within a few percent of this
           page's — so without a rule the image has no edge and reads as part of
           the layout. Same `border-pn-rule` the Tor frame uses, for the same
           reason: it is a window onto something else, and should look like one. -->
      <img
        :src="screenshotPath(project.screenshot)"
        :alt="project.screenshotAlt ?? `${project.name} screenshot`"
        v-bind="assetSize(project.screenshot)"
        class="mt-8 w-full max-w-5xl border border-pn-rule"
      >
    </section>

    <!-- ── Served by this ───────────────────────────────────────────────── -->
    <!-- Only on the project that serves this site, and only once the gateway
         has an address to show. The point is that it is running, not that it
         could. -->
    <section v-if="project.servesThisSite && onion" class="mb-32">
      <TermRule label="running here" />
      <p class="mt-7 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
        This site is served over {{ project.name }}. The same pages you are
        reading now are also reachable as a Tor onion service, behind its TLS
        and its abuse gate, on the address below.
      </p>
      <CodeLine class="mt-7 max-w-4xl" :code="onion" :prompt="false" />
      <p class="mt-4 max-w-3xl text-sm leading-relaxed text-pn-muted">
        Open it in Tor Browser. Expect a certificate warning — the service
        presents a self-signed certificate for its own address, which is normal
        for an onion service and explained in the README below.
      </p>

      <!-- The proof, rather than the assertion: this server dials its own onion
           address over Tor every ten minutes, and that is what is in the frame. -->
      <OnionFrame :snapshot="torSnapshot" />

      <TorBrowserSteps :address="onion" />
    </section>

    <!-- ── Reaching one ─────────────────────────────────────────────────── -->
    <!-- The other side of the same coin, for the project that is about being
         the client rather than the server. Deliberately does NOT claim this
         crate performed the fetch in the frame — it did not; see
         onion/src/snapshot.rs for why it cannot yet. -->
    <section v-if="project.showsTorDemo && onion" class="mb-32">
      <TermRule label="see it working" />
      <p class="mt-7 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
        {{ project.name }} is the client half of this: your code asks for a URL
        and gets an ordinary response back, with the circuit built and torn down
        for you.<template v-if="hasTorFrame"> Below is a page fetched over Tor by
          the server rendering this sentence — using arti, the Tor client
          {{ project.name }} wraps — from the onion address underneath.</template>
      </p>

      <OnionFrame :snapshot="torSnapshot" />

      <p class="mt-10 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
        {{ hasTorFrame ? 'Or reach it yourself.' : 'Reach it yourself.' }} It
        takes about two minutes and nothing you install has to stay installed.
      </p>

      <TorBrowserSteps :address="onion" />
    </section>

    <!-- ── Why ──────────────────────────────────────────────────────────── -->
    <section class="mb-32">
      <TermRule label="why" />
      <p class="mt-7 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
        {{ project.problem }}
      </p>
    </section>

    <!-- ── Features ─────────────────────────────────────────────────────── -->
    <section class="mb-32">
      <TermRule label="what you get" />
      <div class="mt-8 grid max-w-6xl gap-x-14 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="feature in project.features" :key="feature.title">
          <h2 class="text-sm text-pn-fg-bright">
            <span aria-hidden="true" :style="{ color: 'var(--accent)' }">▸ </span>{{ feature.title }}
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-pn-dim">
            {{ feature.body }}
          </p>
        </div>
      </div>
    </section>

    <!-- ── Example ──────────────────────────────────────────────────────── -->
    <section v-if="project.example" class="mb-32">
      <TermRule label="in practice" />
      <CodeBlock
        class="mt-8 max-w-5xl"
        :code="project.example.code"
        :label="project.example.label"
        :html="project.exampleHtml"
      />
    </section>

    <!-- ── Facts ────────────────────────────────────────────────────────── -->
    <section v-if="facts.length" class="mb-32">
      <TermRule label="at a glance" />
      <dl class="mt-7 flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <div v-for="fact in facts" :key="fact.label" class="flex items-baseline gap-2">
          <dt class="text-pn-muted">
            {{ fact.label }}
          </dt>
          <dd class="text-pn-fg-bright">
            {{ fact.value }}
          </dd>
        </div>
      </dl>
      <p v-if="meta?.topics?.length" class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pn-muted">
        <span v-for="topic in meta.topics" :key="topic">#{{ topic }}</span>
      </p>
    </section>

    <!-- ── Releases ─────────────────────────────────────────────────────── -->
    <!-- A strip, not a changelog: the tags, when they landed, and what each one
         was called. The notes themselves live on GitHub, one click away. -->
    <section v-if="releases.length" class="mb-32">
      <TermRule label="releases" />
      <ol class="mt-8 max-w-4xl space-y-6">
        <li v-for="release in releases" :key="release.tag" class="bar">
          <a
            :href="release.url"
            target="_blank"
            :rel="relFor(release.url)"
            class="group block"
          >
            <span class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span
                class="text-sm transition-colors group-hover:text-pn-fg-bright"
                :style="{ color: 'var(--accent)' }"
              >{{ release.tag }}</span>
              <time
                class="text-xs text-pn-muted"
                :datetime="release.publishedAt"
                :title="ago(release.publishedAt)"
              >{{ isoDate(release.publishedAt) }}</time>
              <span v-if="release.prerelease" class="text-xs text-pn-muted">pre-release</span>
            </span>
            <span
              v-if="release.title"
              class="mt-1 block text-sm leading-relaxed text-pn-dim transition-colors group-hover:text-pn-fg"
            >{{ release.title }}</span>
          </a>
        </li>
      </ol>
      <a
        :href="releasesUrl"
        target="_blank"
        :rel="relFor(releasesUrl)"
        class="mt-8 inline-block text-xs text-pn-muted transition-colors hover:text-pn-fg-bright"
      >→ full release history</a>
    </section>

    <!-- ── README ───────────────────────────────────────────────────────── -->
    <!-- Folded away: the pitch is above, and the full documentation is long. -->
    <section v-if="hasReadme">
      <TermRule label="documentation" />
      <details class="mt-7 group" :open="readmeFold.open.value" @toggle="readmeFold.onToggle">
        <summary
          class="cursor-pointer list-none text-sm text-pn-dim transition-colors hover:text-pn-fg-bright"
        >
          <span aria-hidden="true" :style="{ color: 'var(--accent)' }">
            <span class="group-open:hidden">+</span><span class="hidden group-open:inline">−</span>
          </span>
          read the full readme
        </summary>
        <!-- First-party content: the repo's own README, rendered at request time. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <!-- Null while hydrating: the server's markup is kept, not re-sent (see
             `useProject`). `data-allow-mismatch` says so to Vue's dev checks. -->
        <div class="readme mt-8 max-w-4xl" data-allow-mismatch="children" v-html="readmeHtml ?? undefined" />
      </details>
    </section>
  </article>
</template>
