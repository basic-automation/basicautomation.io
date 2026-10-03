/**
 * Which published advisories apply to the code this site actually ships.
 *
 * `npm audit` answers a different question: it walks the whole lockfile, so a
 * flaw in a file-globbing library the build uses, or in the dev server's TLS
 * helper, is reported exactly as loudly as one in the code that renders a page
 * for a visitor. Eleven "high" findings that cannot reach the running site are
 * eleven reasons to stop reading the report — and the twelfth, the one that
 * can, arrives in that same pile.
 *
 * The registry's bulk endpoint already answers with the advisories that apply
 * to the versions it was sent (checked 2026-10-02: braces@3.0.3 alone brings
 * back only its `<=3.0.3` advisory, not the older `<3.0.3` one). The range is
 * still tested here, the way `npm audit` re-reads what it is sent, so a
 * registry answering more broadly than asked would not raise a false alarm.
 * It understands the range syntax advisories are written in — comparators
 * joined by spaces, alternatives joined by `||` — and treats anything else as
 * matching, so a range it cannot read is shown rather than dropped.
 */

export interface Advisory {
	id: number
	url: string
	title: string
	severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
	vulnerable_versions: string
}

export interface Finding {
	name: string
	version: string
	advisory: Advisory
	/** The range could not be read, so it was assumed to match. */
	unparsed?: true
}

type Version = { core: [number, number, number], pre: string[] }

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export function parseVersion(text: string): Version | null {
	const m = text.trim().match(VERSION)
	if (!m) return null
	return {
		core: [Number(m[1]), Number(m[2]), Number(m[3])],
		pre: m[4] ? m[4].split('.') : [],
	}
}

/** Semver precedence: core numerically, then a prerelease sorts before its release. */
export function compareVersions(a: Version, b: Version): number {
	for (let i = 0; i < 3; i++) {
		if (a.core[i] !== b.core[i]) return a.core[i]! - b.core[i]!
	}
	if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length
	for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
		const x = a.pre[i]
		const y = b.pre[i]
		if (x === undefined) return -1
		if (y === undefined) return 1
		if (x === y) continue
		const xn = /^\d+$/.test(x)
		const yn = /^\d+$/.test(y)
		if (xn && yn) return Number(x) - Number(y)
		if (xn !== yn) return xn ? -1 : 1
		return x < y ? -1 : 1
	}
	return 0
}

const COMPARATOR = /^(<=|>=|<|>|=)?\s*(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

/**
 * Does `version` fall in `range`? `null` when the range is not in a form this
 * reads — the caller decides what an unreadable range means.
 */
export function inRange(version: string, range: string): boolean | null {
	const v = parseVersion(version)
	if (!v) return null
	let readable = true
	const hit = range.split('||').some((alternative) => {
		const text = alternative.trim()
		if (text === '*' || text === '') return true
		// `>= 1.2.3` and `>=1.2.3` are both seen; glue each operator to its version.
		const tokens = text.replace(/(<=|>=|<|>|=)\s+/g, '$1').split(/[\s,]+/).filter(Boolean)
		return tokens.every((token) => {
			const m = token.match(COMPARATOR)
			if (!m) {
				readable = false
				return true
			}
			const c = compareVersions(v, parseVersion(m[2]!)!)
			switch (m[1]) {
				case '<': return c < 0
				case '<=': return c <= 0
				case '>': return c > 0
				case '>=': return c >= 0
				default: return c === 0
			}
		})
	})
	return readable ? hit : null
}

/** Every advisory that names an installed version, worst first. */
export function applicable(
	installed: Record<string, string[]>,
	advisories: Record<string, Advisory[]>,
): Finding[] {
	const found: Finding[] = []
	for (const [name, list] of Object.entries(advisories)) {
		for (const version of installed[name] ?? []) {
			for (const advisory of list) {
				const hit = inRange(version, advisory.vulnerable_versions)
				if (hit === false) continue
				found.push(hit === null ? { name, version, advisory, unparsed: true } : { name, version, advisory })
			}
		}
	}
	return found.sort((a, b) => SEVERITY.indexOf(b.advisory.severity) - SEVERITY.indexOf(a.advisory.severity)
		|| a.name.localeCompare(b.name))
}

export const SEVERITY: Advisory['severity'][] = ['info', 'low', 'moderate', 'high', 'critical']

/** `node_modules/@scope/name/dist/x.js` → `@scope/name`; the last package in a nested path wins. */
export function packageFromPath(path: string): { name: string, root: string } | null {
	const parts = path.split('/')
	const at = parts.lastIndexOf('node_modules')
	if (at < 0 || at + 1 >= parts.length) return null
	const first = parts[at + 1]!
	if (first.startsWith('.')) return null
	const scoped = first.startsWith('@')
	if (scoped && at + 2 >= parts.length) return null
	const name = scoped ? `${first}/${parts[at + 2]}` : first
	return { name, root: parts.slice(0, at + (scoped ? 3 : 2)).join('/') }
}
