/**
 * Space calls to one upstream at least `gapMs` apart, in the order they were
 * made.
 *
 * crates.io lets anyone use its API "provided you abide by" two limits, the
 * first of them "a maximum of 1 request per second". The site asked for every
 * published crate at once: each repo refreshes in its own cached function,
 * `getProjects` resolves them together, and they expire together, so each
 * refresh window opened with one simultaneous request per crate.
 * https://crates.io/data-access
 *
 * The wait falls on a background revalidation (the cache serves stale while it
 * refreshes), so no visitor waits for it, apart from a cold start's first render.
 */
export function paced(gapMs: number, now: () => number = Date.now) {
	let next = 0
	return async function run<T>(task: () => Promise<T>): Promise<T> {
		const at = Math.max(now(), next)
		next = at + gapMs
		const wait = at - now()
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
		return task()
	}
}
