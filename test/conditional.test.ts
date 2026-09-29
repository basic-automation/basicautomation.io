import { describe, expect, it } from 'vitest'
import { ConditionalCache } from '~~/shared/github/conditional'

describe('ConditionalCache', () => {
	it('offers nothing to send for a request it has never seen', () => {
		const c = new ConditionalCache()
		expect(c.etag('/repos/x')).toBeUndefined()
		expect(c.body('/repos/x')).toBeUndefined()
	})

	it('hands back the ETag and the body a 200 came with', () => {
		const c = new ConditionalCache<{ stars: number }>()
		c.store('/repos/x', 'W/"abc"', { stars: 3 })
		expect(c.etag('/repos/x')).toBe('W/"abc"')
		expect(c.body('/repos/x')).toEqual({ stars: 3 })
	})

	it('replaces an entry when the resource changed', () => {
		const c = new ConditionalCache<number>()
		c.store('k', '"1"', 1)
		c.store('k', '"2"', 2)
		expect(c.etag('k')).toBe('"2"')
		expect(c.body('k')).toBe(2)
		expect(c.size).toBe(1)
	})

	it('forgets an entry whose new response carried no ETag, rather than revalidating a stale body', () => {
		const c = new ConditionalCache<number>()
		c.store('k', '"1"', 1)
		c.store('k', null, 2)
		expect(c.etag('k')).toBeUndefined()
		expect(c.body('k')).toBeUndefined()
	})

	it('stays within its bound, dropping the least recently stored first', () => {
		const c = new ConditionalCache<number>(2)
		c.store('a', '"a"', 1)
		c.store('b', '"b"', 2)
		c.store('a', '"a2"', 3) // refreshed: now the newest
		c.store('c', '"c"', 4)
		expect(c.size).toBe(2)
		expect(c.etag('b')).toBeUndefined()
		expect(c.etag('a')).toBe('"a2"')
		expect(c.etag('c')).toBe('"c"')
	})
})

describe('ConditionalCache.answer', () => {
	it('keeps a 200 and hands it back', () => {
		const c = new ConditionalCache<string>()
		expect(c.answer('readme', 200, '"1"', '# Hello')).toEqual({ body: '# Hello', notModified: false })
		expect(c.etag('readme')).toBe('"1"')
	})

	// The bug this exists for: ofetch resolves a 304 with no body, and passing
	// that through blanked every unchanged README.
	it('turns a bodiless 304 back into the stored body', () => {
		const c = new ConditionalCache<string | undefined>()
		c.answer('readme', 200, '"1"', '# Hello')
		expect(c.answer('readme', 304, '"1"', undefined)).toEqual({ body: '# Hello', notModified: true })
		// …and the stored body survives the 304 for the next one.
		expect(c.answer('readme', 304, null, undefined).body).toBe('# Hello')
	})

	it('refuses a 304 it has nothing stored for, rather than returning nothing', () => {
		const c = new ConditionalCache<string | undefined>()
		expect(() => c.answer('readme', 304, null, undefined)).toThrow(/nothing stored/)
	})
})
