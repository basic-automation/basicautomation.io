<template>
  <div class="flex min-h-screen flex-col bg-pn-bg">
    <!-- Three header links stand between the keyboard and the page on every
         route. `sr-only focus:not-sr-only` keeps the link out of the layout
         until it is tabbed to, which is the one place this site shows a
         control that was not already on the page. -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:bg-pn-bg focus:px-3 focus:py-2 focus:text-sm focus:text-pn-fg-bright"
    >Skip to content</a>

    <SiteHeader />
    <!-- `tabindex="-1"` so the skip link can actually move focus here; without
         it the browser scrolls and leaves focus where it was. -->
    <main id="main" tabindex="-1" class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
