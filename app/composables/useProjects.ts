import { PAGE_ONLY, type EnrichedProject, type ProjectSummary } from '~~/shared/types/project'


/**
 * Card-level data for every project. Rendered on the server on first paint, so
 * the numbers in the HTML are as fresh as the server's cache. `/api/projects`
 * itself keeps every field — it is a public endpoint; only what is serialized
 * into the page is trimmed.
 */
export async function useProjects() {
  const { data, error } = await useFetch(
    '/api/projects',
    {
      key: 'projects',
      transform: (d: { count: number, projects: EnrichedProject[] }) => ({
        count: d.count,
        projects: d.projects.map((p): ProjectSummary => {
          const out: Partial<EnrichedProject> = { ...p }
          for (const field of PAGE_ONLY) delete out[field]
          return out as ProjectSummary
        }),
      }),
    },
  )
  return {
    projects: computed<ProjectSummary[]>(() => data.value?.projects ?? []),
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
 * serialized and kept on the request's own context for the render — never
 * serialized, and shared by every caller in the request, so a second
 * `useProject` for the same key (whose fetch Nuxt dedupes, so whose transform
 * never runs) still finds it — and the payload carries
 * `readmeOnServer` instead. Hydrating, the client binds no `innerHTML` and Vue
 * leaves the server's markup in place — it does not patch `innerHTML` while
 * hydrating. A client-side navigation fetches the project afresh, in the
 * client, where nothing is taken out, so `readmeHtml` is the string again.
 */
export async function useProject(slug: MaybeRefOrGetter<string>) {
  const key = computed(() => `project:${toValue(slug)}`)
  const readmes: Record<string, string> | null = import.meta.server
    ? (useRequestEvent()!.context.readmes ??= {})
    : null
  const { data, error } = await useFetch(
    () => `/api/projects/${toValue(slug)}`,
    {
      key: () => key.value,
      transform: (p: EnrichedProject): EnrichedProject & { readmeOnServer?: true } => {
        if (!import.meta.server || !p.meta?.readmeHtml) return p
        readmes![p.slug] = p.meta.readmeHtml
        return { ...p, meta: { ...p.meta, readmeHtml: null }, readmeOnServer: true }
      },
    },
  )
  /** The README to bind, or null where the server's markup is to be kept. */
  const readmeHtml = computed(() => (readmes
    ? readmes[data.value?.slug ?? toValue(slug)] ?? null
    : data.value?.meta?.readmeHtml ?? null))
  const hasReadme = computed(() => !!readmeHtml.value || data.value?.readmeOnServer === true)
  return { project: data, error, readmeHtml, hasReadme }
}

/**
 * One project's name, hero line and accent, for pages that name a project
 * without rendering it — the blog tab and its posts.
 *
 * Those pages used `useProject`, and everything `useFetch` returns is
 * serialized into the page for hydration, so each one carried the project's
 * whole rendered README without showing it: 43 KB of Nanna's on its blog tab.
 * `pick` trims the result before it is serialized. Its own key, so it never
 * stands in for the full entry the about tab reads.
 *
 * `accent` is in the pick because `ProjectTabs` colours the current tab with
 * `var(--accent)`, and only the about tab was setting it — so the active tab
 * changed colour depending on which tab you were on. One short string is what
 * that costs, which is the kind of field this pick exists to allow.
 */
export async function useProjectSummary(slug: MaybeRefOrGetter<string>) {
  const { data, error } = await useFetch(
    () => `/api/projects/${toValue(slug)}`,
    {
      key: () => `project-summary:${toValue(slug)}`,
      pick: ['slug', 'name', 'hero', 'accent'] as const,
    },
  )
  return { project: data, error }
}
