/**
 * Headless Firefox over WebDriver BiDi, with Node's own WebSocket — the
 * Firefox half of `lib/cdp.mjs`, for the same reason that is not Puppeteer.
 *
 * Why Firefox at all: the onion service is reached in Tor Browser, which is
 * Firefox, and the two engines differ in ways this site has met — Chromium
 * opens a closed `<details>` for a URL fragment and Firefox does not, so a
 * link to a README heading worked in one and not the other.
 *
 * Firefox is found on PATH (`firefox`, `firefox-esr`) or named by
 * `FIREFOX_PATH`. GitHub's Ubuntu runners ship Firefox.
 * <https://w3c.github.io/webdriver-bidi/>
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function findFirefox() {
	if (process.env.FIREFOX_PATH) return process.env.FIREFOX_PATH
	for (const name of ['firefox', 'firefox-esr']) {
		try {
			return execFileSync('which', [name], { encoding: 'utf8' }).trim()
		}
		catch {
			// not this one
		}
	}
	console.error('✗ No Firefox found. Install one, or set FIREFOX_PATH.')
	process.exit(1)
}

/**
 * Start Firefox on a free port and resolve with its BiDi WebSocket URL.
 * With `--remote-debugging-port 0` it picks the port and writes it to
 * `WebDriverBiDiServer.json` in the profile once it is listening — the
 * counterpart of Chromium's `DevToolsActivePort`, polled the same way.
 */
async function launch(firefox, profile) {
	const proc = spawn(firefox, [
		'--headless',
		'--no-remote',
		'--profile', profile,
		'--remote-debugging-port', '0',
		'about:blank',
	], { stdio: ['ignore', 'ignore', 'pipe'] })

	let err = ''
	let exited = null
	proc.stderr.on('data', (chunk) => { err += chunk })
	proc.on('exit', (code) => { exited = code })

	const deadline = Date.now() + 60_000
	for (;;) {
		if (exited !== null) throw new Error(`Firefox exited ${exited}:\n${err}`)
		if (Date.now() > deadline) {
			proc.kill()
			throw new Error(`Firefox did not start within 60 s:\n${err}`)
		}
		const server = await readFile(join(profile, 'WebDriverBiDiServer.json'), 'utf8').catch(() => null)
		const { ws_host: host, ws_port: port } = server ? JSON.parse(server) : {}
		if (host && port) return { proc, url: `ws://${host}:${port}/session` }
		await new Promise((r) => setTimeout(r, 100))
	}
}

/** Commands by id, events to listeners — the same shape as `cdp.mjs`'s client. */
async function connect(url) {
	const ws = new WebSocket(url)
	await new Promise((res, rej) => {
		ws.onopen = res
		ws.onerror = () => rej(new Error(`could not connect to ${url}`))
	})
	let id = 0
	const pending = new Map()
	const listeners = new Set()
	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data)
		if (msg.id !== undefined && pending.has(msg.id)) {
			const { res, rej } = pending.get(msg.id)
			pending.delete(msg.id)
			if (msg.type === 'error') rej(new Error(`${msg.error}: ${msg.message}`))
			else res(msg.result)
			return
		}
		if (msg.type === 'event') for (const l of listeners) l(msg)
	}
	return {
		send(method, params = {}) {
			const msgId = ++id
			ws.send(JSON.stringify({ id: msgId, method, params }))
			return new Promise((res, rej) => pending.set(msgId, { res, rej }))
		},
		on(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		close: () => ws.close(),
	}
}

/** Launch a throwaway Firefox and open a BiDi session. `stop()` cleans up. */
export async function startFirefox() {
	const firefox = findFirefox()
	const profile = await mkdtemp(join(tmpdir(), 'ba-bidi-'))
	const { proc, url } = await launch(firefox, profile)
	const bidi = await connect(url)
	await bidi.send('session.new', { capabilities: {} })
	return {
		bidi,
		firefox,
		async stop() {
			await bidi.send('session.end').catch(() => {})
			bidi.close()
			proc.kill()
			await new Promise((r) => proc.exitCode !== null ? r() : proc.once('exit', r))
			await rm(profile, { recursive: true, force: true }).catch(() => {})
		},
	}
}
