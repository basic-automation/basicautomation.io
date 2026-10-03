/**
 * Audit what the server ships, not what the build uses.
 *
 * `npm audit` walks the whole lockfile. On 2026-10-02 it reported eleven
 * "high" findings and not one of them could reach a visitor: `braces` sits
 * under nitropack's build-time globbing, and `node-forge` under the dev
 * server's self-signed-certificate helper. Neither has a patched release, so
 * that report will stay red — and a red report nobody can act on is one that
 * stops being read, including on the day it names something real.
 *
 * So this asks the registry about exactly two things, both read out of a
 * finished build:
 *
 *   - the packages Nitro traced into `.output/server/node_modules`, with the
 *     exact versions it lists in `.output/server/package.json`;
 *   - the packages it inlined into the server chunks instead (h3, nitropack,
 *     nuxt itself…), named by the sourcemaps beside them and versioned by the
 *     `package.json` those sources were read from.
 *
 *   npm run build && npm run audit:runtime
 *
 * Fails on a high or critical advisory that applies, unless it is in ACCEPTED
 * below with a reason; anything milder is printed and passes. Fails, too, when
 * the registry cannot be asked — no answer is not a clean answer.
 *
 * What this does NOT cover: the client bundle (built without sourcemaps, so
 * there is nothing to read its packages from — though nearly everything it
 * ships is a package the server bundle carries too), and the onion gateway's
 * Rust dependencies, which are `cargo`'s to audit.
 */

import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { SEVERITY, applicable, packageFromPath } from '../shared/security/advisories.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = resolve(ROOT, '.output/server')
const BULK = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'

/**
 * Advisories known to apply and judged not to matter here, by GHSA id. Each
 * needs a reason a reviewer can check; the list is empty because nothing has
 * needed it yet.
 */
const ACCEPTED = {
	// 'GHSA-xxxx-xxxx-xxxx': 'why this cannot be reached from a request',
}

/** Severities that fail the run. */
const FAIL_AT = SEVERITY.indexOf('high')

async function traced() {
	let manifest
	try {
		manifest = JSON.parse(await readFile(join(SERVER, 'package.json'), 'utf8'))
	}
	catch {
		console.error('No .output/server/package.json — run `npm run build` first.')
		process.exit(1)
	}
	return Object.entries(manifest.dependencies ?? {})
}

async function* maps(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') continue
		const path = join(dir, entry.name)
		if (entry.isDirectory()) yield* maps(path)
		else if (entry.name.endsWith('.map')) yield path
	}
}

async function inlined() {
	const roots = new Map()
	for await (const map of maps(SERVER)) {
		const { sources = [], sourceRoot = '' } = JSON.parse(await readFile(map, 'utf8'))
		for (const source of sources) {
			const pkg = packageFromPath(resolve(dirname(map), sourceRoot ?? '', source))
			if (pkg) roots.set(pkg.root, pkg.name)
		}
	}
	const found = []
	for (const [root, name] of roots) {
		try {
			const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
			found.push([name, version])
		}
		catch {
			console.error(`  ! ${name}: inlined from ${relative(ROOT, root)}, but its package.json is gone — reinstall and rebuild`)
			process.exitCode = 1
		}
	}
	return found
}

const installed = {}
const add = ([name, version]) => {
	installed[name] ??= []
	if (!installed[name].includes(version)) installed[name].push(version)
}
const fromTrace = await traced()
const fromChunks = await inlined()
fromTrace.forEach(add)
fromChunks.forEach(add)

const names = Object.keys(installed).length
console.log(`Asking the npm registry about ${names} packages: ${fromTrace.length} traced into node_modules, ${fromChunks.length} inlined into the chunks.`)

let advisories
try {
	const res = await fetch(BULK, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(installed),
		signal: AbortSignal.timeout(30_000),
	})
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	advisories = await res.json()
}
catch (err) {
	console.error(`✗ The registry could not be asked (${err.message}). No answer is not a clean answer.`)
	process.exit(1)
}

const findings = applicable(installed, advisories)
const ghsa = (url) => url.match(/GHSA-[\w-]+/)?.[0] ?? url
let failing = 0

for (const f of findings) {
	const id = ghsa(f.advisory.url)
	const accepted = ACCEPTED[id]
	const fails = !accepted && SEVERITY.indexOf(f.advisory.severity) >= FAIL_AT
	if (fails) failing++
	const mark = fails ? '✗' : '!'
	console.log(`  ${mark} ${f.advisory.severity.padEnd(8)} ${f.name}@${f.version}  ${f.advisory.title}`)
	console.log(`             ${f.advisory.url}  (affects ${f.advisory.vulnerable_versions})`)
	if (f.unparsed) console.log('             the range could not be read, so it is assumed to match')
	if (accepted) console.log(`             accepted: ${accepted}`)
}

if (failing) {
	console.error(`\n✗ ${failing} high or critical advisor${failing === 1 ? 'y applies' : 'ies apply'} to code the server ships.`)
	process.exit(1)
}
console.log(findings.length
	? `\n✓ Nothing high or critical in what the server ships (${findings.length} milder or accepted, above).`
	: '\n✓ No advisory applies to anything the server ships.')
