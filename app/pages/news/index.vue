<script setup lang="ts">
/**
 * The organisation's own blog.
 *
 * Distinct from a project's news: this is what is about Basic Automation rather
 * than about one of its tools. The home page aggregates both, which is the only
 * place they mix.
 */
import { SITE_SECTION } from '~~/shared/posts/section'

const { data } = await useFetch<{ posts: PostSummary[] }>('/api/posts', {
  key: 'posts-site',
  query: { project: SITE_SECTION },
  default: () => ({ posts: [] }),
})

const posts = computed(() => data.value?.posts ?? [])

const siteUrl = useSiteOrigin()

useSeoMeta({
  title: 'news — basic automation',
  description: 'Release announcements and news from Basic Automation.',
  ogTitle: 'basic automation — news',
  ogUrl: () => `${siteUrl}/news`,
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 sm:px-6">
    <nav aria-label="Breadcrumb" class="pt-14 font-mono text-xs text-pn-muted">
      <NuxtLink to="/" class="hover:text-pn-fg-bright">
        ..
      </NuxtLink>
      <span class="px-2">/</span>
      <span class="text-pn-dim">news</span>
    </nav>

    <section class="pt-8 pb-10">
      <h1 class="text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
        news
      </h1>
      <p class="mt-4 max-w-3xl text-base leading-relaxed text-pn-fg">
        Announcements and notes from Basic Automation. Each project keeps its
        own news on its page.
      </p>
    </section>

    <section class="mb-32">
      <TermRule :label="`${posts.length} post${posts.length === 1 ? '' : 's'}`" />

      <p v-if="!posts.length" class="mt-8 max-w-3xl text-base leading-relaxed text-pn-muted">
        Nothing here yet.
      </p>

      <ol v-else class="mt-8 space-y-10">
        <li v-for="post in posts" :key="post.slug">
          <PostCard :post="post" project-name="basic automation" />
        </li>
      </ol>
    </section>
  </div>
</template>
