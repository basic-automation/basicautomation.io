export default defineEventHandler(async () => ({
  address: await onionAddress(),
}))
