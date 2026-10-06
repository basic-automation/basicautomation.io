import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '~~/shared/markdown/render'
import { absolutize, lazyImages, stripLeadingLogo } from '~~/shared/markdown/readme'
import { slugify } from '~~/shared/markdown/slug'

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

/**
 * …and this site's own patterns over the same README. Each input below never
 * closes what it opens, which is what made a pattern re-scan the rest of the
 * README from every start: at 100 KB they took 0.4–5.2 s each before
 * `shared/markdown/readme.ts` and `slug.ts` were made linear, and take about a
 * millisecond after.
 */
describe('README preparation backtracking', () => {
	const KB100 = (s: string) => s.repeat(Math.floor(100_000 / s.length))
	const cases: [string, () => unknown][] = [
		['absolutize, a run of `![`', () => absolutize(KB100('!['), 'o', 'r', 'main')],
		['absolutize, a run of `[`', () => absolutize(KB100('['), 'o', 'r', 'main')],
		['absolutize, a run of `[a](`', () => absolutize(KB100('[a]('), 'o', 'r', 'main')],
		['absolutize, a run of `<img `', () => absolutize(KB100('<img '), 'o', 'r', 'main')],
		['absolutize, a run of `<a `', () => absolutize(KB100('<a '), 'o', 'r', 'main')],
		['stripLeadingLogo, a logo URL with no `)`', () => stripLeadingLogo('![](' + KB100('logo'))],
		['lazyImages, a run of `<img `', () => lazyImages(KB100('<img '))],
		['slugify, a run of `<`', () => slugify(KB100('<'))],
	]
	for (const [name, run] of cases) {
		it(name, () => {
			const started = performance.now()
			run()
			expect(performance.now() - started).toBeLessThan(100)
		})
	}

	it('renders a 100 KB heading of unclosed tags in linear time', async () => {
		const started = performance.now()
		await renderMarkdown('# ' + KB100('<a'))
		expect(performance.now() - started).toBeLessThan(500)
	})
})

describe('what linear patterns cost', () => {
	const rewrite = (md: string) => absolutize(md, 'o', 'r', 'main')

	it('still rewrites a link or image whose URL ends the README', () => {
		expect(rewrite('[docs](./docs.md')).toBe('[docs](https://github.com/o/r/blob/main/docs.md')
		expect(rewrite('![x](shot.png')).toBe('![x](https://raw.githubusercontent.com/o/r/main/shot.png')
	})

	it('reads `![a [b](x)` as text and a link, the way marked renders it', () => {
		expect(rewrite('![a [b](x.md)')).toBe('![a [b](https://github.com/o/r/blob/main/x.md)')
	})

	it('keeps a stray `<` out of the tag after it — GitHub slugs `a < <b>bold</b>` from the text "a < bold"', () => {
		expect(slugify('a < <b>bold</b>')).toBe('a--bold')
		expect(lazyImages('<<img src="x">')).toBe('<<img loading="lazy" decoding="async" src="x">')
	})
})
