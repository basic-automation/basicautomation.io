import { describe, expect, it } from 'vitest'
import { serialise } from '~~/server/utils/adminPosts'
import { parseFrontMatter } from '~~/server/utils/posts'

/**
 * The writer and the reader have to agree.
 *
 * `serialise` quotes every front-matter value and escapes `\` and `"` inside
 * it; the editor's own loader undoes both. The server's reader used to strip
 * the quotes and stop, so a title containing a quote reached the page with
 * literal backslashes in it — in the h1, the `<title>`, the card, the feed and
 * the JSON-LD, everywhere but the editor the author was looking at.
 *
 * These round-trip through the real `serialise`, so the test cannot drift from
 * the encoding it is checking.
 */
const read = (post: Parameters<typeof serialise>[0]) => parseFrontMatter(serialise(post)).data

const base = {
  project: 'artiqwest',
  slug: 'a-post',
  title: 'untitled',
  date: '2026-10-05T00:00:00.000Z',
  summary: '',
  draft: false,
  body: 'Body.',
}

describe('front matter round trip', () => {
  it('brings a title containing quotes back unescaped', () => {
    expect(read({ ...base, title: 'The "basic" way' }).title).toBe('The "basic" way')
  })

  it('brings a backslash back as one backslash', () => {
    expect(read({ ...base, title: 'a', summary: 'A C:\\path note' }).summary).toBe('A C:\\path note')
  })

  it('survives a quote and a backslash together, in either order', () => {
    for (const v of ['a\\"b', 'a"\\b', '\\', '"', '\\\\', 'ends with a backslash\\']) {
      expect(read({ ...base, title: v }).title).toBe(v)
    }
  })

  it('still handles the colon that the quoting was added for', () => {
    expect(read({ ...base, title: 'onyums 0.5.0: no C' }).title).toBe('onyums 0.5.0: no C')
  })

  it('leaves a hand-written single-quoted value alone, escaping and all', () => {
    // Nothing emits single quotes, so there is no escaping to undo in one.
    const { data } = parseFrontMatter('---\ntitle: \'a \\" b\'\n---\nBody.\n')
    expect(data.title).toBe('a \\" b')
  })
})
