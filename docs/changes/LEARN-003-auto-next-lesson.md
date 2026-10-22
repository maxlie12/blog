# LEARN-003 — automatic next lesson

## Identity

- **Issue:** `LEARN-003`
- **Status:** active
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

- [ ] Focused selector and local progress tests
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 375px, keyboard and reduced-motion check
- [ ] Production route after deployment

## Result

- **Files changed:** pending
- **Evidence:** pending
- **Commit/deployment:** pending
- **Not checked / remaining risk:** pending
