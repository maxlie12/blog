# ASSESS-001 slice A — clarify evidence before claiming four-skill ability

Date: 2026-11-12. Baseline: 35d5ae67879cec03e50ffcda2ea6dc0b62df85d7. PM/BA scope: improve interpretation of an **existing** Listening Lab result (not a new assessment exam).

## Business acceptance
- English learner can see how Nghe, Đọc, Viết and Nói are evaluated.
- Nghe/Đọc: choice keys marked machine-graded; Viết: objective dictation + optional self-check; Nói: self-rated, no automatic pronunciation claim.
- An incomplete result may show a percentage for completed parts, but **must be explicitly temporary**, not labeled 'excellent' mastery.
- Done needs all four parts recorded, with no score threshold; it is practice attendance, **not an awarded CEFR level**.
- Local score storage key and schema, answer content and audio policy must not change.

## Design/Dev
Own: `src/lib/listeningLab.ts` and focused test; `src/components/listening/LabLesson.tsx`; synthetic smoke script and its workflow. No new dependencies, no migration or new AI. Static metadata for evidence source is derived at display time. Rollback = revert this PR; stored scores remain readable.

## TEST/QA
- `npm test`, `npm run lint`, `npm run build` in quality workflow, separately check source label unit test.
- Local Next production build + isolated DB, then Chromium and WebKit at 390/320px. Both languages: save → navigate → reload → resume → Done → self-rate → reload. Listening Lab result page must list all four evidence sources and honest no-score state.
- WebKit is a Safari-engine test **not** a real iPhone test. No genuine speech recording, Apple keyboard or audio quality certification.
- Release only when CI and Vercel preview Ready on the tested SHA; if blocked, leave PR open and log failure.
