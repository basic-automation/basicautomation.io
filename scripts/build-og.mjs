/**
 * One Open Graph card per project, rendered from the editorial data.
 *
 * Social networks do not render SVG, so a card has to be a raster image. It
 * does not have to be rendered at request time: everything on a card — the
 * name, the wordmark, the hero line, the accent — lives in `data/projects.ts`
 * and only moves when someone edits that file. Nothing live belongs on one
 * anyway; a star count baked into an image a social network has cached for a
 * month is worse than no star count.
 *
 * So the cards are generated here, committed, and served as static files. Same
 * posture as `data/projects.generated.json`: a build artifact in the repo, with
 * a reviewable diff when it changes.
 *
 *   npm run og
 *
 * Needs a local Chromium. This is an authoring tool, not a build step — CI does
 * not run it, and the container never sees it.
 *
 * The palette below is not a second copy of the theme: `ACCENT_HEX` is imported
 * from `app/utils/projects.ts`, and the greys are the same literals as the
 * `@theme` block in `app/assets/css/main.css`.
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { projects } from '../data/projects.ts'
import { ACCENT_HEX, STATUS_LABEL } from '../app/utils/projects.ts'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT_DIR = resolve(ROOT, 'public/projects/og')

/** Open Graph's own recommendation, and what every network crops against. */
const WIDTH = 1200
const HEIGHT = 630

/** From the `@theme` block in app/assets/css/main.css. Nothing new here. */
const BG = '#d8d8d0'
const FG_BRIGHT = '#0c0a09'
const DIM = '#5b5b4b'
const MUTED = '#7c7c67'
const RULE = '#abab9c'

const CHROMIUM = process.env.CHROMIUM ?? 'chromium'

/**
 * The wordmarks run from 4:1 (artiqwest) to 0.7:1 (Enlil), so one fixed height
 * makes the tall ones look like stamps beside the wide ones. Scale by rough
 * visual mass instead: the narrower the mark, the more height it gets.
 */
function markHeight(aspect) {
  if (aspect >= 3) return 120
  if (aspect >= 1.2) return 155
  return 200
}

/** The intrinsic aspect of an SVG, from its viewBox. 1 if it does not say. */
function svgAspect(svg) {
  const m = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!m) return 1
  const w = Number(m[1])
  const h = Number(m[2])
  return h > 0 ? w / h : 1
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The card, as a standalone document. The font and the wordmark are inlined as
 * data URIs rather than referenced: a card rendered off a `file://` URL must
 * not depend on a server being up or on Chromium's file-access flags.
 */
function cardHtml({ project, fontDataUri, logoDataUri, markPx }) {
  const accent = ACCENT_HEX[project.accent]
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: "Fira Code";
    src: url(${fontDataUri}) format("woff2-variations");
    font-weight: 300 700;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; border-radius: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: ${BG};
    color: ${FG_BRIGHT};
    font-family: "Fira Code", monospace;
    font-variant-ligatures: contextual;
    -webkit-font-smoothing: antialiased;
    display: flex;
  }
  /* The accent bar, the site's only vertical divider. */
  .bar { width: 14px; background: ${accent}; flex: none; }
  .body { flex: 1; padding: 64px 72px; display: flex; flex-direction: column; }
  .kind { font-size: 20px; color: ${MUTED}; letter-spacing: 0.22em; text-transform: uppercase; }
  .mark { margin-top: 34px; height: ${markPx}px; }
  .mark img { height: 100%; width: auto; max-width: 640px; object-fit: contain; object-position: left center; }
  .name { margin-top: 34px; font-size: 56px; font-weight: 600; }
  .hero { margin-top: 26px; font-size: 40px; line-height: 1.22; max-width: 960px; }
  .spacer { flex: 1; }
  .rule { border-top: 1px dashed ${RULE}; }
  .foot {
    margin-top: 22px; display: flex; align-items: baseline;
    gap: 28px; font-size: 22px; color: ${DIM};
  }
  /* "In development" wrapping would drop the tagline out of alignment. */
  .status { color: ${accent}; white-space: nowrap; }
  .host { margin-left: auto; color: ${MUTED}; }
</style></head>
<body>
  <div class="bar"></div>
  <div class="body">
    <div class="kind">${escapeHtml(project.kind)}</div>
    ${logoDataUri
      ? `<div class="mark"><img src="${logoDataUri}" alt=""></div>`
      : `<div class="name">${escapeHtml(project.name)}</div>`}
    <div class="hero">${escapeHtml(project.hero)}</div>
    <div class="spacer"></div>
    <div class="rule"></div>
    <div class="foot">
      <span class="status">${escapeHtml(STATUS_LABEL[project.status])}</span>
      <span>${escapeHtml(project.tagline)}</span>
      <span class="host">basicautomation.io</span>
    </div>
  </div>
</body></html>`
}

async function dataUri(path, mime) {
  const buf = await readFile(path)
  return `data:${mime};base64,${buf.toString('base64')}`
}

/** The wordmark as a data URI, plus the height it should be drawn at. */
async function loadMark(logo) {
  const path = resolve(ROOT, 'public', logo.replace(/^\//, ''))
  const svg = await readFile(path, 'utf8')
  return {
    uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    height: markHeight(svgAspect(svg)),
  }
}

async function shoot(html, outPath, scratch, name) {
  const page = resolve(scratch, `${name}.html`)
  await writeFile(page, html)
  const profile = resolve(scratch, `profile-${name}`)
  await run(CHROMIUM, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=8000',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${outPath}`,
    `file://${page}`,
  ])
}

const scratch = resolve(tmpdir(), `og-${process.pid}`)
await mkdir(scratch, { recursive: true })
await mkdir(OUT_DIR, { recursive: true })

const fontDataUri = await dataUri(resolve(ROOT, 'public/fonts/FiraCode-VF.woff2'), 'font/woff2')

console.log(`Rendering ${projects.length} cards at ${WIDTH}×${HEIGHT}…`)

let failures = 0
for (const project of projects) {
  const out = resolve(OUT_DIR, `${project.slug}.png`)
  try {
    const mark = project.logo ? await loadMark(project.logo) : null
    await shoot(
      cardHtml({ project, fontDataUri, logoDataUri: mark?.uri ?? null, markPx: mark?.height ?? 0 }),
      out,
      scratch,
      project.slug,
    )
    const { size } = await import('node:fs').then((fs) => fs.promises.stat(out))
    console.log(`  ✓ ${project.slug}.png — ${Math.round(size / 1024)} KB`)
  }
  catch (err) {
    failures++
    console.error(`  ✗ ${project.slug} — ${err.message}`)
  }
}

await rm(scratch, { recursive: true, force: true })

console.log(`\nWrote ${OUT_DIR}`)
if (failures) {
  console.error(`${failures} of ${projects.length} failed.`)
  process.exit(1)
}
