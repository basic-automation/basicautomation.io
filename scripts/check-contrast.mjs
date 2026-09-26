/**
 * Measure every palette colour against the site's one background.
 *
 * `ROADMAP.md` used to carry this as a table somebody typed once. A table
 * somebody typed once is wrong the first time a colour moves, and the palette
 * is the thing most likely to move — so the measurement lives here and the
 * roadmap points at it.
 *
 *   npm run contrast            # report
 *   npm run contrast -- --strict  # and fail on anything not in the baseline
 *
 * It does NOT fail on the failures that exist today. Those are real and they
 * are the owner's call, because the palette is locked and fixing them means
 * deciding what a colour role *is* — retire `pn-muted` for `pn-dim` wherever it
 * carries information, or change a value the Omarchy theme set. Until that
 * decision is made, an always-red check is a check nobody reads. What `--strict`
 * catches is a NEW one: a colour edit that drops a token below its role's
 * threshold, or a known-failing token getting worse.
 *
 * Roles are declared below rather than inferred. A contrast checker that cannot
 * tell a label from a divider reports the dividers too, and then everything is
 * noise.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { contrastRatio, wcagLevel } from '../shared/theme/contrast.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = resolve(ROOT, 'app/assets/css/main.css')

/**
 * What each token is FOR, which is what decides the threshold.
 *
 *   text       — carries words at body size. AA wants 4.5.
 *   large      — only ever used at heading size. AA wants 3.
 *   decorative — rules, bars, fills. No threshold; contrast does not apply to
 *                something that says nothing.
 */
const ROLES = {
	'pn-fg': 'text',
	'pn-fg-bright': 'text',
	'pn-dim': 'text',
	'pn-muted': 'text',
	'pn-accent': 'text',
	'pn-rule': 'decorative',
	// The named colours tint a project: its status label, its accent bar, its
	// social card. The label is words at body size.
	'pn-red': 'text',
	'pn-yellow': 'text',
	'pn-orange': 'text',
	'pn-green': 'text',
	'pn-cyan': 'text',
	'pn-blue': 'text',
	'pn-magenta': 'text',
	'pn-bright-green': 'text',
	'pn-bright-cyan': 'text',
	'pn-bright-magenta': 'text',
}

const THRESHOLD = { text: 4.5, large: 3 }

/**
 * Known failures, with the ratio measured when they were accepted. A token
 * listed here does not fail `--strict` unless it gets WORSE than this — the
 * decision to live with them is recorded in ROADMAP.md, and this is the number
 * that decision was made against.
 */
const BASELINE = {
	'pn-accent': 2.14,
	'pn-red': 2.56,
	'pn-orange': 2.62,
	'pn-bright-cyan': 2.66,
	'pn-muted': 2.97,
	'pn-magenta': 3.47,
	'pn-bright-green': 4.11,
}

/** Colours a run may drift by before it counts as worse. Rounding, not slack. */
const EPSILON = 0.01

const css = await readFile(CSS, 'utf8')
const theme = css.slice(css.indexOf('@theme'), css.indexOf('\n}', css.indexOf('@theme')))

const colours = new Map()
for (const m of theme.matchAll(/--color-(pn-[a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
	colours.set(m[1], m[2].toLowerCase())
}

const bg = colours.get('pn-bg')
if (!bg) {
	console.error('No --color-pn-bg in the @theme block. This check assumes one background.')
	process.exit(1)
}
colours.delete('pn-bg')

const rows = []
for (const [token, hex] of colours) {
	const role = ROLES[token]
	if (!role) {
		console.error(`\n✗ ${token} (${hex}) has no role in scripts/check-contrast.mjs.`)
		console.error('  A new palette token needs one: text, large, or decorative.')
		process.exit(1)
	}
	rows.push({ token, hex, role, ratio: contrastRatio(hex, bg) })
}

rows.sort((a, b) => a.ratio - b.ratio)

console.log(`Against the ground ${bg}:\n`)
console.log(`  ${'token'.padEnd(20)}${'hex'.padEnd(10)}${'ratio'.padEnd(8)}${'level'.padEnd(11)}role`)
for (const r of rows) {
	const level = r.role === 'decorative' ? '—' : wcagLevel(r.ratio)
	console.log(`  ${r.token.padEnd(20)}${r.hex.padEnd(10)}${r.ratio.toFixed(2).padEnd(8)}${level.padEnd(11)}${r.role}`)
}

const short = rows.filter((r) => r.role !== 'decorative' && r.ratio < THRESHOLD[r.role])
if (short.length) {
	console.log(`\n${short.length} token(s) below their role's threshold:`)
	for (const r of short) {
		const was = BASELINE[r.token]
		const note = was === undefined
			? 'NEW'
			: r.ratio < was - EPSILON ? `worse than the accepted ${was.toFixed(2)}` : `known, accepted at ${was.toFixed(2)}`
		console.log(`  · ${r.token} ${r.ratio.toFixed(2)} < ${THRESHOLD[r.role]} — ${note}`)
	}
}

if (!process.argv.includes('--strict')) process.exit(0)

const regressions = short.filter((r) => BASELINE[r.token] === undefined || r.ratio < BASELINE[r.token] - EPSILON)
if (regressions.length) {
	console.error(`\n✗ ${regressions.length} contrast regression(s) against the baseline in this script.`)
	console.error('  Either raise the colour, or move the decision on ROADMAP.md forward and update BASELINE.')
	process.exit(1)
}

const stale = Object.keys(BASELINE).filter((t) => !short.some((r) => r.token === t))
if (stale.length) {
	console.error(`\n✗ BASELINE lists ${stale.join(', ')}, which now pass. Delete them from scripts/check-contrast.mjs.`)
	process.exit(1)
}

console.log('\n✓ No contrast regression against the accepted baseline.')
