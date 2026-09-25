/**
 * Builds public/bg/bevel-map.png — the displacement map behind the masthead's
 * glass edges.
 *
 * It is not a picture. Red carries horizontal displacement, green vertical:
 * 128 means "leave this pixel where it is", and the channels roll off to 255
 * and 0 inside a band at each edge. Feeding that to feDisplacementMap leaves
 * the middle of the pane untouched and bends the backdrop inward near every
 * edge, the way a thick piece of ground glass does.
 *
 * The roll-off is cosine-eased so the bevel reads as a rounded edge rather
 * than a crease. Regenerate with `npm run bevel` after changing any constant.
 */
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WIDTH = 640
const HEIGHT = 64
/** Band width in map pixels. The map is stretched over the pane, so at a
 *  1280x128 masthead each of these lands as roughly 28 screen pixels. */
const BAND = 14

const ramp = (i, n, band) => {
  if (i < band) {
    const t = 1 - i / band
    return 128 + 127 * (0.5 - 0.5 * Math.cos(Math.PI * t))
  }
  if (i >= n - band) {
    const t = (i - (n - band)) / band
    return 128 - 127 * (0.5 - 0.5 * Math.cos(Math.PI * t))
  }
  return 128
}

const gx = Array.from({ length: WIDTH }, (_, x) => Math.round(ramp(x, WIDTH, BAND)))
const gy = Array.from({ length: HEIGHT }, (_, y) => Math.round(ramp(y, HEIGHT, BAND)))

const header = Buffer.from(`P6\n${WIDTH} ${HEIGHT}\n255\n`, 'ascii')
const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)
let i = 0
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    pixels[i++] = gx[x]
    pixels[i++] = gy[y]
    pixels[i++] = 128
  }
}

const ppm = join(tmpdir(), 'bevel-map.ppm')
writeFileSync(ppm, Buffer.concat([header, pixels]))
execFileSync('magick', [ppm, 'public/bg/bevel-map.png'])

console.log(`Wrote public/bg/bevel-map.png — ${WIDTH}x${HEIGHT}, ${BAND}px bands`)
