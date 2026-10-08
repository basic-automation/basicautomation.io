import { describe, expect, it } from 'vitest'
import {
	ANONYMOUS_LIMIT, AUTHENTICATED_BUDGET, AUTHENTICATED_LIMIT, MIN_TTL, MIN_TTL_AUTHENTICATED, SITE_BUDGET,
	anonymousBudget, syncCost,
	cacheTtl, callsPerHour, refreshPolicy,
} from '~~/shared/github/budget'
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

describe('refreshPolicy', () => {
	it('is the anonymous arithmetic without a token, with one sync reserved', () => {
		// 7 repos: a sync costs 21 of the 60, so the site's share is 39 — one
		// refresh an hour, which the floor rounds to the hour.
		expect(refreshPolicy(7, false)).toEqual({
			authenticated: false, ttl: 60 * 60, callsPerHour: 21, budget: anonymousBudget(7),
		})
	})

	it('leaves room for a whole sync run at the current project count', () => {
		const { callsPerHour: cost } = refreshPolicy(projects.length, false)
		expect(cost + syncCost(projects.length)).toBeLessThanOrEqual(ANONYMOUS_LIMIT)
	})

	it('refreshes every five minutes with a token, and says what that costs', () => {
		expect(refreshPolicy(7, true)).toEqual({ authenticated: true, ttl: 5 * 60, callsPerHour: 252, budget: AUTHENTICATED_BUDGET })
	})

	it('keeps a token inside its budget, and its budget a small share of the limit, for every count', () => {
		expect(AUTHENTICATED_BUDGET).toBeLessThanOrEqual(AUTHENTICATED_LIMIT / 10)
		for (let repos = 1; repos <= 100; repos++) {
			const p = refreshPolicy(repos, true)
			expect(p.callsPerHour, `${repos} repos at ${p.ttl}s`).toBeLessThanOrEqual(AUTHENTICATED_BUDGET)
			expect(p.ttl).toBeGreaterThanOrEqual(MIN_TTL_AUTHENTICATED)
		}
	})

	it('is never slower with a token than without one', () => {
		for (let repos = 1; repos <= 18; repos++) {
			expect(refreshPolicy(repos, true).ttl).toBeLessThanOrEqual(refreshPolicy(repos, false).ttl)
		}
	})
})
