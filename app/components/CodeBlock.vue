<script setup lang="ts">
const { code, label, html } = defineProps<{
  code: string
  label?: string
  /** Server-highlighted markup. Falls back to the plain `code` when absent. */
  html?: string | null
}>()

const { copy, label: buttonText, announcement } = useCopy()
const target = useTemplateRef<HTMLElement>('target')
</script>

<template>
  <figure class="bar" style="--accent: var(--color-pn-rule)">
    <figcaption v-if="label" class="flex items-baseline gap-4 pb-2 text-xs text-pn-muted">
      <span class="truncate"># {{ label }}</span>
      <UButton
        :ui="{ base: 'bg-transparent! p-0! ring-0! font-mono text-xs cursor-pointer hover:bg-transparent!' }"
        class="needs-script ml-auto shrink-0 text-pn-muted hover:text-pn-fg-bright"
        :aria-label="`Copy ${label}`"
        @click="copy(code, target)"
      >
        {{ buttonText }}
      </UButton>
    </figcaption>
    <!-- The button's name is pinned by its aria-label, so its text changes
         nothing a screen reader reads out. This says it, outside the
         figcaption so it never becomes part of the figure's name. -->
    <span v-if="label" role="status" class="sr-only">{{ announcement }}</span>

    <!-- Highlighted on the server by Shiki, in the site's own palette. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="html" ref="target" class="code" v-html="html" />
    <pre v-else ref="target" class="code"><code>{{ code }}</code></pre>
  </figure>
</template>
