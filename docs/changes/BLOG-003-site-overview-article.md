# BLOG-003 — site overview article

## Identity

- **Issue:** `BLOG-003`
- **Status:** verified
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

Nothing on the site explains in one place what maxlie-blog is, what it contains and how it works.

## Completion evidence

- `/blog/inside-maxlie-blog` is an English overview of the site in the existing study format:
  bold words with hover meanings, right-hand panel, end-of-article glossary.
- An optional speaking lesson on 2026-11-01 asks the learner to explain the project aloud. The
  automation's main listening lesson stays first.
- The article only states what the repository or the live site shows, and keeps Done/streak
  separate from reviewed evidence.

## Scope

### May edit

- `content/articles/inside-maxlie-blog.mdx` (new) — the article and its `study` data.
- `content/daily-lessons/2026-11-01.json` — append one optional lesson, others unchanged.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Application code, Prisma, Done/streak logic, deployment configuration, domain settings.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (32/32)
- [x] Browser: article at 1280px and 390px, hover cards on every bold word, no horizontal scroll
- [x] Lesson opens the article; `/learning` still offers the main listening lesson first

## Result

- **Evidence (2026-11-01, local `next start`, Playwright):** article 200 at 1280px and 390px, no
  horizontal scroll, all 22 study words and verbs carry hover cards, 14 glossary entries. The
  lesson opens the article and `/learning` still offers `daily-2026-11-01-en-listening` first.
- **Not checked / remaining risk:** facts come from the repository docs, code and the live home
  page; production database and sync settings were not inspected, so the article describes
  them as optional. Dark mode not checked.

Visible in production on 2026-11-01; see `docs/STATUS.md`.
