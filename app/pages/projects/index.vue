<script setup lang="ts">
const { projects } = await useProjects()

const siteUrl = useSiteOrigin()

/**
 * This page is a list, so it says so: a `CollectionPage` whose `mainEntity` is
 * the ordered `ItemList` the page renders. Each item points at the project's own
 * page, which is where that project is actually described — repeating the
 * descriptions here would be two sources for one fact.
 */
const jsonLd = computed(() => ldJson({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  'name': 'Projects — Basic Automation',
  'url': `${siteUrl}/projects`,
  'isPartOf': { '@id': `${siteUrl}/${SITE_ID}` },
  'publisher': organizationRef(siteUrl),
  'mainEntity': {
    '@type': 'ItemList',
    'numberOfItems': projects.value.length,
    'itemListOrder': 'https://schema.org/ItemListOrderAscending',
    'itemListElement': projects.value.map((p, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': p.name,
      'url': `${siteUrl}/projects/${p.slug}`,
    })),
  },
}))

useHead({
  script: [{ type: 'application/ld+json', innerHTML: () => jsonLd.value }],
})

useSeoMeta({
  title: 'projects — basic automation',
  description:
    'Every public project from Basic Automation: Rust crates for the Tor network and '
    + 'desktop apps for catalogs and image conversion.',
  ogImage: () => `${siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 sm:px-6">
    <section class="pt-14 pb-10">
      <p class="text-xs tracking-[0.25em] text-pn-accent uppercase">
        Open source
      </p>

      <h1 class="mt-6 text-2xl text-pn-fg-bright sm:text-3xl">
        Everything we've published
      </h1>

      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-pn-dim">
        {{ projects.length }} public projects. Stars, versions and READMEs come straight
        from GitHub and crates.io on every render.
      </p>
    </section>

    <TermRule />
    <div class="mt-10 grid gap-x-24 gap-y-20 sm:grid-cols-2">
      <ProjectCard v-for="p in projects" :key="p.slug" :project="p" />
    </div>
  </div>
</template>
