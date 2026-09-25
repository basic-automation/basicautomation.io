<script setup lang="ts">
const route = useRoute()

// The wallpaper is a home-page treatment. Elsewhere the ground stays flat.
const onHome = computed(() => route.path === '/' || route.path === '')

/**
 * Two masks, intersected: the wallpaper fades out at the bottom into the flat
 * ground, and fades out to the LEFT so it never sits under the hero copy. The
 * disc is a backdrop on the right-hand side, not a wash behind the text.
 */
const FADE = [
  'linear-gradient(to bottom, black 0%, black 52%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, transparent 34%, black 62%)',
].join(', ')
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-pn-bg">
    <!-- Three header links stand between the keyboard and the page on every
         route. `sr-only focus:not-sr-only` keeps the link out of the layout
         until it is tabbed to, which is the one place this site shows a
         control that was not already on the page. It is first in the DOM so it
         is the first tab stop, ahead of the wallpaper and the masthead. -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:bg-pn-bg focus:px-3 focus:py-2 focus:text-sm focus:text-pn-fg-bright"
    >Skip to content</a>

    <!-- Omarchy's Paleday wallpaper, behind the masthead and the hero together.
         Masked rather than faded with an overlay, so the ground shows through
         underneath instead of a translucent sheet sitting on top of it. -->
    <div
      v-if="onHome"
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-no-repeat sm:h-[40rem]"
      :style="{
        backgroundImage: 'url(/bg/hero.webp)',
        backgroundSize: 'auto 100%',
        backgroundPosition: 'right center',
        maskImage: FADE,
        WebkitMaskImage: FADE,
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      }"
    />

    <CrtFilter />
    <SiteHeader />
    <!-- `tabindex="-1"` so the skip link can actually move focus here; without
         it the browser scrolls and leaves focus where it was. -->
    <main id="main" tabindex="-1" class="relative flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
