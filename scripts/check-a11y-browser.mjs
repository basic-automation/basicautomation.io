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
import { startBrowser } from './lib/cdp.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--'))
	?? process.env.CHECK_BASE_URL
	?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/** The layout rules `check-a11y.mjs` has to skip, less the two contrast ones. */
const RULES = [
	'target-size',
	'scrollable-region-focusable',
	'meta-viewport',
	'meta-viewport-large',
]

const VIEWPORTS = [
	{ name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
	{ name: 'phone', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
]

const PAGES = await sitePages(BASE)
const axeSource = await readFile(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')
const { cdp, chrome, stop } = await startBrowser()

console.log(`axe-core (${RULES.join(', ')}) over ${PAGES.length} pages × ${VIEWPORTS.length} widths in ${chrome}\n`)

let violations = 0
const seen = new Map()

try {
	for (const vp of VIEWPORTS) {
		const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
		const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
		await cdp.send('Page.enable', {}, sessionId)
		const { name, ...metrics } = vp
		await cdp.send('Emulation.setDeviceMetricsOverride', metrics, sessionId)

		for (const path of PAGES) {
			const loaded = cdp.once('Page.loadEventFired', sessionId)
			const nav = await cdp.send('Page.navigate', { url: BASE + path }, sessionId)
			if (nav.errorText) throw new Error(`${path}: ${nav.errorText}`)
			await loaded
			// Let hydration settle, so what is measured is what a visitor gets.
			await cdp.send('Runtime.evaluate', {
				expression: 'new Promise((r) => requestIdleCallback(() => r(), { timeout: 2000 }))',
				awaitPromise: true,
			}, sessionId)

			const expected = path === NOT_FOUND_PATH ? 'error page' : 'page'
			await cdp.send('Runtime.evaluate', { expression: axeSource }, sessionId)
			const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
				expression: `axe.run(document, {
					runOnly: { type: 'rule', values: ${JSON.stringify(RULES)} },
					resultTypes: ['violations'],
				}).then((r) => r.violations.map((v) => ({
					id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
					nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html, summary: n.failureSummary })),
				})))`,
				awaitPromise: true,
				returnByValue: true,
			}, sessionId)
			if (exceptionDetails) throw new Error(`${path}: axe threw — ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)

			const bad = result.value
			violations += bad.length
			console.log(`  ${bad.length ? '✗' : '·'} ${name.padEnd(7)} ${path} (${expected}) — ${bad.length} violation(s)`)

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

		await cdp.send('Target.closeTarget', { targetId })
	}
}
finally {
	await stop()
}

console.log('\nNot run: color-contrast, color-contrast-enhanced — `npm run contrast` measures the palette.')

if (violations) {
	console.error(`\n${violations} violation(s): ${[...seen].map(([id, n]) => `${id}×${n}`).join(', ')}`)
	process.exit(1)
}

console.log(`\n✓ No violations across ${PAGES.length} pages at ${VIEWPORTS.map((v) => `${v.width}px`).join(' and ')}.`)
