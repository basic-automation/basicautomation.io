/**
 * A page of a project's documentation, as both halves of the app see it.
 *
 * Shared for the same reason `Post` is: the pages need the shape, and Nitro's
 * auto-imports do not reach the Vue side.
 */
export interface Doc {
  /** Project slug this page belongs to. */
  project: string
  /** URL segment, from the file name. */
  slug: string
  title: string
  /** One or two sentences for the list and the meta description. */
  summary: string
  /** Where it sorts within the whole listing; lower first. */
  order: number
  /** The heading it is listed under on the docs index. */
  group: string
  /** Markdown, front matter removed. */
  body: string
}

/** A page without its body — what the index carries. */
export type DocSummary = Omit<Doc, 'body'>
