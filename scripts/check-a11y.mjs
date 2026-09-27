/**
 * axe-core over every page of a running build.
 *
 *   node .output/server/index.mjs &
 *   npm run a11y
 *
 * `npm run check` already asserts the handful of structural things that broke
 * here in practice — one `h1`, one `main`, a language, named landmarks, alt
 * text. This is the rest of the ruleset: roughly ninety checks nobody is going
 * to reimplement, run against the markup the server actually served.
 *
 * # Why jsdom, and what that costs
 *
 * axe normally runs inside a browser, because a third of its rules are about
 * what a thing LOOKS like — is this text over that background, is this control
 * big enough, is this element actually visible. jsdom has no layout engine, so
 * those rules cannot run and are switched off explicitly below rather than left
 * to fail in confusing ways. What remains is everything about structure,
 * naming, roles and relationships, which is where the bugs on this site have
 * been.
 *
 * Contrast is not skipped, it is measured somewhere better: `npm run contrast`
 * computes every palette colour's ratio against the one background, which is a
 * stronger check than sampling rendered pixels on whichever pages happen to be
 * crawled.
 *
 * The honest summary: this is not "the site passes axe in a browser". It is
 * "the site passes every axe rule that can be judged from its markup". The
 * layout rules it skips, less contrast, run in headless Chromium in
 * `npm run a11y:browser` (`check-a11y-browser.mjs`).
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { JSDOM, VirtualConsole } from 'jsdom'
import { NOT_FOUND_PATH, sitePages } from './lib/pages.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--'))
	?? process.env.CHECK_BASE_URL
	?? 'http://127.0.0.1:3000').replace(/\/$/, '')

const PAGES = await sitePages(BASE)

/**
 * Rules that need a layout engine to mean anything. Each is disabled because
 * jsdom cannot answer it, NOT because it does not matter — several are among
 * the most important rules axe has, and they are the reason this script is a
 * floor rather than a substitute for auditing the real thing in a browser.
 */
const NEEDS_LAYOUT = [
	'color-contrast', // `npm run contrast` measures the palette directly
	'color-contrast-enhanced',
	'target-size',
	'scrollable-region-focusable',
	'meta-viewport', // judged against zoom behaviour a browser applies
	'meta-viewport-large',
]

const html = new Map()
for (const path of PAGES) {
	const res = await fetch(BASE + path, {
		headers: {
			'user-agent': 'basicautomation.io-a11y',
			'accept': 'text/html,application/xhtml+xml',
		},
	}).catch((err) => ({ ok: false, status: 0, error: err.message }))

	// The 404 page is supposed to be a 404; every other page is supposed not to
	// be. Either way what is wanted is the body it rendered.
	const expected = path === NOT_FOUND_PATH ? 404 : 200
	if (res.status !== expected) {
		console.error(`✗ ${path} answered ${res.status || res.error}, expected ${expected}`)
		process.exit(1)
	}
	html.set(path, await res.text())
}

const axeSource = await readFile(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')

console.log(`axe-core over ${PAGES.length} pages from ${BASE}\n`)

let violations = 0
let incomplete = 0
const seen = new Map()

for (const [path, body] of html) {
	// jsdom logs every CSS rule it cannot parse, and Tailwind v4 emits plenty
	// that it cannot. None of it is about accessibility.
	const virtualConsole = new VirtualConsole()
	const dom = new JSDOM(body, {
		url: BASE + path,
		runScripts: 'outside-only',
		pretendToBeVisual: true,
		virtualConsole,
	})

	dom.window.eval(axeSource)
	const results = await dom.window.axe.run(dom.window.document, {
		rules: Object.fromEntries(NEEDS_LAYOUT.map((id) => [id, { enabled: false }])),
		resultTypes: ['violations', 'incomplete'],
	})

	const bad = results.violations
	const maybe = results.incomplete
	violations += bad.length
	incomplete += maybe.length

	const mark = bad.length ? '✗' : '·'
	console.log(`  ${mark} ${path} — ${bad.length} violation(s), ${maybe.length} needing a human`)

	for (const v of bad) {
		const key = `${v.id}`
		seen.set(key, (seen.get(key) ?? 0) + v.nodes.length)
		console.error(`\n    ${v.impact ?? 'unknown'}: ${v.id} — ${v.help}`)
		console.error(`    ${v.helpUrl}`)
		for (const node of v.nodes.slice(0, 3)) {
			console.error(`      ${node.target.join(' ')}`)
			console.error(`        ${node.html.replace(/\s+/g, ' ').slice(0, 140)}`)
		}
		if (v.nodes.length > 3) console.error(`      …and ${v.nodes.length - 3} more`)
	}

	dom.window.close()
}

console.log(`\n${NEEDS_LAYOUT.length} rules were not run: ${NEEDS_LAYOUT.join(', ')}.`)
console.log('They need a layout engine jsdom does not have. Contrast is measured by `npm run contrast`.')

if (incomplete) {
	console.log(`\n${incomplete} result(s) axe could not decide without a browser. Not a failure.`)
}

if (violations) {
  console.error(`\n${violations} violation(s) across ${PAGES.length} pages: ${[...seen].map(([id, n]) => `${id}×${n}`).join(', ')}`)
	process.exit(1)
}

console.log(`\n✓ No axe violations across ${PAGES.length} pages.`)
