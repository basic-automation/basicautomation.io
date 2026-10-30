/**
 * A docs page mirrored from a file in the project's own repository.
 *
 * Some pages under `project-docs/` are written for the site; others already
 * exist in the project's repo (an honesty page, a benchmark report) and a copy
 * kept by hand drifts the day the repo changes. Those are listed on the
 * project (`repoDocs` in `data/projects.ts`) and written by `npm run sync`:
 * the file as it is on the default branch, with the front matter the docs tab
 * needs, its relative links pointed back at the repo, and a line saying where
 * it came from. The result is committed like the rest of the snapshot, so the
 * build never fetches it.
 */
import { absolutize } from './readme.ts'

export interface RepoDoc {
	/** Path of the source file in the repo, from its root: `HONESTY.md`, `bench/reports/x/README.md` */
	path: string
	/** Page slug: written to `project-docs/<project>/<slug>.md` */
	slug: string
	/** The front matter `toDoc` reads (`server/utils/projectDocs.ts`) */
	title: string
	summary: string
	order: number
	group: string
}

/** A front-matter value, escaped the way `parseFrontMatter` undoes: `\` first, then `"`. */
function quoted(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** The page file for `doc`, from `markdown`, the file's text on `branch`. */
export function repoDocPage(markdown: string, doc: RepoDoc, org: string, repo: string, branch: string): string {
	const dir = doc.path.includes('/') ? doc.path.slice(0, doc.path.lastIndexOf('/')) : ''
	const source = `https://github.com/${org}/${repo}/blob/${branch}/${doc.path}`
	const note = `*This page is [\`${doc.path}\`](${source}) from the ${repo} repository, copied here when the site is synced. If the two disagree, the repository is right.*`

	let body = absolutize(markdown.replace(/\r\n/g, '\n').trim(), org, repo, branch, dir)
	// The note goes under the file's own title when it has one, so the page
	// still opens with its heading.
	const h1 = body.match(/^# [^\n]*\n/)
	body = h1 ? `${h1[0]}\n${note}\n\n${body.slice(h1[0].length).trimStart()}` : `${note}\n\n${body}`

	return [
		'---',
		`title: ${quoted(doc.title)}`,
		`summary: ${quoted(doc.summary)}`,
		`order: ${doc.order}`,
		`group: ${quoted(doc.group)}`,
		`source: ${quoted(source)}`,
		'generated: "npm run sync; edit the source, not this file"',
		'---',
		'',
		body,
		'',
	].join('\n')
}
