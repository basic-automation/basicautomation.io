import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cameOverOnion } from '~~/shared/onion/via'

describe('cameOverOnion', () => {
	it('reads any value under the header as the gateway mark, including an empty one', () => {
		expect(cameOverOnion('1')).toBe(true)
		expect(cameOverOnion('')).toBe(true)
		expect(cameOverOnion('0')).toBe(true)
		expect(cameOverOnion(['1', '1'])).toBe(true)
	})

	it('reads an absent header as not over Tor', () => {
		expect(cameOverOnion(undefined)).toBe(false)
		expect(cameOverOnion(null)).toBe(false)
	})
})

// Not a unit of behaviour but a rule about the tree: Caddy's basic auth does
// not cover the onion gateway, so a handler under server/api/admin/ that forgets
// the guard is an editor open to anyone on Tor. Fails the day one is added
// without it.
describe('server/api/admin', () => {
	const dir = join(import.meta.dirname, '..', 'server', 'api', 'admin')
	const handlers = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'))

	it('has handlers to check', () => {
		expect(handlers.length).toBeGreaterThan(0)
	})

	it.each(handlers)('%s refuses the onion gateway before doing anything else', (file) => {
		const src = readFileSync(join(dir, file), 'utf8')
		const body = src.slice(src.indexOf('defineEventHandler('))
		const first = body.split('\n').slice(1).map(l => l.trim()).find(l => l && !l.startsWith('//'))
		expect(first).toBe('refuseOverOnion(event)')
	})
})
