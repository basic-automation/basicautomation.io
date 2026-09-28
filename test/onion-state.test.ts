import { describe, expect, it } from 'vitest'
import { UNREACHABLE_AFTER_S, onionState } from '~~/shared/onion/state'

const MIN = 60_000
const started = Date.UTC(2026, 8, 27, 12)

describe('onionState', () => {
	it('is off where this process started no gateway, whatever is on disk', () => {
		expect(onionState({ gatewayStartedAt: null, hasAddress: true, lastReachedAt: started, now: started })).toBe('off')
	})

	it('walks starting -> launched -> reachable as a cold start comes up', () => {
		expect(onionState({ gatewayStartedAt: started, hasAddress: false, lastReachedAt: null, now: started + MIN })).toBe('starting')
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: null, now: started + 5 * MIN })).toBe('launched')
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: started + 8 * MIN, now: started + 9 * MIN })).toBe('reachable')
	})

	it('stays reachable across two missed self-fetches, and not a third', () => {
		const last = started + 10 * MIN
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: last, now: last + UNREACHABLE_AFTER_S * 1000 })).toBe('reachable')
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: last, now: last + UNREACHABLE_AFTER_S * 1000 + 1000 })).toBe('unreachable')
	})

	it('is unreachable when a gateway never got through at all, address or not', () => {
		const late = started + 31 * MIN
		expect(onionState({ gatewayStartedAt: started, hasAddress: false, lastReachedAt: null, now: late })).toBe('unreachable')
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: null, now: late })).toBe('unreachable')
	})

	it('judges an old snapshot left by a previous run on its own age', () => {
		// /run/onion is in the container's own filesystem, so the file survives a
		// `docker restart`; the restarted process must not read yesterday's
		// success as today's.
		expect(onionState({ gatewayStartedAt: started, hasAddress: true, lastReachedAt: started - 24 * 60 * MIN, now: started + MIN })).toBe('unreachable')
	})
})
