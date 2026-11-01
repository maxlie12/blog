# LEARN-008 — pronunciation and free reading/word practice

## Identity

- **Issue:** `LEARN-008`
- **Status:** verified
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

A learner cannot hear how a new word sounds, and on a day without time for a lesson there is no
place to read aloud, review words or switch to another topic.

## Completion evidence

- Glossary words show IPA and a listen button; verbs and structures can be heard as a sentence.
- `/learning/practice` lets the learner pick or switch a topic (one per study article), flip word
  cards and read a paragraph aloud: hear a model, record, then see which words were matched.
- Word-card state stays on this device under the active learner profile.
- Free practice writes no Done, streak or attempt, and states that the comparison is not a
  pronunciation score.

## Scope

### May edit

- `src/lib/studyText.ts`, `src/lib/studyText.test.ts` (new) — paragraphs and word matching.
- `src/components/PronounceButton.tsx`, `src/components/FreePractice.tsx` (new).
- `src/app/learning/practice/page.tsx` (new) — the route.
- `src/components/ArticleStudy.tsx`, `src/components/GlossTerm.tsx` — IPA, listen, practice link.
- `src/app/blog/[slug]/page.tsx` — pass the slug to the panel.
- `src/components/SpeakingRecorder.tsx` — optional `hint`; neutral "done" text.
- `src/components/StartLearning.tsx` — entry link.
- `src/lib/content.ts` — optional `ipa`; `src/app/globals.css` — styles.
- `content/articles/*.mdx` — IPA data for the glossary words only.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Done/streak logic, Prisma, lesson packets, Studio.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (36/36)
- [x] Browser: listen buttons call speech synthesis; word cards; switching topic; read-aloud
      comparison at 1280px and 390px; 44px controls; no horizontal scroll; no Done written

## Result

- **Evidence (2026-11-01, local `next start`, Playwright with a fake microphone):** all 14
  glossary entries show IPA; listen buttons pass `en-US` text to speech synthesis. On
  `/learning/practice` at 1280px and 390px: 3 topics, `?topic=` preselects, random switch changes
  topic, "Chưa nhớ" requeues, "Đã nhớ" survives reload, read-aloud shows matched words and clears
  on the next paragraph. No control under 44px, no horizontal scroll, no page errors. The only new
  storage key is `learning-profile:luan:study-words-known-v1`; `/learning` still offers
  `daily-2026-11-01-en-listening` first.
- **Not checked / remaining risk:** real voices were not heard: speech synthesis and the Whisper
  worker were stubbed, so voice quality depends on the device. Whisper tends to write the expected
  word, so a match does not prove pronunciation; the page says so. Hand-written IPA is US English
  and was not checked against a dictionary. Known words are not in the progress backup file. Dark
  mode not checked.

Visible in production on 2026-11-01; see `docs/STATUS.md`.
