/**
 * Cut the project screenshots from the screenshots their own READMEs carry.
 *
 *   npm run shot          # fetch, cut, write public/projects/shots/*, record sources
 *   npm run shot:check    # has any upstream screenshot changed since it was cut?
 *
 * Skidbladnir's page shows the top of the window its README shows, and that
 * window changes with every release that adds a control. Re-cutting it by hand
 * meant remembering the crop, the encoder settings and that it had to happen at
 * all — and a screenshot two releases behind the copy beside it is what this
 * project has already shipped once.
 *
 * So each cut records the git blob it was cut FROM, in
 * `public/projects/shots/sources.json`, and the check asks GitHub for the
 * file's current blob: one request per screenshot, so it needs the network but
 * neither ImageMagick nor a token. The cut itself needs ImageMagick (`magick`);
 * like `npm run og` it is an authoring tool, not a build step.
 *
 * The cut also squares the window's corners. The capture is of a window with
 * rounded corners on black, and on this page — one flat background, no rounded
 * corners — the two in the cut read as black notches. The corner outside the arc is
 * painted with the window's own background, sampled from the capture, so no
 * colour is introduced here.
 */

import { execFile } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const run = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = resolve(ROOT, 'public/projects/shots')
const MANIFEST = resolve(SHOTS, 'sources.json')
const OWNER = 'basic-automation'

/**
 * One entry per screenshot cut from upstream.
 * - `height`: where to cut. For Skidbladnir, the gap above "Metadata" — below
 *   it the panel repeats the same kind of control, and a taller image only
 *   pushes the page's copy further down. Check it by eye after every cut: a
 *   release that adds a row moves the gap.
 * - `radius`: the window's corner radius in the capture, in pixels.
 * - `sample`: a pixel of plain window background, for the corner fill.
 */
const CUTS = [
	{
		file: 'skidbladnir-screenshot.webp',
		repo: 'Skidbladnir',
		path: 'resources/images/screenshot.webp',
		height: 1304,
		radius: 30,
		sample: [640, 1],
		quality: 90,
	},
]

function headers() {
	const h = { 'accept': 'application/vnd.github+json', 'x-github-api-version': '2026-03-10', 'user-agent': 'basicautomation.io' }
	const token = process.env.GITHUB_TOKEN ?? process.env.NUXT_GITHUB_TOKEN
	if (token) h.authorization = `Bearer ${token}`
	return h
}

/** The file's current blob on the default branch, and where to download it. */
async function upstream(cut) {
	const url = `https://api.github.com/repos/${OWNER}/${cut.repo}/contents/${cut.path}`
	const res = await fetch(url, { headers: headers() })
	if (!res.ok) throw new Error(`${cut.repo}/${cut.path}: GitHub answered ${res.status}`)
	const body = await res.json()
	return { sha: body.sha, download: body.download_url }
}

async function readManifest() {
	try {
		return JSON.parse(await readFile(MANIFEST, 'utf8'))
	}
	catch {
		return { cuts: {} }
	}
}

async function check() {
	const manifest = await readManifest()
	const stale = []
	for (const cut of CUTS) {
		const { sha } = await upstream(cut)
		const recorded = manifest.cuts?.[cut.file]?.sha
		if (recorded !== sha) stale.push(`${cut.file}: cut from ${recorded?.slice(0, 8) ?? 'nothing'}, upstream is ${sha.slice(0, 8)} — run \`npm run shot\``)
	}
	if (stale.length) {
		for (const line of stale) console.error(`✗ ${line}`)
		process.exit(1)
	}
	console.log(`✓ ${CUTS.length} screenshot(s) cut from the current upstream file`)
}

async function cutOne(cut, work) {
	const { sha, download } = await upstream(cut)
	const res = await fetch(download)
	if (!res.ok) throw new Error(`${download}: ${res.status}`)
	const source = join(work, `${cut.repo}.webp`)
	await writeFile(source, Buffer.from(await res.arrayBuffer()))

	const [sx, sy] = cut.sample
	const { stdout: fill } = await run('magick', [source, '-format', `%[pixel:p{${sx},${sy}}]`, 'info:'])
	const { stdout: width } = await run('magick', [source, '-format', '%w', 'info:'])
	const w = Number(width)
	const r = cut.radius
	// The two top corners only: the bottom edge is a cut, not the window's edge.
	// Painted where a pixel lies outside a circle two pixels inside the arc,
	// which takes the anti-aliased fringe with it.
	const outside = (cx) => `(i-${cx})*(i-${cx})+(j-${r})*(j-${r})>${(r - 2) ** 2}`
	const corner = `(j<${r})*((i<${r})*(${outside(r)})+(i>=${w - r})*(${outside(w - 1 - r)}))`
	const out = resolve(SHOTS, cut.file)
	await run('magick', [
		source,
		'-crop', `${w}x${cut.height}+0+0`, '+repage',
		'(', '+clone', '-fill', fill.trim(), '-colorize', '100', ')',
		'(', '-clone', '0', '-fx', corner, ')',
		'-composite',
		'-quality', String(cut.quality), '-define', 'webp:method=6',
		out,
	])
	console.log(`✓ ${cut.file}  ${w}×${cut.height}  from ${cut.repo}/${cut.path} @ ${sha.slice(0, 8)}`)
	return { repo: cut.repo, path: cut.path, sha }
}

async function cutAll() {
	const work = await mkdtemp(join(tmpdir(), 'shots-'))
	const manifest = await readManifest()
	try {
		for (const cut of CUTS) manifest.cuts[cut.file] = await cutOne(cut, work)
	}
	finally {
		await rm(work, { recursive: true, force: true })
	}
	await writeFile(MANIFEST, `${JSON.stringify({
		note: 'Written by scripts/cut-screenshot.mjs: the upstream git blob each screenshot was cut from. `npm run shot:check` fails when upstream has moved on.',
		cuts: manifest.cuts,
	}, null, 2)}\n`)
	console.log('Now run `npm run sizes`, and look at the cut: a release that adds a row moves the gap it is cut at.')
}

if (process.argv.includes('--check')) await check()
else await cutAll()
