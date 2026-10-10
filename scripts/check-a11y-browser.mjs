/**
 * The axe rules jsdom cannot run, run in a real browser.
 *
 *   node .output/server/index.mjs &
 *   npm run a11y:browser
 *
 * `npm run a11y` runs axe through jsdom, which has no layout engine, so it
 * switches off every rule that needs to know how big or where a thing is. This
 * is those rules, in headless Chromium, on every page the sitemap lists, at a
 * desktop width and a phone width — `target-size` in particular depends on
 * the width, since the nav and the link rows reflow.
 *
 * Driven over the Chrome DevTools Protocol by `lib/cdp.mjs`, which says why
 * that is not Puppeteer and how Chromium is found.
 *
 * # And the console
 *
 * The same page loads also collect every console error, uncaught exception and
 * browser-reported violation (CSP refusals arrive that way), and any one of
 * them fails the run. Two of this site's bugs were visible only there: nine
 * CSP refusals from the onion frame on every visit to two pages, and a
 * hydration mismatch from a clock read on both sides. Nothing else looked.
 *
 * # What is still not run
 *
 * `color-contrast` and `color-contrast-enhanced`. They would fail today, on
 * shortfalls already known and already waiting on an owner decision (see the
 * contrast item in ROADMAP.md), and `npm run contrast` measures the palette
 * more thoroughly than sampling whichever pixels these pages happen to render.
 * A check that is red for a reason nobody can act on is a check nobody reads.
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOT_FOUND_PATH, sitePages } from './lib/pages.mjs'
import { ENGINES, startDriver } from './lib/browser.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--'))
	?? process.env.CHECK_BASE_URL
	?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/** The layout rules `check-a11y.mjs` has to skip, less the two contrast ones. */
/** `--firefox` runs the same pass in Firefox; Chromium is the default. */
const ENGINE = args.includes('--firefox') ? 'firefox' : 'chromium'
if (!ENGINES.includes(ENGINE)) throw new Error(`no engine ${ENGINE}`)

const RULES = [
	'target-size',
	'scrollable-region-focusable',
	'meta-viewport',
	'meta-viewport-large',
	// On by default from axe 4.14. It compares a control's accessible name with
	// its *visible* text, and jsdom cannot say what is visible, so there it only
	// ever came back undecided — on every copy button — and nothing judged it.
	'label-content-name-mismatch',
]

const VIEWPORTS = [
	{ name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
	{ name: 'phone', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
]

const PAGES = await sitePages(BASE)
const axeSource = await readFile(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')
const browser = await startDriver(ENGINE)

console.log(`axe-core (${RULES.join(', ')}) over ${PAGES.length} pages × ${VIEWPORTS.length} widths in ${browser.name} (${browser.binary})\n`)

let violations = 0
let consoleErrors = 0
const seen = new Map()

/**
 * What the page said went wrong while it loaded. The 404 page is expected to
 * log its own 404 for the document — that one line is not a fault, anything
 * else on it is.
 */
function faults(page) {
	return page.takeErrors()
		.filter(({ text, url }) => !(/status of 404/.test(text) && url?.endsWith(NOT_FOUND_PATH)))
		.map(({ text }) => text.slice(0, 200))
}

try {
	for (const vp of VIEWPORTS) {
		const { name, ...metrics } = vp
		const page = await browser.open(metrics)

		for (const path of PAGES) {
			page.takeErrors()
			await page.goto(BASE + path)
			// Let hydration settle, so what is measured is what a visitor gets.
			await page.evaluate('new Promise((r) => requestIdleCallback(() => r(), { timeout: 2000 }))')
			// Then read to the bottom, a screen at a time, as a visitor would. The
			// onion frame and the README's images are lazy: unscrolled, they never
			// load, and whatever they would log is never seen.
			await page.evaluate(`(async () => {
				for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
					scrollTo(0, y)
					await new Promise((r) => setTimeout(r, 150))
				}
				await new Promise((r) => setTimeout(r, 1000))
				scrollTo(0, 0)
			})()`)

			const expected = path === NOT_FOUND_PATH ? 'error page' : 'page'
			await page.run(axeSource)
			let bad
			try {
				bad = await page.evaluate(`axe.run(document, {
					runOnly: { type: 'rule', values: ${JSON.stringify(RULES)} },
					resultTypes: ['violations'],
				}).then((r) => r.violations.map((v) => ({
					id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
					nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html, summary: n.failureSummary })),
				})))`)
			}
			catch (e) {
				throw new Error(`${path}: axe threw — ${e.message}`)
			}

			const errors = faults(page)
			violations += bad.length
			consoleErrors += errors.length
			console.log(`  ${bad.length || errors.length ? '✗' : '·'} ${name.padEnd(7)} ${path} (${expected}) — ${bad.length} violation(s), ${errors.length} console error(s)`)
			for (const e of errors) console.error(`      console: ${e}`)

			for (const v of bad) {
				seen.set(v.id, (seen.get(v.id) ?? 0) + v.nodes.length)
				console.error(`\n    ${v.impact ?? 'unknown'}: ${v.id} — ${v.help}`)
				console.error(`    ${v.helpUrl}`)
				for (const node of v.nodes.slice(0, 4)) {
					console.error(`      ${node.target}`)
					console.error(`        ${node.html.replace(/\s+/g, ' ').slice(0, 140)}`)
					console.error(`        ${(node.summary ?? '').replace(/\s+/g, ' ').slice(0, 200)}`)
				}
				if (v.nodes.length > 4) console.error(`      …and ${v.nodes.length - 4} more`)
			}
		}

		await page.close()
	}
}
finally {
	await browser.stop()
}

console.log('\nNot run: color-contrast, color-contrast-enhanced — `npm run contrast` measures the palette.')

if (violations || consoleErrors) {
	if (violations) console.error(`\n${violations} violation(s): ${[...seen].map(([id, n]) => `${id}×${n}`).join(', ')}`)
	if (consoleErrors) console.error(`\n${consoleErrors} console error(s) — see above.`)
	process.exit(1)
}

console.log(`\n✓ No violations and no console errors across ${PAGES.length} pages at ${VIEWPORTS.map((v) => `${v.width}px`).join(' and ')} in ${browser.name}.`)
