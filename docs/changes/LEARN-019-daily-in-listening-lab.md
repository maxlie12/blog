# LEARN-019 — Bài mới mỗi ngày ở Phòng nghe, chọn giọng Anh-Mỹ/Anh-Anh

## Identity

- **Issue:** `LEARN-019` (owner, 2026-11-26: thẻ Daily "Tiếp tục từ việc quan trọng nhất" thừa và
  khó hiểu, cần phương pháp cụ thể; Phòng nghe vẫn là chính; cập nhật file md để ChatGPT thêm bài
  mỗi ngày vào đó; thêm chuẩn giọng Anh-Anh)
- **Status:** done — PR #11 merged, production `17e701f`; real-phone voices pending owner check
- **Owner:** Claude
- **Date:** 2026-11-26
- **Builds on:** `LEARN-015-listening-lab.md`, `LEARN-017-speaking-room.md`,
  `LEARN-018-start-card-chatgpt-brief.md`, `docs/DAILY-LEARNING.md`

## PM baseline

- Production `6d03b19`. /learning shows two "start" cards: Phòng nghe (`LabEntry`) and the Daily
  card (`StartLearning`, English + Chinese). Daily English packets arrive almost every day
  (`content/daily-lessons/*.json`, written by the ChatGPT automation per `docs/DAILY-LEARNING.md`)
  but are free-text tasks: no audio player, no graded questions, self-reported Done.
- Phòng nghe has 18 fixed lessons with the six-step method and scores, but nothing new each day.
- All English TTS is forced to en-US (`PronounceButton`, `labShared.speakLines`).
- Owner did not answer which voice option; assumption: an en-US/en-GB switch using the device's
  own voices (no new dependency). Bilingual reading and Vietnamese pronunciation drills: later.

## Acceptance (BA)

- **Daily in Phòng nghe:** a file `content/listening-lab/YYYY-MM-DD.json` holds one lesson in the
  Phòng nghe schema (validated by zod at build and by `npm test`; invalid file fails CI). The
  lesson opens at `/learning/listening/d-YYYY-MM-DD` with the same six steps and scoring.
- **Today:** the newest lesson dated ≤ today (learning timezone) is "Bài hôm nay". Given it is not
  finished, the Phòng nghe card on /learning offers it first ("Bài hôm nay · mới"), with "Học tiếp
  bài N" second; when finished it says so and "Học tiếp bài N" leads. A lesson dated in the future
  is not shown. /learning/listening lists the last 14 daily lessons with status above the levels.
- **Daily card:** /learning no longer shows English Daily on top. The card keeps the Chinese path
  only (heading "Tiếng Trung: bài tiếp theo"); English Daily packets stay reachable in the
  collapsed "Danh sách bài Daily và lộ trình học". The ChatGPT plan section stays on /learning.
- **Voice:** "Giọng đọc: Anh-Mỹ | Anh-Anh" appears in Phòng nghe lessons, tests, Phòng nói and the
  list pages; the choice is saved on the device and used by every English read-aloud (including
  the 🔊 buttons). If the device has no voice for the chosen accent, the page says so, uses another
  English voice, and tells how to add one. VOA mp3 lessons keep their original (American) audio.
- **ChatGPT md:** `docs/DAILY-LEARNING.md` tells the automation to publish the English daily
  lesson as a Phòng nghe file (schema, rules, checks, example), keeping Chinese in daily packets.
- **Credit:** unchanged — lesson Done via `recordLocalCompletion`; self-practice scores only.

## Scope

### May edit

- new `src/lib/labDaily.ts` (+ test), new `src/lib/englishVoice.ts` (+ test),
  new `content/listening-lab/2026-11-26.json` (first daily lesson, original)
- `src/lib/listeningLab.ts` (next-lesson helper takes daily lessons), `src/lib/studyBrief.ts`
  (+ test) (Bài hôm nay in the brief), `src/components/listening/*`, `src/components/StudyBrief.tsx`,
  `src/components/StartLearning.tsx` (Chinese only, no StudyBrief), `src/components/PronounceButton.tsx`
  (accent), `src/app/learning/page.tsx`, `src/app/learning/listening/**`, `src/app/learning/speaking/**`
- `next.config.ts` (trace `content/listening-lab/*.json` into the server bundle like daily packets;
  without it the dynamic /learning page would read an empty folder in production)
- `src/app/page.tsx` (homepage "Học hôm nay" used the same Daily card: it now shows the Phòng
  nghe card, so the homepage and /learning agree)
- `src/app/globals.css` (`ll-` additions), `scripts/learning-mobile-smoke.mjs` (daily + accent check)
- `docs/DAILY-LEARNING.md`, `docs/STATUS.md`, this brief

### Must not edit

- Done/streak logic, daily packet schema, Studio, games, accounts.

## Release path

Branch `claude/learn-019-daily-in-listening` → PR → CI (quality gates + mobile E2E) → Vercel
preview → merge. Rollback: revert the merge commit (production before: `6d03b19`).

## Verification

- [x] Local (no packages could be installed here — network off for npm, so zod/React/Next tests
      run in CI): `englishVoice`, `studyBrief`, `listeningLab`, `speakingRoom` tests 21 pass with
      Node; `tsc --strict` on the pure modules clean.
- [x] CI on PR #11 (`cb2033e`): quality gates (`npm test` incl. `labDaily.test.ts` and
      `englishVoice.test.ts`, lint, build) green; mobile E2E green on rerun — Chromium + WebKit
      "PASS … daily Phòng nghe lesson opens from /learning; accent choice persists" and the
      ChatGPT brief flow. First run: one WebKit timeout in the existing Done/recall flow
      (`study`), passed on rerun → flaky, not caused by this change.
- [x] Found on the way: the LEARN-018 brief preview could be empty when opened before the page
      finished loading (also failing on `master`); fixed by filling it after load, smoke waits.
- [x] Found on the way: every deploy had failed since 2026-11-18 (`npm ci` 404 on an
      onnxruntime GPU binary) → `OPS-002` (PR #12, `f57f953`), merged first.
- [x] Vercel preview green; merge → production `17e701f` green. Rollback: revert `17e701f`.
- QA sequential (same agent). Real iPhone voices: NOT VERIFIED.
