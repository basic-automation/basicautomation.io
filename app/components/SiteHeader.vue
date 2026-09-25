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
  <header class="crt-glass sticky top-0 z-50">
    <div class="mx-auto flex h-32 max-w-7xl items-center gap-5 px-5 sm:px-6">
      <NuxtLink to="/" class="flex items-center" aria-label="Basic Automation — home">
        <BrandMark title="Basic Automation" class="h-24 w-24 shrink-0 text-pn-fg" />
      </NuxtLink>

      <nav aria-label="Site" class="ml-auto flex items-center gap-5 text-xs sm:gap-6">
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
  </header>
</template>
