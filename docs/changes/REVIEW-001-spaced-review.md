# Change brief

## Identity

- **Issue:** `REVIEW-001`
- **Status:** active
- **Owner:** Codex
- **Date:** 2026-10-22

## User-visible problem

Finishing new lessons can crowd out retrieval of old language, while the current automatic
starter has no real due-date logic or explicit way to record that a review happened.

## Completion evidence

After a lesson is Done, it returns after 1, 3, 7 and 14 days. A due review is selected before a
new lesson (unless a saved draft is unfinished). The lesson page shows one explicit review
button; clicking it records the review, preserves the streak and reveals the next due date.
Review activity never increases the count of unique Done lessons or changes a claimed level.

## Scope

### Read

- `docs/ARCHITECTURE.md`, local progress section
- `src/lib/localLearningProgress.ts` and direct tests
- `src/lib/nextLesson.ts` and direct tests
- `src/components/StartLearning.tsx`
- `src/components/LessonDetailView.tsx`

### May edit

- `src/lib/reviewSchedule.ts` and direct test — pure 1–3–7–14 scheduling contract
- `src/lib/localLearningProgress.ts` and direct test — persist explicit review events and expose due items
- `src/lib/nextLesson.ts` and direct test — prioritize a due review after an unfinished draft
- `src/components/StartLearning.tsx` — explain the selected due review
- `src/components/ReviewCompletion.tsx` — explicit learner action and next due date
- `src/components/LessonDetailView.tsx` — mount the shared review action
- `docs/ARCHITECTURE.md` — document review-event meaning in the existing completion store
- `docs/ISSUES.md`, `docs/STATUS.md`, this brief — verified status and evidence

### Must not edit

- Lesson content, Farm, auth, Studio, database schema or proficiency assessment.

## Constraints

- A review is stored only after an explicit learner click.
- Done/streak is habit data, not proficiency evidence.
- Review metadata may sync; answers, audio and feedback do not enter the progress store.
- Keep one primary action and a 44px touch target; announce save results without moving focus.
- Add no dependency and keep the current storage schema compatible.

## Plan

1. Add and test the deterministic scheduler.
2. Connect due items to automatic lesson selection.
3. Add the explicit review action and next-date feedback.
4. Run focused tests, lint, build and production-route verification.

## Verification

- [ ] Fixed tests: due dates, multiple same-day completions, Asia/Ho_Chi_Minh boundary
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Mobile/keyboard status and 44px action check
- [ ] Persistence after refresh
- [ ] Production route check after deployment

## Result

- **Files changed:** pending
- **Evidence:** pending
- **Commit/deployment:** pending
- **Not checked / remaining risk:** pending
