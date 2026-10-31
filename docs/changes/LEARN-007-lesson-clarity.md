# LEARN-007 — clearer lesson page and home

## Identity

- **Issue:** `LEARN-007`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-10-29

## User-visible problem

A five-minute lesson reads like a long policy page: the Done/CEFR disclaimer appears three
times, the UI mixes English and Vietnamese, a guest on a speaking lesson cannot record, "Gửi
audio" reads as if the app accepts audio, and the home page renders the whole 86-lesson library
(≈22,000px on a phone).

## Completion evidence

1. Packets and practice drills say audio is sent to ChatGPT, outside the app.
2. A guest on a speaking lesson can record, play back and use on-device transcription
   (SPEAK-001); the draft is appended to the practice answer.
3. Lesson page: one Done/CEFR disclaimer, Vietnamese learner-facing labels, back link and
   form controls at least 44px, and the mobile "Viết câu trả lời" action reaches the signed-in
   answer field too.
4. Home shows the existing "Phiên học tiếp theo" card instead of the lesson library; the full
   library stays reachable from `/learning`.

## Scope

### May edit

- `content/daily-lessons/*.json` — "Gửi audio" wording only.
- `docs/DAILY-LEARNING.md` — tell the packet author to name ChatGPT as the audio recipient.
- `src/components/SpeakingRecorder.tsx` (new) — recorder moved out of the attempt form so the
  guest practice flow can reuse it.
- `src/components/AttemptSubmitForm.tsx`, `src/components/PracticeCoach.tsx`,
  `src/components/LessonDetailView.tsx` — labels, disclaimers, recorder use, answer field id.
- `src/app/page.tsx` — replace library with `StartLearning`.
- `src/app/globals.css` — touch-target sizes only.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Attempt server action, Prisma, sync API, Done/streak logic, lesson selection.
- `LearningExplorer`/`LessonFilterProvider` (still used elsewhere or deletable later).

## Constraints

- Done/streak stays habit data; the remaining disclaimer must still say so.
- No new dependency; no new stored field.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (30/30)
- [x] Browser 390px: home, guest speaking lesson (record → transcribe → Done), signed-in lesson
- [x] Touch-target scan reports no lesson-page control under 44px

## Result

- **Files changed:** 12 packets in `content/daily-lessons/` (21 wording edits),
  `docs/DAILY-LEARNING.md`, `src/components/SpeakingRecorder.tsx` (new),
  `AttemptSubmitForm.tsx`, `PracticeCoach.tsx`, `LessonDetailView.tsx`, `src/app/page.tsx`,
  `src/app/globals.css`, `docs/ISSUES.md`, this brief.
- **Evidence (2026-10-29, local `next start` on a migrated copy of the local DB, Playwright
  390×844):** home 22,000px / 4,546 words / 86 lesson links → 2,610px / 299 words / 1 link with
  "Bắt đầu học →". Guest en speaking lesson: 507 → 446 words, CEFR mentioned once, no English UI
  labels, no control under 44px; record → "Chép lời trên máy" appended the spoken sentence to the
  answer → "Lưu câu trả lời & ghi Done" showed "ĐÃ GHI NHẬN". Signed-in: 399 words, no control
  under 44px, the mobile "Viết câu trả lời" action now focuses the answer field (it did nothing
  before because the field had no id).
- **Not checked / remaining risk:** `LearningExplorer` and `LessonFilterProvider` are no longer
  imported anywhere — delete them and their CSS in a follow-up. Server-action error text is still
  English. zh/ja lessons and real phones not checked.
