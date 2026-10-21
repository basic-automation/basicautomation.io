import { useRuntimeConfig } from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'

/**
 * The origin to use when this response has to name itself.
 *
 * The site answers on two names: the clearnet domain, and the `.onion` address
 * of the gateway running beside it. Anything absolute — a sitemap entry, a feed
 * link, `og:url` — has to pick one, and picking the configured domain
 * unconditionally means an onion visitor is handed a page whose every absolute
 * link points back at the clearnet name. That is not a cosmetic mismatch: it
 * hands the reader, and anything that scrapes the page, the clearnet address as
 * the "real" one, which is most of what they came to the onion service to
 * avoid.
 *
 * The decision itself is made once per request in `server/middleware/
 * site-origin.ts`; this is the accessor, so that a caller cannot accidentally
 * make it again from a header.
 */
export function siteOrigin(event: RequestEvent): string {
	// The portable event's context is h3's own object, but typed as Nuxt's
	// `RequestEventContext`, which cannot be augmented from here; the middleware
	// is the only writer, and writes a string.
	const decided = event.context.siteOrigin as string | undefined
	return decided ?? useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
}
