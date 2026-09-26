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
  >
    <!-- The word "Status" used to be an `aria-label` on this badge. ARIA
         prohibits `aria-label` on a generic element — a UBadge renders a bare
         `span` with no role — and screen readers are entitled to ignore it, so
         the prefix was being dropped while the visible text carried the rest.
         Said in the content instead, where it is the accessible name by
         construction. `sr-only` is absolutely positioned, so it is not a flex
         item and the badge's own `gap` does not open a hole where it sits. -->
    <span class="sr-only">Status: </span>
    <span aria-hidden="true">●</span>{{ label[status] }}
  </UBadge>
</template>
