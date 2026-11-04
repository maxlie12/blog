# LEARN-014 · Connected Daily learning · milestone 1

Status: owner authorized pushing the reviewed milestone on 2026-11-05; release checks pending.

## Goal
Daily exposes dated packets and individual lessons with the same device-local draft/Done state used by StartLearning. Existing blog stages remain supplementary topics, not an implied proficiency ladder. Preserve all existing drafts.

## Allowed files
- `src/app/learning/daily/page.tsx`, `src/components/DailyLessonLibrary.tsx`: guest-first date/lesson browser.
- `src/lib/localLessonState.ts`, its tests, `src/components/StartLearning.tsx`: shared draft status and contextual next-lesson card.
- `src/components/LearningPath.tsx`: clarify Daily versus blog topics, remove click-to-read completion.
- `src/components/LessonDetailView.tsx`: show Daily date and return to its packet.
- This brief: evidence and next milestone.

## Boundary
No content-packet edits, game changes or account provisioning. Owner authorized pushing the existing Learning changes on 2026-11-05; the existing Git integration may deploy that push. Account-backed answer sync remains a separate milestone.

## Acceptance
Date and lesson views, language/skill/status selection, honest status labels, matching StartLearning draft detection, explicit blog read confirmation and contextual Daily links. Tests/lint/build; browser preview only when available.

## Verification · 2026-11-04
- 73 tests passed (8 focused tests across session history and Daily status/selection).
- Lint passed; production build and TypeScript passed.
- Latest upstream changes are farm/music-only; no remote or unrelated changes overwritten.
- No commit/push/deployment. Browser interaction/mobile verification still pending; do not call this a live preview.

## Remaining milestone
Optional passwordless account sync for private draft/session contents is not implemented here. Authenticated server submissions and local Done are still distinct records; reconcile deliberately in the sync milestone rather than treating reviewed counts as local completion.

## Known review limitations accepted for this incremental push
- Authenticated submissions and guest-local Done are not yet unified.
- New lessons still precede due review in the default next-lesson selector.
- Filters are not yet collapsed for mobile; no mobile/browser interaction verification.
- The fixed seven-stage Digital Detox flow remains a separate specialist session.
- Clear save-status feedback for edits to completed Daily lessons remains follow-up work.
