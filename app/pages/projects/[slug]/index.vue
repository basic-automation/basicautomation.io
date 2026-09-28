<script setup lang="ts">
/**
 * `/projects/<slug>` redirects to `/projects/<slug>/about`.
 *
 * The project page is now one of two tabs, and a tabbed section needs each tab
 * to have its own address — otherwise "about" is the only one that cannot be
 * linked to, bookmarked, or told apart from the section as a whole.
 *
 * A redirect rather than rendering the same content at both: two URLs serving
 * one page is duplicate content, and the canonical link, `og:url` and the
 * sitemap would each have to pick one anyway. 301 because this is permanent —
 * the old address is not coming back as a page.
 */
definePageMeta({
  middleware: [
    (to) => navigateTo(`/projects/${to.params.slug}/about`, { redirectCode: 301 }),
  ],
})
</script>

<template>
  <div />
</template>
