import { describe, expect, it } from 'vitest'
import { type Advisory, applicable, compareVersions, inRange, packageFromPath, parseVersion } from '~~/shared/security/advisories'

const v = (s: string) => parseVersion(s)!

describe('compareVersions', () => {
	it('orders the core numerically, not as text', () => {
		expect(compareVersions(v('1.10.0'), v('1.9.0'))).toBeGreaterThan(0)
		expect(compareVersions(v('2.0.0'), v('10.0.0'))).toBeLessThan(0)
		expect(compareVersions(v('v3.0.3'), v('3.0.3'))).toBe(0)
	})

	it('puts a prerelease before its release, and orders prereleases by semver', () => {
		expect(compareVersions(v('1.0.0-rc.1'), v('1.0.0'))).toBeLessThan(0)
		expect(compareVersions(v('1.0.0'), v('1.0.0-rc.1'))).toBeGreaterThan(0)
		expect(compareVersions(v('1.0.0-rc.2'), v('1.0.0-rc.10'))).toBeLessThan(0)
		expect(compareVersions(v('1.0.0-alpha'), v('1.0.0-alpha.1'))).toBeLessThan(0)
		expect(compareVersions(v('1.0.0-1'), v('1.0.0-alpha'))).toBeLessThan(0)
	})

	it('ignores build metadata', () => {
		expect(compareVersions(v('1.2.3+abc'), v('1.2.3'))).toBe(0)
	})
})

describe('inRange', () => {
	it('reads the single comparators advisories are written with', () => {
		expect(inRange('3.0.2', '<3.0.3')).toBe(true)
		expect(inRange('3.0.3', '<3.0.3')).toBe(false)
		expect(inRange('3.0.3', '<=3.0.3')).toBe(true)
		expect(inRange('4.0.0', '>=4.0.0')).toBe(true)
		expect(inRange('1.2.3', '=1.2.3')).toBe(true)
		expect(inRange('1.2.3', '1.2.4')).toBe(false)
	})

	it('treats spaces as AND, with or without a space after the operator', () => {
		expect(inRange('2.1.0', '>=2.0.0 <2.3.1')).toBe(true)
		expect(inRange('2.3.1', '>=2.0.0 <2.3.1')).toBe(false)
		expect(inRange('1.9.9', '>= 2.0.0 < 2.3.1')).toBe(false)
		expect(inRange('2.2.0', '>= 2.0.0, < 2.3.1')).toBe(true)
	})

	it('treats || as OR', () => {
		const range = '<1.4.6 || >=2.0.0 <2.1.3'
		expect(inRange('1.4.5', range)).toBe(true)
		expect(inRange('1.5.0', range)).toBe(false)
		expect(inRange('2.1.2', range)).toBe(true)
		expect(inRange('2.1.3', range)).toBe(false)
	})

	it('matches everything for *', () => {
		expect(inRange('0.0.1', '*')).toBe(true)
	})

	it('says it cannot read what it cannot read, rather than guessing no', () => {
		expect(inRange('1.2.3', '~1.2.0')).toBeNull()
		expect(inRange('1.2.3', '1.x')).toBeNull()
		expect(inRange('not-a-version', '<1.0.0')).toBeNull()
	})
})

describe('applicable', () => {
	const advisory = (over: Partial<Advisory>): Advisory => ({
		id: 1,
		url: 'https://github.com/advisories/GHSA-test',
		title: 'test',
		severity: 'high',
		vulnerable_versions: '<1.0.0',
		...over,
	})

	it('drops advisories for versions not installed, should the registry send them', () => {
		const found = applicable(
			{ braces: ['3.0.3'] },
			{ braces: [advisory({ vulnerable_versions: '<3.0.3' }), advisory({ id: 2, vulnerable_versions: '<=3.0.3' })] },
		)
		expect(found.map((f) => f.advisory.id)).toEqual([2])
	})

	it('checks every installed version of a package', () => {
		const found = applicable({ x: ['0.9.0', '1.2.0'] }, { x: [advisory({})] })
		expect(found).toEqual([{ name: 'x', version: '0.9.0', advisory: advisory({}) }])
	})

	it('keeps an unreadable range, marked as such', () => {
		const [found] = applicable({ x: ['1.0.0'] }, { x: [advisory({ vulnerable_versions: '^1.0.0' })] })
		expect(found?.unparsed).toBe(true)
	})

	it('puts the worst first', () => {
		const found = applicable(
			{ a: ['0.1.0'], b: ['0.1.0'] },
			{ a: [advisory({ severity: 'low' })], b: [advisory({ severity: 'critical' })] },
		)
		expect(found.map((f) => f.name)).toEqual(['b', 'a'])
	})

	it('ignores advisories for packages it was not asked about', () => {
		expect(applicable({}, { x: [advisory({})] })).toEqual([])
	})
})

describe('packageFromPath', () => {
	it('names the package a source file came from', () => {
		expect(packageFromPath('/r/node_modules/h3/dist/index.mjs')).toEqual({ name: 'h3', root: '/r/node_modules/h3' })
		expect(packageFromPath('/r/node_modules/@nuxt/ui/dist/a.js')).toEqual({ name: '@nuxt/ui', root: '/r/node_modules/@nuxt/ui' })
	})

	it('takes the innermost package of a nested install', () => {
		expect(packageFromPath('/r/node_modules/a/node_modules/b/x.js')?.name).toBe('b')
	})

	it('is null for project source and for node_modules/.cache', () => {
		expect(packageFromPath('/r/server/routes/healthz.get.ts')).toBeNull()
		expect(packageFromPath('/r/node_modules/.cache/nuxt/x.mjs')).toBeNull()
		expect(packageFromPath('/r/node_modules/@scope')).toBeNull()
	})
})
