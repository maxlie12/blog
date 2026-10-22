# LEARN-003 — automatic next lesson

## Identity

- **Issue:** `LEARN-003`
- **Status:** verified in production
- **Owner:** Codex
- **Date:** 2026-10-22

## User-visible problem

The Learning page exposes the whole lesson library before offering a simple way to begin a suitable short session.

## Completion evidence

One primary action on `/learning` resumes a saved draft or opens the next unfinished lesson for the active learner. It works without AI, does not change level, and keeps Luân/Phi browser data separate.

## Scope

### Read

- `docs/ARCHITECTURE.md`, `docs/LEVEL-LESSONS.md`
- `src/app/learning/page.tsx`, `src/components/LearningExplorer.tsx`
- `src/lib/learnerProfiles.ts`, `src/lib/localLearningProgress.ts`, `src/lib/lessonLevels.ts`

### May edit

- `src/app/learning/page.tsx` — place the primary start action.
- `src/components/StartLearning.tsx` — read profile-local state and expose the action.
- `src/lib/nextLesson.ts`, `src/lib/nextLesson.test.ts` — deterministic selection and focused evidence.
- `src/lib/localLearningProgress.ts`, `src/lib/localLearningProgress.test.ts` — expose completed lesson IDs without repeated store reads.
- `src/app/globals.css` — responsive, accessible visual treatment.
- `docs/LEVEL-LESSONS.md` — document selection behavior.
- `docs/ISSUES.md`, `docs/STATUS.md`, this brief — track verified outcome.

### Must not edit

- Lesson content, Farm/game, Studio, auth, Prisma, deployment configuration.

## Constraints

- Done/streak is habit data, not proficiency evidence.
- Do not use public/server review counts as another learner's local completion state.
- No random choice, AI call, new dependency or automatic level promotion.
- Keep one primary action and a 44px touch target; preserve keyboard focus.

## Plan

1. Add a pure selector with profile language/level priorities.
2. Read profile-local drafts and Done IDs in a leaf client component.
3. Add one Start action to `/learning`, then verify tests, lint, build and responsive behavior.

## Verification

- [x] Focused selector and local progress tests
- [x] `npm run lint`
- [x] `npm run build`
- [x] Keyboard semantics, 44px target and responsive/reduced-motion code review
- [x] Production route and primary navigation

## Result

- **Files changed:** one leaf Start component, pure selector/test, local Done-ID accessor/test, Learning page/styles and focused docs.
- **Evidence:** 19 tests, ESLint and production build pass. Production `/learning` displayed the recommendation for Luân; its native link opened `daily-2026-10-10-en-listening`, and the button measured 44.95px high.
- **Commit/deployment:** code commit `09a1e92`; visible on `https://maxlie-blog.vercel.app/learning`.
- **Not checked / remaining risk:** no 375px browser emulation was available. Phone layout is covered by the existing mobile-first one-column CSS; profile-specific draft/Done branches are covered by fixed tests rather than changing production learner data.
