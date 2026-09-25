import type { Accent, Project } from '~~/data/projects'

/** Every Palenight hue a project can be tinted with. */
export const ACCENT_HEX: Record<Accent, string> = {
  magenta: '#497d00', // lime-700
  cyan: '#7e2a0c', // orange-900
  blue: '#733e0a', // yellow-900
  green: '#2f0d68', // violet-950
  yellow: '#1c398e', // blue-900
  orange: '#2b7fff', // blue-500
  red: '#009689', // teal-600
}

/**
 * Sets `--accent` on an element so everything beneath it — borders, glows,
 * bullets, hover states — picks up that project's colour without a class per hue.
 */
export const accentVar = (accent: Accent) => ({ '--accent': ACCENT_HEX[accent] })

export const STATUS_LABEL: Record<Project['status'], string> = {
  stable: 'Stable',
  active: 'In development',
  alpha: 'Alpha',
  archived: 'Archived',
}

export const STATUS_COLOR: Record<Project['status'], string> = {
  stable: 'text-pn-bright-green',
  active: 'text-pn-cyan',
  alpha: 'text-pn-yellow',
  archived: 'text-pn-muted',
}

/** "3 days ago" — Intl handles the wording and pluralisation. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((then - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31557600],
    ['month', 2629800],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(Math.round(seconds), 'second')
}

/**
 * Serialises structured data for a `<script type="application/ld+json">` body.
 *
 * The escape is the whole point: a `<` anywhere in the JSON — in a project's
 * summary, in a release title — would otherwise let a literal `</script>` close
 * the tag early. `\u003c` is valid JSON and parses back to the same string.
 */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * `2026-09-24` — unambiguous and sortable, the way a terminal prints a date.
 * Sliced off the ISO string rather than parsed, so the date shown is the one
 * GitHub published under and not the viewer's timezone shifted a day either way.
 */
export const isoDate = (iso: string | null | undefined): string =>
  iso ? (iso.split('T')[0] ?? '') : ''

export const compactNumber = (n: number | undefined | null): string =>
  n === undefined || n === null ? '' : new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
