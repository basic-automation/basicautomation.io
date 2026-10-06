<script setup lang="ts">
import { EDITOR_CHALLENGE } from '~~/shared/admin/basicAuth'
import { VIA_ONION, cameOverOnion } from '~~/shared/onion/via'
import { postPath } from '~~/shared/posts/section'

/**
 * The post editor.
 *
 * # What guards this page
 *
 * The app: `/api/admin/session` runs the same `requireEditor` check as every
 * API route this page calls (`server/utils/adminGuard.ts`), and the page asks
 * it before rendering anything. The credential is the one Caddy's basic auth
 * prompts for in front, so a visitor through Caddy is asked once; anyone who
 * reaches the app some other way is asked by the app, or refused. There is
 * deliberately no login form — the browser's own prompt is the form.
 *
 * `robots.txt` disallows it and `noindex` is set, which is hygiene rather than
 * protection: neither stops anybody, the credential does.
 *
 * # Why a textarea and not a rich editor
 *
 * The file on disk is markdown, and the thing rendered on the site is that file
 * put through the same renderer as the project READMEs. An editor that showed
 * you something else would be showing you a second opinion about your own post.
 */
definePageMeta({ layout: 'default' })

// Caddy's basic auth never sees a request that came through the onion gateway,
// so over Tor this page does not exist — see `shared/onion/via.ts`. Checked
// here, in the page, rather than by path in a middleware: this only runs when
// the router matched the editor, however the URL was spelled. The API routes
// it calls refuse the same requests on their own (`refuseOverOnion`).
if (import.meta.server && cameOverOnion(useRequestHeader(VIA_ONION))) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: import.meta.client })
}

// Everyone else needs the editor's credential. Asked of the API rather than
// checked here so there is one implementation of it; the request's own
// `Authorization` header goes with the internal call.
if (import.meta.server) {
  const refused = await useRequestFetch()('/api/admin/session')
    .then(() => null, (err: { statusCode?: number }) => err.statusCode ?? 500)
  if (refused === 401) {
    useResponseHeader('WWW-Authenticate').value = EDITOR_CHALLENGE
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', fatal: import.meta.client })
  }
  if (refused !== null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: import.meta.client })
  }
}

useSeoMeta({ title: 'post editor', robots: 'noindex, nofollow' })

const { projects } = await useProjects()

const { data: listData, refresh: refreshList } = await useFetch<{ posts: PostSummary[] }>(
  '/api/admin/posts',
  { key: 'admin-posts', default: () => ({ posts: [] }) },
)
const posts = computed(() => listData.value?.posts ?? [])

/** Blank means "new post"; otherwise the file currently loaded. */
const editing = ref<{ project: string, slug: string } | null>(null)

const form = reactive({
  project: '',
  slug: '',
  title: '',
  date: '',
  summary: '',
  draft: true,
  body: '',
})

const status = ref<{ kind: 'ok' | 'error', message: string } | null>(null)
const busy = ref(false)

function todayIso(): string {
  return new Date().toISOString()
}

/** A filename-safe slug suggested from the title, only while creating. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

watch(() => form.title, (title) => {
  // Only while creating: renaming an existing post would orphan its URL, which
  // is a different operation from editing it.
  if (!editing.value && title) form.slug = slugify(title)
})

function startNew() {
  editing.value = null
  Object.assign(form, {
    project: projects.value[0]?.slug ?? '',
    slug: '',
    title: '',
    date: todayIso(),
    summary: '',
    draft: true,
    body: '',
  })
  status.value = null
}

/**
 * Split a raw file back into the form.
 *
 * The editor round-trips the file rather than the parsed post, so this has to
 * undo exactly what `serialise` did — including the quoting, which is there so
 * a title containing a colon survives.
 */
function loadRaw(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    form.body = raw
    return
  }
  const unquote = (v: string) =>
    v.length > 1 && v.startsWith('"') && v.endsWith('"')
      ? v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : v

  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 1) continue
    const key = line.slice(0, at).trim()
    const value = unquote(line.slice(at + 1).trim())
    if (key === 'title') form.title = value
    else if (key === 'date') form.date = value
    else if (key === 'summary') form.summary = value
    else if (key === 'draft') form.draft = value === 'true'
  }
  form.body = match[2] ?? ''
}

async function open(post: PostSummary) {
  status.value = null
  busy.value = true
  try {
    const res = await $fetch<{ raw: string }>('/api/admin/post', {
      query: { project: post.project, slug: post.slug },
    })
    editing.value = { project: post.project, slug: post.slug }
    form.project = post.project
    form.slug = post.slug
    loadRaw(res.raw)
  }
  catch (error) {
    status.value = { kind: 'error', message: `Could not open: ${String(error)}` }
  }
  finally {
    busy.value = false
  }
}

async function save() {
  status.value = null
  busy.value = true
  try {
    await $fetch('/api/admin/post', { method: 'PUT', body: { ...form } })
    editing.value = { project: form.project, slug: form.slug }
    status.value = { kind: 'ok', message: `Saved. ${form.draft ? 'Still a draft — not listed anywhere.' : 'Live.'}` }
    await refreshList()
  }
  catch (error: unknown) {
    const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? String(error)
    status.value = { kind: 'error', message }
  }
  finally {
    busy.value = false
  }
}

async function remove() {
  if (!editing.value) return
  // eslint-disable-next-line no-alert
  if (!confirm(`Delete ${editing.value.project}/${editing.value.slug}? This cannot be undone.`)) return

  busy.value = true
  try {
    await $fetch('/api/admin/post', { method: 'DELETE', query: { ...editing.value } })
    status.value = { kind: 'ok', message: 'Deleted.' }
    startNew()
    await refreshList()
  }
  catch (error) {
    status.value = { kind: 'error', message: `Could not delete: ${String(error)}` }
  }
  finally {
    busy.value = false
  }
}

const canSave = computed(() => Boolean(form.project && form.slug && form.title.trim()) && !busy.value)

// `postPath`, not a hand-built path: a post in the reserved `site` section
// lives at /news/<slug>, not under /projects/site/. Building it here meant the
// editor's own "view it" link was the one thing pointing at a URL that should
// not exist, and now does not.
const previewUrl = computed(() =>
  editing.value ? postPath(editing.value.project, editing.value.slug) : null)

onMounted(startNew)
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 pt-14 pb-32 sm:px-6">
    <header class="mb-10">
      <h1 class="text-3xl leading-tight text-pn-fg-bright sm:text-4xl">
        post editor
      </h1>
      <p class="mt-3 max-w-3xl text-sm leading-relaxed text-pn-muted">
        Markdown, rendered by the same pipeline as the project READMEs. Files are
        written to the content volume and appear immediately — there is no build
        step between saving and the post being live.
      </p>
    </header>

    <div class="grid gap-12 lg:grid-cols-[18rem_1fr]">
      <!-- ── the list ─────────────────────────────────────────────────── -->
      <aside>
        <TermRule label="posts" />

        <button
          type="button"
          class="mt-6 w-full cursor-pointer border border-pn-rule px-3 py-2 text-left font-mono text-xs text-pn-accent hover:text-pn-fg-bright"
          @click="startNew"
        >
          + new post
        </button>

        <p v-if="!posts.length" class="mt-6 font-mono text-xs text-pn-muted">
          none yet
        </p>

        <ul v-else class="mt-6 space-y-1">
          <li v-for="post in posts" :key="`${post.project}/${post.slug}`">
            <button
              type="button"
              class="w-full cursor-pointer px-2 py-2 text-left hover:bg-pn-rule/20"
              :class="editing?.project === post.project && editing?.slug === post.slug ? 'bg-pn-rule/25' : ''"
              @click="open(post)"
            >
              <span class="block truncate text-sm text-pn-fg">{{ post.title }}</span>
              <span class="mt-0.5 block font-mono text-[0.65rem] text-pn-muted">
                {{ post.project }}
                <span v-if="post.draft" class="text-pn-red">· draft</span>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- ── the form ─────────────────────────────────────────────────── -->
      <section>
        <TermRule :label="editing ? `editing ${editing.project}/${editing.slug}` : 'new post'" />

        <form class="mt-6 space-y-6" @submit.prevent="save">
          <div class="grid gap-6 sm:grid-cols-2">
            <label class="block">
              <span class="block font-mono text-xs text-pn-muted">project</span>
              <select
                v-model="form.project"
                :disabled="Boolean(editing)"
                class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 font-mono text-sm text-pn-fg disabled:opacity-60"
              >
                <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name }}</option>
              </select>
            </label>

            <label class="block">
              <span class="block font-mono text-xs text-pn-muted">
                slug <span v-if="editing" class="text-pn-dim">— fixed; the URL depends on it</span>
              </span>
              <input
                v-model="form.slug"
                :disabled="Boolean(editing)"
                class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 font-mono text-sm text-pn-fg disabled:opacity-60"
              >
            </label>
          </div>

          <label class="block">
            <span class="block font-mono text-xs text-pn-muted">title</span>
            <input v-model="form.title" class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 text-sm text-pn-fg">
          </label>

          <label class="block">
            <span class="block font-mono text-xs text-pn-muted">summary — shown in every listing</span>
            <input v-model="form.summary" class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 text-sm text-pn-fg">
          </label>

          <div class="flex flex-wrap items-center gap-6">
            <label class="block flex-1">
              <span class="block font-mono text-xs text-pn-muted">date</span>
              <input v-model="form.date" class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 font-mono text-xs text-pn-fg">
            </label>

            <label class="flex cursor-pointer items-center gap-2 pt-5 font-mono text-xs text-pn-fg">
              <input v-model="form.draft" type="checkbox" class="cursor-pointer">
              draft — hidden from every list
            </label>
          </div>

          <label class="block">
            <span class="block font-mono text-xs text-pn-muted">body — markdown</span>
            <textarea
              v-model="form.body"
              rows="22"
              spellcheck="true"
              class="mt-2 w-full border border-pn-rule bg-pn-bg px-3 py-2 font-mono text-sm leading-relaxed text-pn-fg"
            />
          </label>

          <div class="flex flex-wrap items-center gap-6">
            <button
              type="submit"
              :disabled="!canSave"
              class="cursor-pointer border border-pn-accent px-4 py-2 font-mono text-xs text-pn-accent hover:text-pn-fg-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              {{ busy ? 'saving…' : 'save' }}
            </button>

            <NuxtLink
              v-if="previewUrl"
              :to="previewUrl"
              target="_blank"
              class="font-mono text-xs text-pn-accent hover:text-pn-fg-bright"
            >
              → view it
            </NuxtLink>

            <button
              v-if="editing"
              type="button"
              :disabled="busy"
              class="ms-auto cursor-pointer font-mono text-xs text-pn-red hover:text-pn-fg-bright disabled:opacity-40"
              @click="remove"
            >
              delete
            </button>
          </div>

          <p
            v-if="status"
            class="font-mono text-xs"
            :class="status.kind === 'ok' ? 'text-pn-accent' : 'text-pn-red'"
          >
            {{ status.message }}
          </p>
        </form>
      </section>
    </div>
  </div>
</template>
