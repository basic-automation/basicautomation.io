<script setup lang="ts">
/**
 * One of the organisation's own posts.
 *
 * The same renderer and the same typography as a project's post — the only
 * difference is which blog it belongs to, and therefore where it sits.
 */
import { SITE_SECTION } from '~~/shared/posts/section'

const route = useRoute()
const postSlug = computed(() => String(route.params.post))

const { data: post, error } = await useFetch<PostSummary & { html: string }>(
  () => `/api/posts/${SITE_SECTION}/${postSlug.value}`,
  { key: () => `post-site-${postSlug.value}` },
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
    innerHTML: () => post.value ? ldJson(blogPostingLd(siteUrl, post.value, 'basic automation news')) : '',
  }],
})

useSeoMeta({
  title: () => `${post.value?.title} — basic automation`,
  description: () => post.value?.summary,
  ogTitle: () => post.value?.title,
  ogDescription: () => post.value?.summary,
  ogType: 'article',
  ogUrl: () => `${siteUrl}/news/${postSlug.value}`,
  articlePublishedTime: () => post.value?.date,
})
</script>

<template>
  <article v-if="post" class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink to="/news" class="hover:text-pn-fg-bright">
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

    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="readme mb-32 max-w-3xl" v-html="post.html" />
  </article>
</template>
