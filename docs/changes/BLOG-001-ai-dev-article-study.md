# BLOG-001 — article with a vocabulary study panel

## Identity

- **Issue:** `BLOG-001`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-10-31

## User-visible problem

Reading an English dev article is also language practice, but new words, verbs and sentence
structures are not pulled out anywhere, and nothing connects the article to a lesson on
`/learning`.

## Completion evidence

- `/blog/ai-and-the-developer-job-2026` is a sourced article on how AI has changed developer
  work in 2025–2026, with new words in bold.
- On desktop a right-hand panel lists the article's words, verbs/phrasal verbs and structures,
  and links to a reading lesson on `/learning`. On mobile it stacks below the article without
  repeating the word list.
- The end of the article lists "Từ mới cần biết" with meaning and example, from the same
  frontmatter data as the panel (one source of truth).
- `daily-2026-10-31-en-reading` opens the article as its main source and practises the same
  structures; Done stays habit data.

## Scope

### May edit

- `content/articles/ai-and-the-developer-job-2026.mdx` (new) — the article and its `study` data.
- `src/lib/content.ts` — optional `study` frontmatter type.
- `src/components/ArticleStudy.tsx` (new) — panel and end-of-article word list.
- `src/app/blog/[slug]/page.tsx` — render them when `study` exists.
- `src/app/globals.css` — two-column article layout and panel styles.
- `content/daily-lessons/2026-10-31.json` (new) — the linked reading lesson.
- `src/components/LessonDetailView.tsx` — accept an internal `/blog/…` path as the lesson source.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Studio post schema (Studio posts simply have no `study`), Prisma, Done/streak logic.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (30/30)
- [x] Browser: article at 1280px (panel on the right) and 390px (stacked, no horizontal scroll)
- [x] Lesson page opens the article as its source; anchors from panel words reach the list

## Result

- **Files changed:** `content/articles/ai-and-the-developer-job-2026.mdx`,
  `content/daily-lessons/2026-10-31.json`, `src/components/ArticleStudy.tsx`,
  `src/lib/content.ts`, `src/app/blog/[slug]/page.tsx`, `src/components/LessonDetailView.tsx`,
  `src/app/globals.css`, `docs/ISSUES.md`, this brief.
- **Evidence (2026-10-31, local `next start`, Playwright):** 1280px — panel sits right of the
  article, sticky at 24px, 14 word chips; clicking "bottleneck" scrolls its glossary entry into
  view. 390px — panel stacks below, word chips hidden (glossary already ends the article), no
  horizontal scroll. 968-word body, 28 bold terms, 14 glossary entries, 8 verbs, 6 structures.
  The lesson shows "Mở bài trên blog Field Notes ↗" linking to the article, and `/learning`
  now offers `daily-2026-10-31-en-reading` as the next lesson.
- **Not checked / remaining risk:** CNN and The Decoder were cited from search results, not
  fetched (CNN returned 451). CNBC, IT Brief, I Programmer and IOActive figures were checked
  against the fetched pages; the METR figures (19% slower, ~20% felt faster, 16 developers)
  agree across several search results but were not checked against the METR paper itself.
  Dark mode not checked.
