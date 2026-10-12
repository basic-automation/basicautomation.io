import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs script, no declarations
import { readPuzzle, solve } from '../scripts/probe-onion.mjs'

// The shape onyums-skin's proof-of-work page declares its puzzle in, as served
// by the onion gateway on 2026-10-11 (the script around it trimmed).
const PAGE = `<title>Checking your connection…</title><script>
(function(){
var SEED="11f6ff20ef3c0e538856965cbff5d083683c78a6298545c48d07d4a5089e94e1";var DIFFICULTY=18;var PUZZLE="Efb_IO88DlOIVpZcv_XQg2g8eKYphUXEjQfUpQielOEAAAASAAAAAGrMUr0.8LC0pmo8ad3msuwNRX9wSPAeYtapewpmEGtResmiqIA";var SUBMIT="/.skin/pow";
var K=[0x428a2f98];
})();
</script>`

function zeroBits(bytes: Buffer) {
	let bits = 0
	for (const b of bytes) {
		if (b === 0) { bits += 8; continue }
		return bits + Math.clz32(b) - 24
	}
	return bits
}

describe('probe-onion', () => {
	it('reads the puzzle out of the gate page', () => {
		expect(readPuzzle(PAGE)).toEqual({
			seed: '11f6ff20ef3c0e538856965cbff5d083683c78a6298545c48d07d4a5089e94e1',
			difficulty: 18,
			puzzle: 'Efb_IO88DlOIVpZcv_XQg2g8eKYphUXEjQfUpQielOEAAAASAAAAAGrMUr0.8LC0pmo8ad3msuwNRX9wSPAeYtapewpmEGtResmiqIA',
			submit: '/.skin/pow',
		})
	})

	it('says so when the page is not the gate', () => {
		expect(readPuzzle('<title>Basic Automation</title>')).toBeNull()
	})

	it('finds a nonce the gate accepts: SHA-256(seed || nonce) has the leading zero bits', () => {
		const puzzle = { seed: 'ab'.repeat(32), difficulty: 12 }
		const nonce = Buffer.from(solve(puzzle), 'base64url')
		expect(nonce).toHaveLength(8)
		// The counter is the low four bytes, big-endian, as the gate's script writes it.
		expect(nonce.readUInt32BE(0)).toBe(0)
		const hash = createHash('sha256').update(Buffer.concat([Buffer.from(puzzle.seed, 'hex'), nonce])).digest()
		expect(zeroBits(hash)).toBeGreaterThanOrEqual(12)
	})
})
