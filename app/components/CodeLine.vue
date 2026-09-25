<script setup lang="ts">
const { code } = defineProps<{ code: string }>()

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
    // Clipboard unavailable (insecure context, denied permission) — the command
    // is on screen to select by hand.
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex items-center gap-4 bar" style="--accent: var(--color-pn-rule)">
    <code class="flex-1 overflow-x-auto py-1 text-sm text-pn-green prompt">{{ code }}</code>
    <!-- UButton for the focus ring, keyboard handling and disabled semantics;
         app.config.ts strips it back to a bracketed mono label. -->
    <UButton
      :ui="{ base: 'bg-transparent! p-0! ring-0! font-mono text-xs cursor-pointer hover:bg-transparent!' }"
      class="shrink-0 text-pn-muted hover:text-pn-fg-bright"
      :aria-label="`Copy to clipboard: ${code}`"
      @click="copy"
    >
      {{ copied ? '[copied]' : '[copy]' }}
    </UButton>
  </div>
</template>
