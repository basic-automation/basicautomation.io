/**
 * Cut the part of Fira Code this site actually sets out of the full font.
 *
 *   npm run font           # write public/fonts/FiraCode-VF-core.woff2
 *   npm run font:check     # fail if the file or main.css has drifted
 *
 * The full variable font is 113 KB and every page preloads it at high priority,
 * so on a phone it shares a slow link with the page's own largest image. Most
 * of it is scripts this site never sets: Cyrillic, Greek Extended, Latin
 * Extended, Hebrew. The core cut keeps what the pages and the READMEs use —
 * measured by collecting every non-ASCII character they render — and is what
 * gets preloaded.
 *
 * Nothing is lost. `app/assets/css/main.css` declares the full font first and
 * the core second, both as "Fira Code", each with a `unicode-range`. For a
 * character both cover, the later face — the core — wins; for anything only the
 * full font has, the browser fetches the full font then, and only on that page.
 * The full face's range is what the font contains outside the core — coarsely
 * below the emoji planes, exactly within them, and never overlapping the core —
 * so an emoji or a ✅ in a README (which Fira Code does not have) never
 * triggers a download of 113 KB to find that out.
 * https://developer.mozilla.org/docs/Web/CSS/@font-face/unicode-range
 *
 * HarfBuzz keeps the layout closure of what is included, so the ligatures and
 * the `wght` axis come through with the characters that use them.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'
import fontverter from 'fontverter'
import { Blob, Face } from 'harfbuzzjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FULL = resolve(ROOT, 'public/fonts/FiraCode-VF.woff2')
const CORE = resolve(ROOT, 'public/fonts/FiraCode-VF-core.woff2')
const CSS = resolve(ROOT, 'app/assets/css/main.css')
const CHECK = process.argv.includes('--check')

/**
 * What the core keeps, as inclusive code point ranges. Latin-1; Greek and
 * Coptic (a README's formulas); general punctuation, super- and subscripts, the
 * euro and trademark signs; arrows, maths, technical symbols; box drawing,
 * blocks, geometric shapes, miscellaneous symbols and dingbats — the terminal
 * furniture this site and its READMEs are built from.
 */
const CORE_RANGES = [
	[0x0000, 0x00ff],
	[0x0370, 0x03ff],
	[0x2000, 0x209f],
	[0x20ac, 0x20ac],
	[0x2122, 0x2122],
	[0x2190, 0x23ff],
	[0x2500, 0x27bf],
]

const hex = (n) => n.toString(16).toUpperCase()
const toRange = ([a, b]) => (a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`)

/**
 * Below the emoji planes, spans closer than this are merged into one. The exact
 * list of what Fira Code covers is 1,656 characters of CSS on every page; merged
 * it is about 250, 334 bytes less after brotli. A coarse range costs a wasted
 * fetch of the full font only when a page sets a character in a gap, which no
 * page does today. (It was first suspected of the ~48 ms the split added to
 * text-LCP pages on a throttled phone. Measured, it is not the cause: see
 * ROADMAP.md.)
 */
const MERGE_GAP = 0x100

/**
 * Where emoji live. Here the range stays exact, because this is precisely where
 * a README's 🌙 would otherwise send the browser off for 113 KB to find out the
 * font does not have it.
 */
const EXACT_FROM = 0x1f000

const inCore = (p) => CORE_RANGES.some(([a, b]) => p >= a && p <= b)
const bridgesCore = (from, to) => CORE_RANGES.some(([a, b]) => a <= to && b >= from)

/**
 * Collapse a sorted list of code points into `unicode-range` spans for the full
 * face. Never across a core range: a character the core range claims but the
 * core does not have (✅, say — Fira Code has no such glyph) must not fall
 * through to a full face whose coarse range happens to cover it, or the page
 * pays 113 KB to learn the font lacks it.
 */
function spans(points) {
	const out = []
	for (const p of points) {
		const last = out.at(-1)
		const gap = last ? p - last[1] : Infinity
		const merge = last && (gap === 1
			|| (p < EXACT_FROM && gap <= MERGE_GAP && !bridgesCore(last[1] + 1, p - 1)))
		if (merge) last[1] = p
		else out.push([p, p])
	}
	return out
}

const full = await readFile(FULL)
const face = new Face(new Blob(await fontverter.convert(full, 'sfnt')), 0)
const has = [...face.collectUnicodes()].sort((a, b) => a - b)

const corePoints = has.filter(inCore)

const coreRange = CORE_RANGES.map(toRange).join(', ')
// The full face only answers for what the core does not: inside the core's
// ranges the core already has every glyph the font has.
const fullRange = spans(has.filter((p) => !inCore(p))).map(toRange).join(', ')

const core = await subsetFont(full, String.fromCodePoint(...corePoints), { targetFormat: 'woff2' })

if (CHECK) {
	let bad = 0
	const existing = await readFile(CORE).catch(() => null)
	if (!existing || !existing.equals(core)) {
		console.error('✗ public/fonts/FiraCode-VF-core.woff2 does not match a fresh cut of FiraCode-VF.woff2')
		bad++
	}
	const css = await readFile(CSS, 'utf8')
	if (!css.includes(`unicode-range: ${coreRange};`)) {
		console.error('✗ main.css does not declare the core face with the range this script cuts')
		bad++
	}
	if (!css.includes(`unicode-range: ${fullRange};`)) {
		console.error('✗ main.css does not declare the full face with the range the font covers')
		bad++
	}
	if (bad) {
		console.error('\nRun `npm run font` and paste the ranges it prints into main.css.')
		process.exit(1)
	}
	console.log(`✓ core cut and main.css match (${corePoints.length} of ${has.length} code points, ${core.length} bytes)`)
	process.exit(0)
}

await writeFile(CORE, core)
console.log(`FiraCode-VF.woff2       ${full.length} bytes, ${has.length} code points`)
console.log(`FiraCode-VF-core.woff2  ${core.length} bytes, ${corePoints.length} code points\n`)
console.log(`core unicode-range: ${coreRange};\n`)
console.log(`full unicode-range: ${fullRange};`)
