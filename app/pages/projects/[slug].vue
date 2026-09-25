<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { project, error } = await useProject(slug)

if (error.value || !project.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'No such project',
    fatal: true,
  })
}

const meta = computed(() => project.value?.meta ?? null)

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
  if (m.pushedAt) rows.push({ label: 'updated', value: relativeTime(m.pushedAt) })
  return rows
})

/**
 * Structured data for the page, as `SoftwareSourceCode` — which is what this
 * is: a page about a published body of source, not a product listing. Every
 * field is something the page already states; nothing is asserted here that a
 * reader could not also see.
 */
const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')

const orgLd = {
  '@type': 'Organization',
  'name': 'Basic Automation',
  'url': siteUrl,
  'logo': `${siteUrl}/logo.svg`,
}

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
    'url': `${siteUrl}/projects/${p.slug}`,
    'codeRepository': m?.htmlUrl ?? `https://github.com/basic-automation/${p.repo}`,
    'author': orgLd,
    'publisher': orgLd,
    'isAccessibleForFree': true,
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

  return ldJson(data)
})

useHead({
  script: [{ type: 'application/ld+json', innerHTML: () => jsonLd.value }],
})

useSeoMeta({
  title: () => `${project.value?.name} — ${project.value?.tagline}`,
  description: () => project.value?.summary,
  ogTitle: () => `${project.value?.name} — ${project.value?.hero}`,
  ogDescription: () => project.value?.summary,
  ogType: 'article',
  ogUrl: () => `https://basicautomation.io/projects/${slug.value}`,
  ogImage: 'https://basicautomation.io/og.png',
  twitterCard: 'summary_large_image',
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
          rel="noreferrer noopener"
          class="transition-colors hover:text-pn-fg-bright"
          :style="{ color: 'var(--accent)' }"
        >→ {{ link.label }}</a>
      </nav>
    </header>

    <!-- ── Screenshot ───────────────────────────────────────────────────── -->
    <section v-if="project.screenshot" class="mb-32">
      <TermRule label="screenshot" />
      <img
        :src="project.screenshot"
        :alt="`${project.name} screenshot`"
        class="mt-8 w-full max-w-5xl"
      >
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
            rel="noreferrer noopener"
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
                :title="relativeTime(release.publishedAt)"
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
        rel="noreferrer noopener"
        class="mt-8 inline-block text-xs text-pn-muted transition-colors hover:text-pn-fg-bright"
      >→ full release history</a>
    </section>

    <!-- ── README ───────────────────────────────────────────────────────── -->
    <!-- Folded away: the pitch is above, and the full documentation is long. -->
    <section v-if="meta?.readmeHtml">
      <TermRule label="documentation" />
      <details class="mt-7 group">
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
        <div class="readme mt-8 max-w-4xl" v-html="meta.readmeHtml" />
      </details>
    </section>
  </article>
</template>
