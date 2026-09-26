/**
 * What the last Tor fetch measured — without the document itself.
 *
 * The page needs the numbers to render its caption and needs to know whether a
 * frame is worth mounting at all. It does not need the ~440 KB of HTML, which
 * the frame gets from `/onion-frame` when and if it is shown.
 */
export default defineEventHandler(async (event) => {
  const snapshot = await renderableSnapshot(event)
  if (!snapshot) return { available: false as const }

  const { address, status, bytes, elapsedMs, fetchedAt } = snapshot
  return { available: true as const, address, status, bytes, elapsedMs, fetchedAt }
})
