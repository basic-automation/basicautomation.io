import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paced } from '~~/shared/net/pace'

describe('paced', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('starts calls made together a gap apart, in order', async () => {
		const run = paced(1000)
		const started: number[] = []
		const t0 = Date.now()
		const calls = [1, 2, 3].map((n) => run(async () => {
			started.push(Date.now() - t0)
			return n
		}))
		await vi.runAllTimersAsync()
		expect(await Promise.all(calls)).toEqual([1, 2, 3])
		expect(started).toEqual([0, 1000, 2000])
	})

	it('does not delay a call when the last one was long enough ago', async () => {
		const run = paced(1000)
		await run(async () => 'first')
		await vi.advanceTimersByTimeAsync(5000)
		const t = Date.now()
		let at = -1
		const p = run(async () => { at = Date.now() })
		await vi.runAllTimersAsync()
		await p
		expect(at - t).toBe(0)
	})

	it('passes a failure through without stalling the queue', async () => {
		const run = paced(1000)
		const bad = run(async () => { throw new Error('nope') })
		const good = run(async () => 'ok')
		bad.catch(() => {})
		await vi.runAllTimersAsync()
		await expect(bad).rejects.toThrow('nope')
		await expect(good).resolves.toBe('ok')
	})
})
