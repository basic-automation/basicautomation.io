import { describe, expect, it } from 'vitest'
import { ANONYMOUS_LIMIT, SITE_BUDGET, MIN_TTL, cacheTtl, callsPerHour } from '~~/shared/github/budget'
import { projects } from '~~/data/projects'

describe('cacheTtl', () => {
	it('keeps the site under its budget for every project count up to the limit', () => {
		// 18 repos is where one refresh an hour is all that fits in 54 calls.
		for (let repos = 1; repos <= 18; repos++) {
			const ttl = cacheTtl(repos)
			expect(callsPerHour(repos, ttl), `${repos} repos at ${ttl}s`).toBeLessThanOrEqual(SITE_BUDGET)
		}
	})

	it('keeps the numbers the comments quote', () => {
		// Six repos was the 20-minute constant; seven is what broke it.
		expect(cacheTtl(6)).toBe(20 * 60)
		expect(callsPerHour(6, cacheTtl(6))).toBe(54)
		expect(cacheTtl(7)).toBe(30 * 60)
		expect(callsPerHour(7, cacheTtl(7))).toBe(42)
	})

	it('is what the old constant got wrong: 20 minutes for seven repos is over the limit', () => {
		expect(callsPerHour(7, 20 * 60)).toBeGreaterThan(ANONYMOUS_LIMIT)
	})

	it('never refreshes faster than the floor, however few repos', () => {
		expect(cacheTtl(1)).toBe(MIN_TTL)
		expect(cacheTtl(0)).toBe(MIN_TTL)
	})

	it('falls back to once an hour when even that does not fit, rather than zero', () => {
		expect(cacheTtl(40)).toBe(60 * 60)
	})

	it('holds for the catalogue as it stands today', () => {
		const ttl = cacheTtl(projects.length)
		expect(callsPerHour(projects.length, ttl)).toBeLessThanOrEqual(SITE_BUDGET)
	})
})
