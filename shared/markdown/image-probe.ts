import { PROBE_BYTES, measureImage, type ImageSize } from './image-size.ts'

/**
 * Where a README image may be read from to learn its size. The README is the
 * organisation's own, but it is still markup fetched at request time, and this
 * makes the server request whatever URL it names; so only the hosts a GitHub
 * README's images actually come from.
 */
const HOSTS = /^(?:github\.com|raw\.githubusercontent\.com|(?:[\w-]+\.)*githubusercontent\.com|img\.shields\.io)$/i

export function probeable(src: string): boolean {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && HOSTS.test(url.hostname)
  }
  catch {
    return false
  }
}

/**
 * The size of the image at `src`, from its first {@link PROBE_BYTES} bytes, or
 * `null` — for a host not in the list, a failed or slow request, or a format
 * `measureImage` does not read. Never throws: a README renders the same
 * without a size, it only moves when its images land.
 *
 * Asks for the first bytes with `Range`, and stops reading at that many even
 * when a server ignores it and sends the whole file.
 */
export async function probeImageSize(src: string, timeoutMs = 5000, fetchImpl: typeof fetch = fetch): Promise<ImageSize | null> {
  if (!probeable(src)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(src, {
      headers: { range: `bytes=0-${PROBE_BYTES - 1}`, accept: 'image/*' },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < PROBE_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    await reader.cancel().catch(() => {})
    const bytes = new Uint8Array(Math.min(total, PROBE_BYTES))
    let at = 0
    for (const c of chunks) {
      const part = c.subarray(0, bytes.length - at)
      bytes.set(part, at)
      at += part.length
      if (at >= bytes.length) break
    }
    return measureImage(bytes)
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
    controller.abort()
  }
}
