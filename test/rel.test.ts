import { describe, expect, it } from 'vitest'
import { outboundRel } from '~~/shared/html/rel'

const CLEARNET = 'https://basicautomation.io'
const ONION = 'https://abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz2345.onion'

describe('outboundRel', () => {
	it('lets the organization\'s own repositories see the visit came from here', () => {
		expect(outboundRel('https://github.com/basic-automation/Skidbladnir', CLEARNET)).toBe('noopener')
		expect(outboundRel('https://github.com/basic-automation/Skidbladnir/releases/download/v1.0.0/x.deb', CLEARNET)).toBe('noopener')
	})

	it('keeps noreferrer for everyone else', () => {
		for (const href of [
			'https://v2.tauri.app',
			'https://crates.io/crates/artiqwest',
			'https://github.com/someone-else/repo',
			'https://github.com/basic-automation-evil/repo',
			'https://github.com/basic-automation',
			'http://github.com/basic-automation/Skidbladnir',
		]) {
			expect(outboundRel(href, CLEARNET), href).toBe('noreferrer noopener')
		}
	})

	it('keeps noreferrer on everything over the onion service', () => {
		expect(outboundRel('https://github.com/basic-automation/Skidbladnir', ONION)).toBe('noreferrer noopener')
		expect(outboundRel('https://github.com/basic-automation/Skidbladnir', 'http://x.onion:8080')).toBe('noreferrer noopener')
	})

	it('treats an origin it cannot read as the cautious case', () => {
		expect(outboundRel('https://github.com/basic-automation/Skidbladnir', 'not a url')).toBe('noreferrer noopener')
	})
})
