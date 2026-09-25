import type { Project } from '~~/data/projects'

/** One published release, as the changelog strip and the releases feed print it. */
export interface Release {
  /** The git tag, e.g. `v0.5.0` */
  tag: string
  /** The release's own title, when the author gave it one beyond the tag. */
  title: string | null
  url: string
  publishedAt: string
  prerelease: boolean
}

/** The live half of a project: whatever GitHub and crates.io report right now. */
export interface RepoMeta {
  repo: string
  /** When the upstream call behind this data was made. */
  fetchedAt: string
  /** 'snapshot' means upstream was unreachable and the committed fallback was used. */
  source: 'live' | 'snapshot'
  description: string | null
  htmlUrl: string
  homepage: string | null
  language: string | null
  topics: string[]
  stars: number
  forks: number
  openIssues: number
  license: string | null
  defaultBranch: string
  createdAt: string
  pushedAt: string
  archived: boolean
  readmeHtml: string | null
  /**
   * The newest full release, by GitHub's definition — no drafts, no
   * pre-releases. Null for a repo that has only ever tagged pre-releases.
   */
  latestRelease: { tag: string, url: string, publishedAt: string } | null
  /**
   * The most recent releases, newest first, pre-releases included. Comes from
   * the same list call `latestRelease` is derived from, so it costs nothing
   * extra against the rate limit.
   */
  releases: Release[]
  crateVersion?: string
  crateDownloads?: number
  crateUrl?: string
  docsUrl?: string
}

export type EnrichedProject = Project & {
  meta: RepoMeta | null
  /** `project.example.code`, syntax-highlighted on the server. */
  exampleHtml?: string | null
}
