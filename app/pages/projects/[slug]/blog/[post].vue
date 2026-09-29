<script setup lang="ts">
/**
 * One post.
 *
 * The body arrives as HTML already rendered on the server — same `marked` and
 * Shiki as the READMEs — and is dropped in with `v-html`, exactly as the README
 * is further down the project page. The source is a file this site's own admin
 * wrote, on a volume only this container can reach.
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const postSlug = computed(() => String(route.params.post))

const { project } = await useProject(slug)

const { data: post, error } = await useFetch<PostSummary & { html: string }>(
  () => `/api/posts/${slug.value}/${postSlug.value}`,
  { key: () => `post-${slug.value}-${postSlug.value}` },
)

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'No such post', fatal: true })
}

const siteUrl = useSiteOrigin()

const exact = computed(() =>
  post.value ? new Date(post.value.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '')

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => post.value ? ldJson(blogPostingLd(siteUrl, post.value, `${project.value?.name ?? slug.value} news`)) : '',
  }],
})

useSeoMeta({
  title: () => `${post.value?.title} — ${project.value?.name ?? 'basic automation'}`,
  description: () => post.value?.summary,
  ogTitle: () => post.value?.title,
  ogDescription: () => post.value?.summary,
  ogType: 'article',
  ogUrl: () => `${siteUrl}/projects/${slug.value}/blog/${postSlug.value}`,
  articlePublishedTime: () => post.value?.date,
})
</script>

<template>
  <article v-if="post" class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink :to="`/projects/${slug}/about`" class="hover:text-pn-fg-bright">
        {{ project?.name ?? slug }}
      </NuxtLink>
      <span class="px-2">/</span>
      <NuxtLink :to="`/projects/${slug}/blog`" class="hover:text-pn-fg-bright">
        news
      </NuxtLink>
    </nav>

    <header class="pt-8 pb-10">
      <p class="font-mono text-xs text-pn-muted">
        <time :datetime="post.date">{{ exact }}</time>
        <span v-if="post.draft" class="ms-3 text-pn-red">draft — not listed</span>
      </p>
      <h1 class="mt-3 max-w-4xl text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
        {{ post.title }}
      </h1>
      <p v-if="post.summary" class="mt-4 max-w-3xl text-base leading-relaxed text-pn-fg sm:text-lg">
        {{ post.summary }}
      </p>
    </header>

    <!-- Same `readme` typography as a rendered README, because it is the same
         renderer and should read the same. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="readme readme-post mb-32 max-w-3xl" v-html="post.html" />
  </article>
</template>
