<script setup lang="ts">
import { ORG_CARD_ALT } from '~~/shared/posts/section'

const siteUrl = useSiteOrigin()
const email = 'admin@basicautomation.io'

useCanonical('/contact')

useSeoMeta({
  title: 'contact — basic automation',
  description:
    'How to reach Basic Automation: questions about Nisaba and our other open-source projects, '
    + 'bug reports, and security or privacy requests.',
  ogImage: () => `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: ORG_CARD_ALT,
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 sm:px-6">
    <section class="pt-14 pb-10">
      <p class="text-xs tracking-[0.25em] text-pn-accent uppercase">
        Contact
      </p>

      <h1 class="mt-6 text-2xl text-pn-fg-bright sm:text-3xl">
        Contact Basic Automation
      </h1>

      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Basic Automation is an open-source software project. We design and build software tools
        for businesses and publish the sharp ones, including
        <NuxtLink to="/projects/nisaba/about" class="text-pn-accent transition-colors hover:text-pn-bright-magenta">
          Nisaba
        </NuxtLink>,
        a desktop app that keeps one product list in step across the marketplaces a seller uses.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Email
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        For questions about our software, support, and privacy requests, write to
        <a :href="`mailto:${email}`" class="text-pn-accent transition-colors hover:text-pn-bright-magenta">{{ email }}</a>.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Bug reports and feature requests
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Open an issue on the project's repository on GitHub. For Nisaba that is
        <a
          href="https://github.com/basic-automation/nisaba/issues"
          target="_blank" rel="noreferrer noopener"
          class="text-pn-accent transition-colors hover:text-pn-bright-magenta"
        >github.com/basic-automation/nisaba/issues</a>.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Security issues
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Please report a vulnerability privately, not in a public issue. On GitHub, use
        <a
          href="https://github.com/basic-automation/nisaba/security/advisories/new"
          target="_blank" rel="noreferrer noopener"
          class="text-pn-accent transition-colors hover:text-pn-bright-magenta"
        >Report a vulnerability</a>
        on the repository's Security tab, or email the address above.
      </p>
    </section>
  </div>
</template>
