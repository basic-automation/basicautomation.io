<template>
  <!--
    Two filters, one tube.

    Both are referenced through `backdrop-filter`/`filter: url(...)`, which is
    the only way to reach live DOM behind an element — a canvas shader cannot
    see what is behind it without re-rendering the page into itself first.

    The turbulence in each is deliberately lopsided: a very low frequency
    across X and a high one down Y produces horizontal bands, so displacing
    against it moves the image ALONG the scanlines rather than in all
    directions — the way a misaligned tube pulls a picture sideways.

    They are split because the backdrop and the grille want different
    amplitudes. The picture behind the glass takes the full pull; the phosphor
    lines only shiver, because a working set shivers and does not tear. Every
    animation below shares the same durations and the same value walk, so the
    two stay in step — only `scale` differs. Driving them from one filter
    would force one amplitude on both; giving them separate clocks would let
    them drift apart.
  -->
  <svg class="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
    <defs>
      <!-- The backdrop: the picture behind the glass. Full displacement. -->
      <filter id="crt-warp" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feTurbulence
          type="fractalNoise"
          base-frequency="0.0014 0.34"
          num-octaves="1"
          seed="11"
          result="bands"
        >
          <animate
            attributeName="baseFrequency"
            dur="11s"
            values="0.0014 0.34; 0.0031 0.26; 0.0009 0.41; 0.0014 0.34"
            repeatCount="indefinite"
          />
          <animate attributeName="seed" dur="7s" values="11; 14; 9; 11" repeatCount="indefinite" />
        </feTurbulence>

        <!-- R drives the horizontal smear. B is near-flat in fractal noise, so
             using it for Y keeps vertical drift to a shiver, not a wobble. -->
        <feDisplacementMap
          in="SourceGraphic"
          in2="bands"
          scale="14"
          x-channel-selector="R"
          y-channel-selector="B"
        >
          <animate attributeName="scale" dur="5.5s" values="14; 20; 11; 14" repeatCount="indefinite" />
        </feDisplacementMap>
      </filter>

      <!-- The grille: same bands, same clock, a fraction of the pull. -->
      <filter id="crt-grille" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feTurbulence
          type="fractalNoise"
          base-frequency="0.0014 0.34"
          num-octaves="1"
          seed="11"
          result="bands"
        >
          <animate
            attributeName="baseFrequency"
            dur="11s"
            values="0.0014 0.34; 0.0031 0.26; 0.0009 0.41; 0.0014 0.34"
            repeatCount="indefinite"
          />
          <animate attributeName="seed" dur="7s" values="11; 14; 9; 11" repeatCount="indefinite" />
        </feTurbulence>

        <feDisplacementMap
          in="SourceGraphic"
          in2="bands"
          scale="1.6"
          x-channel-selector="R"
          y-channel-selector="B"
        >
          <animate attributeName="scale" dur="5.5s" values="1.6; 2.4; 1.1; 1.6" repeatCount="indefinite" />
        </feDisplacementMap>
      </filter>
    </defs>
  </svg>
</template>
