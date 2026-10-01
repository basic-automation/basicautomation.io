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
 *
 * An unknown slug is a 404 here, directly, not after a redirect. The query
 * string is carried over to the new address.
 */
import { bySlug } from '~~/data/projects'

definePageMeta({
  middleware: [
    (to) => {
      // Only a project that exists has an about tab to go to. Redirecting an
      // unknown slug too sent a crawler on a 301 to learn it had found a 404,
      // and told it "moved permanently" about something that never existed.
      if (!bySlug(String(to.params.slug))) {
        return abortNavigation(createError({ statusCode: 404, statusMessage: 'No such project', fatal: import.meta.client }))
      }
      // The query goes along: a link from a campaign carries its `utm_*` tags
      // on this address, and a redirect that dropped them would erase where
      // the visit came from. The canonical link on the target stays query-free
      // either way (`useCanonical`).
      return navigateTo({ path: `/projects/${to.params.slug}/about`, query: to.query }, { redirectCode: 301 })
    },
  ],
})
</script>

<template>
  <div />
</template>
