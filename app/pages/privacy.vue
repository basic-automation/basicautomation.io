<script setup lang="ts">
import { ORG_CARD_ALT } from '~~/shared/posts/section'

const siteUrl = useSiteOrigin()
const email = 'admin@basicautomation.io'

useCanonical('/privacy')

useSeoMeta({
  title: 'privacy — basic automation',
  description:
    'What basicautomation.io and the Nisaba desktop app collect, what leaves your computer, '
    + 'and what never does.',
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
        Privacy
      </p>

      <h1 class="mt-6 text-2xl text-pn-fg-bright sm:text-3xl">
        Privacy statement
      </h1>
      <p class="mt-3 text-xs text-pn-muted">
        Last updated 28 October 2026
      </p>

      <p class="mt-6 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Basic Automation is an open-source software project. This page covers this website and
        the Nisaba desktop app.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        This website
      </h2>
      <ul class="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-pn-dim">
        <li>There are no accounts, and the public pages set no cookies.</li>
        <li>
          There is no analytics, advertising or tracking, and the pages load no third-party
          scripts or fonts. The project figures shown here are fetched by our server from GitHub
          and crates.io; your browser does not contact them.
        </li>
        <li>
          Our server records each request (time, method, path, response status and the visitor's
          IP address as forwarded by our reverse proxy) so that we can run the site and spot
          abuse. We do not use these records for analytics or advertising, and we do not sell or
          share them.
        </li>
        <li>
          The site is delivered through Cloudflare, which processes requests, including IP
          addresses, to provide its content-delivery and security services. See Cloudflare's own
          privacy policy for how it does that.
        </li>
      </ul>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        The Nisaba desktop app
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Nisaba keeps one product catalog on your own computer and synchronizes quantities and
        listings with the marketplaces you connect. There is no Nisaba account, no Nisaba server
        that receives your catalog, no telemetry and no crash-reporting service.
      </p>
      <ul class="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-pn-dim">
        <li>
          Requests go to a marketplace only when you connect it, carry your own listing data, and
          go only to that marketplace.
        </li>
        <li>
          Your marketplace credentials and tokens are stored on your own computer and are sent
          only to that marketplace's own sign-in and API endpoints.
        </li>
        <li>
          The app checks GitHub for updates, which reveals what any web request reveals: your IP
          address, the app version and your operating system. You can turn the automatic check
          off in Settings.
        </li>
        <li>
          Where the app offers one-click eBay sign-in, a small service run by Basic Automation
          relays the sign-in. It stores nothing and does not log authorization codes or tokens.
        </li>
        <li>Syncing between your own computers is off unless you turn it on.</li>
      </ul>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Amazon
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        When you connect an Amazon seller account, Nisaba uses Amazon's Selling Partner API under
        your own authorization, from your own computer. It uses only the Listings Items API (to
        read your listings, create listings, and update quantity and price) and the Sellers API
        (to read which marketplaces you sell in). It does not call the Orders API, it does not
        read buyer data, and it requests no restricted roles. Basic Automation does not receive,
        store or process your Amazon data, and does not share it with anyone.
      </p>

      <p class="mt-6 max-w-2xl text-sm leading-relaxed text-pn-dim">
        The full statement for the app is kept with its source code:
        <a
          href="https://github.com/basic-automation/nisaba/blob/master/PRIVACY.md"
          target="_blank" rel="noreferrer noopener"
          class="text-pn-accent transition-colors hover:text-pn-bright-magenta"
        >Nisaba's PRIVACY.md</a>.
      </p>

      <h2 class="mt-10 text-lg text-pn-fg-bright">
        Questions and requests
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Write to
        <a :href="`mailto:${email}`" class="text-pn-accent transition-colors hover:text-pn-bright-magenta">{{ email }}</a>.
        If this statement changes, the date above changes with it.
      </p>
    </section>
  </div>
</template>
