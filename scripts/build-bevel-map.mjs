/**
 * Builds public/bg/bevel-map.png — the displacement map behind the masthead's
 * glass edges.
 *
 * It is not a picture. Red carries horizontal displacement, green vertical;
 * 128 in both means "leave this pixel alone". Everything is neutral across the
 * middle of the pane and rolls off inside a band at each edge.
 *
 * The important part is that BOTH channels respond to BOTH edges. A first pass
 * made red depend only on x and green only on y, which is geometrically
 * tidy and visually useless: the scanlines are horizontal, and sliding a
 * horizontal line sideways changes nothing you can see. Only the top and
 * bottom bevels showed, because only they displaced vertically.
 *
 * So instead each pixel is pulled toward the centre of the pane, with the pull
 * rising as it nears ANY edge. Near the left edge the top of the grille is
 * pushed down and the bottom pushed up — the lines visibly converge, the way
 * they do through the thick part of a lens. That is the whole effect.
 *
 * Regenerate with `npm run bevel` after changing any constant.
 */
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WIDTH = 640
const HEIGHT = 64
/** Band in map pixels. The map is stretched 2x over a 1280x128 masthead, so
 *  this lands as roughly 28 screen pixels on every side. */
const BAND = 14

/** 0 across the middle, eased to 1 at the very edge. */
const edge = (i, n) => {
  const d = Math.min(i, n - 1 - i)
  if (d >= BAND) return 0
  const t = 1 - d / BAND
  return 0.5 - 0.5 * Math.cos(Math.PI * t)
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))

const header = Buffer.from(`P6\n${WIDTH} ${HEIGHT}\n255\n`, 'ascii')
const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)

let i = 0
for (let y = 0; y < HEIGHT; y++) {
  const dy = ((y + 0.5) / HEIGHT - 0.5) * 2 // -1 at the top, +1 at the bottom
  const ey = edge(y, HEIGHT)
  for (let x = 0; x < WIDTH; x++) {
    const dx = ((x + 0.5) / WIDTH - 0.5) * 2
    const ex = edge(x, WIDTH)
    // One pull, strongest at whichever edge is nearest, aimed at the centre.
    const k = Math.max(ex, ey)
    pixels[i++] = clamp(128 - 127 * k * dx)
    pixels[i++] = clamp(128 - 127 * k * dy)
    pixels[i++] = 128
  }
}

const ppm = join(tmpdir(), 'bevel-map.ppm')
writeFileSync(ppm, Buffer.concat([header, pixels]))
execFileSync('magick', [ppm, 'public/bg/bevel-map.png'])

console.log(`Wrote public/bg/bevel-map.png — ${WIDTH}x${HEIGHT}, ${BAND}px bands, both channels on both axes`)
