export default defineEventHandler(async () => {
  const items = await getProjects()
  return {
    count: items.length,
    // The landing page only needs card-level fields; leaving the README and the
    // release history out keeps this payload small enough to hydrate without a
    // second thought. `/api/projects/<slug>` carries both in full.
    projects: items.map(({ meta, ...project }) => ({
      ...project,
      meta: meta ? { ...meta, readmeHtml: null, releases: [] } : null,
    })),
  }
})
