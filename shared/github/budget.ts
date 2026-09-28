/**
 * How long a repo's GitHub data may be reused, worked out from how many repos
 * there are rather than typed in.
 *
 * GitHub allows 60 unauthenticated requests an hour, and refreshing one repo
 * costs `CALLS_PER_REPO` of them — the repo, its README and its releases. The
 * cache refreshes each repo at most once per TTL, so the most refreshes that can
 * land inside one hour is `ceil(3600 / ttl)`. The TTL has to be long enough that
 * this, times every call for every repo, stays under the limit.
 *
 * It used to be a constant, and a constant is correct only for the project count
 * it was computed against: 20 minutes was sized for six repos (54 calls an hour),
 * and the seventh project took it to 63 without anything noticing. Adding a
 * project now lengthens the TTL instead of quietly out-running the limit.
 * https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */

/** The repo, `/readme` and `/releases` — see `fetchRepo` in `server/utils/github.ts`. */
export const CALLS_PER_REPO = 3

/** GitHub's primary rate limit for unauthenticated requests, per hour. */
export const ANONYMOUS_LIMIT = 60

/**
 * What the site allows itself of that limit. The rest is headroom for
 * everything else that shares this host's address: `npm run sync`, the
 * routine's checks, anyone on the LAN browsing GitHub's API.
 */
export const SITE_BUDGET = 54

/** Never refresh more often than this, however few repos there are. */
export const MIN_TTL = 60 * 15

/** GitHub's primary rate limit for a request carrying a token, per hour. */
export const AUTHENTICATED_LIMIT = 5000

/**
 * What the site allows itself when it has a token: 6% of the 5,000. The token
 * is a person's, and whatever else that person runs draws on the same hour —
 * the site is fresher for spending more of it, not entitled to.
 */
export const AUTHENTICATED_BUDGET = 300

/**
 * The floor with a token. Five minutes is about as fresh as anyone reading a
 * star count can tell apart from live, and it keeps a bad token — every request
 * a 401, all of them landing on the snapshot — from hammering GitHub's sign-in.
 */
export const MIN_TTL_AUTHENTICATED = 60 * 5

const HOUR = 60 * 60

/**
 * The cache TTL in seconds for `repos` repositories: the shortest whole-hour
 * divisor (15, 20, 30, 60 minutes…) that keeps a full hour of refreshes
 * inside `budget`. Past the point where even one refresh an hour does not fit,
 * it returns the hour and the caller is told so by `callsPerHour`.
 */
export function cacheTtl(repos: number, budget = SITE_BUDGET, floor = MIN_TTL): number {
	const perRefresh = Math.max(1, repos) * CALLS_PER_REPO
	const refreshes = Math.max(1, Math.floor(budget / perRefresh))
	return Math.max(floor, Math.ceil(HOUR / refreshes))
}

/** The worst case a TTL allows: every repo refreshed as often as it can be, for an hour. */
export function callsPerHour(repos: number, ttl: number): number {
	return Math.ceil(HOUR / ttl) * repos * CALLS_PER_REPO
}

/** How often the site refreshes, and what that costs, given whether it holds a token. */
export interface RefreshPolicy {
	authenticated: boolean
	/** Seconds a repo's data is reused before it is fetched again. */
	ttl: number
	/** The worst case `ttl` allows, per hour. */
	callsPerHour: number
	/** The share of GitHub's limit the site allows itself. */
	budget: number
}

/**
 * The anonymous arithmetic above, or the same arithmetic against a token's
 * budget and floor. With seven repos that is 30 minutes anonymously and 5 with
 * a token: the token was shipped to lift the limit, and a limit lifted with the
 * TTL left where it was bought nothing a visitor could see.
 */
export function refreshPolicy(repos: number, authenticated: boolean): RefreshPolicy {
	const budget = authenticated ? AUTHENTICATED_BUDGET : SITE_BUDGET
	const ttl = cacheTtl(repos, budget, authenticated ? MIN_TTL_AUTHENTICATED : MIN_TTL)
	return { authenticated, ttl, callsPerHour: callsPerHour(repos, ttl), budget }
}
