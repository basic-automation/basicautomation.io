/**
 * A project's documentation: markdown that ships with the site.
 *
 * # Why not the posts directory
 *
 * Posts are written to a running container by the admin page, so they live on
 * a volume and are read at request time. Documentation is the opposite — it is
 * edited in a pull request, reviewed with the code, and should arrive with the
 * image that renders it. A volume would let a stale copy outlive a deploy, so
 * these are Nitro server assets (`project-docs/` at the repository root,
 * bundled by `nuxt.config.ts`) and cannot change without a build.
 *
 * # Where they live
 *
 * `project-docs/<project>/<slug>.md`. `<project>` is a project slug from
 * `data/projects.ts` with `docs: true`; a directory for any other name is not
 * a section and is never listed.
 */
import { projects } from '~~/data/projects'
import type { Doc, DocSummary } from '~~/shared/types/doc'
import { SLUG, parseFrontMatter } from './posts'

/** The storage mount `nuxt.config.ts` registers the directory under. */
const MOUNT = 'assets:projectdocs'

const withDocs = new Set<string>(projects.filter((p) => p.docs).map((p) => p.slug))

/**
 * Parse one file, or null if it cannot be a page.
 *
 * A page without a title is not a page, the same rule posts follow. `order`
 * falls back to a large number rather than zero, so a page someone forgot to
 * number sorts last instead of first.
 */
export function toDoc(project: string, slug: string, raw: string): Doc | null {
  const { data, body } = parseFrontMatter(raw)

  const title = data.title?.trim()
  if (!title) return null

  const order = Number(data.order)

  return {
    project,
    slug,
    title,
    summary: data.summary?.trim() || '',
    order: Number.isFinite(order) ? order : 9999,
    group: data.group?.trim() || 'Documentation',
    body,
  }
}

let cached: Map<string, Doc[]> | null = null

async function load(): Promise<Map<string, Doc[]>> {
  if (cached) return cached

  // Imported here rather than at the top: Nuxt 5's typecheck does not
  // auto-import `useStorage`, and a top-level import would load Nitro's storage
  // — a virtual module only a Nitro build provides — into the unit tests that
  // import `toDoc`, which is pure.
  const { useStorage } = await import('nitropack/runtime')
  const storage = useStorage(MOUNT)
  const byProject = new Map<string, Doc[]>()

  for (const key of await storage.getKeys()) {
    // Keys look like `weftdb:release-plan.md`.
    const [project, file, ...extra] = key.split(':')
    if (!project || !file || extra.length) continue
    if (!withDocs.has(project) || !file.endsWith('.md')) continue

    const slug = file.slice(0, -3)
    if (!SLUG.test(slug)) continue

    const raw = await storage.getItemRaw<Uint8Array | string>(key)
    if (raw == null) continue
    const doc = toDoc(project, slug, typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    if (!doc) continue

    byProject.set(project, [...(byProject.get(project) ?? []), doc])
  }

  for (const docs of byProject.values()) {
    docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }

  // The files cannot change without a build, so the first read is the last.
  cached = byProject
  return byProject
}

/** Every page of one project's docs, in reading order. Empty for a project with none. */
export async function listDocs(project: string): Promise<DocSummary[]> {
  const docs = (await load()).get(project) ?? []
  return docs.map(({ body: _body, ...summary }) => summary)
}

export async function oneDoc(project: string, slug: string): Promise<Doc | null> {
  return (await load()).get(project)?.find((d) => d.slug === slug) ?? null
}
