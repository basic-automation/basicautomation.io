---
title: "Fixture: the site's own news"
date: "2026-01-02T12:00:00.000Z"
summary: "A test post in the reserved site section, so /news and a /news/<slug> page render in CI"
---
A test post for CI. It lives in the `site` section, so it renders under
`/news` rather than under a project.

It links to [the projects page](/projects) and to
[a project's about tab](/projects/onyums/about), so the crawler follows both
out of a post.
