# BLOG-008 — developer article on building AI features with Claude

## Identity

- **Issue:** `BLOG-008`
- **Status:** active (pushed; production render not yet checked)
- **Owner:** Claude
- **Date:** 2026-11-09

## User-visible problem

After BLOG-007, the owner asked for a more professional, developer-grade article: how AI in general,
and Claude in particular, works as a component when building products and features, and how to use
it to an engineering standard.

## Completion evidence

- `content/articles/building-ai-features-with-claude.mdx` publishes as an English study article with
  a Vietnamese reading note, 16 words, 7 verbs, 6 structures and a `## Sources` list.
- It covers the stateless, non-deterministic LLM call, thinking blocks and output limits, token cost
  and latency (Batch API, prompt caching, effort, model routing), the tool-use loop and tool design,
  structured outputs and their limits, context assembly, evals, the OWASP 2026 LLM and agentic lists,
  observability, fallbacks and a pre-ship checklist.
- The worked cost example was computed from the published prices by script.
- Every bold run matches a study term or form, every structure is used, inline code is balanced, and
  there are no tables or raw `<`, `{` or `}` in the prose.

## Scope

### May edit

- `content/articles/building-ai-features-with-claude.mdx` (new) — the article.
- `public/images/claude-practice/ai-feature-anatomy.png` (new) — request lifecycle diagram.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Learning code, Done/streak/review logic, Farm, Prisma, Studio, daily lesson packets.

## Verification

- [x] Script check of bold runs, study terms, structures, MDX hazards, tables and internal links
- [x] Diagram opened and checked by eye
- [x] API details, prices and figures traced to fetched pages on 2026-11-09
- [ ] `npm run lint`, `npm run build` — not run: dependencies could not be installed in the session
- [ ] Browser: hover cards, inline code, image and 390px layout on the deployed page

## Result

- **Files changed:** the article, the diagram, `docs/ISSUES.md`, this brief.
- **Sources used:** Claude Platform docs (tool use, structured outputs, prompt caching, effort,
  pricing, Opus 5.5 migration guide); Anthropic: demystifying evals (9 Jan 2026), C compiler
  (5 Feb 2026), containing Claude (25 May 2026), writing tools for agents (2025), context engineering
  (2025); OWASP Agentic Top 10 for 2026 (9 Dec 2025); Help Net Security (6 Aug 2026) and Cloud
  Security Alliance (4 Sep 2026) on the OWASP 2026 LLM Top 10.
- **Not checked / remaining risk:** no local build, and blog pages render on request, so the page
  must be opened to confirm the MDX compiles. The OWASP 2026 LLM list comes from two secondary
  reports because the official page could not be fetched. Prices and API parameters change by model
  version. IPA is not dictionary-checked.
