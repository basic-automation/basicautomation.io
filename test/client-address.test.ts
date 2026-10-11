import { describe, expect, it } from 'vitest'
import { clientAddress } from '~~/shared/log/client'

describe('clientAddress', () => {
	it('logs Caddy\'s peer and Cloudflare\'s visitor side by side', () => {
		expect(clientAddress({ forwardedFor: '172.18.0.1', cfConnectingIp: '203.0.113.7' }, 'web'))
			.toEqual({ ip: '172.18.0.1', cfIp: '203.0.113.7' })
	})

	it('takes the first hop of a list, trimmed', () => {
		expect(clientAddress({ forwardedFor: ' 198.51.100.2 , 172.18.0.1', cfConnectingIp: ['2001:db8::1'] }, 'web'))
			.toEqual({ ip: '198.51.100.2', cfIp: '2001:db8::1' })
	})

	it('is null, not empty, where a header is missing or blank', () => {
		expect(clientAddress({ forwardedFor: '192.168.3.97', cfConnectingIp: undefined }, 'web'))
			.toEqual({ ip: '192.168.3.97', cfIp: null })
		expect(clientAddress({ forwardedFor: '', cfConnectingIp: ' ' }, 'web'))
			.toEqual({ ip: null, cfIp: null })
	})

	it('logs no address for a request over Tor, whatever it sent', () => {
		expect(clientAddress({ forwardedFor: undefined, cfConnectingIp: '203.0.113.7' }, 'onion'))
			.toEqual({ ip: null, cfIp: null })
	})
})
