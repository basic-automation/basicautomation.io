/**
 * Where a request came from, as far as the request log can tell.
 *
 * The clearnet path is visitor → Cloudflare → docker's port proxy → Caddy →
 * the site. Caddy trusts no proxy, so the `x-forwarded-for` it sets is its own
 * peer — and behind docker's port proxy that peer is the bridge gateway. In
 * 21 hours of live log (2026-10-10) 5,548 of 5,555 lines carried `172.18.0.1`:
 * the field was there and said nothing. Only the LAN, which resolves the name
 * to the host and skips Cloudflare, ever showed a real address.
 *
 * Cloudflare names the visitor in `cf-connecting-ip`, and Caddy passes request
 * headers through untouched. It is a claim, not a verified hop: nothing on the
 * way in checks that the request really came from Cloudflare, so anyone who
 * reaches the origin directly can write it. It is logged under its own name,
 * `cfIp`, beside `ip`, so a reader knows which is which — and nothing in the
 * site decides anything from either.
 *
 * Over the onion gateway there is no Cloudflare: the gateway strips
 * `x-forwarded-for`, and a Tor visitor's own `cf-connecting-ip` is just a
 * header they typed, so neither is logged for `via: onion`.
 */
export interface ClientAddress {
	/** Caddy's peer: the first `x-forwarded-for` hop. */
	ip: string | null
	/** Cloudflare's word for the visitor, when the request came through it. */
	cfIp: string | null
}

type Header = string | string[] | null | undefined

function first(value: Header): string | null {
	const raw = Array.isArray(value) ? value[0] : value
	const hop = raw?.split(',')[0]?.trim()
	return hop ? hop : null
}

export function clientAddress(
	headers: { forwardedFor: Header, cfConnectingIp: Header },
	via: 'onion' | 'web',
): ClientAddress {
	if (via === 'onion') return { ip: null, cfIp: null }
	return { ip: first(headers.forwardedFor), cfIp: first(headers.cfConnectingIp) }
}
