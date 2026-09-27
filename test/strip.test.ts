import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripScripts } from '~~/shared/html/strip'

describe('stripScripts', () => {
	it('removes script elements, inline and external', () => {
		const out = stripScripts('<p>a</p><script>alert(1)</script><script type="module" src="/_nuxt/x.js"></script><p>b</p>')
		expect(out).toBe('<p>a</p><p>b</p>')
	})

	it('removes a self-closed script tag', () => {
		expect(stripScripts('<script src="/x.js" />ok')).toBe('ok')
	})

	it('removes Nuxt\'s modulepreload links, attribute order and all', () => {
		const html = [
			'<link rel="modulepreload" as="script" crossorigin href="/_nuxt/A.js">',
			'<link href="/_nuxt/B.js" crossorigin rel="modulepreload">',
			'<link rel=modulepreload href=/_nuxt/C.js>',
		].join('')
		expect(stripScripts(html)).toBe('')
	})

	it('removes a preload or prefetch that is for a script', () => {
		expect(stripScripts('<link rel="preload" as="script" href="/a.js"><link as="script" rel="prefetch" href="/b.js">')).toBe('')
	})

	it('keeps everything the frame needs to look like the site', () => {
		const keep = [
			'<link rel="stylesheet" href="/_nuxt/entry.css" crossorigin>',
			'<link rel="preload" as="font" type="font/woff2" href="/fonts/fira.woff2" crossorigin="anonymous">',
			'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
			'<link rel="alternate" type="application/atom+xml" href="/releases.xml">',
		].join('')
		expect(stripScripts(keep)).toBe(keep)
	})

	it('leaves no script fetch in a real rendered page', () => {
		// A page as Nuxt renders it, trimmed to the <head> that carries the links.
		const page = readFileSync(new URL('./fixtures/rendered-head.html', import.meta.url), 'utf8')
		const out = stripScripts(page)
		expect(out).not.toMatch(/<script\b/i)
		expect(out).not.toMatch(/modulepreload/i)
		expect(out).toMatch(/rel="stylesheet"/)
	})
})
