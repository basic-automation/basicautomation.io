import { hasAnchor } from '~~/shared/markdown/anchor'

/** The key this keeps in `history.state`, beside vue-router's own. */
const KEY = 'readmeOpen'

/**
 * Whether the about page's folded README is open — kept in the history entry.
 *
 * A visitor who unfolds a README, reads down it and moves to the blog tab
 * comes Back to a page rendered afresh, folded. vue-router hands Nuxt the
 * scroll position it saved for that entry, but on the folded page it no
 * longer exists, so the visitor landed at the bottom of a short page,
 * thousands of pixels from where they were reading (13,201 px down onyums'
 * README, restored to 2,700). Recording the fold in `history.state` makes
 * it part of the entry, as the scroll position is: Back and Forward reopen
 * it before the page scrolls, while a fresh visit by link starts folded, as
 * the page is designed to.
 *
 * A fragment that names a README heading opens it too — on a client-side
 * navigation, and on arrival from a link elsewhere, because only Chromium
 * opens a closed `<details>` for a fragment itself. Firefox, and so Tor
 * Browser, which is how the onion service is reached, left a link to
 * `/projects/onyums/about#how-onyums-compares` at the bottom of the folded
 * page with the heading hidden inside it.
 *
 * Never while hydrating: the element must match the server's markup, which
 * is folded. `onMounted` catches up — that is a reload, where the entry's
 * state survives.
 */
export function useReadmeFold(readmeHtml: Readonly<Ref<string | null>>) {
  const route = useRoute()
  const nuxtApp = useNuxtApp()

  const wanted = (): boolean => {
    if (!import.meta.client) return false
    // What the visitor last did with this entry's fold wins, even over a
    // fragment: one who folded it and came Back meant it.
    const kept: unknown = history.state?.[KEY]
    if (typeof kept === 'boolean') return kept
    return !!route.hash && hasAnchor(readmeHtml.value, route.hash)
  }

  const open = ref(!nuxtApp.isHydrating && wanted())
  // A reload: the browser restores the scroll position against the page as
  // the server sent it, folded, so a visitor reading the README lands short
  // of where they were. Neither it nor vue-router keeps the position across
  // a reload (`history.state.scroll` is `false` then), and Chromium drops a
  // `replaceState` made while the page unloads, so it goes to session
  // storage, keyed by the history entry. A convenience: if storage is
  // refused, a reload just lands where it did before.
  const entry = () => `readme-top:${history.state?.position ?? ''}:${route.path}`
  const remember = () => {
    try {
      if (open.value) sessionStorage.setItem(entry(), String(Math.round(window.scrollY)))
    }
    catch {}
  }
  onMounted(async () => {
    window.addEventListener('pagehide', remember)
    if (open.value) return
    // While hydrating the README is markup, not a string, so a fragment is
    // looked up in the document. Not when the visitor already chose.
    const heading = typeof history.state?.[KEY] === 'boolean' ? null : readmeHeading(route.hash)
    if (!heading && !wanted()) return
    open.value = true
    let top = Number.NaN
    try {
      // Only for the same entry come back to. vue-router numbers entries from
      // the length of the history when a document loads, so a fresh load can
      // reuse an older entry's number — and its saved position would send a
      // link to `#heading` to wherever that one was left.
      if (returning()) top = Number(sessionStorage.getItem(entry()) ?? Number.NaN)
    }
    catch {}
    await nextTick()
    if (Number.isFinite(top)) window.scrollTo({ top, behavior: 'instant' })
    else heading?.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
  onBeforeUnmount(() => window.removeEventListener('pagehide', remember))

  /** The `<details>`'s own `toggle`, from a click or from the binding. */
  function onToggle(event: Event) {
    const now = (event.target as HTMLDetailsElement).open
    open.value = now
    // vue-router merges `history.state` into the entry when it next writes
    // it, so the key survives navigating away; a new entry starts without it.
    if (history.state?.[KEY] !== now) history.replaceState({ ...history.state, [KEY]: now }, '')
  }

  return { open, onToggle }
}

/** The README element a location hash names, if it names one. */
function readmeHeading(hash: string): HTMLElement | null {
  const raw = hash.replace(/^#/, '')
  if (!raw) return null
  let id = raw
  try {
    id = decodeURIComponent(raw)
  }
  catch {}
  const el = document.getElementById(id)
  return el?.closest('.readme') ? el : null
}

/** Whether this document is a reload, or Back or Forward to it, rather than a new visit. */
function returning(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload' || nav?.type === 'back_forward'
}
