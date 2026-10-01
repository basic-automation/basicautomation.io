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

/** One file on a release that a person downloads to install the app. */
export interface ReleaseAsset {
  /** The file name, e.g. `Skidbladnir_1.0.0_x64-setup.exe` */
  name: string
  /** GitHub's direct download URL for it */
  url: string
  /** In bytes, as GitHub reports it */
  size: number
}

/**
 * The release a page's download links point at, with its installable files.
 * See `pickDownload` in `shared/github/releases.ts` for which release that is
 * and which files are left out.
 */
export interface DownloadRelease {
  tag: string
  url: string
  publishedAt: string
  prerelease: boolean
  assets: ReleaseAsset[]
}

/** The live half of a project: whatever GitHub and crates.io report right now. */
export interface RepoMeta {
  repo: string
  /** When the upstream call behind this data was made. */
  fetchedAt: string
  /** 'snapshot' means upstream was unreachable and the committed fallback was used. */
  source: 'live' | 'snapshot'
  /**
   * Which of the optional upstream calls failed for this repo, if any.
   *
   * `source: 'live'` only says the repo itself resolved. The README, the
   * release history and the crate data are each fetched separately and each
   * allowed to fail without sinking the repo — which is right, and which used
   * to mean a page could render with no README and no releases while every
   * health signal on the site said everything was fine.
   */
  incomplete?: ('readme' | 'releases' | 'crate')[]
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
  /**
   * What to download: the newest full release that has installable files, or,
   * for a repo that has only tagged pre-releases, the newest one that has.
   * Null when no release in the list carries any. Comes from the same list
   * call as `releases`, so it costs nothing extra against the rate limit.
   */
  download: DownloadRelease | null
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
