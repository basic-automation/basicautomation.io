/**
 * GitHub's heading-anchor algorithm.
 *
 * A README's own table of contents links to `#its-own-headings`, and those
 * anchors were minted by GitHub. `marked` puts no `id` on a heading at all, so
 * unless the site reproduces the same slug, every contents list it renders
 * points at nothing.
 *
 * The rule, as github-slugger implements it: lowercase, drop HTML, drop
 * punctuation but keep `-` and `_`, then turn each remaining whitespace
 * character into a hyphen. Note "each" — runs of spaces are NOT collapsed,
 * which is why "First launch & troubleshooting" becomes
 * `first-launch--troubleshooting` with two hyphens where the ampersand was.
 */

/** Punctuation GitHub strips. `-` and `_` are deliberately not in the set. */
// eslint-disable-next-line no-useless-escape
const PUNCTUATION = /[ -⁯⸀-⹿\\'!"#$%&()*+,.\/:;<=>?@\[\]^`{|}~]/g

export function slugify(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION, '')
    .replace(/\s/g, '-')
}

/**
 * A slugger with memory, one per document: two headings with the same words
 * get `-1`, `-2` after the first, exactly as GitHub numbers them.
 */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text: string) => {
    const base = slugify(text)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}-${n}`
  }
}
