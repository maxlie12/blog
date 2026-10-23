# LEARN-001 — reusable takeaway after Done

## Identity

- **Issue:** `LEARN-001`
- **Status:** verified in production
- **Owner:** Codex
- **Date:** 2026-10-23

## User-visible problem

A learner can finish an external source and record Done without a clear answer to “What can I
reuse in another conversation now?” The lesson page also does not show its short learning flow
as one predictable sequence.

## Completion evidence

The lesson page shows a four-step route: goal, source, output, then Done and takeaway. After Done,
one authored phrase, one sentence pattern and one transfer prompt appear. They remain visible
after refresh because visibility follows the existing local completion record. This is a learning
summary, not a CEFR claim.

## Scope

### Read

- `docs/GUIDED-PRACTICE.md`, `docs/DAILY-LEARNING.md`, relevant `docs/ARCHITECTURE.md` lesson/progress sections
- `src/components/PracticeCoach.tsx`, `src/components/LessonDetailView.tsx`
- `src/lib/dailyLessons.ts`, `src/lib/localLearningProgress.ts`
- `content/daily-lessons/2026-10-23.json`

### May edit

- `src/lib/dailyLessons.ts` — validate the optional authored takeaway contract.
- `src/components/LessonTakeaway.tsx` — reveal the takeaway from existing local Done state.
- `src/components/LessonDetailView.tsx` — show the predictable lesson route and mount the leaf client component.
- `src/components/PracticeCoach.tsx`, `src/components/AttemptSubmitForm.tsx` — align the output step label for anonymous and signed-in learners.
- `src/app/globals.css` — focused phone-first route and takeaway styles.
- `content/daily-lessons/2026-10-23.json` — one representative authored fixture.
- `docs/DAILY-LEARNING.md`, `docs/ARCHITECTURE.md`, `docs/ISSUES.md`, `docs/STATUS.md`, this brief — contract and evidence.

### Must not edit

- Farm/game, auth, Studio, Prisma, deployment configuration or proficiency assessment.

## Constraints

- Done/streak is habit data, not proficiency evidence.
- Do not store private answers, audio, feedback or secrets in the public repository.
- Reuse the existing local completion event; add no dependency and no AI call on page load.
- Show exactly one phrase, one pattern and one transfer prompt.
- Keep touch targets at least 44px and do not hide the takeaway behind another click.

## Plan

1. Add the optional authored takeaway contract and one current packet fixture.
2. Add a leaf client component that follows the existing Done record and update event.
3. Clarify the four-step lesson route without rebuilding the page.
4. Run packet validation, tests, lint, type-check and production verification.

## Verification

- [x] Daily packet contract and focused tests
- [x] `npm run lint`
- [x] TypeScript production type-check
- [x] Phone/keyboard/reduced-motion code review
- [x] Done takeaway remains visible after refresh
- [x] Production route check after deployment

## Result

- **Files changed:** optional daily-packet takeaway contract, one current packet, leaf Done-state
  card, lesson route labels/styles and focused documentation.
- **Evidence:** 26 tests, ESLint, TypeScript and JSON parsing pass. Production revealed exactly
  one phrase, one pattern and one transfer prompt after Done, and the card remained after reload.
  Vercel's GitHub check succeeded; app-origin console errors were zero.
- **Commit/deployment:** `4abfc7b`, production at
  `https://maxlie-blog.vercel.app/learning/daily-2026-10-23-en-listening`.
- **Not checked / remaining risk:** local `next build` is blocked by the existing invalid SQLite
  fixture; Vercel built successfully. The managed browser could not emulate 375px, so the phone
  layout has responsive code review but not a phone screenshot.
