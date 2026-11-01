# BLOG-004 — article on the in-browser speech model

## Identity

- **Issue:** `BLOG-004`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

The on-device transcription work is the site's most distinctive engineering decision, and nothing
public explains why it was built this way or what it costs.

## Completion evidence

- `/blog/i-put-a-speech-model-inside-my-browser` tells the real story in English, in the existing
  study format, and appears as a topic on `/learning/practice`.
- Figures come only from `docs/changes/SPEAK-001-browser-transcription.md`. The article states that
  they come from one synthetic test, and lists what was not tested. No personal anecdote is invented.
- An optional writing lesson on 2026-11-01 practises explaining a technical decision. The main
  listening lesson stays first.

## Scope

### May edit

- `content/articles/i-put-a-speech-model-inside-my-browser.mdx` (new) — article and `study` data.
- `content/daily-lessons/2026-11-01.json` — append one optional lesson, others unchanged.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Application code, transcription behaviour, Done/streak logic.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (36/36)
- [x] Browser: article at 1280px and 390px, hover cards on study words, no horizontal scroll
- [x] Lesson opens the article; topic appears on `/learning/practice`; `/learning` keeps the main lesson

## Result

- **Evidence (2026-11-01, local `next start`, Playwright):** article 200 at 1280px and 390px, no
  horizontal scroll, 24 hover cards, all 14 glossary words appear in bold in the text. The lesson
  opens the article, `/learning/practice` lists 4 topics and `/learning` still offers
  `daily-2026-11-01-en-listening` first.
- **Not checked / remaining risk:** the figures come from one synthetic SPEAK-001 run. The
  statement in SPEAK-001 that Web Speech cannot use recorded audio is out of date: MDN now mentions
  audio tracks and an on-device mode, neither tested here. The article uses the MDN wording, and
  SPEAK-001 keeps its original text as a record. Markdown tables do not render in articles (no
  remark-gfm), so the figures are a list. Dark mode not checked.
