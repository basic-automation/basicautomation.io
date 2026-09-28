<script setup lang="ts">
/**
 * About / blog, on every project page.
 *
 * Both tabs are always present, including when a project has no posts yet. A
 * tab that appears only once there is something behind it makes the navigation
 * move under the reader as content arrives, and gives no hint that a blog is
 * the kind of thing this project has. The empty blog page says so in words
 * instead, which is the better place for it.
 *
 * The current tab is marked with `aria-current="page"` and not only with
 * colour, because "which of these am I on" is the whole job of this component
 * and colour alone does not answer it for everyone.
 */
const { slug, current } = defineProps<{
  slug: string
  current: 'about' | 'blog'
}>()

const tabs = computed(() => [
  { key: 'about' as const, label: 'about', to: `/projects/${slug}/about` },
  { key: 'blog' as const, label: 'blog', to: `/projects/${slug}/blog` },
])
</script>

<template>
  <nav aria-label="Project sections" class="mt-10 flex gap-8 border-b border-pn-rule/70">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      :aria-current="tab.key === current ? 'page' : undefined"
      class="-mb-px border-b-2 pb-3 font-mono text-xs tracking-widest lowercase transition-colors"
      :class="tab.key === current
        ? 'border-current text-pn-fg-bright'
        : 'border-transparent text-pn-muted hover:text-pn-fg'"
      :style="tab.key === current ? { color: 'var(--accent)' } : undefined"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
