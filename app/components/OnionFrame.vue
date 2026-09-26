<script setup lang="ts">
/**
 * The site, as it comes back over Tor, in a browser frame.
 *
 * Every ten minutes the onion gateway dials this site's own `.onion` address
 * through a real rendezvous circuit and keeps what came back. This renders that
 * document, with the measurement underneath it. The claim on this page is that
 * onyums is serving the page you are reading; this is the claim being shown
 * rather than repeated.
 *
 * The frame is deliberately inert — no pointer events, no tab stops, `inert` so
 * assistive technology does not walk into a second copy of the site. It is a
 * live render of a fetched document, not a browsing session: its links are
 * relative, so following one would quietly leave the snapshot and load this
 * origin instead, which would be a lie told by accident.
 */
/**
 * Handed down rather than fetched here. The page needs the same answer — its
 * copy refers to this frame, and the frame is absent whenever the snapshot came
 * from another build — and two `useFetch` calls sharing a key with different
 * options is a Nuxt warning (`NUXT_E3004`) and two sources of truth besides.
 */
const { snapshot } = defineProps<{
  snapshot: { address: string, status: number, bytes: number, elapsedMs: number, fetchedAt: number } | null
}>()

/** Swapped for the frame once it has painted; until then the splash stands in. */
const frameLoaded = ref(false)

const frame = ref<HTMLIFrameElement | null>(null)

/**
 * `@load` alone is not enough.
 *
 * The frame is `loading="lazy"`, so the browser decides when to fetch it, and
 * that decision can land before Vue has attached the listener — hydration and
 * the intersection observer are not ordered with respect to each other. When
 * that happens the event is simply missed, `frameLoaded` stays false, and the
 * splash covers a frame that loaded perfectly well. Observed doing exactly that.
 *
 * So the state is also read directly on mount. It is the same-origin document,
 * so `readyState` is legible; a cross-origin frame would throw and fall through
 * to the listener, which is the correct outcome there anyway.
 */
onMounted(() => {
  try {
    if (frame.value?.contentDocument?.readyState === 'complete') frameLoaded.value = true
  }
  catch {
    // Cross-origin, or the document is not there yet. `@load` covers both.
  }
})

const size = computed(() => {
  const bytes = snapshot?.bytes ?? 0
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
})

const seconds = computed(() => `${((snapshot?.elapsedMs ?? 0) / 1000).toFixed(1)} s`)

const when = computed(() => (snapshot ? relativeTime(new Date(snapshot.fetchedAt * 1000).toISOString()) : ''))
</script>

<template>
  <div v-if="snapshot" class="mt-10">
    <!-- Browser chrome. Square, like everything else here: the point of the
         frame is to say "this is a page in a browser", which the address bar
         does on its own without borrowing a vendor's rounded corners. -->
    <div class="max-w-6xl">
      <div class="flex items-center gap-3 border border-b-0 border-pn-rule bg-pn-rule/25 px-4 py-2.5">
        <!-- Three marks, not three coloured circles. Same idea, this palette. -->
        <span class="flex gap-1.5" aria-hidden="true">
          <span v-for="i in 3" :key="i" class="block h-2 w-2 bg-pn-muted/50" />
        </span>

        <span class="min-w-0 flex-1 truncate bg-pn-bg px-3 py-1 font-mono text-[0.7rem] text-pn-dim">
          <span class="text-pn-accent">https://</span>{{ snapshot.address }}<span class="text-pn-muted">/</span>
        </span>

        <span class="shrink-0 text-[0.65rem] tracking-[0.2em] text-pn-muted uppercase">tor</span>
      </div>

      <!-- The viewport. Fixed aspect so the splash and the frame occupy exactly
           the same box and the swap does not move the page under the reader.

           `style` rather than `aspect-[16/10]`: that utility is not in the built
           stylesheet — the arbitrary-value scanner does not pick up the `/`, and
           `/` is also Tailwind's opacity-modifier separator. A ratio that
           silently does not apply leaves the box at content height and the
           iframe at its intrinsic 300x150, which is exactly what it did. One
           declaration is not worth a utility that can vanish. -->
      <div class="relative overflow-hidden border border-pn-rule bg-pn-bg" style="aspect-ratio: 16 / 10">
        <img
          src="/onion-splash.webp"
          alt=""
          aria-hidden="true"
          class="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500"
          :class="frameLoaded ? 'opacity-0' : 'opacity-100'"
        >

        <!-- `inert` and `pointer-events-none`: see the component docs. Lazy so a
             reader who never scrolls this far pays nothing for it. -->
        <iframe
          ref="frame"
          src="/onion-frame"
          title="basicautomation.io as fetched over Tor"
          loading="lazy"
          inert
          tabindex="-1"
          scrolling="no"
          class="pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity duration-500"
          :class="frameLoaded ? 'opacity-100' : 'opacity-0'"
          @load="frameLoaded = true"
        />

        <!-- Only while the splash is up. -->
        <p
          v-if="!frameLoaded"
          class="absolute inset-x-0 bottom-0 bg-pn-bg/80 px-4 py-2 text-center font-mono text-[0.7rem] text-pn-dim"
        >
          rendering the document that came back over Tor…
        </p>
      </div>
    </div>

    <p class="mt-4 max-w-4xl font-mono text-xs leading-relaxed text-pn-muted">
      <span class="text-pn-accent">·</span>
      fetched {{ when }} over a Tor circuit from this server to its own onion
      address — {{ snapshot.status }}, {{ size }}, {{ seconds }}. Scripts are
      stripped and the frame does not accept input: it is the document that came
      back, rendered, not a second copy of the site to click around in.
    </p>
  </div>
</template>
