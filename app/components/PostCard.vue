<script setup lang="ts">
/**
 * One post in a list.
 *
 * Used by a project's own news and by the aggregate on the home page; the
 * project name is shown only when the list mixes projects, which is the one
 * difference between the two.
 */
import { postPath, sectionLabel } from '~~/shared/posts/section'

const { post, projectName, showProject = false } = defineProps<{
  post: PostSummary
  projectName: string
  /** The aggregate needs to say which project a post belongs to; a project's own list does not. */
  showProject?: boolean
}>()

const when = computed(() => relativeTime(post.date))

const exact = computed(() =>
  new Date(post.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }))
</script>

<template>
  <NuxtLink
    :to="postPath(post.project, post.slug)"
    class="group block max-w-3xl"
  >
    <p class="flex flex-wrap items-baseline gap-x-3 font-mono text-xs text-pn-muted">
      <time :datetime="post.date" :title="exact">{{ when }}</time>
      <template v-if="showProject">
        <span aria-hidden="true">·</span>
        <span class="text-pn-accent">{{ sectionLabel(post.project, projectName) }}</span>
      </template>
    </p>

    <!-- h2, like a ProjectCard's: every list of these sits directly under the
         page's h1 (the dashed rule above it is a separator, not a heading). -->
    <h2 class="mt-2 text-xl leading-snug text-pn-fg-bright group-hover:text-pn-accent sm:text-2xl">
      {{ post.title }}
    </h2>

    <p v-if="post.summary" class="mt-2 text-base leading-relaxed text-pn-fg">
      {{ post.summary }}
    </p>

    <p class="mt-3 font-mono text-xs text-pn-accent">
      read &rarr;
    </p>
  </NuxtLink>
</template>
