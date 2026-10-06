<script setup lang="ts">
/**
 * One post.
 *
 * The body arrives as HTML already rendered on the server — same `marked` and
 * Shiki as the READMEs — and is dropped in with `v-html`, exactly as the README
 * is further down the project page. The source is a file this site's own admin
 * wrote, on a volume only this container can reach.
 */
import { blogName, socialCardAlt, socialCardPath } from '~~/shared/posts/section'
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const postSlug = computed(() => String(route.params.post))

// Guarded like the blog index and the about tab beside it, and for a reason
// this page alone could hit: `site` is a real posts directory but not a
// project, so its posts resolve here and the page would render a second copy
// of every one of them under /projects/site/blog/<slug> — canonical pointing
// at itself, breadcrumbs linking to /projects/site/{about,blog}, both 404.
// Named `projectError` so it does not shadow the post fetch's own `error`.
const { project, error: projectError } = await useProjectSummary(slug)

if (projectError.value || !project.value) {
  throw createError({
    statusCode: projectError.value?.statusCode ?? 404,
    statusMessage: 'No such project',
    fatal: import.meta.client,
  })
}

const { data: post, error } = await useFetch<PostSummary & { html: string }>(
  () => `/api/posts/${slug.value}/${postSlug.value}`,
  { key: () => `post-${slug.value}-${postSlug.value}` },
)

if (error.value || !post.value) {
  // Client-only `fatal`, as in `app/pages/[...slug].vue`: on the server it buys
  // a Nitro stack trace in the request log and nothing else.
  throw createError({ statusCode: 404, statusMessage: 'No such post', fatal: import.meta.client })
}

const siteUrl = useSiteOrigin()

const exact = computed(() =>
  post.value
    ? new Date(post.value.date).toLocaleDateString('en-GB', {
        // Fixed zone, so the server and the browser agree. Without it a post
        // published late in the day renders one date on the server and the
        // next one in a reader east of it — a hydration mismatch, and a date
        // that disagrees with the ISO string in the `datetime` beside it.
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      })
    : '')

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => post.value ? ldJson(blogPostingLd(siteUrl, post.value, blogName(slug.value, project.value?.name))) : '',
  }],
})

useCanonical(() => `/projects/${slug.value}/blog/${postSlug.value}`)

useSeoMeta({
  title: () => `${post.value?.title} — ${project.value?.name ?? 'basic automation'}`,
  description: () => post.value?.summary,
  ogTitle: () => post.value?.title,
  ogDescription: () => post.value?.summary,
  ogType: 'article',
  articlePublishedTime: () => post.value?.date,
  ogImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => socialCardAlt(slug.value, project.value?.name, project.value?.hero),
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}${socialCardPath(slug.value)}`,
  // A draft is reachable by URL so it can be previewed, which is not the same
  // as asking a search engine to index it.
  robots: () => (post.value?.draft ? 'noindex, nofollow' : undefined),
})
</script>

<template>
  <article v-if="post" :style="project ? accentVar(project.accent) : undefined" class="mx-auto max-w-7xl px-5 sm:px-6">
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
