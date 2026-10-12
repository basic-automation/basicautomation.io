/**
 * Reach the onion service from outside, through the front door, as a visitor.
 *
 *   tor --SocksPort 9050 &            # any Tor client, bootstrapped
 *   npm run probe:onion                               # address from basicautomation.io
 *   npm run probe:onion -- --address=<name>.onion --socks=127.0.0.1:19050
 *
 * The site already fetches itself over Tor (`onion/src/snapshot.rs`), and the
 * health it reports comes from that. But that fetch runs in the gateway's own
 * arti, and it mints its own clearance rather than meeting the abuse gate. It
 * cannot say whether a separate client can find the descriptor, whether the
 * gate lets a browser through, or whether what is behind the gate is the site.
 * This does all three, from a client the gateway has never seen:
 *
 * 1. GET `/` over the given SOCKS proxy, sending the `Accept` header Tor
 *    Browser sends — the one that once tripped the gate's WAF for every
 *    browser while `curl`'s bare `*\/*` sailed through (see `onion/src/gate.rs`).
 * 2. Expect the gate's proof-of-work page — a 200 that is NOT the site — and
 *    solve it: SHA-256 over SEED || an 8-byte big-endian counter, until
 *    DIFFICULTY leading zero bits.
 * 3. Submit it, keep the clearance cookie, GET `/` again, and expect the site's
 *    own `<title>`.
 *
 * HTTP goes through `curl` (`--socks5-hostname`, so the name is resolved by
 * Tor): Node has no SOCKS client, and every runner and this host have curl.
 * `-k` because the gateway's certificate is self-signed; the `.onion` name is
 * itself the service's key, which is what authenticates it.
 *
 * Tries up to `--tries` times (default 3) — one failed circuit is Tor, three in
 * a row is the service. Prints one JSON line per attempt and exits 1 if none
 * reached the site, 2 if it could not even ask (no address to probe).
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const args = process.argv.slice(2)
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const SITE = opt('site', 'https://basicautomation.io').replace(/\/$/, '')
const SOCKS = opt('socks', process.env.TOR_SOCKS ?? '127.0.0.1:9050')
const TRIES = Number(opt('tries', 3))
const TIMEOUT_S = Number(opt('timeout', 120))
/** What the site's pages are titled; the gate's page is "Checking your connection…". */
const SITE_TITLE = /Basic Automation|basic automation/

/** Tor Browser 15's `Accept` for a document — what a real visitor sends. */
const ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0'

/** The puzzle's fields, read out of the gate's page. */
export function readPuzzle(html) {
	const field = (name) => new RegExp(`var ${name}=("?)([^";]+)\\1;`).exec(html)?.[2]
	const seed = field('SEED'), difficulty = field('DIFFICULTY'), puzzle = field('PUZZLE'), submit = field('SUBMIT')
	if (!seed || !difficulty || !puzzle || !submit) return null
	return { seed, difficulty: Number(difficulty), puzzle, submit }
}

function leadingZeroBits(bytes) {
	let bits = 0
	for (const b of bytes) {
		if (b === 0) { bits += 8; continue }
		return bits + Math.clz32(b) - 24
	}
	return bits
}

/** The nonce the gate's own script would find: the counter sits in the low 4 bytes. */
export function solve({ seed, difficulty }) {
	const seedBytes = Buffer.from(seed, 'hex')
	const buf = Buffer.alloc(seedBytes.length + 8)
	seedBytes.copy(buf)
	for (let n = 0; n <= 0xffffffff; n++) {
		buf.writeUInt32BE(n, seedBytes.length + 4)
		if (leadingZeroBits(createHash('sha256').update(buf).digest()) >= difficulty) {
			return buf.subarray(seedBytes.length).toString('base64url')
		}
	}
	throw new Error('no nonce in 2^32 tries')
}

async function get(url, jar) {
	const { stdout } = await run('curl', [
		'-sSk', '--socks5-hostname', SOCKS, '-m', String(TIMEOUT_S),
		'-b', jar, '-c', jar, '-L', '--max-redirs', '5',
		'-H', `Accept: ${ACCEPT}`, '-A', USER_AGENT,
		'-w', '\n%{http_code}', url,
	], { maxBuffer: 16 * 1024 * 1024 })
	const cut = stdout.lastIndexOf('\n')
	return { status: Number(stdout.slice(cut + 1)), body: stdout.slice(0, cut) }
}

const titleOf = (html) => /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null

async function attempt(origin) {
	const jar = join(await mkdtemp(join(tmpdir(), 'ba-onion-')), 'jar')
	const t0 = Date.now()
	const ms = () => Date.now() - t0
	try {
		const first = await get(`${origin}/`, jar)
		const reachedMs = ms()
		if (SITE_TITLE.test(titleOf(first.body) ?? '')) return { ok: true, gate: 'none', status: first.status, title: titleOf(first.body), reachedMs, totalMs: ms() }
		const puzzle = readPuzzle(first.body)
		if (!puzzle) return { ok: false, stage: 'gate', status: first.status, title: titleOf(first.body), reachedMs }
		const solveStart = Date.now()
		const nonce = solve(puzzle)
		const solveMs = Date.now() - solveStart
		await get(`${origin}${puzzle.submit}?puzzle=${encodeURIComponent(puzzle.puzzle)}&nonce=${nonce}`, jar)
		const site = await get(`${origin}/`, jar)
		const title = titleOf(site.body)
		return { ok: site.status === 200 && SITE_TITLE.test(title ?? ''), stage: 'site', status: site.status, title, difficulty: puzzle.difficulty, reachedMs, solveMs, totalMs: ms() }
	}
	catch (e) {
		return { ok: false, stage: 'connect', error: (e.stderr || e.message).trim().split('\n').pop(), totalMs: ms() }
	}
	finally {
		await rm(join(jar, '..'), { recursive: true, force: true })
	}
}

async function main() {
	let address = opt('address', null)
	if (!address) {
		const res = await fetch(`${SITE}/api/onion`)
		if (!res.ok) throw new Error(`${SITE}/api/onion answered ${res.status}`)
		address = (await res.json()).address
		if (!address) throw new Error(`${SITE}/api/onion names no address`)
	}
	const origin = `https://${address}`
	console.log(`Probing ${origin} through SOCKS ${SOCKS}, up to ${TRIES} tries`)
	for (let i = 1; i <= TRIES; i++) {
		const result = await attempt(origin)
		console.log(JSON.stringify({ try: i, ...result }))
		if (result.ok) {
			console.log(`✓ reached the site over Tor on try ${i}${result.gate === 'none' ? ', with no gate in front of it' : ', through the gate'}, in ${(result.totalMs / 1000).toFixed(1)} s`)
			return
		}
		// Long enough for Tor to stop reusing the circuit that just failed.
		if (i < TRIES) await new Promise((r) => setTimeout(r, 15_000))
	}
	console.error(`✗ ${TRIES} tries, none reached the site`)
	process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main().catch((e) => {
		console.error(`✗ could not probe: ${e.message}`)
		process.exit(2)
	})
}
