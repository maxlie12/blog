# LEARN-013 · Preserve Guided Practice sessions

Status: owner authorized pushing this existing change on 2026-11-05; release checks pending.

## Problem and evidence
Starting another session overwrites the only language-specific draft. Learners must be able to reopen and edit earlier English/Chinese sessions without duplicating Done/streak.

## Allowed scope
- `src/lib/guidedSessionHistory.ts` and its test: validated, profile-local history and legacy migration.
- `src/components/GuidedPractice.tsx`: saved-session list, reopen/edit and safe save errors.
- `docs/GUIDED-PRACTICE.md`: document local history limits.
- This brief: verification evidence.

## Boundaries
No remote writes, new dependencies, proficiency inference or automatic history deletion. Keep existing completion identity (`language` + `startedAt`). Browser storage is device-specific and finite; overwritten data from before this fix cannot be reconstructed. Keep legacy latest-draft key for compatibility.

## Checks
Focused migration/update/isolation/failure tests, lint, build, and browser persistence when preview access is available. Do not push or deploy until the owner explicitly approves the preview.

## Local verification · 2026-11-04
- `npm test`: 70 passed, including five new history tests.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript.
- `git diff --check`: passed.
- No commit, push or deployment made. Live browser/mobile QA is not completed; this is a code-and-behavior review preview, not a verified hosted preview.
