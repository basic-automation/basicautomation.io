<script setup lang="ts">
const { projects } = await useProjects()

const stats = computed(() => {
  const list = projects.value
  const stars = list.reduce((n, p) => n + (p.meta?.stars ?? 0), 0)
  const downloads = list.reduce((n, p) => n + (p.meta?.crateDownloads ?? 0), 0)
  return [
    { value: String(list.length), label: 'projects' },
    { value: String(stars), label: 'stars' },
    { value: compactNumber(downloads), label: 'downloads' },
  ]
})

const description
  = 'Basic Automation designs and builds software tools for businesses. Open-source '
    + 'Rust crates for the Tor network, and desktop apps for catalogs and image pipelines.'

const siteUrl = useSiteOrigin()

useSeoMeta({
  title: 'basic automation — software for the productive',
  description,
  ogTitle: 'basic automation — software for the productive',
  ogDescription: description,
  ogType: 'website',
  ogUrl: () => siteUrl,
  ogImage: () => `${siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}/og.png`,
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 sm:px-6">
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="pt-16 pb-14 sm:pt-24">
      <p class="text-xs tracking-[0.25em] text-pn-accent uppercase">
        Software toolmakers
      </p>

      <h1 class="mt-7 text-4xl leading-tight text-pn-fg-bright sm:text-6xl">
        Software for the <span class="text-pn-accent">productive</span><span
          aria-hidden="true" class="ml-1.5 cursor"
        />
      </h1>

      <p class="mt-6 max-w-3xl text-base leading-relaxed text-pn-dim sm:text-lg">
        We design and build software tools for businesses — and we publish the sharp
        ones. Privacy-preserving Rust crates for the Tor network, desktop apps that
        take the tedium out of catalogs and image pipelines. All of it open source.
      </p>

      <div class="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
        <NuxtLink
          to="/projects"
          class="text-pn-accent transition-colors hover:text-pn-bright-magenta"
        >
          → browse projects
        </NuxtLink>
        <a
          href="https://github.com/basic-automation"
          target="_blank" rel="noreferrer noopener"
          class="text-pn-cyan transition-colors hover:text-pn-bright-cyan"
        >
          → view the source
        </a>
      </div>

      <dl class="mt-7 flex flex-wrap gap-x-10 gap-y-3 text-xs">
        <div v-for="stat in stats" :key="stat.label" class="flex items-baseline gap-2">
          <dt class="text-pn-muted">
            {{ stat.label }}
          </dt>
          <dd class="text-base text-pn-fg-bright">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- ── Projects ─────────────────────────────────────────────────────── -->
    <section id="projects" class="mt-8">
      <TermRule label="projects" />
      <div class="mt-10 grid gap-x-24 gap-y-20 sm:grid-cols-2">
        <ProjectCard v-for="p in projects" :key="p.slug" :project="p" />
      </div>
    </section>

    <!-- ── About ────────────────────────────────────────────────────────── -->
    <section id="about" class="mt-40">
      <TermRule label="about" />
      <div class="mt-8 max-w-2xl space-y-5 text-sm leading-relaxed text-pn-dim">
        <p class="text-base text-pn-fg">
          Basic Automation is a toolmaker. We design and build software tools for
          businesses.
        </p>
        <p>
          An artificer makes the instruments other people work with — and is the first
          to use them, which is the only honest way to find out whether a tool is any
          good. The projects on this page came out of real work: each one started as
          something a job needed and nothing on the market provided.
        </p>
        <p>
          Most of it is Rust, and a good deal of it concerns the Tor network — not as a
          novelty, but because reaching and serving onion services should be as ordinary
          as any other HTTP call. The libraries ship secure and complete by default: the
          hard parts are enabled out of the box and you opt down when you have a reason
          to, rather than assembling safety from feature flags.
        </p>
        <p>
          A good tool is unremarkable in use. It has one job, it doesn't ask to be
          configured into correctness, and it holds an edge. That is the whole bar.
        </p>
        <p>
          Everything here is public and open source. Issues and pull requests are
          welcome on any of it.
        </p>
      </div>
    </section>
  </div>
</template>
