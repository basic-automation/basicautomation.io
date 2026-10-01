/**
 * Reading an `Authorization: Basic` header, for the post editor's own check.
 *
 * The browser sends the credential it gave Caddy's prompt on every request to
 * the same origin, and Caddy passes the header on — so the app can check the
 * very same credential, against the very same bcrypt hash, without a second
 * prompt. See `server/utils/adminGuard.ts` for why it has to.
 */

export interface BasicCredential {
  user: string
  password: string
}

/**
 * The user and password in a `Basic` header, or null for anything else:
 * absent, another scheme, not base64, or no colon. The password may itself
 * contain colons — only the first separates (RFC 7617 §2).
 */
export function parseBasicAuth(header: string | null | undefined): BasicCredential | null {
  if (!header) return null
  const match = /^Basic[ ]+([A-Za-z0-9+/]+={0,2})[ ]*$/i.exec(header)
  if (!match?.[1]) return null

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(base64Bytes(match[1]))
  }
  catch {
    return null
  }

  const colon = decoded.indexOf(':')
  if (colon < 0) return null
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) }
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/**
 * Header for a 401, so a browser that reached the app without going through
 * Caddy's prompt is asked rather than just refused.
 */
export const EDITOR_CHALLENGE = 'Basic realm="post editor", charset="UTF-8"'
