/**
 * Headless Chromium over the Chrome DevTools Protocol, with Node's own
 * WebSocket — for the scripts that need a real layout engine
 * (`check-a11y-browser.mjs`, `measure-vitals.mjs`).
 *
 * Not Puppeteer or Playwright: the whole job is "open a page, run a script in
 * it, read what it measured", and a browser-automation framework is a large
 * dependency for a handful of protocol calls.
 *
 * Chromium is found on PATH (`chromium`, `google-chrome`, `google-chrome-stable`)
 * or named by `CHROME_PATH`. GitHub's Ubuntu runners ship Google Chrome.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function findChrome() {
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

	const listeners = new Set()

	ws.onmessage = ({ data }) => {
		const msg = JSON.parse(data)
		for (const l of listeners) l(msg)
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
		/** Every message, raw; returns an unsubscribe function. */
		on(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		close: () => ws.close(),
	}
}

/** Launch a throwaway Chromium and connect to it. `stop()` cleans up both. */
export async function startBrowser() {
	const chrome = findChrome()
	const profile = await mkdtemp(join(tmpdir(), 'ba-cdp-'))
	const { proc, url } = await launch(chrome, profile)
	const cdp = await connect(url)
	return {
		cdp,
		chrome,
		async stop() {
			cdp.close()
			proc.kill()
			await rm(profile, { recursive: true, force: true }).catch(() => {})
		},
	}
}
