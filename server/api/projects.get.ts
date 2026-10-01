export default defineEventHandler(async () => {
  const items = await getProjects()
  return {
    count: items.length,
    // The landing page only needs card-level fields; leaving the README, the
    // release history and the download files out keeps this payload small
    // enough to hydrate without a second thought. `/api/projects/<slug>`
    // carries all three in full.
    projects: items.map(({ meta, ...project }) => ({
      ...project,
      meta: meta ? { ...meta, readmeHtml: null, releases: [], download: null } : null,
    })),
  }
})
