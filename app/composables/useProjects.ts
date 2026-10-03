import type { EnrichedProject } from '~~/shared/types/project'

/**
 * Card-level data for every project. Rendered on the server on first paint, so
 * the numbers in the HTML are as fresh as the server's cache.
 */
export async function useProjects() {
  const { data, error } = await useFetch<{ count: number, projects: EnrichedProject[] }>(
    '/api/projects',
    { key: 'projects' },
  )
  return {
    projects: computed<EnrichedProject[]>(() => data.value?.projects ?? []),
    error,
  }
}

/**
 * One project, README included — but the README only once.
 *
 * Whatever `useFetch` returns is serialized into the page so the client can
 * hydrate it, and a `v-html` README is static markup the server has already
 * rendered: the payload was a second copy of it. 162 KB of onyums' README sat
 * in its about page's payload, beside the same README as HTML.
 *
 * So on the server the README is taken out of the result before it is
 * serialized and kept in this closure for the render, and the payload carries
 * `readmeOnServer` instead. Hydrating, the client binds no `innerHTML` and Vue
 * leaves the server's markup in place — it does not patch `innerHTML` while
 * hydrating. A client-side navigation fetches the project afresh, in the
 * client, where nothing is taken out, so `readmeHtml` is the string again.
 */
export async function useProject(slug: MaybeRefOrGetter<string>) {
  const key = computed(() => `project:${toValue(slug)}`)
  let serverReadme: string | null = null
  const { data, error } = await useFetch(
    () => `/api/projects/${toValue(slug)}`,
    {
      key: () => key.value,
      transform: (p: EnrichedProject): EnrichedProject & { readmeOnServer?: true } => {
        if (!import.meta.server || !p.meta?.readmeHtml) return p
        serverReadme = p.meta.readmeHtml
        return { ...p, meta: { ...p.meta, readmeHtml: null }, readmeOnServer: true }
      },
    },
  )
  /** The README to bind, or null where the server's markup is to be kept. */
  const readmeHtml = computed(() => (import.meta.server ? serverReadme : data.value?.meta?.readmeHtml ?? null))
  const hasReadme = computed(() => !!readmeHtml.value || data.value?.readmeOnServer === true)
  return { project: data, error, readmeHtml, hasReadme }
}

/**
 * One project's name and hero line, for pages that name a project without
 * rendering it — the blog tab and its posts.
 *
 * Those pages used `useProject`, and everything `useFetch` returns is
 * serialized into the page for hydration, so each one carried the project's
 * whole rendered README without showing it: 43 KB of Nanna's on its blog tab.
 * `pick` trims the result before it is serialized. Its own key, so it never
 * stands in for the full entry the about tab reads.
 */
export async function useProjectSummary(slug: MaybeRefOrGetter<string>) {
  const { data, error } = await useFetch(
    () => `/api/projects/${toValue(slug)}`,
    {
      key: () => `project-summary:${toValue(slug)}`,
      pick: ['slug', 'name', 'hero'] as const,
    },
  )
  return { project: data, error }
}
