<script setup lang="ts">
/**
 * A labelled section rule. Backed by USeparator so it carries a real
 * `role="separator"` rather than being a decorative div — the label starts the
 * line, as a TUI draws one, and everything visual comes from the theme.
 */
const { label } = defineProps<{ label?: string }>()
</script>

<template>
  <USeparator
    type="dashed"
    :label="label"
    :position="label ? 'start' : 'center'"
    :ui="{
      border: 'border-pn-rule/70',
      container: 'font-mono',
      label: 'font-mono text-xs tracking-widest text-pn-muted lowercase pe-4',
    }"
  />
</template>
