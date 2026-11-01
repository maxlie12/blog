# LEARN-010 — documentation, backup and small cleanup

## Identity

- **Issue:** `LEARN-010`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

Known words and path marks are lost when moving browser or domain, one daily-page button goes
nowhere, Vietnamese pages are announced as English, and the docs no longer match the product.

## Completion evidence

- A backup carries known words and path marks; importing merges them. Older backups still import.
- "Nhịp học & mốc bài test" on `/learning/daily` reaches the progress section on `/learning`.
- The page language is Vietnamese, and English article text and study terms are marked `en`.
- Unused `LearningExplorer` and `lessonFilter` are deleted.
- Docs describe study articles, free practice, the path, the packet naming rule and `proxy.ts`.
  Shipped items move from `ISSUES.md` to `STATUS.md` with production evidence.

## Scope

### May edit

- `src/lib/localLearningProgress.ts`, `.test.ts`, `src/lib/studyPath.ts` — backup fields.
- `src/app/learning/daily/page.tsx` — the dead link.
- `src/app/layout.tsx`, `src/lib/mdx.tsx`, `src/app/blog/[slug]/page.tsx`,
  `src/components/ArticleStudy.tsx`, `src/components/GlossTerm.tsx` — language attributes.
- `src/components/LearningExplorer.tsx`, `src/lib/lessonFilter.tsx` — delete; nothing imports them
  except each other.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTENT-GUIDE.md`, `docs/DAILY-LEARNING.md`,
  `docs/OPERATIONS.md`, `docs/PRODUCT.md`, `docs/STATUS.md`, `docs/ISSUES.md`,
  shipped briefs in `docs/changes/` (status and evidence only).

### Must not edit

- Done/streak logic, sync API, Prisma, lesson packets, Studio. `docs/DECISIONS.md` stays as history.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (44/44)
- [x] Browser: backup round trip into a fresh browser; link target; `lang` values; no regression
      on article, path and practice pages

## Result

- **Evidence (2026-11-01, local `next start`, Playwright):** one known word and one path mark were
  created in the UI, exported with "Xuất bản sao" and imported into a fresh browser, which showed
  "Đã nhớ 1/14" and the read step done. Older and malformed backups are covered by tests. The daily
  link reaches `#local-progress-title` in view. On a study article: `html` vi, title and prose en,
  reading note and hover card vi. Seven main routes returned 200 with no page errors.
- **Not checked / remaining risk:** a backup taken before this change has no words or marks, so take
  a new backup before changing domain. Navigation and other English site text now sit inside a `vi`
  page without their own `lang`. Articles without `study` have no `lang`. `globals.css` keeps styles
  for the deleted catalog; removing them was left out to keep this change small.
