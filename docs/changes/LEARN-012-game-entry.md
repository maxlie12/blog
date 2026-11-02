# LEARN-012 — a way into the games from Learning

## Identity

- **Issue:** `LEARN-012`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-03

## User-visible problem

The learner can reach Làng Rêu only by typing its address. Learning links to neither game: the farm
has one button on the home page, and the village has one link inside the farm page.

## Completion evidence

- `/learning` shows a quiet row under the next-session card with links to Làng Rêu and the farm.
- The row says the games do not count towards Done or a level. The primary action stays first and
  the row is not a lesson step.
- Làng Rêu's back link returns to Learning, where the learner now arrives from.
- This revises the LEARN-004 rule that keeps games off the primary surface, at the learner's request:
  the entry is secondary, and game content stays on its own pages.

## Scope

### May edit

- `src/app/learning/page.tsx` — the row.
- `src/app/learning/village/page.tsx` — the back link.
- `src/app/globals.css` — `.learning-games` only.
- `docs/PRODUCT.md`, `docs/ISSUES.md`, this brief.

### Must not edit

- Game code, Done/streak, reviews, path logic, Prisma, Studio.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (51/51)
- [x] Browser: both links open from `/learning` at 1280px and 390px, 44px, no horizontal scroll, dark mode

## Result

- **Evidence (2026-11-03, local `next start`, Playwright):** the row sits under the unchanged primary
  action, at 547px on 1280px wide and 822px on 390px. Both links were clicked at both widths and
  open Làng Rêu and the farm, and the village back link returns to `/learning`. Links are 45px tall,
  no horizontal scroll, no page errors. Dark mode colours follow the tokens.
- **Commit/deployment:** not committed or deployed.
- **Not checked / remaining risk:** on a 390px phone the row starts at the bottom of the first
  screen, so it needs a short scroll. The site header still has no game link.
