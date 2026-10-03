/**
 * Record the intrinsic size of every image the pages render.
 *
 *   npm run sizes          # write data/asset-sizes.generated.json
 *   npm run sizes:check    # is it still current?
 *
 * An `<img>` with no `width`/`height` gives the browser nothing to reserve
 * space with, so everything below it moves when the file lands. The sizes are
 * in the files themselves — this reads them once and commits the answer, the
 * same posture as `data/projects.generated.json` and the social cards' manifest:
 * a build artifact in the repo, with a reviewable diff when it changes.
 *
 * Not computed at request time, because the pages are server-rendered per
 * request and reading six files per render to learn something that only changes
 * when someone commits a new logo is work for nothing.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { projects } from '../data/projects.ts'
import { imageDimensions } from '../shared/assets/dimensions.ts'
import { CARD_CUTS, cutPath } from '../shared/assets/cuts.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'data/asset-sizes.generated.json')

/** Every image a page renders with a `src` this repo controls. */
function sources() {
	const paths = new Set()
	for (const p of projects) {
		if (p.logo) paths.add(p.logo)
		if (p.screenshot) paths.add(p.screenshot)
		if (p.cardImage) {
			paths.add(p.cardImage)
			for (const w of CARD_CUTS) paths.add(cutPath(p.cardImage, w))
		}
	}
	return [...paths].sort()
}

async function measure() {
	const sizes = {}
	const missing = []
	for (const path of sources()) {
		const file = resolve(ROOT, 'public', path.replace(/^\//, ''))
		try {
			const bytes = await readFile(file)
			const d = imageDimensions(new Uint8Array(bytes))
			if (!d) missing.push(`${path}: could not read a size out of it`)
			// Rounded, because `width`/`height` on an <img> are integers and a
			// fractional one is simply ignored. Several wordmarks have fractional
			// viewBoxes; the rounding moves the reserved aspect by well under a
			// pixel at any size they are drawn at.
			else sizes[path] = [Math.max(1, Math.round(d.width)), Math.max(1, Math.round(d.height))]
		}
		catch {
			missing.push(`${path}: no such file under public/`)
		}
	}
	return { sizes, missing }
}

const { sizes, missing } = await measure()

if (missing.length) {
	console.error('Cannot measure:\n')
	for (const m of missing) console.error(`  ✗ ${m}`)
	process.exit(1)
}

const body = `${JSON.stringify({
	note: 'Written by scripts/build-asset-sizes.mjs. Intrinsic [width, height] per image, so an <img> can reserve its space. Run `npm run sizes` after adding or replacing one.',
	sizes,
}, null, 2)}\n`

if (process.argv.includes('--check')) {
	let current = null
	try {
		current = await readFile(OUT, 'utf8')
	}
	catch {
		console.error(`No ${OUT}. Run \`npm run sizes\`.`)
		process.exit(1)
	}
	if (current !== body) {
		console.error('data/asset-sizes.generated.json is out of date — an image was added, removed or replaced.')
		console.error('Run `npm run sizes` and commit the result.')
		process.exit(1)
	}
	console.log(`✓ ${Object.keys(sizes).length} image sizes match the files on disk`)
	process.exit(0)
}

await writeFile(OUT, body)
for (const [path, [w, h]] of Object.entries(sizes)) console.log(`  ${path} — ${w}×${h}`)
console.log(`\nWrote ${OUT}`)
