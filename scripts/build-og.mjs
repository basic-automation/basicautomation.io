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
 * Which is exactly the failure mode this script has to defend against: nothing
 * in the build reads `data/projects.ts` and notices that a hero line was edited
 * three weeks ago and the card still shows the old one. So every render also
 * records what it was rendered FROM, in `public/projects/og/cards.json`:
 *
 *   npm run og:check
 *
 * recomputes those fingerprints and fails when a card no longer matches its
 * data. The check needs no Chromium and no network, so CI can run it on every
 * pull request even though it can never render a card itself.
 *
 * The palette below is not a second copy of the theme: `ACCENT_HEX` is imported
 * from `app/utils/projects.ts`, and the greys are the same literals as the
 * `@theme` block in `app/assets/css/main.css`.
 */

import { mkdir, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { projects } from '../data/projects.ts'
import { ACCENT_HEX, STATUS_LABEL } from '../app/utils/projects.ts'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT_DIR = resolve(ROOT, 'public/projects/og')
const MANIFEST = resolve(OUT_DIR, 'cards.json')
const FONT = resolve(ROOT, 'public/fonts/FiraCode-VF.woff2')

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
    svg,
  }
}

function sha(...parts) {
  const h = createHash('sha256')
  for (const p of parts) h.update(typeof p === 'string' ? p : String(p))
  return h.digest('hex').slice(0, 16)
}

/**
 * A fingerprint of the card RECIPE — the layout, the type scale, the palette
 * constants and the font file. Taken from the source of the functions that draw
 * a card rather than from a hand-bumped version number, because a hand-bumped
 * version number is a thing somebody forgets. Restyle the card and every
 * fingerprint moves; the check then says all six cards are stale, which is true.
 */
async function recipeFingerprint() {
  const font = await readFile(FONT)
  return sha(
    cardHtml.toString(),
    markHeight.toString(),
    svgAspect.toString(),
    WIDTH, HEIGHT, BG, FG_BRIGHT, DIM, MUTED, RULE,
    createHash('sha256').update(font).digest('hex'),
  )
}

/**
 * A fingerprint of everything on ONE card that comes from the editorial data.
 * Deliberately not `JSON.stringify(project)`: a card does not show the feature
 * list or the worked example, and a fingerprint that moved when those did would
 * cry stale on edits that cannot change a pixel.
 */
function cardFingerprint(project, recipe, markSvg) {
  return sha(JSON.stringify([
    recipe,
    project.slug,
    project.name,
    project.kind,
    project.hero,
    project.tagline,
    project.status,
    project.accent,
    ACCENT_HEX[project.accent],
    STATUS_LABEL[project.status],
    project.logo ?? null,
    markSvg ?? null,
  ]))
}

/** Every card's fingerprint, keyed by slug. */
async function fingerprintAll() {
  const recipe = await recipeFingerprint()
  const cards = {}
  for (const project of projects) {
    const markSvg = project.logo
      ? await readFile(resolve(ROOT, 'public', project.logo.replace(/^\//, '')), 'utf8')
      : null
    cards[project.slug] = cardFingerprint(project, recipe, markSvg)
  }
  return { recipe, cards }
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'))
  }
  catch {
    return null
  }
}

async function writeManifest(recipe, cards) {
  const ordered = {}
  for (const slug of Object.keys(cards).sort()) ordered[slug] = cards[slug]
  await writeFile(MANIFEST, `${JSON.stringify({
    note: 'Written by scripts/build-og.mjs. Fingerprints of what each card was rendered from; `npm run og:check` fails when a card no longer matches data/projects.ts.',
    recipe,
    cards: ordered,
  }, null, 2)}\n`)
}

/**
 * The read-only half: does every project have a card, is every card current,
 * and is there a card for a project that no longer exists? Needs no Chromium,
 * which is the whole point — CI can run this even though it cannot render.
 */
async function check() {
  const manifest = await readManifest()
  if (!manifest?.cards) {
    console.error(`No ${MANIFEST}. Run \`npm run og\` to render the cards and write it.`)
    process.exit(1)
  }

  const { recipe, cards } = await fingerprintAll()
  const problems = []

  if (manifest.recipe !== recipe) {
    problems.push(`the card recipe changed (${manifest.recipe} → ${recipe}) — every card is stale`)
  }

  for (const project of projects) {
    const png = resolve(OUT_DIR, `${project.slug}.png`)
    if (!await stat(png).catch(() => null)) {
      problems.push(`${project.slug}: no card at public/projects/og/${project.slug}.png`)
      continue
    }
    const recorded = manifest.cards[project.slug]
    if (!recorded) problems.push(`${project.slug}: card is not in cards.json`)
    else if (recorded !== cards[project.slug]) problems.push(`${project.slug}: card is stale — data/projects.ts has moved since it was rendered`)
  }

  const slugs = new Set(projects.map((p) => p.slug))
  for (const file of await readdir(OUT_DIR)) {
    if (!file.endsWith('.png')) continue
    const slug = file.slice(0, -4)
    if (!slugs.has(slug)) problems.push(`${slug}: a card for a project that is no longer in data/projects.ts`)
  }

  if (problems.length) {
    console.error('Social cards are out of date:\n')
    for (const p of problems) console.error(`  ✗ ${p}`)
    console.error('\nRun `npm run og` (needs a local Chromium) and commit the result.')
    process.exit(1)
  }
  console.log(`✓ ${projects.length} social cards match data/projects.ts (recipe ${recipe})`)
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

if (process.argv.includes('--check')) {
  await check()
  process.exit(0)
}

const scratch = resolve(tmpdir(), `og-${process.pid}`)
await mkdir(scratch, { recursive: true })
await mkdir(OUT_DIR, { recursive: true })

const fontDataUri = await dataUri(FONT, 'font/woff2')
const recipe = await recipeFingerprint()

// A card that fails to render keeps its old fingerprint, so the next check still
// calls it stale rather than blessing a file nobody managed to write.
const recorded = (await readManifest())?.cards ?? {}

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
    const { size } = await stat(out)
    recorded[project.slug] = cardFingerprint(project, recipe, mark?.svg ?? null)
    console.log(`  ✓ ${project.slug}.png — ${Math.round(size / 1024)} KB`)
  }
  catch (err) {
    failures++
    console.error(`  ✗ ${project.slug} — ${err.message}`)
  }
}

await rm(scratch, { recursive: true, force: true })

// A project dropped from the catalogue should not leave a fingerprint behind.
const slugs = new Set(projects.map((p) => p.slug))
for (const slug of Object.keys(recorded)) if (!slugs.has(slug)) delete recorded[slug]
await writeManifest(recipe, recorded)

console.log(`\nWrote ${OUT_DIR}`)
if (failures) {
  console.error(`${failures} of ${projects.length} failed.`)
  process.exit(1)
}
