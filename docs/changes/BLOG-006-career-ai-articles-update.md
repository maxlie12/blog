# BLOG-006 — update the three 8 November career and AI articles

## Identity

- **Issue:** `BLOG-006`
- **Status:** active (pushed; production render not yet checked)
- **Owner:** Claude
- **Date:** 2026-11-09

## User-visible problem

The owner asked for three recent articles to be updated in detail and with complete information.
Two English articles were short (about 6 KB each), and `hoc-claude-lam-viec-voi-ai` was in
Vietnamese only, so it had no hover words and was not a study article. The owner asked for it to
become an English article with new words, and for the newest 2026 posts to be preferred as sources.

## Completion evidence

- `building-a-future-without-learning-everything`, `hoc-claude-lam-viec-voi-ai` and
  `learning-claude-like-an-engineer` are long English study articles with a Vietnamese reading note,
  hover words with IPA, verbs, structures and a `## Sources` list.
- Every bold run matches a study term or form, every word and verb is bold in the text, every
  structure is used, and there are no tables, raw `<`, `{` or `}` in the body.
- The `hoc-claude-lam-viec-voi-ai` slug is kept, so existing links still work.
- Facts are traced to fetched sources, with 2026 sources preferred; older sources are kept only as
  the origin of an idea.

## Scope

### Read

- `docs/CONTENT-GUIDE.md`, `src/lib/content.ts`, `src/lib/studyText.ts`, `src/components/ArticleStudy.tsx`,
  `content/articles/start-with-one-wall.mdx` (reference study article).

### May edit

- `content/articles/building-a-future-without-learning-everything.mdx` — rewrite.
- `content/articles/hoc-claude-lam-viec-voi-ai.mdx` — English edition with study block.
- `content/articles/learning-claude-like-an-engineer.mdx` — rewrite.
- `public/images/claude-practice/controls-en.png` (new) — English diagram for the work article.
- `public/images/claude-practice/help-ladder.png` (new) — diagram for the learning article.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Learning code, Done/streak/review logic, Farm, Prisma, Studio, daily lesson packets.

## Constraints

- First-person lines describe the repository truthfully or are labelled as illustrations; nothing
  about the owner's feelings or history is invented.
- Research claims carry their stated limits (sample size, self-report, advertised salaries).
- No new optional lessons are added, so `lessonId` stays unset.

## Verification

- [x] Script check of bold runs, study terms, structures, MDX hazards, tables and internal links
- [x] Both new diagrams opened and checked by eye
- [x] Every quoted figure traced to a fetched page on 2026-11-09
- [ ] `npm run lint`, `npm run build` — not run: dependencies could not be installed in the session
- [ ] Browser: hover cards, images and 390px layout on the deployed pages

## Result

- **Files changed:** the three articles, two images, `docs/ISSUES.md`, this brief.
- **Sources used:** WEF Future of Jobs 2025 digest and its January 2025 story; WEF story by Fabian
  Stephany (10 Feb 2026); Anthropic: AI-resistant technical evaluations (21 Jan 2026), AI assistance
  and coding skills (29 Jan 2026), harness design (24 Mar 2026), auto mode (25 Mar 2026), Economic
  Index "Learning curves" (24 Mar 2026) and "Cadences" (26 Jun 2026), containing Claude (25 May 2026),
  agent memory (6 Nov 2026), Building effective agents (2024), context engineering (2025); Claude Code
  best-practices and security docs; Stack Overflow 2026 survey (6 Oct 2026); APA on switching costs;
  Gollwitzer & Sheeran (2006); WHO on burn-out (2019).
- **Not checked / remaining risk:** no local build, so MDX compilation is checked only by script.
  IPA is not dictionary-checked. The WEF Future of Jobs report page itself could not be fetched; its
  figures come from the WEF digest. Stack Overflow figures come from its press release and the
  trust-question data page. The three same-date articles reach the path in filename order.
