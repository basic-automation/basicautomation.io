/**
 * Where a project's documentation lives on the site.
 *
 * Shared by the pages, the sitemap and the tab strip, so a link cannot be built
 * one way in one of them and another way in the next.
 */

export function docsIndexPath(project: string): string {
  return `/projects/${project}/docs`
}

export function docPath(project: string, slug: string): string {
  return `${docsIndexPath(project)}/${slug}`
}
