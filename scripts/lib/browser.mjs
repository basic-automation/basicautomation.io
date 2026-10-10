/**
 * One page-driving interface over two engines: Chromium through `cdp.mjs`,
 * Firefox through `bidi.mjs`. Only as much as `check-a11y-browser.mjs` and
 * `check-navigation.mjs` need — open a page at a size, load or reload a URL,
 * evaluate in it, and hear what it logged.
 *
 *   const browser = await startDriver('firefox')
 *   const page = await browser.open({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
 *   await page.goto(url); await page.evaluate('document.title'); page.takeErrors()
 *
 * `evaluate` takes an expression and resolves with its value (awaited, as
 * JSON); `run` executes a whole script, such as a library's source, and
 * resolves with nothing.
 *
 * `takeErrors()` returns, and forgets, `{ text, url }` for every console
 * error, uncaught exception and refused load the page reported.
 */

import { startBrowser } from './cdp.mjs'
import { startFirefox } from './bidi.mjs'

export const ENGINES = ['chromium', 'firefox']

export async function startDriver(engine) {
	if (engine === 'firefox') return firefoxDriver()
	if (engine === 'chromium') return chromiumDriver()
	throw new Error(`unknown engine ${engine}; expected one of ${ENGINES.join(', ')}`)
}

async function chromiumDriver() {
	const { cdp, chrome, stop } = await startBrowser()
	return {
		name: 'Chromium',
		binary: chrome,
		stop,
		async open(viewport) {
			const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
			const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
			await cdp.send('Page.enable', {}, sessionId)
			await cdp.send('Runtime.enable', {}, sessionId)
			await cdp.send('Log.enable', {}, sessionId)
			await cdp.send('Emulation.setDeviceMetricsOverride', viewport, sessionId)
			let errors = []
			const off = cdp.on((msg) => {
				if (msg.sessionId !== sessionId) return
				if (msg.method === 'Runtime.exceptionThrown') {
					const d = msg.params.exceptionDetails
					errors.push({ text: `exception: ${d.exception?.description?.split('\n')[0] ?? d.text}` })
				}
				else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
					errors.push({ text: msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200) })
				}
				else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
					// Refused loads, CSP refusals and the like arrive here.
					errors.push({ text: msg.params.entry.text, url: msg.params.entry.url })
				}
			})
			return {
				async goto(url) {
					const loaded = cdp.once('Page.loadEventFired', sessionId)
					const nav = await cdp.send('Page.navigate', { url }, sessionId)
					if (nav.errorText) throw new Error(`${url}: ${nav.errorText}`)
					await loaded
				},
				async reload() {
					const loaded = cdp.once('Page.loadEventFired', sessionId)
					await cdp.send('Page.reload', {}, sessionId)
					await loaded
				},
				async run(source) {
					const { exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: source }, sessionId)
					if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
				},
				async evaluate(expression) {
					const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
						expression, awaitPromise: true, returnByValue: true,
					}, sessionId)
					if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
					return result.value
				},
				takeErrors() {
					const out = errors
					errors = []
					return out
				},
				async close() {
					off()
					await cdp.send('Target.closeTarget', { targetId })
				},
			}
		},
	}
}

async function firefoxDriver() {
	const { bidi, firefox, stop } = await startFirefox()
	return {
		name: 'Firefox',
		binary: firefox,
		stop,
		async open({ width, height, deviceScaleFactor = 1 }) {
			const { context } = await bidi.send('browsingContext.create', { type: 'tab' })
			await bidi.send('browsingContext.setViewport', {
				context, viewport: { width, height }, devicePixelRatio: deviceScaleFactor,
			})
			await bidi.send('session.subscribe', { events: ['log.entryAdded'], contexts: [context] })
			let errors = []
			const off = bidi.on((msg) => {
				if (msg.method !== 'log.entryAdded' || msg.params.source?.context !== context) return
				if (msg.params.level !== 'error') return
				// `javascript` entries are uncaught errors and, in Firefox, the
				// browser's own refusals too — a CSP-blocked script arrives here.
				const prefix = msg.params.type === 'javascript' ? 'exception: ' : ''
				errors.push({ text: `${prefix}${msg.params.text ?? ''}`.slice(0, 200) })
			})
			return {
				async goto(url) {
					await bidi.send('browsingContext.navigate', { context, url, wait: 'complete' })
				},
				async reload() {
					await bidi.send('browsingContext.reload', { context, wait: 'complete' })
				},
				async run(source) {
					const r = await bidi.send('script.evaluate', {
						expression: source, target: { context }, awaitPromise: false, resultOwnership: 'none',
					})
					if (r.type === 'exception') throw new Error(r.exceptionDetails.text)
				},
				async evaluate(expression) {
					// BiDi returns a typed remote value; JSON round-trips what the
					// callers here return, which is plain data.
					const r = await bidi.send('script.evaluate', {
						expression: `Promise.resolve(${expression}).then((v) => v === undefined ? undefined : JSON.stringify(v))`,
						target: { context },
						awaitPromise: true,
						resultOwnership: 'none',
					})
					if (r.type === 'exception') throw new Error(r.exceptionDetails.text)
					return r.result.type === 'string' ? JSON.parse(r.result.value) : undefined
				},
				takeErrors() {
					const out = errors
					errors = []
					return out
				},
				async close() {
					off()
					await bidi.send('browsingContext.close', { context })
				},
			}
		},
	}
}
