<script setup lang="ts">
import type { EnrichedProject } from '~~/shared/types/project'

const { project } = defineProps<{ project: EnrichedProject }>()

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
      <img
        v-if="project.cardImage"
        :src="project.cardImage"
        :alt="project.cardImageAlt ?? project.name"
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
      >
      <img
        v-else-if="project.logo"
        :src="project.logo"
        :alt="project.name"
        loading="lazy"
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
        loading="lazy"
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
