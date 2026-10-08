import { Marked } from 'marked'
import { createSlugger } from './slug.ts'
import { postHeading, readmeHeading } from './heading.ts'
import { lazyImages } from './readme.ts'
import { highlight } from './highlight.ts'

/**
 * Markdown to HTML, in this site's palette.
 *
 * Shared by the project READMEs and the blog, so a code fence in a post reads
 * exactly like a code fence in a README — same grammars, same theme, same
 * heading anchors. It lived inside `github.ts` until the blog needed it, then
 * in `server/utils/` until `npm run sync` needed it too: the snapshot had its
 * own `marked` set-up with no highlighter, so a page served from the fallback
 * lost every README's syntax colours. One renderer, so a fallback that takes
 * over renders what the live path would have.
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
      // Every link out of rendered markdown carries `noreferrer noopener`.
      //
      // `shared/html/rel.ts` has a finer rule for the page's own curated links
      // — `noopener` alone for the organisation's repos on the clearnet, so
      // GitHub's "Referring sites" can still credit the visit — and that rule
      // cannot be applied here. It depends on the origin the page is being
      // served from, and this HTML is rendered once and then cached, snapshotted
      // and served over BOTH the clearnet site and the onion. A rel baked in at
      // render time is wrong for one of them.
      //
      // So it takes the private form unconditionally. Over the onion the origin
      // is the `.onion` address and `Referrer-Policy` sends the origin on every
      // cross-origin request, so without this a README's links told gitlab,
      // crates.io and everyone else that the reader came from the hidden
      // service. The cost is the referral credit on an own-repo link inside
      // README prose on the clearnet, which is the smaller thing to lose.
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        const t = title ? ` title="${title.replace(/"/g, '&quot;')}"` : ''
        return `<a href="${href}"${t} rel="noreferrer noopener">${text}</a>`
      },
    },
  })

  // A README is folded away on its page, so its images wait until it is
  // opened; a post is the page, and its first image may be what a reader
  // sees first. See shared/markdown/readme.ts.
  const parsed = collecting.parse(md) as string
  const html = kind === 'readme' ? lazyImages(parsed) : parsed
  if (!fences.length) return html

  const rendered = await Promise.all(fences.map((f) => highlight(f.code, f.lang)))
  return html.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => rendered[Number(i)] ?? '')
}
