# GAME-019 — Farm: separate chicken and duck yards

## Identity

- **Issue:** `GAME-019` (owner request, 2026-11-07: separate the duck and chicken areas; this
  replaces the GAME-017 choice of one shared poultry yard)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-07
- **Builds on:** `GAME-017-farm-zoom-ranch-pens.md`, `GAME-018-farm-people-fishing.md`

## User-visible problem

Chickens and ducks share one poultry yard; the owner wants each in its own area.

## Completion evidence

- The poultry yard becomes two pens side by side on the lane, with a fence between them: a chicken
  yard (hen house, straw nests, its own trough, its own gate) and a duck yard (the duck pond, a
  small duck house, its own trough, its own gate).
- Chickens stay in the chicken yard, ducks in the duck yard (they still swim in their pond); eggs
  lie in the chicken yard, duck eggs in the duck yard; chicks and ducklings stay with their kind.
- Both yards still grow with the capacity upgrade and keep their details; the farmer walks into
  each through its gate and fills each trough.
- Rules and saves are unchanged.

## Scope

### May edit

- `src/lib/farm/ranchLayout.ts` (pens, fixtures, pond), `src/lib/farm/paths.ts` (fences, gates,
  paths into the two yards), `src/lib/farm/chores.ts` (a trough per pen), `src/lib/farm/scene.ts`
  (fences, gates, duck house, troughs, grass, animals' pens)
- `src/components/farm/sheets.tsx` (the help line about the ranch)
- `src/lib/farmLayout.test.ts`, `src/lib/farmPeople.test.ts`
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules and saves (`engine.ts`), lesson flow, Done/streak, learner accounts, Prisma, Studio,
  Làng Rêu, the GLB files.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1. No new dependency.

## Verification

- [x] `npm test`: `farmLayout.test.ts` 4 and `farmPeople.test.ts` 6 pass (four pens grow, never
      overlap, the two yards share their fence at every size, buildings and the pond fit the first
      yards, room for each kind; every path point and link clear, routes into both yards), 109
      pass overall (`habitSyncServer` fails as before); ESLint, `tsc`.
- [x] Browser harness: ranch 7/7 (each kind stays in its own yard or pen, ducks swim, all four
      troughs open the feed sheet, pens grow), people 20/20 (the farmer collects eggs in the
      chicken yard and a duck egg in the duck yard, through their gates), zoom 13/13, phone HUD
      9/9, earlier checks 15/15, 11/11, 5/5, eating and reduced motion; the play test 29/30 (its
      "catches reach the barn" counted an old boot, which never goes to the barn: the known
      flake); screenshots of the yards at the first and top level.
- [x] Vercel build + production deploy (`664a9ec`).

## Result

- **Files changed:** `ranchLayout.ts` (pens `chicken` and `duck` instead of `poultry`, side by side
  with a shared fence; the duck pond moved into the duck yard; a duck house and a duck trough),
  `paths.ts` (gate spans shared with the scene, fences, paths into both yards round the pond, a
  stand by the duck trough clear of the water barrel), `chores.ts` (feed is poured into each kind's
  trough), `scene.ts` (the two yards' fences and gates, the duck house, four troughs, grass, straw
  piles, which yard each product lies in), `sheets.tsx` (help line), the two test files,
  `docs/LEARNING-FARM.md`.
- **Found while checking:** the first duck-yard layout left too little bank round the pond for the
  farmer to walk round it (the paths test caught the blocked links): the duck house moved to the
  west end, the pond to the middle, open ground and the trough by the gate. The ranch check hid
  animals by moving them off the island, but the pen clamp pulls them back to their pen's nearest
  corner, which for the duck yard is right by the trough, and invisible objects still take taps:
  the check now also switches off their hit boxes. The duck house's first roof matched the sheep
  shelter's next to it: it is thatch-coloured now.
- **Not checked / remaining risk:** real phones; saves keep working (animals and drops are placed
  by kind, nothing stored names a pen); an animal or a drop can still sit in front of a trough and
  take the tap, as before.
