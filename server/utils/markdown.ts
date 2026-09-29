import { Marked } from 'marked'
import { createSlugger } from '~~/shared/markdown/slug'
import { postHeading, readmeHeading } from '~~/shared/markdown/heading'

/**
 * Markdown to HTML, in this site's palette.
 *
 * Shared by the project READMEs and the blog, so a code fence in a post reads
 * exactly like a code fence in a README — same grammars, same theme, same
 * heading anchors. It lived inside `github.ts` until the blog needed it; the
 * behaviour is unchanged, only its address.
 */

/**
 * README code fences go through the same highlighter as the site's own
 * examples, so a repo's code reads the same as the code beside it. Shiki is
 * async to initialise, so fences are collected on the first pass and swapped in
 * on a second — `marked` itself stays synchronous.
 *
 * Headings carry GitHub's own anchor, so a README's table of contents still
 * works once it is rendered here, and are demoted a level so the README nests
 * under the page's own h1. The slugger is per-document: duplicate heading text
 * numbers from 1 within one README, not across all of them.
 */
export async function renderMarkdown(md: string, kind: 'readme' | 'post' = 'readme'): Promise<string> {
  const fences: { lang: string | undefined, code: string }[] = []
  const slug = createSlugger()

  const collecting = new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      code({ text, lang }) {
        fences.push({ lang, code: text })
        return `\u0000FENCE${fences.length - 1}\u0000`
      },
      // A README is demoted a level so it nests under the page's own h1, with
      // the ids left where GitHub minted them; a post is already written under
      // its title and keeps its levels. See shared/markdown/heading.ts.
      heading: kind === 'post' ? postHeading(slug) : readmeHeading(slug),
    },
  })

  const html = collecting.parse(md) as string
  if (!fences.length) return html

  const rendered = await Promise.all(fences.map((f) => highlight(f.code, f.lang)))
  return html.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => rendered[Number(i)] ?? '')
}
