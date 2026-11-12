# ASSESS-001 — Writing rubric and one-step retry (slice B)

Date: 2026-11-12. Base `75158b04728599f639a1880b4d1bad608c173809`. Existing English Listening Lab already has dictation scoring and a self-review checklist. This slice adds **form feedback and a specific next retry action**, not a new proficiency grade.

## PM/BA acceptance
- At Writing step, a learner writes a private optional short answer, requests rubric and sees observable evidence: sentence count relative to that prompt, reuse of at least two lesson terms, and final punctuation.
- At most one priority correction is suggested; edit in the same textarea and the criteria refresh, permitting a retry.
- Meaning, grammar, task fulfillment and CEFR are explicitly **not** automatically graded. Existing dictation/checklist score and Done conditions remain untouched.
- Draft is in memory on this page only, not sent to a model, server or a new storage key. Do not use actual learner answers in tests.

## Architect/DEV
- Small pure `writingRubric` function next to existing `writingCheck`; one short UI section in `LabLesson`.
- No dependency, auth, schema or migration changes; content is already lesson-local. Rollback: revert the PR.

## TEST/QA
- Unit test weak/strong/empty and prompt-specific minimum (including 4 sentences); no automatic grade of semantics.
- Existing `npm test`, `npm run lint`, `npm run build` workflow, plus Chromium and WebKit mobile E2E on 390/320px.
- E2E: enter weak text → inspect feedback → fix → inspect updated feedback; unchanged daily save/reload/recall and Listening Lab evidence labels. Never claim physical iPhone, native Safari keyboard or real microphone passed.
- QA requires exact CI logs, preview/production SHA, and no localStorage key/content leakage.
- Release only with both CI workflows green and Vercel preview READY on reviewed SHA.
