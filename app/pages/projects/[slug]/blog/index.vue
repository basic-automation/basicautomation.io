<script setup lang="ts">
/**
 * One project's news.
 *
 * Posts live on a volume rather than in the bundle, so this is a request-time
 * fetch rather than build-time content — see `server/utils/posts.ts` for why.
 */
import { socialCardPath } from '~~/shared/posts/section'
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

const { data } = await useFetch<{ posts: PostSummary[] }>('/api/posts', {
  key: () => `posts-${slug.value}`,
  query: { project: slug },
  default: () => ({ posts: [] }),
})

const posts = computed(() => data.value?.posts ?? [])

const siteUrl = useSiteOrigin()

useSeoMeta({
  title: () => `news — ${project.value?.name}`,
  description: () => `Release notes and news for ${project.value?.name}.`,
  ogTitle: () => `${project.value?.name} — news`,
  ogUrl: () => `${siteUrl}/projects/${slug.value}/blog`,
  ogImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
})
</script>

<template>
  <article v-if="project" class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink to="/projects" class="hover:text-pn-fg-bright">
        ../projects
      </NuxtLink>
      <span class="px-2">/</span>
      <NuxtLink :to="`/projects/${slug}/about`" class="hover:text-pn-fg-bright">
        {{ project.name }}
      </NuxtLink>
      <span class="px-2">/</span>
      <span class="text-pn-dim">news</span>
    </nav>

    <section class="pt-8">
      <h1 class="text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
        {{ project.name }} news
      </h1>
      <p class="mt-4 max-w-3xl text-base leading-relaxed text-pn-fg">
        Releases, changes and notes. The about tab has what {{ project.name }}
        is and what it does.
      </p>

      <ProjectTabs :slug="slug" current="blog" />
    </section>

    <section class="mt-12 mb-32">
      <TermRule :label="`${posts.length} post${posts.length === 1 ? '' : 's'}`" />

      <p v-if="!posts.length" class="mt-8 max-w-3xl text-base leading-relaxed text-pn-muted">
        Nothing yet. When there is something worth saying about
        {{ project.name }} — a release, a change, a decision — it will be here.
      </p>

      <ol v-else class="mt-8 space-y-10">
        <li v-for="post in posts" :key="post.slug">
          <PostCard :post="post" :project-name="project.name" />
        </li>
      </ol>
    </section>
  </article>
</template>
