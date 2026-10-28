<script setup lang="ts">
import { ORG_CARD_ALT } from '~~/shared/posts/section'

const siteUrl = useSiteOrigin()
const email = 'admin@basicautomation.io'

useCanonical('/terms')

useSeoMeta({
  title: 'terms — basic automation',
  description:
    'The terms for using basicautomation.io and the free, MIT-licensed Nisaba desktop app.',
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
        Terms
      </p>

      <h1 class="mt-6 text-2xl text-pn-fg-bright sm:text-3xl">
        Terms of use
      </h1>
      <p class="mt-3 text-xs text-pn-muted">
        Last updated 28 October 2026
      </p>

      <p class="mt-6 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Basic Automation is an open-source software project. By using this website or its software
        you agree to these terms.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Price
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Nisaba and our other software are free. There are no fees, subscriptions or paid tiers.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        The software
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Each project is published under the open-source licence in its repository. Nisaba is
        licensed under the
        <a
          href="https://github.com/basic-automation/nisaba/blob/master/LICENSE"
          target="_blank" rel="noreferrer noopener"
          class="text-pn-accent transition-colors hover:text-pn-bright-magenta"
        >MIT licence</a>,
        which lets you use, copy, modify and distribute it. It is provided as is, without warranty
        of any kind, and the authors are not liable for any claim or damage arising from its use.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Using Nisaba with your marketplace accounts
      </h2>
      <ul class="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-pn-dim">
        <li>
          You connect your own accounts and you authorize Nisaba to act on them. Nisaba changes
          listings on those marketplaces, such as quantity and price, so you are responsible for
          what it is set up to do. It can preview a sync before anything is written.
        </li>
        <li>
          You are responsible for following each marketplace's own terms and policies, including
          Amazon's Acceptable Use Policy and Data Protection Policy, and for keeping your
          credentials safe.
        </li>
        <li>
          Marketplaces can change or withdraw their interfaces, so Basic Automation cannot
          promise that a connection will keep working.
        </li>
      </ul>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Trademarks
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Amazon, eBay, Squarespace and other names are trademarks of their owners. Basic Automation
        is not affiliated with, endorsed by or sponsored by them.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        This website
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        The content is provided as is. We link to third-party sites and are not responsible for
        them. How the site handles your data is described in the
        <NuxtLink to="/privacy" class="text-pn-accent transition-colors hover:text-pn-bright-magenta">
          privacy statement
        </NuxtLink>.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Questions
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Write to
        <a :href="`mailto:${email}`" class="text-pn-accent transition-colors hover:text-pn-bright-magenta">{{ email }}</a>.
        If these terms change, the date above changes with it.
      </p>
    </section>
  </div>
</template>
