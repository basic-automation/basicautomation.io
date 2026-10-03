<script setup lang="ts">
import type { ProjectSummary } from '~~/shared/types/project'
import { CARD_CUTS, cutPath } from '~~/shared/assets/cuts'

/**
 * `eager` for a card that is in the first screen the page shows. Its media is
 * then that page's Largest Contentful Paint, and `loading="lazy"` holds an
 * image back until layout has proved it visible — on /projects, with campaign
 * art leading the grid, that cost a phone ~1.2 s of LCP. Every other card
 * stays lazy: most of a grid is below the fold.
 */
const { project, eager = false } = defineProps<{ project: ProjectSummary, eager?: boolean }>()
const loading = computed(() => (eager ? 'eager' : 'lazy'))
const fetchpriority = computed(() => (eager ? 'high' : undefined))

/**
 * The card art's `srcset`s (see `shared/assets/cuts.ts`). A phone gets the cuts
 * only: the widest, 800 px, is still 2.3× its ~350 px slot, and offering the
 * 1224 px original as well meant a 3× phone always took it — 200 KB for a
 * difference no one can see at that size. From `sm` the grid has two columns
 * of at most 568 px, and a 2× screen there does get the original.
 */
const art = computed(() => {
  const src = project.cardImage
  if (!src) return null
  const cuts = CARD_CUTS.map((w) => `${cutPath(src, w)} ${w}w`)
  const { width } = assetSize(src)
  return {
    phone: cuts.join(', '),
    wide: (width ? [...cuts, `${src} ${width}w`] : cuts).join(', '),
    fallback: cutPath(src, CARD_CUTS[CARD_CUTS.length - 1]!),
  }
})

const ago = useRelativeTime()
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.slug}/about`"
    :style="accentVar(project.accent)"
    class="group block"
  >
    <!-- Media. The mark comes first: the grid reads as a set of brands, and a
         screenshot sitting among wordmarks looks like a different kind of
         object. The screenshot still gets its own section on the project page,
         where it is evidence rather than identity. The name set large when
         there is neither, so every card occupies the same block and the grid
         stays even. No frame, no fill — the media sits on the page's ground.
         A project's `cardImage` overrides all three: campaign art, chosen
         deliberately for one card, not a default. -->
    <div class="relative aspect-16/10 overflow-hidden">
      <picture v-if="art">
        <source
          media="(min-width: 640px)"
          :srcset="art.wide"
          sizes="(min-width: 1280px) 568px, calc(50vw - 72px)"
        >
        <img
          :src="art.fallback"
          :srcset="art.phone"
          sizes="calc(100vw - 40px)"
          :alt="project.cardImageAlt ?? project.name"
          :loading="loading"
          :fetchpriority="fetchpriority"
          class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
        >
      </picture>
      <img
        v-else-if="project.logo"
        :src="project.logo"
        :alt="project.name"
        :loading="loading"
        :fetchpriority="fetchpriority"
        class="absolute inset-0 h-full w-full object-contain p-10 transition-transform duration-300 group-hover:scale-[1.03] sm:p-14"
      >
      <!-- Bordered for the same reason as the one on the project page: a
           screenshot is a window onto another application, and a light-themed
           one has no edge of its own against this page. The wordmark above
           needs no border — it is a mark on the page's ground, not a window. -->
      <img
        v-else-if="project.screenshot"
        :src="project.screenshot"
        :alt="project.screenshotAlt ?? `${project.name} screenshot`"
        :loading="loading"
        :fetchpriority="fetchpriority"
        class="absolute inset-0 h-full w-full border border-pn-rule object-cover object-top transition-opacity duration-300 group-hover:opacity-90"
      >
      <span
        v-else
        aria-hidden="true"
        class="absolute inset-0 flex items-center justify-center text-4xl text-pn-rule transition-colors duration-300 group-hover:text-[var(--accent)] sm:text-5xl"
      >{{ project.name }}</span>
    </div>

    <div class="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <!-- `h2`, not `h3`. A card is a direct child of the page's own `h1` —
           the dashed "projects" rule above it is a `role="separator"`, not a
           heading, so there is no `h2` between them and starting at `h3`
           skipped a level in the outline a screen reader navigates by. -->
      <h2 class="text-base text-pn-fg-bright transition-colors group-hover:text-[var(--accent)]">
        {{ project.name }}
      </h2>
      <span class="text-xs text-pn-muted">
        {{ project.kind.toLowerCase() }}<span v-if="project.meta?.language"> · {{ project.meta.language }}</span>
      </span>
      <StatusDot :status="project.status" class="ml-auto" />
    </div>

    <p class="mt-2 text-sm leading-relaxed text-pn-dim">
      {{ project.tagline }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-pn-muted">
      <span v-if="project.meta?.stars">
        <span class="text-pn-yellow">★</span> {{ project.meta.stars }}
      </span>
      <span v-if="project.meta?.crateVersion" :style="{ color: 'var(--accent)' }">
        v{{ project.meta.crateVersion }}
      </span>
      <span v-if="project.meta?.license">{{ project.meta.license }}</span>
      <span v-if="project.meta?.pushedAt">updated {{ ago(project.meta.pushedAt) }}</span>
      <span class="ml-auto text-pn-dim transition-colors group-hover:text-[var(--accent)]">open →</span>
    </div>
  </NuxtLink>
</template>
