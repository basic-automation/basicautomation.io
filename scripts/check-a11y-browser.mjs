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
 * # And focus the masthead hides
 *
 * WCAG 2.2's 2.4.11, Focus Not Obscured (Minimum): a focused control may not
 * be entirely hidden by content the author put over it — here, the sticky
 * glass masthead. axe has no rule for it. So every page is also walked the
 * way Shift+Tab walks it, from the bottom up, focusing each control and
 * hit-testing five points of it; one that none of the five reaches fails.
 * Before `scroll-padding-top` in `main.css` the live site hid 1–7 focused
 * controls a page this way — release links, "read the full readme", the
 * status table's project names — and passed every axe rule.
 * <https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html>
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
let obscured = 0
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
			//
			// Every jump is `instant`. The site scrolls smoothly, so a bare
			// `scrollTo` only starts an animation: the pass stalled a screen or
			// so down (Chromium, onyums at 390 px: 1,014 of 3,894 px by the last
			// step), and the return to the top was still ~1,700 px out when axe
			// ran. axe then measured a page in motion, with links passing under
			// the fixed masthead, and `target-size` failed /status's links as
			// "partially obscured" on one Firefox run in four (2026-10-10).
			await page.evaluate(`(async () => {
				for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
					scrollTo({ top: y, behavior: 'instant' })
					await new Promise((r) => setTimeout(r, 150))
				}
				await new Promise((r) => setTimeout(r, 1000))
				scrollTo({ top: 0, behavior: 'instant' })
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
				if (scrollY !== 0) throw new Error('still ' + scrollY + ' px down after scrolling to the top')
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

			// Focus, backwards from the bottom. Only what really takes focus is
			// counted — a link inside the folded README does not, and Tab skips
			// it too. Each focus may scroll the page (smoothly, here), so wait
			// for three still frames before looking.
			const hidden = await page.evaluate(`(async () => {
				const frame = () => new Promise((r) => requestAnimationFrame(r))
				const settle = async () => { let last = -1, still = 0; for (let i = 0; i < 120 && still < 3; i++) { await frame(); still = scrollY === last ? still + 1 : 0; last = scrollY } }
				const glass = document.querySelector('header .crt-glass')
				if (!glass) return []
				scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
				await settle()
				const controls = [...document.querySelectorAll('a[href], button, summary, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
					.filter((el) => !glass.contains(el))
				const hidden = []
				for (const el of controls.reverse()) {
					el.focus()
					if (document.activeElement !== el) continue
					await settle()
					const r = el.getBoundingClientRect()
					const seen = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].some(([fx, fy]) => {
						const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy)
						return hit && (hit === el || el.contains(hit))
					})
					if (!seen) hidden.push(\`\${el.tagName.toLowerCase()} "\${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 50)}" at y \${Math.round(r.top)}–\${Math.round(r.bottom)}\`)
				}
				document.activeElement?.blur()
				scrollTo({ top: 0, behavior: 'instant' })
				return hidden
			})()`)
			obscured += hidden.length
			for (const h of hidden) console.error(`      focus not visible: ${h}`)

			const errors = faults(page)
			violations += bad.length
			consoleErrors += errors.length
			console.log(`  ${bad.length || errors.length || hidden.length ? '✗' : '·'} ${name.padEnd(7)} ${path} (${expected}) — ${bad.length} violation(s), ${hidden.length} hidden focus, ${errors.length} console error(s)`)
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

if (violations || consoleErrors || obscured) {
	if (violations) console.error(`\n${violations} violation(s): ${[...seen].map(([id, n]) => `${id}×${n}`).join(', ')}`)
	if (obscured) console.error(`\n${obscured} focused control(s) entirely behind the masthead (WCAG 2.4.11) — see above.`)
	if (consoleErrors) console.error(`\n${consoleErrors} console error(s) — see above.`)
	process.exit(1)
}

console.log(`\n✓ No violations, no focus behind the masthead and no console errors across ${PAGES.length} pages at ${VIEWPORTS.map((v) => `${v.width}px`).join(' and ')} in ${browser.name}.`)
