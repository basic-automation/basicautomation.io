import { describe, expect, it } from 'vitest'
import { QUIET, RESTART_AFTER_S, UNREACHABLE_AFTER_S, onionState, shouldRestartGateway, watchOnion } from '~~/shared/onion/state'

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

describe('watchOnion', () => {
	const at = (m: number) => started + m * MIN

	it('says nothing while the service is fine or still coming up', () => {
		for (const state of ['off', 'starting', 'launched', 'reachable'] as const) {
			expect(watchOnion(QUIET, state, at(1))).toEqual({ watch: QUIET, alert: null })
		}
	})

	it('alerts once on the way in, then hourly, not on every healthcheck', () => {
		let w = watchOnion(QUIET, 'unreachable', at(31))
		expect(w.alert).toBe('onion.unreachable')
		const alerts: string[] = []
		// Four and a half hours of healthchecks, every 30 s.
		for (let m = 31.5; m <= 31 + 4.5 * 60; m += 0.5) {
			w = watchOnion(w.watch, 'unreachable', at(m))
			if (w.alert) alerts.push(w.alert)
		}
		expect(alerts).toEqual(Array(4).fill('onion.unreachable'))
		expect(w.watch.unreachableSince).toBe(at(31))
	})

	it('recovers on a fetch over Tor, and only on one', () => {
		const down = watchOnion(QUIET, 'unreachable', at(31)).watch
		// A gateway restarted in place is `launched` until it proves itself.
		const relaunched = watchOnion(down, 'launched', at(40))
		expect(relaunched).toEqual({ watch: down, alert: null })
		expect(watchOnion(relaunched.watch, 'reachable', at(41))).toEqual({ watch: QUIET, alert: 'onion.recovered' })
	})

	it('alerts again straight away for a second outage after a recovery', () => {
		const down = watchOnion(QUIET, 'unreachable', at(31)).watch
		const up = watchOnion(down, 'reachable', at(40)).watch
		expect(watchOnion(up, 'unreachable', at(75)).alert).toBe('onion.unreachable')
	})

	it('closes the outage quietly when the gateway is switched off', () => {
		const down = watchOnion(QUIET, 'unreachable', at(31)).watch
		expect(watchOnion(down, 'off', at(40))).toEqual({ watch: QUIET, alert: null })
	})
})

describe('shouldRestartGateway', () => {
	const hour = RESTART_AFTER_S * 1000

	it('leaves a reachable, starting or launched gateway alone, however old', () => {
		for (const state of ['reachable', 'starting', 'launched'] as const) {
			expect(shouldRestartGateway({ state, gatewayStartedAt: started, now: started + 10 * hour })).toBe(false)
		}
	})

	it('restarts one that has been up an hour and is unreachable', () => {
		expect(shouldRestartGateway({ state: 'unreachable', gatewayStartedAt: started, now: started + hour - 1 })).toBe(false)
		expect(shouldRestartGateway({ state: 'unreachable', gatewayStartedAt: started, now: started + hour })).toBe(true)
	})

	it('waits another hour after a restart, rather than looping', () => {
		// The old snapshot on disk keeps the state `unreachable` straight after a
		// restart; the gateway's own fresh start time is what holds it off.
		const restarted = started + hour
		expect(shouldRestartGateway({ state: 'unreachable', gatewayStartedAt: restarted, now: restarted + 1000 })).toBe(false)
		expect(shouldRestartGateway({ state: 'unreachable', gatewayStartedAt: restarted, now: restarted + hour })).toBe(true)
	})

	it('never restarts what was never started', () => {
		expect(shouldRestartGateway({ state: 'off', gatewayStartedAt: null, now: started })).toBe(false)
	})
})
