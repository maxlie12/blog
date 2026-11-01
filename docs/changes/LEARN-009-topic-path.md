# LEARN-009 — topic path built from blog articles

## Identity

- **Issue:** `LEARN-009`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

Blog study articles, their lessons and free practice exist, but nothing shows them as an ordered
route, so a learner cannot see where they are or what comes next.

## Completion evidence

- A "Hôm nay" stage opens the path when today has a packet: the main task is next until Done,
  extra lessons are labelled optional, blog-based lessons keep their own stage, and it is hidden
  on a day without a packet. The page scrolls to the next step on opening.
- `/learning/path` shows each study article as a stage, oldest first, on a winding path of steps:
  read, words, read aloud, lesson, then a stage marker. Adding a study article adds a stage.
- Done, next and open steps differ by icon and text, not only colour. One step is marked next.
- No step is locked: rest days create no debt, and any step opens at any time.
- `/learning` keeps its single primary action; the path is one secondary link (LEARN-004).
- Marks stay on this device under the active profile. The page says they are habit marks, not a
  level. Only the lesson step reads Done; the path writes no Done, streak or attempt.
- Original art and site colours: no mascot, branding or layout copied from another product.

## Scope

### May edit

- `src/lib/studyPath.ts`, `src/lib/studyPath.test.ts` (new) — steps and local marks.
- `src/components/LearningPath.tsx`, `src/app/learning/path/page.tsx` (new).
- `src/components/FreePractice.tsx`, `src/app/learning/practice/page.tsx` — shared storage, open
  in read mode, mark the read-aloud step.
- `src/components/StartLearning.tsx` — one secondary link.
- `src/app/globals.css`, `docs/ISSUES.md`, this brief.

### Must not edit

- Done/streak logic, lesson packets and their schema, Prisma, Studio, Farm.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (41/41)
- [x] Browser: full stage at 1280px and 390px; marks update after real actions; 44px; keyboard
      focus; no horizontal scroll; `/learning` primary action unchanged

## Result

- **Evidence (2026-11-01, local `next start`, Playwright):** 4 stages, oldest first. One full
  stage was walked at 390px with real actions: opening the article, marking all 14 words, a
  read-aloud comparison (recorder on a fake microphone, Whisper worker stubbed) and a real Done on
  `daily-2026-10-31-en-blog-ai`. Each step moved "Tiếp theo" forward, the marker showed "Đã đủ các
  bước" and the next stage took over. No horizontal scroll at 1280px or 390px, no node under 44px,
  no node past the screen edge, no page errors. `/learning` still opens
  `daily-2026-11-01-en-listening` as its primary action.
- **Not checked / remaining risk:** the read step means "opened", not "read". Path marks and known
  words are not in the progress backup and would not move to a new domain. Stage order follows
  article date, so two articles on one date have no authored order. Articles and packets are read
  from the deployed files, so new content appears after the next deploy. Dark mode: path, word card and glossary checked by
  screenshot only.
- **Today stage (2026-11-01, Playwright at 1280, 390 and 320px):** today's packet shows the main
  listening task as next and two optional lessons; blog-based lessons stay in their stages. A real
  Done moved the next step to stage 1. The page opens with the next step in view. No horizontal
  scroll, no node past the edge or under 44px. Optional is read from the packet title, because the
  schema has no flag: a packet title without "tùy chọn" counts as a main task. The hidden state on a
  day without a packet was not exercised in the browser.
