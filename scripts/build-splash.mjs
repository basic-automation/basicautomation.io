/**
 * Capture the splash the onion frame shows while it loads.
 *
 * `OnionFrame.vue` holds a fixed-aspect box and cross-fades from this image to
 * the real frame once it has painted. Without it the box is empty parchment for
 * as long as the fetch takes, which on a page about a thing being *live* reads
 * as the thing being broken.
 *
 * It is a real screenshot of the home page rather than a drawn placeholder,
 * because it is standing in for a real screenshot of the home page. It is
 * captured the same way the social cards are (`build-og.mjs`) — headless
 * Chromium against a running server — so there is one screenshot mechanism in
 * this repo, not two.
 *
 *   node .output/server/index.mjs &
 *   npm run splash                  # against http://127.0.0.1:3000
 *   npm run splash -- http://127.0.0.1:3124
 *
 * Committed, not built at deploy time: it changes when the design changes, not
 * when the site is deployed, and a deploy should not depend on a browser being
 * installed.
 */
import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const CHROMIUM = process.env.CHROMIUM ?? 'chromium'
const BASE = (process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/**
 * 16:10, matching the frame's aspect box exactly. A mismatch here is visible as
 * a jump at the moment the frame swaps in, which is the one moment the whole
 * component is trying not to draw attention to.
 */
const WIDTH = 1600
const HEIGHT = 1000

const OUT_DIR = resolve(root, 'public')
const PNG = resolve(OUT_DIR, 'onion-splash.png')
const WEBP = resolve(OUT_DIR, 'onion-splash.webp')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`· capturing ${BASE}/ at ${WIDTH}x${HEIGHT}`)
  await run(CHROMIUM, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    // The masthead's backdrop-filter and SVG filters are the whole look; without
    // a GPU-less compositor that honours them the splash would not match what
    // replaces it.
    '--force-color-profile=srgb',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${PNG}`,
    // Let the fonts land and the hero image decode before the shutter.
    '--virtual-time-budget=4000',
    `${BASE}/`,
  ])

  // webp at the size this is displayed: the frame is at most ~1000px wide on a
  // large screen, and this is a placeholder measured in milliseconds of screen
  // time. png stays out of the repo.
  console.log('· encoding webp')
  await run('magick', [PNG, '-resize', '1280x800', '-quality', '82', WEBP])
  await rm(PNG, { force: true })

  console.log(`✓ public/onion-splash.webp`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
