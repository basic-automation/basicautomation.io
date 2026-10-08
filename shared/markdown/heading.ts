/**
 * How a fetched README's headings are rendered into a page that already has
 * headings of its own.
 *
 * Two things have to be true at once, and they pull against each other.
 *
 * A README starts with `# ProjectName`, which is an `<h1>`. The project page
 * already has one — the wordmark — so rendering the README verbatim gives the
 * document two top-level headings, and a screen reader offers two answers to
 * "what is this page about". So every heading is demoted a level, which nests
 * the whole README under the page's own `h1` where it belongs.
 *
 * But the README's own table of contents links to `#anchors` GitHub minted from
 * the heading TEXT, and those must not move. So the level changes and the id
 * does not.
 *
 * Both callers render READMEs — `server/utils/github.ts` at request time and
 * `scripts/fetch-projects.mjs` into the snapshot — and a snapshot whose
 * headings nest differently from the live path is a fallback that reshapes the
 * page the day it takes over. Hence one copy, here.
 */

/** HTML stops at `h6`, so a README nested six deep flattens rather than breaks. */
export const MAX_HEADING = 6

/** `#` becomes `h2`, `##` becomes `h3`, and `######` stays `h6`. */
export function demote(depth: number): number {
	return Math.min(depth + 1, MAX_HEADING)
}

interface HeadingToken {
	tokens: unknown[]
	depth: number
	text: string
}

/** Marked calls this with itself as `this`, which is where the parser lives. */
interface RendererThis {
	parser: { parseInline: (tokens: never[]) => string }
}

/**
 * The `heading` renderer for `marked`, given a per-document slugger.
 *
 * The slug comes from the heading's raw text, never from the rendered inline
 * HTML: `Identity & address helpers` renders as `&amp;`, and slugging that
 * gives `identity-amp-address-helpers` instead of the `identity--address-helpers`
 * GitHub minted and the README links to.
 */
export function readmeHeading(slug: (text: string) => string) {
	return markdownHeading(slug, demote)
}

/**
 * A blog post's headings keep their own level, except that a stray `#` is
 * lifted to `h2`.
 *
 * A post is not a README. Its title is not in the body — it is front matter,
 * rendered as the page's `h1` — so the body is written from `##` down, and
 * `##` already means "a section under the title". Demoting it the README way
 * made every section an `h3` straight under the `h1`, which is the skipped
 * level axe's `heading-order` reports. A `#` in a post would be a second `h1`,
 * so it becomes an `h2` like the sections beside it.
 */
export function underTitle(depth: number): number {
	return Math.min(Math.max(depth, 2), MAX_HEADING)
}

/** The `heading` renderer for a post. Same anchors as a README's. */
export function postHeading(slug: (text: string) => string) {
	return markdownHeading(slug, underTitle)
}

/**
 * The five entities marked escapes in text. Decoded before slugging, because
 * `slugify` strips punctuation: left encoded, the `&` in "First launch &
 * troubleshooting" reaches it as `&amp;` and the anchor becomes
 * `first-launch-amp-troubleshooting` instead of GitHub's
 * `first-launch--troubleshooting`.
 */
const ENTITIES: Record<string, string> = {
	'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'',
}

/**
 * A heading's text content, as GitHub mints its anchor from.
 *
 * The anchor used to be slugged from the heading's raw markdown, so a heading
 * that contains a link — `## [Configuration](./docs/config.md)` — baked the URL
 * into its own id (`configurationhttpsgithubcom…`) and the README's own
 * contents link to `#configuration` missed it. Slugging the rendered HTML
 * instead gives the text the reader sees, which is what the link was written
 * against.
 */
function headingText(innerHtml: string): string {
	return innerHtml
		.replace(/<[^<>]*>/g, '')
		.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e)
}

function markdownHeading(slug: (text: string) => string, levelFor: (depth: number) => number) {
	return function heading(this: RendererThis, { tokens, depth }: HeadingToken): string {
		const level = levelFor(depth)
		const inner = this.parser.parseInline(tokens as never[])
		return `<h${level} id="${slug(headingText(inner))}">${inner}</h${level}>\n`
	}
}
