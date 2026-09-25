<script setup lang="ts">
/**
 * The masthead is always a pane of CRT glass — the warp and the scanlines do
 * not wait for a scroll, because a tube does not switch off when the picture
 * stops moving.
 */
const nav = [
  { label: 'projects', to: '/projects' },
  { label: 'about', to: '/#about' },
]

/**
 * Drive the bevel's catch from the scroll position.
 *
 * The pane is a fixed sheet that the page slides behind, and a highlight that
 * does not answer that is a highlight that has been painted on. `--crt-glint`
 * is a 0..1 ramp the CSS uses to swing the balance between the lit corners and
 * to carry a travelling glint along the edges; `.crt-rim` in main.css is where
 * it is spent.
 *
 * One cycle per SWEEP_PX of scrolling rather than per page: tied to page
 * fraction, the same flick of the wheel would move the light a long way on a
 * short page and barely at all on a long one, which is exactly backwards for
 * something meant to read as a physical response to movement.
 *
 * The four corner intensities are computed here rather than in the stylesheet
 * because they are quarter-phase apart on a sine, and CSS cannot do that
 * portably — `sin()` is recent enough that Tor Browser, which is Firefox ESR
 * and a visitor this site actually expects, would fall through to no highlight
 * at all. A trig call per animation frame is not the expensive part of this.
 *
 * Each one swings the full range, down to nothing. That matters: a corner with
 * a floor under its brightness never goes out, and a corner that never goes out
 * is a white mark in a fixed place, which is a border with extra steps.
 */
const glass = ref<HTMLElement | null>(null)

/** Distance scrolled for the glint to cross the pane once. */
const SWEEP_PX = 1400

let detach: (() => void) | null = null

onMounted(() => {
  // Reduced motion keeps the rim — it is the glass's shape, not decoration —
  // and simply stops it moving. Unset, `var(--crt-glint, 0)` holds it still.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let queued = false

  const update = () => {
    queued = false

    const el = glass.value
    if (!el) return

    const phase = (window.scrollY / SWEEP_PX) % 1
    el.style.setProperty('--crt-glint', String(phase))

    // Top-left, top-right, bottom-right, bottom-left — a quarter turn apart, so
    // the lit corner walks round the pane instead of all four pulsing together.
    for (let i = 0; i < 4; i++) {
      const v = 0.5 + 0.5 * Math.sin(2 * Math.PI * (phase - i / 4))
      el.style.setProperty(`--crt-c${i + 1}`, v.toFixed(3))
    }

    // How fat the wide ring is at this moment. Two sines at rates that do not
    // divide into each other, so the width wanders instead of pulsing on the
    // same beat as everything else — a highlight that breathes in time with its
    // own brightness reads as one animation, which is the tell.
    const wobble = 0.5 + 0.34 * Math.sin(2 * Math.PI * phase) + 0.16 * Math.sin(2 * Math.PI * 2.7 * phase + 1.1)
    el.style.setProperty('--crt-wobble', Math.min(1, Math.max(0, wobble)).toFixed(3))
  }

  // Coalesced into a frame: scroll fires far more often than the compositor
  // can use, and this writes a custom property that repaints a masked ring.
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  detach = () => window.removeEventListener('scroll', onScroll)

  // Deep links and restored scroll positions do not fire a scroll event.
  update()
})

onBeforeUnmount(() => {
  detach?.()
  detach = null
})
</script>

<template>
  <header class="sticky top-0 z-50">
    <!-- The glass is a pane, not a band: it stops at the content measure so it
         reads as an object sitting over the page rather than a bar welded to
         the window. Inside it, the same gutter as the content below, so the
         mark lines up with the copy. -->
    <!-- `flow-root` matters: the pane hangs off the top of the screen with a
         negative top margin, and without a block formatting context here that
         margin would collapse through this wrapper and drag the whole sticky
         header up with it instead of just the glass. -->
    <div class="mx-auto max-w-7xl flow-root">
      <div ref="glass" class="crt-glass flex items-center gap-4 px-5 sm:px-6">
        <!-- The bevel's catch, in two rings. Elements rather than
             pseudo-elements for two reasons: both of this pane's pseudos are
             already spoken for (::after is the phosphor grille, ::before the
             drifting sheen), and a mask applies to an element's whole subtree,
             so a ring cannot contain another ring of a different width. Two
             widths is the point — see `.crt-rim` in main.css. -->
        <span class="crt-rim crt-rim--wide" aria-hidden="true" />
        <span class="crt-rim crt-rim--fine" aria-hidden="true" />

        <NuxtLink to="/" class="flex items-center" aria-label="Basic Automation — home">
          <BrandMark title="Basic Automation" class="h-24 w-24 shrink-0 text-pn-fg" />
        </NuxtLink>

        <nav class="ml-auto flex items-center gap-5 text-xs sm:gap-6">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="text-pn-muted transition-colors hover:text-pn-fg-bright"
          >
            {{ item.label }}
          </NuxtLink>
          <a
            href="https://github.com/basic-automation"
            target="_blank"
            rel="noreferrer noopener"
            class="text-pn-muted transition-colors hover:text-pn-fg-bright"
          >
            github
          </a>
        </nav>
      </div>
    </div>
  </header>
</template>
