# LEARN-013 — resume and reopen conversation practice

- Status: verified on preview; real-phone QA pending
- Owner: Codex
- Date: 2026-11-09

## Problem and evidence

Production Learning starts with conversation scenarios. Their local history is separate from
Daily Done/review metadata. The launch cards show no saved progress; opening after completion
starts a blank session, hiding earlier work behind history. The current speaking turn is lost
on refresh because only the stage is saved.

## Scope

Read: Learning page, ConversationPractice and its storage/tests/styles, localLearningProgress,
learnerProfiles, reviewSchedule, PracticeCoach, architecture storage notes.

May edit:
- src/lib/conversationPractice.ts and its direct test: optional backward-compatible saved turn.
- src/components/ConversationPractice.tsx: existing history on launch cards and resume/reopen.
- src/app/learning/page.tsx: clarify where Daily history and scheduled review are found.
- src/components/LocalProgressSummary.tsx: clarify the counter and backup boundaries.
- docs/changes/LEARN-013-resume-review.md, docs/ISSUES.md: evidence and work tracking.

Do not edit Blog, World/Farm, other projects, auth, API, database, Daily completion/scheduling,
lesson content, shared styles or dependencies. No new storage abstraction or AI feature.
Conversation history remains device-only and never becomes assessed proficiency or Daily Done.

## Acceptance

- Launch cards show drafts/completed sessions and reopen the existing session.
- A refresh resumes the saved speaking turn; old records without turn remain readable.
- Completed output and chosen phrase can be reopened without creating another session.
- Explicit new practice retains earlier history; failed reads/writes show a useful warning.
- Clearly distinguish conversation history, Daily habit counts and the metadata-only backup.
- Run focused tests, full test suite, lint/build and browser checks where available.

## Verification so far

- 113/113 tests pass, including legacy turn default, turn persistence and invalid writes.
- npm run lint and npm run build pass. Dependency installation used --ignore-scripts
  after ONNX GPU binary download timed out; Prisma client generated separately. No lockfile change.
- Production baseline inspected in browser before editing. Local browser QA is unavailable:
  the remote browser cannot reach the executor's localhost. Preview verification subsequently completed (see below).
- Connected-code review: correctness (validated turn, old history preserved), privacy
  (no new requests or server answer storage), load (two existing local histories), tests
  (storage regressions covered), performance (no dependency), lean code (reused storage/UI).
- Blog/World/Farm sources, APIs, database schema and dependencies have no changes.
- Conversation completion is still self-reported; reopening is review, not an assessment.

## Preview verification

- Vercel Git preview cb9ab76 built and deployed successfully.
- Browser UI: typed test text on turns 1/2, refreshed, reopened and confirmed turn 2/3
  plus the exact second answer. Completed all five stages using synthetic QA fixtures.
- Returning to Learning showed one completed session and its saved phrase; reopening
  showed the takeaway fields and explicit new-session action, without making another session.
- No horizontal overflow at 1363px; visible conversation buttons measured 49px high.
- Console sample showed browser-extension errors only, not application-origin errors.
- Not checked: a real phone viewport, mobile microphone/keyboard, cross-device sync and
  browser storage denial. No production release or learner records were modified.
- Preview: https://maxlie-blog-l5t4hhms4-luanweabus-projects.vercel.app/learning
- Draft PR: https://github.com/maxlie12/blog/pull/2
