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
 * Driven over the Chrome DevTools Protocol with Node's own WebSocket rather
 * than through Puppeteer or Playwright: the whole job is "open a page, run a
 * script in it", and a browser-automation framework is a large dependency for
 * three protocol calls.
 *
 * Chromium is found on PATH (`chromium`, `google-chrome`, `google-chrome-stable`)
 * or named by `CHROME_PATH`. GitHub's Ubuntu runners ship Google Chrome.
 *
 * # What is still not run
 *
 * `color-contrast` and `color-contrast-enhanced`. They would fail today, on
 * shortfalls already known and already waiting on an owner decision (see the
 * contrast item in ROADMAP.md), and `npm run contrast` measures the palette
 * more thoroughly than sampling whichever pixels these pages happen to render.
 * A check that is red for a reason nobody can act on is a check nobody reads.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOT_FOUND_PATH, sitePages } from './lib/pages.mjs'

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

function findChrome() {
	if (process.env.CHROME_PATH) return process.env.CHROME_PATH
	for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
		try {
			return execFileSync('which', [name], { encoding: 'utf8' }).trim()
		}
		catch {
			// not this one
		}
	}
	console.error('✗ No Chromium found. Install one, or set CHROME_PATH.')
	process.exit(1)
}

/** Start Chromium and resolve with the browser's DevTools WebSocket URL. */
async function launch(chrome, profile) {
	const proc = spawn(chrome, [
		'--headless=new',
		'--remote-debugging-port=0',
		`--user-data-dir=${profile}`,
		// A throwaway profile loading this site and nothing else. The sandbox
		// also needs unprivileged user namespaces, which CI runners restrict.
		'--no-sandbox',
		'--disable-gpu',
		'--no-first-run',
		'--no-default-browser-check',
		'about:blank',
	], { stdio: ['ignore', 'ignore', 'pipe'] })

	const url = await new Promise((resolveUrl, reject) => {
		let err = ''
		const timer = setTimeout(() => reject(new Error(`Chromium did not start:\n${err}`)), 20_000)
		proc.stderr.on('data', (chunk) => {
			err += chunk
			const m = err.match(/DevTools listening on (ws:\/\/\S+)/)
			if (m) {
				clearTimeout(timer)
				resolveUrl(m[1])
			}
		})
		proc.on('exit', (code) => reject(new Error(`Chromium exited ${code}:\n${err}`)))
	})
	return { proc, url }
}

/** The smallest CDP client that works: numbered requests, flat sessions, events by name. */
async function connect(url) {
	const ws = new WebSocket(url)
	await new Promise((res, rej) => {
		ws.onopen = res
		ws.onerror = () => rej(new Error(`could not connect to ${url}`))
	})

	let id = 0
	const pending = new Map()
	const waiters = []

	ws.onmessage = ({ data }) => {
		const msg = JSON.parse(data)
		if (msg.id && pending.has(msg.id)) {
			const { res, rej } = pending.get(msg.id)
			pending.delete(msg.id)
			if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`))
			else res(msg.result)
			return
		}
		for (const w of [...waiters]) {
			if (w.method === msg.method && w.sessionId === msg.sessionId) {
				waiters.splice(waiters.indexOf(w), 1)
				w.res(msg.params)
			}
		}
	}

	return {
		send(method, params = {}, sessionId) {
			const msgId = ++id
			ws.send(JSON.stringify({ id: msgId, method, params, sessionId }))
			return new Promise((res, rej) => pending.set(msgId, { res, rej }))
		},
		once(method, sessionId, timeout = 30_000) {
			return new Promise((res, rej) => {
				const w = { method, sessionId, res }
				waiters.push(w)
				setTimeout(() => {
					const i = waiters.indexOf(w)
					if (i >= 0) {
						waiters.splice(i, 1)
						rej(new Error(`timed out waiting for ${method}`))
					}
				}, timeout)
			})
		},
		close: () => ws.close(),
	}
}

const PAGES = await sitePages(BASE)
const axeSource = await readFile(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')
const chrome = findChrome()
const profile = await mkdtemp(join(tmpdir(), 'ba-a11y-'))
const { proc, url } = await launch(chrome, profile)
const cdp = await connect(url)

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
	cdp.close()
	proc.kill()
	await rm(profile, { recursive: true, force: true }).catch(() => {})
}

console.log('\nNot run: color-contrast, color-contrast-enhanced — `npm run contrast` measures the palette.')

if (violations) {
	console.error(`\n${violations} violation(s): ${[...seen].map(([id, n]) => `${id}×${n}`).join(', ')}`)
	process.exit(1)
}

console.log(`\n✓ No violations across ${PAGES.length} pages at ${VIEWPORTS.map((v) => `${v.width}px`).join(' and ')}.`)
