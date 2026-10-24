<script setup lang="ts">
/**
 * One documentation page.
 *
 * Rendered on the server by the same `marked` and Shiki as the READMEs and the
 * blog, and dropped in with `v-html`. The source is a file in this repository,
 * bundled at build time, so there is nothing a visitor or an admin can put in
 * it that a pull request did not.
 */
import { docsIndexPath } from '~~/shared/docs/path'
import { socialCardAlt, socialCardPath } from '~~/shared/posts/section'
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const pageSlug = computed(() => String(route.params.page))

const { project, error: projectError } = await useProjectSummary(slug)

if (projectError.value || !project.value?.docs) {
  throw createError({
    statusCode: projectError.value?.statusCode ?? 404,
    statusMessage: 'No such page',
    fatal: import.meta.client,
  })
}

const { data: doc, error } = await useFetch<DocSummary & { html: string }>(
  () => `/api/docs/${slug.value}/${pageSlug.value}`,
  { key: () => `doc-${slug.value}-${pageSlug.value}` },
)

if (error.value || !doc.value) {
  throw createError({ statusCode: 404, statusMessage: 'No such page', fatal: import.meta.client })
}

const siteUrl = useSiteOrigin()

useCanonical(() => `${docsIndexPath(slug.value)}/${pageSlug.value}`)

useSeoMeta({
  title: () => `${doc.value?.title} — ${project.value?.name ?? 'basic automation'}`,
  description: () => doc.value?.summary,
  ogTitle: () => doc.value?.title,
  ogDescription: () => doc.value?.summary,
  ogType: 'article',
  ogImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => socialCardAlt(slug.value, project.value?.name, project.value?.hero),
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
})
</script>

<template>
  <article v-if="doc" :style="project ? accentVar(project.accent) : undefined" class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink :to="`/projects/${slug}/about`" class="hover:text-pn-fg-bright">
        {{ project?.name ?? slug }}
      </NuxtLink>
      <span class="px-2">/</span>
      <NuxtLink :to="docsIndexPath(slug)" class="hover:text-pn-fg-bright">
        docs
      </NuxtLink>
    </nav>

    <p class="pt-8 font-mono text-xs text-pn-muted">
      {{ doc.group }}
    </p>

    <h1 class="mt-3 max-w-4xl text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
      {{ doc.title }}
    </h1>
    <p v-if="doc.summary" class="mt-4 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
      {{ doc.summary }}
    </p>

    <!-- Same `readme` typography as a post, because it is the same renderer. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="readme readme-post mt-10 mb-32 max-w-3xl" v-html="doc.html" />
  </article>
</template>
