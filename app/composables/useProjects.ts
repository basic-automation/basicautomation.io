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

/** One project, README included. */
export async function useProject(slug: MaybeRefOrGetter<string>) {
  const key = computed(() => `project:${toValue(slug)}`)
  const { data, error } = await useFetch<EnrichedProject>(
    () => `/api/projects/${toValue(slug)}`,
    { key: () => key.value },
  )
  return { project: data, error }
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
