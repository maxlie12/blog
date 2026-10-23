# LEARN-004 — remove the main-page lesson catalog

## Identity

- **Issue:** `LEARN-004`
- **Status:** verified
- **Owner:** Codex
- **Date:** 2026-10-23

## User-visible problem

The Learning page first chooses a purposeful next lesson, then immediately exposes a second,
large “Choose a lesson” catalog with language, level, review and skill filters. The two entry
points compete and make the curriculum feel like an unordered list.

## Completion evidence

`/learning` has one learning decision: resume a draft, open a due review or start the next lesson.
The mixed catalog and its level explainer are absent. A learner who deliberately wants an older
lesson can still open the separate dated archive.

## Scope

### Read

- `docs/WORK-ROUTER.md`, relevant learning-page product description
- `src/app/learning/page.tsx`, `src/components/LearningExplorer.tsx`
- `src/components/StartLearning.tsx`, `src/app/learning/daily/page.tsx`

### May edit

- `src/app/learning/page.tsx` — remove the catalog mount and clarify the single entry point.
- `src/components/StartLearning.tsx` — replace the obsolete “filters below” hint with the archive link.
- `src/app/learning/daily/page.tsx` — correct the back-link label after catalog removal.
- `docs/PRODUCT.md`, `docs/ISSUES.md`, `docs/STATUS.md`, this brief — keep the visible product contract current.

### Must not edit

- Lesson selection rules, content packets, Done/streak data, Farm, auth, Studio or database schema.

## Constraints

- Keep the deterministic draft → due review → next lesson decision unchanged.
- Do not delete lessons or completion data; this is navigation simplification only.
- Keep the dated archive reachable without making it another primary action.
- Add no dependency or new client state.

## Plan

1. Remove the main-page catalog provider, skill cards, picker and duplicate level explanation.
2. Update entry-point copy and the archive/back-link labels.
3. Run tests, lint, type-check and production route verification.

## Verification

- [x] Existing next-lesson tests
- [x] `npm run lint`
- [x] TypeScript production type-check
- [x] `/learning` has one primary learning action and no “Choose a lesson”
- [x] Dated archive remains reachable
- [x] Production route check after deployment

## Result

- **Files changed:** `src/app/learning/page.tsx`, `src/components/StartLearning.tsx`,
  `src/app/learning/daily/page.tsx` and targeted product/status documentation.
- **Evidence:** 26 tests, ESLint and `tsc --noEmit` passed. Production `/learning` contains no
  catalog, skill cards, filters or duplicate level explainer. Its primary action opens a real
  lesson with a goal, source, required output, response field and Done flow. The dated archive
  remains linked as “Mở lịch sử bài học”.
- **Commit/deployment:** implementation commit `9fbf04f`; Vercel GitHub status succeeded and
  production was inspected on 2026-10-23.
- **Not checked / remaining risk:** a real 375px viewport was not available. The local production
  build still stops on the workspace's existing invalid SQLite persistence fixture; Vercel's
  production build succeeded. Dormant catalog components remain in the repository but are not
  mounted on `/learning`, avoiding unrelated cleanup in this change.
