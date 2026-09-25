<script setup lang="ts">
import type { Status } from '~~/data/projects'

/**
 * Project status. A UBadge for the semantics and consistent sizing; the fill,
 * ring and radius a badge would normally bring are stripped in app.config.ts,
 * because nothing on this site is a pill.
 */
const { status } = defineProps<{ status: Status }>()

const color: Record<Status, string> = {
  stable: 'text-pn-bright-green',
  active: 'text-pn-cyan',
  alpha: 'text-pn-yellow',
  archived: 'text-pn-muted',
}

const label: Record<Status, string> = {
  stable: 'stable',
  active: 'in development',
  alpha: 'alpha',
  archived: 'archived',
}
</script>

<template>
  <!-- The library's own variant classes beat anything set in app.config for
       multi-slot components, so the chrome is removed here, on the instance,
       where `!` guarantees it. Nothing on this site is a filled pill. -->
  <UBadge
    :ui="{ base: 'bg-transparent! p-0! ring-0! font-mono text-xs gap-1.5 whitespace-nowrap' }"
    :class="color[status]"
    :aria-label="`Status: ${label[status]}`"
  >
    <span aria-hidden="true">●</span>{{ label[status] }}
  </UBadge>
</template>
