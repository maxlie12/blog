# Max Learning — context for the next Work session

Updated 2026-11-09. Start here, then WORK-ROUTER and the active brief.
Source: maxlie12/blog, draft PR #2, branch codex/learning-resume-review. Never merge or
release production without the user's request. Working code is not a verified release.

## Product decision
A small daily English/Chinese practice tool: know what was learned, what can still be
recalled, one weak point and what to review next. Short sessions, phone first. No LMS,
AI, new DB/dependencies or architecture; reuse helpers. Blog, World and Max Note are out
of scope. Completion and self-rated recall never establish CEFR/HSK or pronunciation ability.
Existing Japanese support remains compatible; no new Japanese work is requested.

## What exists / what changed / what remains
| Area | Before PR #2 | Current changes | Still missing / not needed now |
|---|---|---|---|
| Conversation | Local text, five stages, completion; no recall schedule | PR #2 saves speaking turn, exposes history/phrase, reopens completed work | Adaptive conversation review not implemented; do not call Daily universal |
| Daily selection | Draft → new → due | LEARN-014: draft → oldest valid due → new → deterministic fallback review | No global cross-mode planner needed |
| Recall | Four fixed milestones; button records attendance | First check after Done and due checks: again/hard/remembered; next date and practical retry instruction | Self-report, not automatic correctness or an ability score |
| Review spacing | 1/3/7/14 after previous event | Again resets 1; hard holds; remembered at due review advances, cap repeats 14; immediate check stays 1 | No FSRS/SM-2, trained model, tuning dashboard or exam prediction |
| Saving | Browser drafts; metadata sync and private JSON backup | Reuse same completion store and sync transport for recall events | Answers/conversation text/audio still do not travel in metadata backup |

## Contracts and owners
- nextLesson.ts + StartLearning: selector and reason. LearningPath is a catalog, not a
  replacement for the primary resume selector. Keep only valid completed due lessons.
- reviewSchedule.ts: pure scheduler, Asia/Ho_Chi_Minh dates supplied by localLearningProgress.
- localLearningProgress.ts: writes only after explicit click. Existing review:<interval>:<lesson>
  IDs stay readable; new review:recall:<rating>:<nextInterval>:<uuid> IDs carry metadata only.
  No schema expansion. Sync/JSON backup preserve IDs; Done counts exclude review: records.
- Latest self-check wins by date, timestamp, then ID, independent of input order. One check
  per lesson/Vietnam day; no repeated clicks to jump intervals. Missing/corrupt self-check
  IDs do not schedule a review. Old final milestone now continues at 14 days.
- ReviewCompletion: recall prompt first, learner opens comparison, then explicitly rates.
  Remount/refresh displays saved outcome and next date. Storage errors allow retry.
- PracticeCoach keeps existing draft/gap/revision; completion links to the recall section.
- Conversation history remains local in conversationPractice.ts. Never infer retention from
  completion counts or silently convert conversation completion into Daily Done.

## Evening study entry point (2026-11-09)
- The `/learning` landing page now puts `StartLearning` directly above the fold before optional sections; Daily list/path and conversation are collapsible. This only changes page composition and copy, not scheduling/storage.
- This landing change has not been independently browser/mobile QA'd; verify the latest PR preview deploy before claiming it works on a real phone. Keep PR draft and production untouched.
- For first use: open `/learning`, start the suggested Daily, save/done, self-check, return later to confirm persistence; do not expect conversation to use the Daily adaptive scheduler.

## Verification / next smallest work
Read docs/changes/LEARN-014-recall-loop.md for exact evidence and limits.
121 tests, lint and production build pass. Preview Daily save/leave/resume/Done/rate/reload
passed at 664fac1; phone viewport, virtual keyboard and microphone remain unverified.
Required UI loop: learn → save → leave → return → recall → reload; check at phone width,
44px controls, keyboard, no horizontal overflow and honest error status.
If phone/browser access is unavailable, state that explicitly; do not mark phone QA passed.
Next: verify the Daily slice on a real phone before deciding whether conversation needs the
same retention loop. Do not expand scope just to fill this table.
