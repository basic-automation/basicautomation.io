import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '~~/shared/markdown/render'

/**
 * The README renderer runs on the server's one thread, on markdown fetched
 * from repos at request time. Before marked 18.1.0 a link destination opening
 * on a run of unicode whitespace backtracked cubically
 * (https://github.com/markedjs/marked/pull/4106): `[](` and 4 KB of U+00A0
 * took 10.3 s to render here, so one README edit could stall every page the
 * process serves. 18.1.0 renders it in well under a millisecond. This holds
 * the renderer to that, so a downgrade or a regression upstream fails CI
 * rather than the site.
 */
describe('renderMarkdown backtracking', () => {
	for (const space of [' ', ' ', ' ']) {
		it(`renders a link destination of 8 KB of U+${space.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} in linear time`, async () => {
			const started = performance.now()
			for (const kind of ['readme', 'post'] as const) {
				await renderMarkdown('[](' + space.repeat(8192), kind)
			}
			expect(performance.now() - started).toBeLessThan(500)
		})
	}
})
