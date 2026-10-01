/**
 * Writing posts.
 *
 * Split from `posts.ts` deliberately: reading is done on every request by
 * anyone, writing is done rarely by one authenticated person, and the two
 * having separate files makes it obvious which routes touch which.
 *
 * # What guards this
 *
 * The app itself. Every route under `server/api/admin/` calls `requireEditor`
 * (`server/utils/adminGuard.ts`) before it does anything: it refuses the onion
 * gateway outright and checks the editor's credential on everything else.
 * Caddy's basic auth in front is a second lock on the public way in, not the
 * one these functions depend on. Still, the validation below does not lean on
 * either: `postPath` re-derives and re-checks the path on every call, and a
 * body that fails `parsePost` is refused rather than written and fixed later.
 *
 * The original plan was to gate this on the onion address instead. That was
 * wrong and the reason is worth recording: the onion address is printed on two
 * of this site's own pages, so it is not a secret and "reachable only over Tor"
 * is a routing requirement, not an authentication one.
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { SLUG, invalidatePosts, postPath } from './posts'

/** Bound what a single post can be. Generous for prose, finite for a file. */
const MAX_BODY = 512 * 1024
const MAX_TITLE = 200
const MAX_SUMMARY = 500

export interface PostInput {
  project: string
  slug: string
  title: string
  date: string
  summary: string
  draft: boolean
  body: string
}

/**
 * Validate a request body into something writable, or explain what is wrong.
 *
 * Returns the reason rather than throwing so the route can decide the status
 * code, and so the message reaching the editor says which field to fix.
 */
export function parsePost(raw: unknown): { ok: true, post: PostInput } | { ok: false, reason: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'expected an object' }
  const d = raw as Record<string, unknown>

  const project = typeof d.project === 'string' ? d.project.trim() : ''
  const slug = typeof d.slug === 'string' ? d.slug.trim().toLowerCase() : ''
  const title = typeof d.title === 'string' ? d.title.trim() : ''
  const summary = typeof d.summary === 'string' ? d.summary.trim() : ''
  const body = typeof d.body === 'string' ? d.body : ''
  const draft = d.draft === true
  const date = typeof d.date === 'string' && d.date.trim() ? d.date.trim() : new Date().toISOString()

  if (!SLUG.test(slug)) {
    return { ok: false, reason: 'slug must be lowercase letters, digits and hyphens, 2–80 characters, not starting or ending with a hyphen' }
  }
  // `postPath` is the authority on whether the project exists and whether the
  // pair names a file inside the content directory. Asking it here means the
  // check cannot drift from the one the writer uses.
  if (!postPath(project, slug)) return { ok: false, reason: 'unknown project' }

  if (!title) return { ok: false, reason: 'a title is required' }
  if (title.length > MAX_TITLE) return { ok: false, reason: `title must be ${MAX_TITLE} characters or fewer` }
  if (summary.length > MAX_SUMMARY) return { ok: false, reason: `summary must be ${MAX_SUMMARY} characters or fewer` }
  if (Number.isNaN(Date.parse(date))) return { ok: false, reason: 'date is not a date' }
  if (body.length > MAX_BODY) return { ok: false, reason: `body must be ${Math.round(MAX_BODY / 1024)} KB or less` }

  return { ok: true, post: { project, slug, title, date: new Date(date).toISOString(), summary, draft, body } }
}

/**
 * Front matter that survives a round trip through the reader.
 *
 * Values are quoted and any quote inside them escaped, because the reader
 * strips one layer of matching quotes and a title containing `: ` would
 * otherwise come back truncated at the colon.
 */
function frontMatter(post: PostInput): string {
  const q = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return [
    '---',
    `title: ${q(post.title)}`,
    `date: ${q(post.date)}`,
    `summary: ${q(post.summary)}`,
    `draft: ${post.draft ? 'true' : 'false'}`,
    '---',
    '',
  ].join('\n')
}

export function serialise(post: PostInput): string {
  return `${frontMatter(post)}${post.body.replace(/\r\n/g, '\n').trimStart()}\n`
}

/**
 * Write a post, atomically.
 *
 * Rename rather than a plain write because the reader may be mid-request: a
 * partially written file would either fail to parse and vanish from the list,
 * or worse, render half a post.
 */
export async function writePost(post: PostInput): Promise<void> {
  const path = postPath(post.project, post.slug)
  if (!path) throw createError({ statusCode: 400, statusMessage: 'unknown project or slug' })

  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, serialise(post), 'utf8')
  await rename(tmp, path)

  // Without this the editor saves and then shows the previous version for up to
  // the read cache's TTL, which reads as the save having failed.
  invalidatePosts()
}

export async function deletePost(project: string, slug: string): Promise<boolean> {
  const path = postPath(project, slug)
  if (!path) return false
  try {
    await unlink(path)
    invalidatePosts()
    return true
  }
  catch {
    return false
  }
}

/** The raw file, for the editor to load into its textarea. */
export async function rawPost(project: string, slug: string): Promise<string | null> {
  const path = postPath(project, slug)
  if (!path) return null
  try {
    return await readFile(path, 'utf8')
  }
  catch {
    return null
  }
}
