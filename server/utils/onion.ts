/**
 * The site's own onion address.
 *
 * The onion gateway (`onion/`) runs beside the site in the same container and
 * writes its address to a file once the service launches. This reads it back so
 * the site can advertise the name it is also being served on.
 *
 * It is read from disk rather than passed as an environment variable because
 * the address does not exist until the gateway has bootstrapped Tor, which is
 * minutes after the container starts — long after the site's own environment is
 * fixed. The file appears when it appears.
 */
import { readFile } from 'node:fs/promises'

const ADDRESS_FILE = process.env.ONION_ADDRESS_FILE || '/run/onion/address'

/** A v3 onion address: 56 characters of base32, then `.onion`. */
const V3_ONION = /^[a-z2-7]{56}\.onion$/

/** Re-read this often. The address is stable, but it starts out absent. */
const TTL_MS = 30_000

let cached: { value: string | null, at: number } | null = null

export async function onionAddress(): Promise<string | null> {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return cached.value

  let value: string | null = null
  try {
    const raw = (await readFile(ADDRESS_FILE, 'utf8')).trim().toLowerCase()
    // Validated, not just trimmed: this string is rendered into the page as an
    // address to visit, and a half-written or stale file must not become one.
    value = V3_ONION.test(raw) ? raw : null
    if (raw && !value) {
      console.warn(`[onion] ${ADDRESS_FILE} does not hold a v3 onion address; ignoring`)
    }
  }
  catch {
    // Absent is the normal state for the first few minutes after a cold start,
    // and the permanent state anywhere the gateway is not running.
    value = null
  }

  cached = { value, at: now }
  return value
}
