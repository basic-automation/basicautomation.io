import { describe, expect, it } from 'vitest'
import { absolutize, stripLeadingLogo } from '~~/shared/markdown/readme'

const ORG = 'basic-automation'
const RAW = `https://raw.githubusercontent.com/${ORG}/onyums/main/`
const BLOB = `https://github.com/${ORG}/onyums/blob/main/`

const rewrite = (md: string) => absolutize(md, ORG, 'onyums', 'main')

describe('absolutize', () => {
	it('sends images to raw and links to the blob view', () => {
		expect(rewrite('![shot](./docs/shot.png)')).toBe(`![shot](${RAW}docs/shot.png)`)
		expect(rewrite('[the design note](./docs/onion.md)')).toBe(`[the design note](${BLOB}docs/onion.md)`)
	})

	it('treats a repo-rooted path the same as a ./ path', () => {
		expect(rewrite('![x](/logo.svg)')).toBe(`![x](${RAW}logo.svg)`)
		expect(rewrite('![x](logo.svg)')).toBe(`![x](${RAW}logo.svg)`)
	})

	it('rewrites src on an HTML img, which READMEs use for sizing', () => {
		expect(rewrite('<img src="./shot.png" width="600">')).toBe(`<img src="${RAW}shot.png" width="600">`)
		expect(rewrite("<IMG ALT='a' SRC='shot.png'>")).toBe(`<IMG ALT='a' SRC='${RAW}shot.png'>`)
	})

	it('leaves alone anything that already stands on its own', () => {
		for (const url of [
			'https://example.com/x.png',
			'http://example.com/x.png',
			'//cdn.example.com/x.png',
			'mailto:someone@example.com',
			'data:image/gif;base64,R0lGOD',
			'#a-heading-in-this-readme',
		]) {
			expect(rewrite(`[t](${url})`)).toBe(`[t](${url})`)
		}
	})

	it('does not send an image link to the blob view as well', () => {
		// The link pass runs after the image pass and must not match `![…](…)`.
		// A badge — an image wrapped in a link — is the case that catches this.
		expect(rewrite('[![build](./badge.svg)](./ci.yml)'))
			.toBe(`[![build](${RAW}badge.svg)](${BLOB}ci.yml)`)
	})

	it('rewrites every occurrence, not just the first', () => {
		expect(rewrite('![a](./a.png) and ![b](./b.png) and [c](./c.md)'))
			.toBe(`![a](${RAW}a.png) and ![b](${RAW}b.png) and [c](${BLOB}c.md)`)
	})

	it('carries the branch, because not every repo is on main', () => {
		expect(absolutize('![x](./a.png)', ORG, 'Skidbladnir', 'master'))
			.toBe(`![x](https://raw.githubusercontent.com/${ORG}/Skidbladnir/master/a.png)`)
	})

	it('does not blow up on pathological input', () => {
		// This runs over somebody else's README, so a pattern that backtracks
		// exponentially is an outage. A thousand unclosed image openings is the
		// shape that would find one.
		const nasty = `${'!['.repeat(1000)}x`
		const started = performance.now()
		expect(rewrite(nasty)).toBe(nasty)
		expect(performance.now() - started).toBeLessThan(200)
	})

	it('leaves a link with a title alone rather than mangling it', () => {
		// The URL group stops at whitespace, so `(./a.md "Title")` is matched with
		// a space as the tail. Rewriting the path and keeping the title is right;
		// swallowing the title would not be.
		expect(rewrite('[t](./a.md "Title")')).toBe(`[t](${BLOB}a.md "Title")`)
	})
})

describe('stripLeadingLogo', () => {
	it('drops a leading logo or banner image', () => {
		expect(stripLeadingLogo('![logo](./logo.svg)\n\n# onyums')).toBe('# onyums')
		expect(stripLeadingLogo('![](./assets/banner.png)\n\n# onyums')).toBe('# onyums')
	})

	it('drops the <br> run some READMEs put under the logo', () => {
		expect(stripLeadingLogo('![logo](./logo.svg)\n<br>\n<br/>\n\n# onyums')).toBe('# onyums')
	})

	it('keeps an image that is not the logo, and one that is not leading', () => {
		expect(stripLeadingLogo('![a screenshot](./shot.png)\n\n# onyums'))
			.toBe('![a screenshot](./shot.png)\n\n# onyums')
		expect(stripLeadingLogo('# onyums\n\n![logo](./logo.svg)'))
			.toBe('# onyums\n\n![logo](./logo.svg)')
	})

	it('only drops one, so a second logo image stays visible', () => {
		expect(stripLeadingLogo('![logo](./logo.svg)\n![logo](./logo2.svg)\n# t'))
			.toBe('![logo](./logo2.svg)\n# t')
	})
})
