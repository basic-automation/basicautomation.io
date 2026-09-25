<script setup lang="ts">
/**
 * The displacement map for the glass slab, built here rather than in the
 * template: a data URI cannot live in a Vue template attribute — the SFC
 * parser reads the slashes inside it as tag syntax and refuses the file.
 *
 * It is a vertical ramp in the GREEN channel — 255 at the top edge, 128
 * (neutral) through the middle, 0 at the bottom — so the backdrop is pulled
 * toward the centre line the way it is through thick glass. Red is held flat
 * at 128 so nothing shifts horizontally: the CRT filter owns the X axis, and
 * two filters pulling the same axis would cancel each other out.
 */
const LENS_MAP = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="128">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="rgb(128,255,128)"/>
         <stop offset="0.34" stop-color="rgb(128,150,128)"/>
         <stop offset="0.5" stop-color="rgb(128,128,128)"/>
         <stop offset="0.66" stop-color="rgb(128,106,128)"/>
         <stop offset="1" stop-color="rgb(128,0,128)"/>
       </linearGradient>
     </defs>
     <rect width="8" height="128" fill="url(#g)"/>
   </svg>`,
)}`
</script>

<template>
  <!--
    Three filters, one pane of glass.

    All are reached through `backdrop-filter`/`filter: url(...)`, which is the
    only way to touch live DOM behind an element — a canvas shader cannot see
    what is behind it without re-rendering the page into itself first.

    #crt-warp and #crt-grille share a deliberately lopsided turbulence: very
    low frequency across X, high down Y, so it bands horizontally and the
    displacement moves the image ALONG the scanlines. They are split so the
    backdrop can take the full pull while the phosphor lines only shiver — a
    working tube does not tear its own raster. Same durations, same value
    walk, different scale, so they stay in step.

    #glass-refract is the slab itself, and it works the Y axis alone so it
    never argues with the CRT over the same pixels.
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

      <!-- Liquid glass: the slab's own refraction, chained after the warp. -->
      <filter id="glass-refract" x="-10%" y="-25%" width="120%" height="150%" color-interpolation-filters="sRGB">
        <feImage
          :href="LENS_MAP"
          result="lens"
          preserveAspectRatio="none"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="lens"
          scale="16"
          x-channel-selector="R"
          y-channel-selector="G"
        >
          <animate attributeName="scale" dur="13s" values="16; 21; 13; 16" repeatCount="indefinite" />
        </feDisplacementMap>
      </filter>
    </defs>
  </svg>
</template>
