import { describe, expect, it } from 'vitest'
import { toDoc } from '~~/server/utils/projectDocs'
import { docPath, docsIndexPath } from '~~/shared/docs/path'

describe('toDoc', () => {
	const file = (front: string, body = '# Title\n\nBody.\n') => `---\n${front}\n---\n\n${body}`

	it('reads the front matter and leaves the body', () => {
		const doc = toDoc('weftdb', 'release-plan', file('title: "1.0 release plan"\nsummary: "One sequence."\norder: 6\ngroup: Release'))
		expect(doc).toMatchObject({ project: 'weftdb', slug: 'release-plan', title: '1.0 release plan', summary: 'One sequence.', order: 6, group: 'Release' })
		expect(doc?.body.trim()).toBe('# Title\n\nBody.')
	})

	it('is not a page without a title', () => {
		expect(toDoc('weftdb', 'x1', file('summary: "No title."'))).toBeNull()
		expect(toDoc('weftdb', 'x1', '# Just markdown\n')).toBeNull()
	})

	it('sorts an unnumbered page last, not first', () => {
		expect(toDoc('weftdb', 'x1', file('title: A'))?.order).toBe(9999)
		expect(toDoc('weftdb', 'x1', file('title: A\norder: soon'))?.order).toBe(9999)
	})

	it('falls back to a group name', () => {
		expect(toDoc('weftdb', 'x1', file('title: A'))?.group).toBe('Documentation')
	})
})

describe('docs paths', () => {
	it('hangs pages under their project', () => {
		expect(docsIndexPath('weftdb')).toBe('/projects/weftdb/docs')
		expect(docPath('weftdb', 'release-plan')).toBe('/projects/weftdb/docs/release-plan')
	})
})
