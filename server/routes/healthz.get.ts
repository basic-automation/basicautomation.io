/**
 * Liveness, for the container healthcheck — and enough detail beside it to
 * answer "is it serving real data right now?" without opening a shell.
 *
 * Always 200 while the process can serve. A degraded site is one rendering from
 * the committed snapshot because GitHub is unreachable: the pages are correct
 * and only the numbers are stale, so restarting the container would fix nothing
 * and drop traffic doing it. `status` says which it is; the HTTP code does not.
 */

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return health()
})
