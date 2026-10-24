import { defineEventHandler, getRouterParam } from 'nuxt/server'

/** One project's documentation, listed in reading order. */
export default defineEventHandler(async (event) => {
  const project = getRouterParam(event, 'project') ?? ''
  return { docs: await listDocs(project) }
})
