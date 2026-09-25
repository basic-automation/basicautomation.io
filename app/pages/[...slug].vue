<script setup lang="ts">
/**
 * The catch-all, so that a missing page is a route rather than a miss.
 *
 * Without it vue-router finds nothing to match and warns — six unstructured
 * lines on stdout for every 404, twice over, which on a public site means a
 * steady drip of scanner probes shredding the JSON request log beside it. The
 * response was always a correct 404 rendered by `app/error.vue`; this only
 * changes who decides that, and it still is `error.vue` that renders it.
 *
 * Every real route is more specific than `[...slug]`, so this is only ever
 * reached when nothing else matched — including `/projects/<slug>`, which
 * throws its own 404 with a message about the project.
 */
throw createError({
  statusCode: 404,
  statusMessage: 'Page not found',
  fatal: true,
})
</script>

<template>
  <!-- Never rendered: the fatal error above hands the page to error.vue. -->
  <div />
</template>
