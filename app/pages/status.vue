<script setup lang="ts">
import type { Health } from '~~/shared/types/health'

/**
 * What the process behind this page is doing, rendered by that same process.
 *
 * The point is the `source` column: every number on this site is fetched from
 * GitHub and crates.io at request time, and when that fails the render falls
 * back to a snapshot committed to the repository. That is invisible on a
 * project page — by design, the page still looks right — so this is where it
 * is visible.
 */

const { data: healthData } = await useFetch<Health>('/healthz', { key: 'health' })
const { projects } = await useProjects()

const health = computed(() => healthData.value ?? null)

/** "2 days, 3 hours" — an uptime nobody has to divide by 86400 themselves. */
function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const units: [string, number][] = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]
  const parts: string[] = []
  let rest = Math.max(0, Math.round(seconds))
  for (const [name, size] of units) {
    const n = Math.floor(rest / size)
    if (n > 0) parts.push(`${n} ${name}${n === 1 ? '' : 's'}`)
    rest -= n * size
    if (parts.length === 2) break
  }
  return parts.length ? parts.join(', ') : '0 seconds'
}

const rows = computed(() => {
  const h = health.value
  if (!h) return []
  return [
    { label: 'status', value: h.status },
    { label: 'data', value: h.data.source },
    { label: 'uptime', value: duration(h.uptimeSeconds) },
    { label: 'started', value: h.startedAt },
    { label: 'live fetches', value: String(h.data.liveResolutions) },
    { label: 'snapshot fetches', value: String(h.data.snapshotResolutions) },
  ]
})

useSeoMeta({
  title: 'status — basic automation',
  description:
    'Whether basicautomation.io is rendering from live GitHub and crates.io data '
    + 'or from its committed fallback snapshot, and how long it has been up.',
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 sm:px-6">
    <section class="pt-14 pb-10">
      <p class="text-xs tracking-[0.25em] text-pn-accent uppercase">
        Operations
      </p>

      <h1 class="mt-6 text-2xl text-pn-fg-bright sm:text-3xl">
        Status
      </h1>

      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-pn-dim">
        Every number on this site is fetched when the page is rendered. When GitHub or
        crates.io cannot be reached, the render falls back to a snapshot committed to the
        repository — the site stays up and the numbers go stale. This page says which is
        happening.
      </p>
    </section>

    <!-- ── Process ──────────────────────────────────────────────────────── -->
    <section class="mb-24">
      <TermRule label="process" />

      <p v-if="!health" class="mt-7 text-sm text-pn-muted">
        No health data — the process did not answer its own /healthz.
      </p>

      <template v-else>
        <p class="mt-8 text-2xl text-pn-fg-bright sm:text-3xl">
          <span aria-hidden="true" :class="health.status === 'ok' ? 'text-pn-bright-green' : 'text-pn-yellow'">● </span>
          <span v-if="health.status === 'ok'">Serving live data.</span>
          <span v-else>Serving the fallback snapshot.</span>
        </p>

        <p
          v-if="health.data.degradedSince"
          class="mt-4 max-w-2xl text-sm leading-relaxed text-pn-dim"
        >
          Upstream has been unreachable for {{ duration(health.data.degradedForSeconds) }},
          since {{ health.data.degradedSince }}. The pages are correct; the stars, versions
          and download counts on them are as old as the snapshot.
        </p>

        <dl class="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-xs">
          <div v-for="row in rows" :key="row.label" class="flex items-baseline gap-2">
            <dt class="text-pn-muted">
              {{ row.label }}
            </dt>
            <dd class="text-pn-fg-bright">
              {{ row.value }}
            </dd>
          </div>
        </dl>
      </template>
    </section>

    <!-- ── Per project ──────────────────────────────────────────────────── -->
    <section class="mb-24">
      <TermRule label="projects" />
      <ul class="mt-8 max-w-4xl space-y-5">
        <li v-for="p in projects" :key="p.slug" class="bar" :style="accentVar(p.accent)">
          <p class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <NuxtLink
              :to="`/projects/${p.slug}`"
              class="text-sm transition-colors hover:text-pn-fg-bright"
              :style="{ color: 'var(--accent)' }"
            >{{ p.slug }}</NuxtLink>
            <span class="text-xs" :class="p.meta?.source === 'live' ? 'text-pn-dim' : 'text-pn-yellow'">
              {{ p.meta?.source ?? 'unresolved' }}
            </span>
            <time
              v-if="p.meta?.fetchedAt"
              class="text-xs text-pn-muted"
              :datetime="p.meta.fetchedAt"
            >fetched {{ relativeTime(p.meta.fetchedAt) }}</time>
          </p>
        </li>
      </ul>
    </section>

    <!-- ── Endpoints ────────────────────────────────────────────────────── -->
    <section class="mb-24">
      <TermRule label="endpoints" />
      <ul class="mt-8 space-y-2 text-xs">
        <li v-for="path in ['/healthz', '/api/projects', '/sitemap.xml', '/robots.txt', '/releases.xml']" :key="path">
          <!-- Server routes, not pages: plain anchors, nothing for the router. -->
          <a :href="path" class="text-pn-dim transition-colors hover:text-pn-fg-bright">{{ path }}</a>
        </li>
      </ul>
    </section>
  </div>
</template>
