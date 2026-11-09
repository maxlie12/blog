# LEARN-014 — small Daily recall loop

Date: 2026-11-09. Base: PR #2, 0a73ef9. Status: verified on preview; phone QA pending.

## Evidence and scope
PR #2 restores conversation turns/history; it does not change lesson selection or retention.
Daily currently chooses draft → new → due review; fixed reviews only record attendance.
Implement Daily first: draft → oldest due → new; explicit again/hard/remembered self-check;
next review and one practical improvement instruction after saving. Existing conversation
sessions keep their own local history. Do not claim a unified adaptive conversation queue.

May edit: src/lib/{nextLesson,reviewSchedule,localLearningProgress}.ts and direct tests;
src/components/{StartLearning,LearningPath,ReviewCompletion,LessonDetailView,PracticeCoach}.tsx;
docs/{MAX-LEARNING-CONTEXT,ARCHITECTURE,ISSUES,WORK-ROUTER}.md and this brief.
Read: these owners, PR #2 diff, WORK-ROUTER, PRODUCT, AI-WORKFLOW, architecture storage
notes, PracticeCoach, habitSyncServer validation and the existing UI/coding guides.
No Blog, World, Max Note, lesson content, API, DB, dependencies or new storage layers.

## Small changes
1. Reorder the existing selector and align path highlighting/copy. Test priority/stale due data.
2. Add self-check events in the existing completion store. Extend the existing review ID
   convention (review:recall:<rating>:<next interval>:<uuid>), so existing sync and backup
   preserve ratings without any server/schema change. No answer text in these events.
3. Reuse ReviewCompletion for recall prompt, three explicit outcomes and next-date feedback.
   New lesson's first same-day check stays at one day; delayed remembered advances
   1→3→7→14 (14 repeats), hard holds interval, again resets to one day.
   At most one self-check per lesson per Vietnam calendar day; save failures remain retryable.
4. Tests, lint/build, preview UI where available; record phone QA limits honestly.

Old review IDs retain their pending milestone until a self-check exists; after all four legacy milestones, continue at 14 days. Concurrent device
checks resolve deterministically by date/timestamp/id; the latest encoded next interval wins.
This is a simple product heuristic, not validated memory measurement or CEFR assessment.

## Local evidence and review
- 121/121 tests pass. Covers selection priority, ignored stale/missing/future entries,
  immediate versus delayed recall, reset/hold/advance/cap, legacy milestones, same-day
  deterministic merges, invalid IDs, restore, sync transport and retry after failed writes.
- npm run lint passes; npm run build passes with a schema-only local SQLite fixture.
  Initial worktree symlink to dependencies was rejected by Turbopack; copied the existing
  installed dependencies locally and rebuilt successfully. No dependency/config change.
- Correctness: ratings only after explicit action; same-day repeats rejected; old data retained.
  Privacy: no raw recall answer/audio transmitted, only existing metadata fields/IDs.
  Load/performance: existing personal-use store/limits, no added request or dependency.
  Test gap at local checkpoint: browser Daily loop pending; subsequently verified below. Real-phone viewport/keyboard/microphone remains pending.
- Source commits: selector 9b22047; recall slice 664fac1. No production merge/release.


## Preview evidence (664fac1)
- Vercel preview built successfully. UI-only QA with synthetic text on Daily 2026-11-09
  English listening: typed → left → primary card resumed draft → exact answer restored →
  Done → recall prompt → comparison → again via keyboard → refresh.
- After refresh: saved again on 2026-11-09, next review 2026-11-10, one improvement
  instruction. Rating buttons absent that day, so another click cannot jump the schedule.
- Visible recall controls measured 45px high, Enter activated comparison/rating, no overflow
  at 1363px. Existing mobile CSS wraps actions and makes completion buttons full width.
- Real phone viewport/virtual keyboard/microphone not verified: available browser API has
  no viewport resizing and cannot reach executor localhost. No mobile-pass claim.
- Due-date advancement/reset/hold and sync/restore are covered with fixed-date tests;
  waiting a real day and live cross-device sync were not performed.
- Remaining product scope: adaptive recall is Daily only. Conversation still uses PR #2
  resume/history. Weakness feedback is a rule-based instruction from the learner's rating,
  not a diagnosis of their answer or pronunciation. No AI/DB/dependency was added.
- Preview: https://maxlie-blog-f7vyg53pq-luanweabus-projects.vercel.app/learning
- Review: correctness/legacy compatibility/storage failure/sync transport covered by tests;
  privacy boundary preserved; no unrelated source changes. Keep PR draft for phone QA.
