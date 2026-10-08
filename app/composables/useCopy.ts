/**
 * The copy buttons' behaviour, for `CodeLine` and `CodeBlock`.
 *
 * The clipboard can refuse: an insecure context, a denied permission, a
 * browser or an embedding frame that does not allow it. That used to fail in
 * silence — the button stayed `[copy]`, nothing was announced, and whoever
 * pressed it pasted whatever their clipboard held before. Now a refusal
 * selects the text instead, so the platform's own copy shortcut finishes the
 * job, and says so both on the button and to a screen reader.
 *
 * The button's name is pinned by its `aria-label`, so its visible text changes
 * nothing a screen reader reads out: `announcement` is for a `role="status"`
 * region beside it.
 */
export function useCopy() {
  const state = ref<'idle' | 'copied' | 'selected'>('idle')
  let timer: ReturnType<typeof setTimeout> | undefined

  function settle(next: 'copied' | 'selected', ms: number) {
    state.value = next
    clearTimeout(timer)
    timer = setTimeout(() => (state.value = 'idle'), ms)
  }

  async function copy(text: string, fallback: HTMLElement | null | undefined) {
    try {
      await navigator.clipboard.writeText(text)
      settle('copied', 1600)
    }
    catch {
      const selection = window.getSelection()
      if (!fallback || !selection) return
      const range = document.createRange()
      range.selectNodeContents(fallback)
      selection.removeAllRanges()
      selection.addRange(range)
      settle('selected', 4000)
    }
  }

  onBeforeUnmount(() => clearTimeout(timer))

  const label = computed(() => ({ idle: '[copy]', copied: '[copied]', selected: '[selected]' })[state.value])
  const announcement = computed(() => ({
    idle: '',
    copied: 'Copied to clipboard',
    selected: 'Could not copy. The text is selected; copy it with your keyboard.',
  })[state.value])

  return { copy, label, announcement }
}
