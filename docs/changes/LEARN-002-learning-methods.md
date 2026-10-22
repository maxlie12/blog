# LEARN-002 — optional learning methods

## Identity

- **Issue:** `LEARN-002`
- **Status:** deployed; production interaction QA pending
- **Owner:** Codex
- **Date:** 2026-10-22

## User-visible problem

The current practice form forces every learner through the same multi-step repair flow before
Done becomes available. It does not clearly offer different useful ways to practise the same
lesson in a short mobile session.

## Completion evidence

The learner chooses one suitable method, sees its exact action and output, saves one real
response and can record Done immediately. Self-check and repair remain available but optional.
The selected method is restored with the device-local draft; signed-in learners receive the
same choices before submitting a private attempt.

## Scope

### Read

- `docs/PRACTICE-COACH.md`
- `docs/GUIDED-PRACTICE.md`
- `src/components/PracticeCoach.tsx`
- `src/components/LessonDetailView.tsx`
- `src/lib/localLearningProgress.ts`

### May edit

- `src/lib/learningMethods.ts` and its direct test — method definitions and skill filtering.
- `src/components/PracticeCoach.tsx` — method choice and progressive disclosure.
- `src/components/AttemptSubmitForm.tsx` — expose the same choices to signed-in learners.
- `src/components/LessonDetailView.tsx` — pass the lesson language needed for local Done/streak.
- `src/app/globals.css` — mobile/touch presentation for the new controls.
- `docs/PRACTICE-COACH.md`, `docs/ISSUES.md`, `docs/STATUS.md` — verified behavior/status.

### Must not edit

- Farm/game, auth, Prisma, Studio and deployment configuration.
- Daily packet schema or existing learner completion records.

## Constraints

- Done/streak is habit data, not proficiency evidence.
- Existing version-1 local drafts must still restore.
- Method cards use native radio controls and 44px touch targets.
- No new dependency and no AI call on page load.

## Plan

1. Define a small shared method catalogue filtered by skill.
2. Persist the optional method ID in the existing local draft.
3. Make one saved response sufficient for Done.
4. Put self-check and repair behind an optional disclosure.
5. Let a signed-in learner record habit Done after a successful private submission.
6. Run focused tests, lint and build; review the connected flow.

## Verification

- [x] Focused method test
- [x] Existing local progress tests
- [x] `npm run lint`
- [x] `npm run build`
- [x] Mobile/keyboard code review: native radios, labels, 44px targets and one-column phone layout
- [x] Vercel deployment status for code commit
- [ ] Direct production interaction check

## Result

- **Files changed:** shared method catalogue/test, anonymous and signed-in lesson forms, focused
  styles and workflow/status documentation.
- **Evidence:** 14 tests, lint and production build pass.
- **Commit/deployment:** code commit `57321db`; Vercel status succeeded.
- **Not checked / remaining risk:** the managed runtime cannot start Next because
  `uv_interface_addresses` fails, so the live interaction still needs production browser QA.
