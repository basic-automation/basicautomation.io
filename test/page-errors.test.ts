import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A page's 404 is `fatal: import.meta.client`, never `fatal: true`. `fatal`
 * only matters in the client, where it is what shows the error page after an
 * in-app navigation; on the server Nitro answers it with a dozen-line stack
 * trace in the request log, beside the one structured line the 404 already
 * gets. The blog pages arrived after the rest were fixed and brought it back,
 * so a stack per unknown post until 2026-10-02.
 */
const PAGES = join(__dirname, '..', 'app', 'pages')

function vueFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return vueFiles(path)
		return entry.name.endsWith('.vue') ? [path] : []
	})
}

describe('page errors', () => {
	it.each(vueFiles(PAGES).map((f) => [relative(PAGES, f), f]))('%s does not throw a server-side fatal', (_, file) => {
		expect(readFileSync(file, 'utf8')).not.toMatch(/fatal:\s*true/)
	})
})
