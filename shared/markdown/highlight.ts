import { createHighlighter, type Highlighter } from 'shiki'
import { paleday } from '../theme/paleday-shiki.ts'
import { logEvent } from '../log/event.ts'

/**
 * Server-side syntax highlighting, in the site's own palette.
 *
 * Shiki runs on the server only — the highlighted markup ships as HTML and no
 * part of the highlighter reaches the client bundle. The highlighter is a
 * singleton: loading the grammars costs real time, and there is no reason to
 * pay it more than once per process.
 */

/** Grammars the site actually needs: its own examples plus what the READMEs use. */
const LANGS = [
  'rust',
  'shellscript',
  'toml',
  'typescript',
  'javascript',
  'json',
  'yaml',
  'html',
  'css',
  'vue',
  'diff',
  'ini',
] as const

/** Fence aliases as they appear in the wild, mapped to a grammar we loaded. */
const ALIASES: Record<string, string> = {
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  console: 'shellscript',
  shell: 'shellscript',
  rs: 'rust',
  ts: 'typescript',
  js: 'javascript',
  yml: 'yaml',
  jsonc: 'json',
  cargo: 'toml',
}

let instance: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  instance ??= createHighlighter({ themes: [paleday], langs: [...LANGS] })
  return instance
}

function resolveLang(lang: string | undefined, loaded: string[]): string {
  if (!lang) return 'text'
  const key = lang.toLowerCase().trim().split(/[\s:,]/)[0] ?? ''
  const mapped = ALIASES[key] ?? key
  // An unknown grammar is not an error — plenty of README fences are ASCII
  // diagrams with a made-up tag. Fall back to plain text rather than throwing.
  return loaded.includes(mapped) ? mapped : 'text'
}

/**
 * Returns `<pre class="shiki">…</pre>`. Falls back to an escaped plain block if
 * highlighting fails for any reason — a code sample that renders uncoloured is
 * a much smaller problem than a page that doesn't render.
 */
export async function highlight(code: string, lang?: string): Promise<string> {
  const source = code.replace(/\n+$/, '')
  try {
    const shiki = await getHighlighter()
    return shiki.codeToHtml(source, {
      lang: resolveLang(lang, shiki.getLoadedLanguages()),
      theme: 'paleday-tailwind',
    })
  }
  catch (err) {
    logEvent('warn', 'highlight.fallback', `falling back to plain text (${lang})`, { lang, error: (err as Error).message })
    return `<pre class="shiki"><code>${escapeHtml(source)}</code></pre>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
