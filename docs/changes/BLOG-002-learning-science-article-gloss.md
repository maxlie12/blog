# BLOG-002 — learning-science article and hover meanings for study words

## Identity

- **Issue:** `BLOG-002`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-10-31

## User-visible problem

On a study article the learner must scroll to the end to see what a bold word means and what part
of speech it is. There is also no article on *how* to practise (any skill, not only English).

## Completion evidence

- Hovering, focusing (keyboard) or tapping a bold study word shows its part of speech and
  Vietnamese meaning; Escape hides it. On phones the card is pinned to the bottom of the screen
  so it never overflows.
- `/blog/how-to-learn-english-with-learning-science`: a sourced English article on learning
  science (retrieval, spacing, interleaving, habits, sleep, exercise, AI tutors) with the same
  study panel, glossary and a linked optional reading lesson.
- Merge fix: the 2026-10-31 packet was committed with conflict markers (both the automation and
  BLOG-001 created it). The automation's lessons are kept unchanged; the two blog reading lessons
  are added as optional with new IDs (`daily-2026-10-31-en-blog-ai`, `-en-blog-learning`).

## Scope

### May edit

- `content/articles/how-to-learn-english-with-learning-science.mdx` (new).
- `content/articles/ai-and-the-developer-job-2026.mdx` — `pos`/`forms`, new lesson ID.
- `content/daily-lessons/2026-10-31.json` — resolve conflict, add the two optional lessons.
- `src/lib/content.ts` — optional `pos` and `forms` on `StudyTerm`.
- `src/lib/mdx.tsx` — pass MDX `components`.
- `src/components/ArticleStudy.tsx`, `src/components/GlossTerm.tsx` (new) — the `strong` override.
- `src/app/blog/[slug]/page.tsx`, `src/app/globals.css`.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Done/streak logic, Prisma, Studio post schema.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (32/32)
- [x] Browser: hover and keyboard focus show the card at 1280px; tap shows it pinned at 390px;
      no horizontal scroll; Escape hides it
- [x] Both blog lessons open their article from `/learning/<id>`

## Result

- **Evidence (2026-10-31, local `next start`, Playwright):** new article 200, 23 bold study words
  with hover cards, 14 glossary entries; AI article 21. At 1280px hover shows e.g. "NOUN · cảm giác
  quen thuộc" above the word and hides on mouse leave; keyboard focus shows it and Escape hides it.
  At 390px a tap shows the card pinned 16px from the screen edges; no horizontal scroll. All three
  English lessons for 2026-10-31 open their own source.
- **Not checked / remaining risk:** Li et al. (2025) and the ScienceDirect ChatGPT trial returned
  403 and are cited from search results; Roediger & Karpicke is described qualitatively (the PDF
  could not be read). Lally et al. is cited via PsyBlog, not the paper. Bold text that is not a
  study term (e.g. list labels in the AI article) stays plain bold by design. Dark mode not checked.
