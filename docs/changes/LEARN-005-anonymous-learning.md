# LEARN-005 — anonymous learning without profile or account gates

## Identity

- **Issue:** `LEARN-005`
- **Status:** active
- **Owner:** Codex
- **Date:** 2026-10-24

## User-visible problem

The public Learning flow asks who is learning, offers sign-in and presents several competing
destinations before the learner reaches a lesson. Inside a lesson, the required output is
separated from a low-contrast source link, then the learner must choose a method before the task
is clear. Daily per-language streaks also turn missed days into debt instead of supporting a
flexible five-minute self-study habit.

## Completion evidence

`/learning` has one primary start action followed by a compact, device-local learning rhythm.
Public lesson pages show the exact task beside a prominent source action, prescribe one sensible
method, restore drafts automatically and record Done without authentication. No public learning
surface contains a profile chooser, sign-in prompt or named learner copy. Progress uses a rolling
7-day rhythm and neutral history rather than punishing separate language streaks.

## Scope

### May edit

- Public Learning routes and their directly rendered start, lesson, local-practice and progress
  components.
- Public Learning styles directly supporting the revised hierarchy and accessible source action.
- Product, architecture and decision documentation describing the public learning boundary.
- Direct tests only if existing behavior changes require them.

### Must not edit

- Studio authentication or authorization.
- Lesson packets, Done/streak records, storage schema, database schema or account API.
- Studio submission, review or authentication flows.
- Existing profile/account components beyond unmounting them from the public flow.

## Constraints

- Preserve existing local drafts and completion records; delete no browser or server data.
- Keep the existing device namespace internally for backward compatibility; do not expose it as
  identity in the public UI.
- Do not expose private attempts to anonymous visitors.
- Add no dependency and no new account/session abstraction.
- Do not infer CEFR/HSK/JLPT progress from Done, frequency or elapsed time.

## Plan

1. Reduce `/learning` to the suggested lesson and a lightweight rolling activity summary.
2. Recompose the lesson so the required task and a high-contrast source action are one learning
   step; remove the up-front method choice from anonymous practice.
3. Auto-restore local work, keep one clear save/Done path and move review/export controls behind
   optional disclosure.
4. Replace visible per-language streak pressure with a 3/5/7-session rolling rhythm and neutral
   28-day history; keep test milestones evidence-based.
5. Run focused tests, lint, type-check/build and verify the complete browser flow.

## Verification

- [x] Focused learning tests
- [x] `npm run lint`
- [x] Production build / TypeScript
- [x] No public profile/account prompt or learner name in the revised render tree
- [x] Start action targets a real lesson without authentication
- [x] Required task is rendered before the prominent external source action
- [x] Local output and Done controls remain available
- [x] Rolling rhythm does not punish a missed calendar day or require three languages daily
- [ ] Production route check after deployment

## Result

- **Files changed:** `/learning`, the suggested-start component, public lesson composition,
  anonymous practice, local progress summary/styles, direct Learning styles and documentation.
- **Evidence:** 26 library tests pass; ESLint passes; `tsc --noEmit` passes; clean-cache
  `next build` passes. Server-rendered local route QA is blocked because this workspace has no
  usable `data/blog.db`; this is an environment/runtime fixture issue, not a compile failure.
- **Commit/deployment:**
- **Not checked / remaining risk:** visual browser QA and the live production route remain pending
  until this change is committed and deployed. Existing localStorage/profile-key compatibility is
  preserved but intentionally hidden from the public UI.
