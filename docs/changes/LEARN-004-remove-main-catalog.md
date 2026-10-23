# LEARN-004 — remove the main-page lesson catalog

## Identity

- **Issue:** `LEARN-004`
- **Status:** active
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

- [ ] Existing next-lesson tests
- [ ] `npm run lint`
- [ ] TypeScript production type-check
- [ ] `/learning` has one primary learning action and no “Choose a lesson”
- [ ] Dated archive remains reachable
- [ ] Production route check after deployment

## Result

- **Files changed:**
- **Evidence:**
- **Commit/deployment:**
- **Not checked / remaining risk:**
