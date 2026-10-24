<script setup lang="ts">
/**
 * One project's documentation, listed by group.
 *
 * The pages ship with the build rather than living on a volume — see
 * `server/utils/projectDocs.ts` for why — but they are still fetched here
 * rather than imported, so the markdown never enters a client bundle.
 */
import { docPath, docsIndexPath } from '~~/shared/docs/path'
import { socialCardAlt, socialCardPath } from '~~/shared/posts/section'
const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { project, error } = await useProjectSummary(slug)

// A project with no docs has no docs tab, so its address is a 404 rather than
// an empty page that says docs were expected.
if (error.value || !project.value?.docs) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'No such page',
    fatal: import.meta.client,
  })
}

const { data } = await useFetch<{ docs: DocSummary[] }>(
  () => `/api/docs/${slug.value}`,
  { key: () => `docs-${slug.value}`, default: () => ({ docs: [] }) },
)

/** Groups in the order their first page appears, which is the order they were numbered in. */
const groups = computed(() => {
  const out: { name: string, docs: DocSummary[] }[] = []
  for (const doc of data.value?.docs ?? []) {
    const found = out.find((g) => g.name === doc.group)
    if (found) found.docs.push(doc)
    else out.push({ name: doc.group, docs: [doc] })
  }
  return out
})

const siteUrl = useSiteOrigin()

useCanonical(() => docsIndexPath(slug.value))

useSeoMeta({
  title: () => `docs — ${project.value?.name}`,
  description: () => `Design documents, release plans and the reasoning behind ${project.value?.name}.`,
  ogTitle: () => `${project.value?.name} — docs`,
  ogImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => socialCardAlt(slug.value, project.value?.name, project.value?.hero),
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
})
</script>

<template>
  <article v-if="project" :style="accentVar(project.accent)" class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink to="/projects" class="hover:text-pn-fg-bright">
        ../projects
      </NuxtLink>
      <span class="px-2">/</span>
      <NuxtLink :to="`/projects/${slug}/about`" class="hover:text-pn-fg-bright">
        {{ project.name }}
      </NuxtLink>
      <span class="px-2">/</span>
      <span class="text-pn-dim">docs</span>
    </nav>

    <section class="pt-8">
      <h1 class="text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
        {{ project.name }} docs
      </h1>
      <p class="mt-4 max-w-3xl text-base leading-relaxed text-pn-fg">
        The strategy, the design documents, the release plan and the notes behind
        the roadmap. The roadmap itself is a checklist; the reasoning is here.
      </p>

      <ProjectTabs :slug="slug" current="docs" :docs="project.docs" />
    </section>

    <section v-for="group in groups" :key="group.name" class="mt-12 last:mb-32">
      <TermRule :label="group.name" />

      <ol class="mt-8 space-y-6">
        <li v-for="doc in group.docs" :key="doc.slug">
          <NuxtLink :to="docPath(slug, doc.slug)" class="text-lg text-pn-fg-bright hover:underline">
            {{ doc.title }}
          </NuxtLink>
          <p v-if="doc.summary" class="mt-1 max-w-3xl text-sm leading-relaxed text-pn-muted">
            {{ doc.summary }}
          </p>
        </li>
      </ol>
    </section>
  </article>
</template>
