<script setup lang="ts">
/**
 * How to reach the onion address yourself.
 *
 * The frame above it is this server's word for it. This is the reader doing it
 * themselves, which is the only version that actually settles the question — so
 * the steps are the real ones, including the certificate warning, which is the
 * step people stop at when nobody warned them it was coming.
 */
defineProps<{ address: string }>()
</script>

<template>
  <ol class="mt-8 max-w-3xl space-y-5">
    <li class="flex gap-4">
      <span class="shrink-0 font-mono text-xs text-pn-accent" aria-hidden="true">01</span>
      <p class="text-sm leading-relaxed text-pn-fg">
        Install Tor Browser from
        <a
          href="https://www.torproject.org/download/"
          target="_blank"
          rel="noreferrer noopener"
          class="text-pn-accent underline underline-offset-4 hover:text-pn-fg-bright"
        >torproject.org/download</a>. It is the Tor Project's own build, for
        Windows, macOS, Linux and Android. Nothing else needs installing — the
        Tor client is inside it.
      </p>
    </li>

    <li class="flex gap-4">
      <span class="shrink-0 font-mono text-xs text-pn-accent" aria-hidden="true">02</span>
      <p class="text-sm leading-relaxed text-pn-fg">
        Open it and press <span class="font-mono text-pn-fg-bright">Connect</span>.
        The first connection builds a circuit and takes a few seconds; after that
        it is quick. You do not need a bridge unless Tor is blocked where you are.
      </p>
    </li>

    <li class="flex gap-4">
      <span class="shrink-0 font-mono text-xs text-pn-accent" aria-hidden="true">03</span>
      <div class="min-w-0">
        <p class="text-sm leading-relaxed text-pn-fg">
          Paste the address into the address bar. Onion addresses are 56
          characters of base32 and are not memorable by design — the address
          <em>is</em> the service's public key, which is what makes it
          unspoofable.
        </p>
        <CodeLine class="mt-4" :code="`https://${address}`" :prompt="false" />
      </div>
    </li>

    <li class="flex gap-4">
      <span class="shrink-0 font-mono text-xs text-pn-accent" aria-hidden="true">04</span>
      <p class="text-sm leading-relaxed text-pn-fg">
        Accept the certificate warning. The service presents a self-signed
        certificate for its own address, because no certificate authority issues
        for <span class="font-mono">.onion</span> and none is needed: the
        rendezvous circuit has already proved you are talking to the holder of
        that key before any TLS happens. This is the step people stop at, and it
        is the expected one.
      </p>
    </li>

    <li class="flex gap-4">
      <span class="shrink-0 font-mono text-xs text-pn-accent" aria-hidden="true">05</span>
      <p class="text-sm leading-relaxed text-pn-fg">
        Wait out the <span class="font-mono text-pn-fg-bright">Checking your
          connection…</span> page. That is the abuse gate solving a one-time
        proof-of-work in your browser — a few hundred milliseconds, no
        interaction. Then you are on the site, over Tor.
      </p>
    </li>
  </ol>
</template>
