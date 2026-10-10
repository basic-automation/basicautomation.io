<script setup lang="ts">
const { code, prompt = true } = defineProps<{
  code: string
  /** A `$` sigil. Off for anything that is not a shell command. */
  prompt?: boolean
}>()

const { copy, label: buttonText, announcement } = useCopy()
const target = useTemplateRef<HTMLElement>('target')
</script>

<template>
  <div class="flex items-center gap-4 bar" style="--accent: var(--color-pn-rule)">
    <!-- `wrap-anywhere`: a command already wraps at its spaces, but an onion
         address or a URL is one unbroken token, and it used to overflow into a
         scroll region on a phone — one a keyboard could not reach, and one that
         hid most of the address it exists to show. -->
    <code ref="target" class="min-w-0 flex-1 overflow-x-auto py-1 text-sm wrap-anywhere text-pn-green prompt" :style="prompt ? undefined : { '--prompt': '\'\'' }">{{ code }}</code>
    <!-- UButton for the focus ring, keyboard handling and disabled semantics;
         app.config.ts strips it back to a bracketed mono label. -->
    <UButton
      :ui="{ base: 'bg-transparent! p-0! ring-0! font-mono text-xs cursor-pointer hover:bg-transparent!' }"
      class="needs-script shrink-0 text-pn-muted hover:text-pn-fg-bright"
      :aria-label="`Copy to clipboard: ${code}`"
      @click="copy(code, target)"
    >
      {{ buttonText }}
    </UButton>
    <!-- The button's name is pinned by its aria-label, so its text changes
         nothing a screen reader reads out. This says it. -->
    <span role="status" class="sr-only">{{ announcement }}</span>
  </div>
</template>
