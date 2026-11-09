# BLOG-007 — deep-dive study article on how Claude works

## Identity

- **Issue:** `BLOG-007`
- **Status:** active (pushed; production render not yet checked)
- **Owner:** Claude
- **Date:** 2026-11-09

## User-visible problem

After BLOG-006, the owner asked for a deeper article about Claude: what happens inside it and what a
user needs to know. The existing Claude articles cover working practices and learning, not how the
model, its character and its harness work.

## Completion evidence

- `content/articles/inside-claude-how-it-works.mdx` publishes as an English study article with a
  Vietnamese reading note, 16 words, 7 verbs, 6 structures and a `## Sources` list.
- It covers tokens and pretraining, post-training and the persona selection model, the constitution,
  interpretability findings, the context window, the agent loop, the 2026 model family, privacy and
  practical advice, each with its stated limits.
- Every bold run matches a study term or form, every structure is used, and there are no tables or
  raw `<`, `{` or `}` in the body.

## Scope

### May edit

- `content/articles/inside-claude-how-it-works.mdx` (new) — the article.
- `public/images/claude-practice/inside-claude-layers.png` (new) — three-layer diagram.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Learning code, Done/streak/review logic, Farm, Prisma, Studio, daily lesson packets.

## Verification

- [x] Script check of bold runs, study terms, structures, MDX hazards, tables and internal links
- [x] Diagram opened and checked by eye
- [x] Every figure traced to a fetched page on 2026-11-09, 2026 sources preferred
- [ ] `npm run lint`, `npm run build` — not run: dependencies could not be installed in the session
- [ ] Browser: hover cards, image and 390px layout on the deployed page

## Result

- **Files changed:** the article, the diagram, `docs/ISSUES.md`, this brief.
- **Sources used:** Anthropic: new constitution (22 Jan 2026), assistant axis (19 Jan 2026), persona
  selection model (23 Feb 2026), emotion concepts (2 Apr 2026), natural language autoencoders
  (7 May 2026), global workspace (6 Jul 2026), agent memory (6 Nov 2026), tracing thoughts (2025);
  Claude Platform context-window and model pages; Claude Code "How Claude Code works"; Anthropic
  Privacy Center retention page (updated 1 Jul 2026) and the consumer terms update (28 Aug 2025).
- **Not checked / remaining risk:** no local build. Blog pages render on request, so a successful
  Vercel build does not prove the MDX compiles; the page must be opened. IPA is not
  dictionary-checked. Most sources are Anthropic describing its own models. Model and privacy details
  change over time.
