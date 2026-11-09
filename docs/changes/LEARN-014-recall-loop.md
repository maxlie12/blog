# LEARN-014 — small Daily recall loop

Date: 2026-11-09. Base: PR #2, 0a73ef9. Status: implementation.

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
