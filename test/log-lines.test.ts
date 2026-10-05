import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { logLine } from '~~/shared/log/event'

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name)
		if (e.isDirectory()) return sources(p)
		return /\.(ts|vue)$/.test(e.name) ? [p] : []
	})
}

describe('logLine', () => {
	it('writes one JSON object with t, level, event and message', () => {
		const line = logLine('warn', 'upstream.fetch_failed', 'Nanna fetch failed', { repo: 'Nanna' })
		expect(line).not.toContain('\n')
		const parsed = JSON.parse(line)
		expect(parsed).toMatchObject({ level: 'warn', event: 'upstream.fetch_failed', message: 'Nanna fetch failed', repo: 'Nanna' })
		expect(Number.isNaN(Date.parse(parsed.t))).toBe(false)
	})

	it('does not let a field overwrite the message', () => {
		expect(JSON.parse(logLine('info', 'x', 'kept', { message: 'lost' })).message).toBe('kept')
	})
})

describe('server log lines', () => {
	it('every console call in server/ and shared/ writes JSON', () => {
		const offenders: string[] = []
		for (const file of [...sources('server'), ...sources('shared')]) {
			readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
				const call = text.match(/console\.(log|info|warn|error)\((.*)/)
				if (!call) return
				if (call[2].startsWith('JSON.stringify(')) return
				if (file.endsWith(join('shared', 'log', 'event.ts')) && call[2].startsWith('line)')) return
				offenders.push(`${file}:${i + 1}`)
			})
		}
		expect(offenders, 'use logEvent() from shared/log/event.ts').toEqual([])
	})
})
