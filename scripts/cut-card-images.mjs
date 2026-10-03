/**
 * Cut each card's campaign art down to the widths in `CARD_CUTS`.
 *
 *   npm run cuts && npm run sizes
 *
 * Needs ImageMagick (`magick`); like `npm run shot` it is an authoring tool,
 * not a build step. Run it whenever a `cardImage` is added or replaced, then
 * `npm run sizes` to record what it wrote. See `shared/assets/cuts.ts` for why.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { projects } from '../data/projects.ts'
import { CARD_CUTS, cutPath } from '../shared/assets/cuts.ts'

const run = promisify(execFile)
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const file = (src) => resolve(PUBLIC, src.replace(/^\//, ''))

for (const p of projects) {
	if (!p.cardImage) continue
	for (const width of CARD_CUTS) {
		const out = cutPath(p.cardImage, width)
		// Lossy WebP at 80, method 6: the art is grainy, so it compresses on
		// size, not on quality — re-encoding the full 1224 px at 70 saved 10%.
		await run('magick', [file(p.cardImage), '-resize', `${width}x`, '-strip', '-quality', '80', '-define', 'webp:method=6', file(out)])
		console.log(`  ✓ ${out}`)
	}
}
