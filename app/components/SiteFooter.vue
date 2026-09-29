<script setup lang="ts">
import { sortedProjects } from '~~/data/projects'

// Names and slugs are editorial and identical on every request — no reason to
// make the footer wait on the GitHub fetch.
const projects = sortedProjects()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mx-auto mt-24 w-full max-w-7xl px-5 pb-16 sm:px-6">
    <div class="rule-dashed" />

    <div class="grid gap-8 pt-8 text-xs sm:grid-cols-3">
      <div>
        <BrandMark class="h-20 w-20 shrink-0 text-pn-fg" />
        <p class="mt-3 max-w-[22rem] leading-relaxed text-pn-muted">
          We design and build software tools for businesses. The sharp ones get
          published — mostly Rust, all open source.
        </p>
      </div>

      <div>
        <p class="text-pn-muted">
          projects
        </p>
        <!-- Each link is its own 24px row rather than 15px of text with a gap:
             WCAG 2.2's minimum target size, which the tightly stacked names
             failed on every page (`npm run a11y:browser`). The row pitch is
             what it was, give or take two pixels — the gap became the target. -->
        <ul class="mt-2">
          <li v-for="p in projects" :key="p.slug">
            <NuxtLink
              :to="`/projects/${p.slug}/about`"
              class="inline-block py-1 text-pn-dim transition-colors hover:text-pn-fg-bright"
            >
              {{ p.name }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="text-pn-muted">
          elsewhere
        </p>
        <ul class="mt-2">
          <li>
            <a
              href="https://github.com/basic-automation"
              target="_blank" rel="noreferrer noopener"
              class="inline-block py-1 text-pn-dim transition-colors hover:text-pn-fg-bright"
            >github.com/basic-automation</a>
          </li>
          <li>
            <a
              href="https://crates.io/crates/artiqwest"
              target="_blank" rel="noreferrer noopener"
              class="inline-block py-1 text-pn-dim transition-colors hover:text-pn-fg-bright"
            >crates.io</a>
          </li>
          <li>
            <!-- Not a NuxtLink: this is a server route, not a page to route to. -->
            <a
              href="/releases.xml"
              class="inline-block py-1 text-pn-dim transition-colors hover:text-pn-fg-bright"
            >releases feed</a>
          </li>
          <li>
            <a
              href="/news.xml"
              class="inline-block py-1 text-pn-dim transition-colors hover:text-pn-fg-bright"
            >news feed</a>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-10 flex flex-col gap-1.5 text-xs text-pn-muted sm:flex-row sm:justify-between">
      <span># © {{ year }} basic automation</span>
      <!-- The claim and the evidence for it, in the same place. -->
      <NuxtLink to="/status" class="transition-colors hover:text-pn-fg-bright">
        # data live from github &amp; crates.io
      </NuxtLink>
    </div>
  </footer>
</template>
