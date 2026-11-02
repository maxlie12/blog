# BLOG-005 — three study articles on building a small game

## Identity

- **Issue:** `BLOG-005`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-02

## User-visible problem

The learner wants English reading that connects the blog, the learning path and the small building
game idea, in more depth than the earlier articles, and wants it to work in Learning like them.

## Completion evidence

- Three English study articles publish on `/blog`: how the prototype builds a stone house, why to
  start small, and why cozy games calm people. Each is long, sourced and says what is unproven.
- Each has bold terms with hover cards, a side panel, a glossary with pronunciation and one optional
  lesson, so it appears on `/learning/practice` and as a stage on the `/learning` path.
- Stages read in the intended order: stone house, one wall, cozy games.
- The game stays separate: no game file changes, no reward code, and nothing writes Done or a level.

## Scope

### Read

- `docs/CONTENT-GUIDE.md`, `docs/DAILY-LEARNING.md`, the earlier study articles and packets.

### May edit

- `content/articles/building-a-stone-house-from-a-line.mdx` (new) — article 1.
- `content/articles/start-with-one-wall.mdx` (new) — article 2.
- `content/articles/why-cozy-games-calm-us-down.mdx` (new) — article 3.
- `content/daily-lessons/2026-11-02.json` — add three optional lessons, keep the existing two.
- `public/images/tiny-valley-dusk.jpg` (new) — prototype picture for article 1.
- `docs/ISSUES.md`, this brief.

### Must not edit

- Farm code, Learning code, Done/streak/review logic, Prisma, Studio.

## Constraints

- Done/streak is habit data, not proficiency evidence.
- First-person statements must be true of the project. Nothing about the owner's feelings or
  history is invented.
- Claims about games and wellbeing must match what each study can support.
- The slugs sort alphabetically in reading order, because same-date articles reach the path in
  filename order.

## Verification

- [x] Every bold run has a hover card, every word is bold in the text, every structure is used
- [x] All quoted facts traced to a fetched source; unverified claims left out
- [x] `npm run lint`, `npm run build`, `npm test` (44/44)
- [x] Browser: three articles, hover card, image, 390px, path stages, lessons open

## Result

- **Files changed:** the three articles, the 2026-11-02 packet, the image, `docs/ISSUES.md`, this brief.
- **Evidence (2026-11-02, local `next start`, Playwright):** all three articles return 200 at 1280px
  and 390px, with no horizontal scroll, no page errors, no plain bold run and no table; the image
  loads at both widths and a hover card opens. The path shows them as stages 5, 6 and 7 in reading
  order, today's stage keeps its two lessons, the three new lessons open and link to their article,
  and `/learning/practice` lists all three. Lint clean, 44/44 tests, build compiled.
- **Commit/deployment:** not committed or deployed.
- **Not checked / remaining risk:** the stage order relies on filenames because the date sort has no
  tie-break. IPA is not dictionary-checked. Sonnentag & Fritz was read through summaries, and the
  Steam page could not be reached. The first-person lines are drafted for the owner to confirm,
  above all the rules in section 6 of the cozy article. Dark mode and real voices were not checked.
