import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBasicAuth } from '~~/shared/admin/basicAuth'
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

describe('parseBasicAuth', () => {
	const basic = (s: string) => `Basic ${Buffer.from(s, 'utf8').toString('base64')}`

	it('splits user and password at the first colon only', () => {
		expect(parseBasicAuth(basic('physics515:pa:ss'))).toEqual({ user: 'physics515', password: 'pa:ss' })
		expect(parseBasicAuth(basic('u:'))).toEqual({ user: 'u', password: '' })
	})

	it('reads the scheme case-insensitively and decodes UTF-8', () => {
		expect(parseBasicAuth(basic('ünïcode:pässwörd').replace('Basic', 'basic'))).toEqual({ user: 'ünïcode', password: 'pässwörd' })
	})

	it('refuses anything that is not a well-formed Basic credential', () => {
		expect(parseBasicAuth(undefined)).toBeNull()
		expect(parseBasicAuth('')).toBeNull()
		expect(parseBasicAuth('Bearer abc')).toBeNull()
		expect(parseBasicAuth('Basic')).toBeNull()
		expect(parseBasicAuth('Basic !!!')).toBeNull()
		expect(parseBasicAuth(basic('no-colon'))).toBeNull()
		expect(parseBasicAuth(`Basic ${Buffer.from([0x75, 0x3a, 0xff]).toString('base64')}`)).toBeNull()
	})
})

// Not a unit of behaviour but a rule about the tree: a handler under
// server/api/admin/ that forgets the guard is a write API open to anyone who
// can reach the container — over Tor, or from any other container on its
// network. Fails the day one is added without it.
describe('server/api/admin', () => {
	const dir = join(import.meta.dirname, '..', 'server', 'api', 'admin')
	const handlers = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'))

	it('has handlers to check', () => {
		expect(handlers.length).toBeGreaterThan(0)
	})

	it.each(handlers)('%s demands the editor before doing anything else', (file) => {
		const src = readFileSync(join(dir, file), 'utf8')
		const body = src.slice(src.indexOf('defineEventHandler('))
		const first = body.split('\n').slice(1).map(l => l.trim()).find(l => l && !l.startsWith('//'))
		expect(first).toBe('await requireEditor(event)')
	})
})
