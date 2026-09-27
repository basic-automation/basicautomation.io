import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, stampNonce } from '~~/shared/security/csp'

const directive = (csp: string, name: string) =>
	csp.split('; ').find((d) => d.split(' ')[0] === name)

describe('contentSecurityPolicy', () => {
	it('without a nonce, is the policy every response gets', () => {
		const csp = contentSecurityPolicy()
		expect(directive(csp, 'script-src')).toBe("script-src 'self' 'unsafe-inline'")
		expect(csp).not.toMatch(/nonce-/)
		expect(directive(csp, 'style-src-elem')).toBeUndefined()
	})

	it('with a nonce, trusts it for scripts and style blocks, and only attributes stay inline', () => {
		const csp = contentSecurityPolicy('abc123')
		expect(directive(csp, 'script-src')).toContain("'nonce-abc123'")
		expect(directive(csp, 'style-src-elem')).toContain("'nonce-abc123'")
		expect(directive(csp, 'style-src-attr')).toBe("style-src-attr 'unsafe-inline'")
	})

	it('keeps the locked rules a browser enforces', () => {
		const csp = contentSecurityPolicy('n')
		expect(directive(csp, 'font-src')).toBe("font-src 'self'")
		expect(directive(csp, 'connect-src')).toBe("connect-src 'self'")
		expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'")
		expect(directive(csp, 'object-src')).toBe("object-src 'none'")
	})
})

describe('stampNonce', () => {
	it('stamps script and style tags, with and without attributes', () => {
		expect(stampNonce('<script>a</script><style id="x">b</style><script type="module" src="/e.js"></script>', 'N'))
			.toBe('<script nonce="N">a</script><style nonce="N" id="x">b</style><script nonce="N" type="module" src="/e.js"></script>')
	})

	it('leaves a tag that already has a nonce alone', () => {
		expect(stampNonce('<script nonce="old">a</script>', 'N')).toBe('<script nonce="old">a</script>')
	})

	it('does not mistake other elements for script or style', () => {
		const html = '<scripts></scripts><styled-box></styled-box><noscript></noscript>'
		expect(stampNonce(html, 'N')).toBe(html)
	})

	it('touches nothing else in the markup', () => {
		expect(stampNonce('<p>script style</p>', 'N')).toBe('<p>script style</p>')
	})
})
