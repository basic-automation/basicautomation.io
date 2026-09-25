<script setup lang="ts">
/**
 * The masthead is always a pane of CRT glass — the warp and the scanlines do
 * not wait for a scroll, because a tube does not switch off when the picture
 * stops moving.
 */
const nav = [
  { label: 'projects', to: '/projects' },
  { label: 'about', to: '/#about' },
]
</script>

<template>
  <header class="sticky top-0 z-50">
    <!-- The glass is a pane, not a band: it stops at the content measure so it
         reads as an object sitting over the page rather than a bar welded to
         the window. Inside it, the same gutter as the content below, so the
         mark lines up with the copy. -->
    <div class="mx-auto max-w-7xl">
      <div class="crt-glass flex h-32 items-center gap-4 px-5 sm:px-6">
        <NuxtLink to="/" class="flex items-center" aria-label="Basic Automation — home">
          <BrandMark title="Basic Automation" class="h-24 w-24 shrink-0 text-pn-fg" />
        </NuxtLink>

        <nav class="ml-auto flex items-center gap-5 text-xs sm:gap-6">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="text-pn-muted transition-colors hover:text-pn-fg-bright"
          >
            {{ item.label }}
          </NuxtLink>
          <a
            href="https://github.com/basic-automation"
            target="_blank"
            rel="noreferrer noopener"
            class="text-pn-muted transition-colors hover:text-pn-fg-bright"
          >
            github
          </a>
        </nav>
      </div>
    </div>
  </header>
</template>
