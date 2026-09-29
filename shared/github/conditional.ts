/**
 * The last successful body of each GitHub request, by the ETag it came with,
 * so the next request for it can be conditional.
 *
 * GitHub does not count a `304 Not Modified` against the primary rate limit
 * when the request was authorized, and most refreshes of most repos change
 * nothing — so sending `If-None-Match` turns the bulk of the site's refresh
 * traffic into requests that cost nothing. That matters because the token the
 * site runs with is a person's, and its 5,000 an hour is shared with whatever
 * else they run.
 * <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>
 *
 * Bounded, oldest-first: the site asks for three things per project, so the
 * bound is generous headroom rather than a working limit, and it exists so a
 * mistake in the key cannot grow the map without end.
 */
export class ConditionalCache<T = unknown> {
  private readonly entries = new Map<string, { etag: string, body: T }>()

  constructor(private readonly max = 128) {}

  /** The ETag to send as `If-None-Match`, if this request has a stored answer. */
  etag(key: string): string | undefined {
    return this.entries.get(key)?.etag
  }

  /** The stored body, for a `304`. Undefined if there is none to reuse. */
  body(key: string): T | undefined {
    return this.entries.get(key)?.body
  }

  /** Keep a fresh `200`'s body under its ETag. A response without one is not kept. */
  store(key: string, etag: string | null | undefined, body: T): void {
    if (!etag) {
      this.entries.delete(key)
      return
    }
    this.entries.delete(key)
    this.entries.set(key, { etag, body })
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  /**
   * What a response means for the caller: a `304` is the stored body, still
   * current; anything else is the new body, kept under its ETag.
   *
   * This lives here rather than in the fetch because the fetch got it wrong
   * once: ofetch only throws from 400 up, so a `304` reaches the success path
   * with no body — and returning that blanked the README and the release strip
   * of every repo that had not changed.
   */
  answer(key: string, status: number, etag: string | null | undefined, data: T): { body: T, notModified: boolean } {
    if (status === 304) {
      const stored = this.body(key)
      if (stored === undefined) throw new Error(`304 for ${key} with nothing stored to reuse`)
      return { body: stored, notModified: true }
    }
    this.store(key, etag, data)
    return { body: data, notModified: false }
  }

  get size(): number {
    return this.entries.size
  }
}
