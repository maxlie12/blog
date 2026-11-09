# LEARN-015 — verify Daily readiness, repair only observed blockers

Date: 2026-11-09. Base: PR #2 HEAD 075e882. Status: active.

Read MAX-LEARNING-CONTEXT, LEARN-013/014, WORK-ROUTER, AI-WORKFLOW, current PR commits;
StartLearning, PracticeCoach, ReviewCompletion, ConversationPractice, nextLesson,
reviewSchedule, localLessonState and localLearningProgress. No repeat implementation.
Baseline: 122 tests, lint and production build pass; latest preview loads bilingual Daily links.

May edit: src/components/PracticeCoach.tsx (explicit safe draft save and truthful restore
status), src/lib/localLessonState.ts and direct tests (validate the same draft for resume
and restore, catch damaged records), docs/MAX-LEARNING-CONTEXT.md, docs/ISSUES.md and
this brief. Add another path here with evidence before editing it.
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
