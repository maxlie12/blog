# LEARN-015 — verify Daily readiness, repair only observed blockers

Date: 2026-11-09. Base: PR #2 HEAD 075e882. Status: verified on desktop preview; phone QA unavailable.

Read MAX-LEARNING-CONTEXT, LEARN-013/014, WORK-ROUTER, AI-WORKFLOW, current PR commits;
StartLearning, PracticeCoach, ReviewCompletion, ConversationPractice, nextLesson,
reviewSchedule, localLessonState and localLearningProgress. No repeat implementation.
Baseline: 122 tests, lint and production build pass; latest preview loads bilingual Daily links.

May edit: src/components/PracticeCoach.tsx (explicit safe draft save and truthful restore
status), src/lib/localLessonState.ts and direct tests (validate the same draft for resume
and restore, catch damaged records), docs/MAX-LEARNING-CONTEXT.md, docs/ISSUES.md and
this brief; src/components/StartLearning.tsx and src/lib/nextLesson.test.ts for the observed duplicate Chinese entry when the primary recommendation is Chinese. Add another path here with evidence before editing it.
No Blog, World, Max Note, new schema/DB/dependencies/AI, production release or merge.

Observed source issues: pending debounce has no explicit flush action before leaving;
completed answers restore with a contradictory "not Done" message; malformed JSON can
escape the restoration effect. Preserve legacy version/keys and existing answers.

QA uses only synthetic data on a fresh preview origin, never real learner storage.
Browser has no viewport/device emulation API. A local 390px iframe harness was rejected
by the browser URL policy (file protocol); do not attempt a workaround. Desktop UI QA
and responsive CSS inspection are distinct from phone emulation/real-phone testing.

Acceptance: English and Chinese save → leave/reload → resume exact answer → Done →
recall before comparison → rating → persisted next date. Verify due prioritization via
existing metadata import with synthetic historical completion if file upload is supported.
Check keyboard, 44px controls, overflow, readable state feedback, microphone if supported.
Record exact tests/commits/preview and limitations; keep PR draft and production untouched.

UI evidence on 075e882: importing synthetic historical EN/ZH Done records prioritizes ZH due 2026-11-07 over EN due 2026-11-09, but both entry buttons point to that ZH lesson. Keep an English subset entry when primary is not English; hide duplicate ZH subset entry when primary is already Chinese. Microphone attempt reports unavailable; text fallback remains usable.


## Final evidence
- Baseline HEAD 075e882: 122 tests, lint and production build passed before edits.
- Fix 016ead8: explicit draft save flushes current text, truthful restored Done state,
  shared draft validation and caught malformed JSON. One regression covers valid/invalid
  restore and recommendation consistency. Manual saves validate 1–60 whole minutes.
- Fix 875e63b: English remains one tap away when Chinese draft/review is primary;
  duplicate Chinese action hidden. English subset regression added.
- Final: 124/124 unit tests, npm run lint, npm run build, git diff --check pass.
- Browser EN at 016ead8: manual Save → leave → reload Learning → Resume → exact text
  restored → Done via Enter → recall prompt before comparison → remembered → reload.
  Outcome retained, Done stayed recorded, next date 2026-11-10. No repeat rating that day.
- Browser ZH at 875e63b: same full loop with Chinese text and hard rating. After reload,
  exact answer, Done and hard outcome persisted; next date 2026-11-10. English action
  visible when Chinese draft is primary, without duplicate Chinese action.
- Synthetic historical metadata import at 075e882: Chinese due 2026-11-07 selected before
  English due 2026-11-09 and before new lessons. Selector/scheduler did not change in this
  readiness pass. Fixed-date tests cover draft → due → new and reset/hold/advance/cap.
- All browser writes used fresh immutable preview origins and synthetic QA-prefixed answers
  or a synthetic backup without a real sync token. No actual learner profile was edited.
- Keyboard Enter works for save, Done, comparison and rating. Recall buttons 45px high;
  no horizontal overflow at 1363px; final app-origin console error sample empty.
- Microphone on 075e882 reported browser unavailable; text input remained enabled.
  Actual voice/audio/transcription quality is not verified. Conversation source unchanged.
- Responsive CSS inspected (44px min-height, wrapping actions, full-width completion button
  on narrow screens), but phone viewport/virtual keyboard/touch/Safari not verified. The
  browser has no resizing API; local file harness denied by URL policy, no workaround used.
- UI automation had one reload/click timing timeout; a fresh snapshot and normal click
  continued successfully, with no data loss or application error.
- Code preview Ready: https://maxlie-blog-dvma3dyw3-luanweabus-projects.vercel.app/learning
- Desktop screenshot: max-learning-qa-1794219572269.jpg (scratch QA evidence, not a phone).

## Review and handoff
Correctness: one shared parser, existing keys/version preserved, no Done on draft save.
Privacy: no new transport; no raw answer/audio upload. Load/performance: no new fetch,
no library added. Test gaps are above. No Blog/World/Max Note/API/schema edits.
Self-rating schedules practice, not correctness grading; it does not prove CEFR/HSK,
retention or pronunciation. Keep the PR unmerged and production untouched.

Tonight: open the Ready preview on the same phone browser; choose EN or Chinese;
spend 5 minutes on the source/output; use Save draft to stop or Done when finished;
recall before comparison, rate honestly and check next date; reopen once to confirm.
Stay on the same origin/browser: metadata backup does not carry answer text or audio.
Stop feature work after this readiness pass; follow up only on reproduced study blockers.
