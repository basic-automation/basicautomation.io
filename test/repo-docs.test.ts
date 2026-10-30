import { describe, expect, it } from 'vitest'
import { projects } from '~~/data/projects'
import { toDoc } from '~~/server/utils/projectDocs'
import { absolutize } from '~~/shared/markdown/readme'
import { repoDocPage, type RepoDoc } from '~~/shared/markdown/repoDoc'

const ORG = 'basic-automation'
const BLOB = `https://github.com/${ORG}/weftdb/blob/main/`
const RAW = `https://raw.githubusercontent.com/${ORG}/weftdb/main/`

const doc: RepoDoc = { path: 'bench/reports/evi-15/README.md', slug: 'cross-engine-report', title: 'Report: "first" run', summary: 'A \\ summary.', order: 7.5, group: 'Benchmarks' }

describe('absolutize from a file below the root', () => {
	const rewrite = (md: string) => absolutize(md, ORG, 'weftdb', 'main', 'bench/reports/evi-15')

	it('resolves a relative path against the file\'s own directory', () => {
		expect(rewrite('[report](report.md)')).toBe(`[report](${BLOB}bench/reports/evi-15/report.md)`)
		expect(rewrite('[report](./report.md)')).toBe(`[report](${BLOB}bench/reports/evi-15/report.md)`)
		expect(rewrite('![chart](chart.svg)')).toBe(`![chart](${RAW}bench/reports/evi-15/chart.svg)`)
	})

	it('follows .. up the tree, and / to the root', () => {
		expect(rewrite('[decisions](../../../DECISIONS.md)')).toBe(`[decisions](${BLOB}DECISIONS.md)`)
		expect(rewrite('[honesty](/HONESTY.md)')).toBe(`[honesty](${BLOB}HONESTY.md)`)
	})

	it('leaves anchors and absolute URLs alone', () => {
		expect(rewrite('[up](#results)')).toBe('[up](#results)')
		expect(rewrite('[uci](https://archive.ics.uci.edu/)')).toBe('[uci](https://archive.ics.uci.edu/)')
	})
})

describe('repoDocPage', () => {
	const page = repoDocPage('# EVI-15\r\n\r\nSee [the report](report.md).\r\n', doc, ORG, 'weftdb', 'main')

	it('writes front matter the docs tab reads back exactly', () => {
		expect(toDoc('weftdb', doc.slug, page)).toMatchObject({ title: doc.title, summary: doc.summary, order: 7.5, group: 'Benchmarks' })
	})

	it('keeps the title first and says where the page came from', () => {
		const body = toDoc('weftdb', doc.slug, page)!.body.trim()
		expect(body.startsWith('# EVI-15\n\n*This page is [`bench/reports/evi-15/README.md`]')).toBe(true)
		expect(body).toContain(`(${BLOB}bench/reports/evi-15/README.md)`)
		expect(body).toContain(`[the report](${BLOB}bench/reports/evi-15/report.md)`)
		expect(body).not.toContain('\r')
	})

	it('puts the note first when the file has no title', () => {
		expect(toDoc('weftdb', 'x1', repoDocPage('Just text.', doc, ORG, 'weftdb', 'main'))!.body.trim().startsWith('*This page is')).toBe(true)
	})
})

describe('repoDocs on the catalogue', () => {
	it('is only set on projects with a docs tab, with unique page slugs', () => {
		for (const p of projects.filter((p) => p.repoDocs?.length)) {
			expect(p.docs, p.slug).toBe(true)
			const slugs = p.repoDocs!.map((d) => d.slug)
			expect(new Set(slugs).size, p.slug).toBe(slugs.length)
		}
	})
})
