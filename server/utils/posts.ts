/**
 * The blog: markdown files read from disk at request time.
 *
 * # Why not Nuxt Content
 *
 * Content v3 compiles markdown into a collection at build time. That is the
 * right trade for a site whose posts ship with the code, and the wrong one here:
 * the admin page writes `.md` files to a running container, and a build-time
 * collection cannot see them. Posting would mean rebuilding the image.
 *
 * The site already renders GitHub READMEs through `marked` + Shiki on the
 * server, so a post is the same pipeline pointed at a different source. That is
 * the whole of the "content system".
 *
 * # Where they live
 *
 * `$CONTENT_DIR/posts/<project>/<slug>.md`, on a named volume so they survive
 * the image being rebuilt. `<project>` is a project slug from `data/projects.ts`
 * — a post belongs to exactly one project, which is what lets a project page
 * show its own news and the home page aggregate all of it.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

import { projects } from '~~/data/projects'
import { SITE_SECTION } from '~~/shared/posts/section'
import type { Post, PostSummary } from '~~/shared/types/post'
import { logEvent } from '~~/shared/log/event'

const CONTENT_DIR = process.env.CONTENT_DIR || '/app/content'

/** Where posts live under the content root. */
const POSTS_DIR = 'posts'

/** Re-read this often. Posting should feel immediate; `stat` per request is not. */
const TTL_MS = 10_000

/**
 * A post's file name, and the URL segment it becomes.
 *
 * Deliberately strict. These strings arrive from the admin API and are joined
 * onto a filesystem path, so anything that could climb out of the content
 * directory — a dot, a slash, a backslash, a NUL — simply is not a slug. Length
 * is bounded because a filename is.
 */
export const SLUG = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/

/**
 * Parse `key: value` front matter between `---` fences.
 *
 * A deliberate subset of YAML rather than a dependency. The fields a post needs
 * are four scalars; a real YAML parser would bring anchors, references and type
 * coercion to a problem that does not have them, and every one of those is a
 * way for a file on disk to surprise the renderer.
 */
export function parseFrontMatter(raw: string): { data: Record<string, string>, body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }

  const data: Record<string, string> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 1) continue
    const key = line.slice(0, at).trim()
    let value = line.slice(at + 1).trim()
    // Strip one layer of matching quotes, which is how a title containing a
    // colon has to be written — and then undo the escaping the writer applied
    // inside them. `serialise` escapes `\` and then `"` (adminPosts.ts), and
    // the editor's own reader already reverses both; this one did not, so a
    // title saved as `The "basic" way` came back, and rendered, with literal
    // backslashes in the h1, the <title>, the card, the feed and the JSON-LD.
    // Decoding reverses the writer's order: quotes first, then backslashes.
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
    // Single quotes get a bare dequote: nothing writes them, so a file using
    // them is hand-made and has no escaping to undo.
    else if (value.length > 1 && value.startsWith('\'') && value.endsWith('\'')) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return { data: data, body: match[2] ?? '' }
}

/**
 * Every directory that may hold posts: the project slugs, plus `site` for the
 * organisation's own news. A stray directory is not a section.
 *
 * The assertion is not paranoia about today — it is about the day someone adds
 * a project whose slug happens to be `site`, which would silently merge that
 * project's news into the site's. Better to fail at boot than to discover it in
 * a listing.
 */
const knownProjects = new Set<string>(projects.map((p) => p.slug))

if (knownProjects.has(SITE_SECTION)) {
  throw new Error(`a project is using the reserved slug "${SITE_SECTION}", which names the site's own blog`)
}
knownProjects.add(SITE_SECTION)

/**
 * The absolute path of a post, or null if the arguments could not name one.
 *
 * The `resolve` check is the load-bearing part: even with `SLUG` validating both
 * segments, this asserts the result is still inside the content directory rather
 * than trusting that it must be.
 */
export function postPath(project: string, slug: string): string | null {
  if (!knownProjects.has(project)) return null
  if (!SLUG.test(slug)) return null

  const root = resolve(CONTENT_DIR, POSTS_DIR)
  const path = resolve(root, project, `${slug}.md`)
  if (path !== join(root, project, `${slug}.md`)) return null
  if (!path.startsWith(root + sep)) return null
  return path
}

function toPost(project: string, slug: string, raw: string): Post | null {
  const { data, body } = parseFrontMatter(raw)

  const title = data.title?.trim()
  if (!title) return null

  // An unparseable or missing date would sort unpredictably against the others,
  // so it disqualifies the post rather than defaulting to now.
  const date = data.date?.trim()
  if (!date || Number.isNaN(Date.parse(date))) return null

  return {
    project,
    slug,
    title,
    date: new Date(date).toISOString(),
    summary: data.summary?.trim() || '',
    draft: data.draft === 'true',
    body,
  }
}

let cached: { value: Post[], at: number } | null = null
/**
 * Bumped by every invalidation, so a read that overlapped a write cannot
 * install its own stale result.
 *
 * `allPosts` walks the directory with `await` in it, so a request that started
 * before the editor renamed a file can finish after `invalidatePosts` has run
 * and write the pre-write listing back into the cache — undoing the
 * invalidation, and hiding a just-saved post for the rest of the TTL. Comparing
 * the generation it started with is enough: if it changed, the walk it just did
 * is already known to be out of date.
 */
let generation = 0

/** Every post on disk, newest first. Drafts included — callers filter. */
export async function allPosts(): Promise<Post[]> {
  const now = Date.now()
  const startedAt = generation
  if (cached && now - cached.at < TTL_MS) return cached.value

  const root = resolve(CONTENT_DIR, POSTS_DIR)
  const out: Post[] = []

  for (const project of knownProjects) {
    let names: string[]
    try {
      names = await readdir(join(root, project))
    }
    catch {
      // A project with no posts has no directory. That is the normal state.
      continue
    }

    for (const name of names) {
      if (!name.endsWith('.md')) continue
      const slug = name.slice(0, -3)
      if (!SLUG.test(slug)) {
        logEvent('warn', 'posts.ignored', `${project}/${name} is not a usable file name; ignoring`, { project, file: name })
        continue
      }
      const path = postPath(project, slug)
      if (!path) continue

      try {
        const info = await stat(path)
        if (!info.isFile()) continue
        const post = toPost(project, slug, await readFile(path, 'utf8'))
        if (post) out.push(post)
        else logEvent('warn', 'posts.ignored', `${project}/${name} has no title or no valid date; ignoring`, { project, file: name })
      }
      catch (error) {
        logEvent('warn', 'posts.unreadable', `could not read ${project}/${name}`, { project, file: name, error: String(error) })
      }
    }
  }

  out.sort((a, b) => b.date.localeCompare(a.date))
  if (generation === startedAt) cached = { value: out, at: now }
  return out
}

/** Whether a `project` value names a blog at all — a project, or the site's own. */
export function isKnownSection(project: string): boolean {
  return knownProjects.has(project)
}

/** Published posts for one project, newest first. */
export async function postsFor(project: string): Promise<PostSummary[]> {
  const all = await allPosts()
  return all.filter((p) => p.project === project && !p.draft).map(({ body: _body, ...rest }) => rest)
}

/**
 * Published posts across every project, newest first.
 *
 * `limit` omitted means all of them, which is what `/news` wants: it is the
 * aggregate of every blog on the site, so a cap there would silently hide the
 * oldest history rather than paginate it. The home page passes its own small
 * limit because it shows a teaser.
 */
export async function latestPosts(limit?: number): Promise<PostSummary[]> {
  const all = await allPosts()
  const published = all.filter((p) => !p.draft)
  const bounded = limit === undefined ? published : published.slice(0, limit)
  return bounded.map(({ body: _body, ...rest }) => rest)
}

/** One post, draft or not — a draft is reachable by URL so it can be previewed. */
export async function onePost(project: string, slug: string): Promise<Post | null> {
  const all = await allPosts()
  return all.find((p) => p.project === project && p.slug === slug) ?? null
}

/** Drop the cache so a write is visible on the next request rather than in 10s. */
export function invalidatePosts(): void {
  cached = null
  generation += 1
}
