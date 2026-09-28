/**
 * A blog post, as both halves of the app see it.
 *
 * Shared rather than defined in `server/utils/posts.ts` because the pages need
 * the shape too, and Nitro's auto-imports do not reach the Vue side.
 */
export interface Post {
  /** Project slug this post belongs to. */
  project: string
  /** URL segment, from the file name. */
  slug: string
  title: string
  /** ISO 8601. */
  date: string
  /** One or two sentences for the list and the meta description. */
  summary: string
  /** Hidden from every listing and from the feed; reachable only by URL. */
  draft: boolean
  /** Markdown, front matter removed. */
  body: string
}

/** A post without its body — what every listing carries. */
export type PostSummary = Omit<Post, 'body'>
