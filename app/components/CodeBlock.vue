<script setup lang="ts">
const { code, label, html } = defineProps<{
  code: string
  label?: string
  /** Server-highlighted markup. Falls back to the plain `code` when absent. */
  html?: string | null
}>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1600)
  }
  catch {
    // Clipboard unavailable (insecure context, denied permission) — the code is
    // on screen to select by hand.
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <figure class="bar" style="--accent: var(--color-pn-rule)">
    <figcaption v-if="label" class="flex items-baseline gap-4 pb-2 text-xs text-pn-muted">
      <span class="truncate"># {{ label }}</span>
      <UButton
        :ui="{ base: 'bg-transparent! p-0! ring-0! font-mono text-xs cursor-pointer hover:bg-transparent!' }"
        class="ml-auto shrink-0 text-pn-muted hover:text-pn-fg-bright"
        :aria-label="`Copy ${label}`"
        @click="copy"
      >
        {{ copied ? '[copied]' : '[copy]' }}
      </UButton>
    </figcaption>

    <!-- Highlighted on the server by Shiki, in the site's own palette. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="html" class="code" v-html="html" />
    <pre v-else class="code"><code>{{ code }}</code></pre>
  </figure>
</template>
