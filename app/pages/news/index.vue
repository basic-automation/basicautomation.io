<script setup lang="ts">
/**
 * All the site's news, in one list.
 *
 * Every blog on the site feeds this page: each project's release notes and the
 * organisation's own posts, interleaved by date. The home page shows the same
 * aggregate cut to a handful; this is the whole of it, which is why the fetch
 * passes no limit.
 *
 * `show-project` is on because the list mixes sources — a reader needs to know
 * whether a post is about artiqwest or about Basic Automation before deciding
 * to open it.
 */
import { SITE_SECTION, blogName, isSiteSection, socialCardAlt, socialCardPath } from '~~/shared/posts/section'
const { data } = await useFetch<{ posts: PostSummary[] }>('/api/posts', {
  key: 'posts-all',
  default: () => ({ posts: [] }),
})

const posts = computed(() => data.value?.posts ?? [])

// Only the names are kept: whatever `useFetch` returns is serialized into the
// page, and the whole list was ~29 KB of copy this page never shows.
const { data: projectData } = await useFetch(
  '/api/projects',
  {
    key: 'projects-for-news',
    default: () => ({ projects: [] }),
    transform: (d: { projects: { slug: string, name: string }[] }) => ({
      projects: d.projects.map(({ slug, name }) => ({ slug, name })),
    }),
  },
)

/** A post carries its project's slug; the card wants the display name. */
const nameFor = (slug: string): string =>
  projectData.value?.projects.find((p) => p.slug === slug)?.name ?? slug

const siteUrl = useSiteOrigin()

useCanonical('/news')

// The page lists every blog, but the `Blog` it describes is the site's own —
// the one `/news/<post>` pages name in `isPartOf`. Project blogs are described
// on their own tabs.
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => ldJson(blogLd(
      siteUrl,
      SITE_SECTION,
      blogName(SITE_SECTION, undefined),
      posts.value.filter((p) => isSiteSection(p.project)),
    )),
  }],
})

useSeoMeta({
  title: 'news — basic automation',
  description: 'Release notes and announcements from every Basic Automation project.',
  ogTitle: 'basic automation — news',
  ogImage: () => `${siteUrl}${socialCardPath(SITE_SECTION)}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: socialCardAlt(SITE_SECTION),
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl}${socialCardPath(SITE_SECTION)}`,
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
        Every release and announcement across all of Basic Automation's
        projects, newest first. Each project's own news is on its page.
      </p>
    </section>

    <section class="mb-32">
      <TermRule :label="`${posts.length} post${posts.length === 1 ? '' : 's'}`" />

      <p v-if="!posts.length" class="mt-8 max-w-3xl text-base leading-relaxed text-pn-muted">
        Nothing here yet.
      </p>

      <ol v-else class="mt-8 space-y-10">
        <li v-for="post in posts" :key="`${post.project}/${post.slug}`">
          <PostCard :post="post" :project-name="nameFor(post.project)" show-project />
        </li>
      </ol>
    </section>
  </div>
</template>
