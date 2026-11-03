# GAME-003 — Làng Rêu: light physics and interactions

## Identity

- **Issue:** `GAME-003` (owner request, 2026-11-03: “thêm 1 chút vật lí vào và tương tác với nhau với các đồ vật”;
  owner chose all four directions: animals, rolling/pushing, water and wind, objects affecting each other)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-002-village-more-pieces.md`

## User-visible problem

Pieces stand still and ignore each other, so the village looks like a diorama rather than a
place where things happen.

## Completion evidence

- A pinned **Tay** (hand) tool grabs balls, barrels, crates, pumpkins and boats; release throws
  them. They roll or slide, bounce off walls, houses and each other, float and drift down
  streams, and can fall off the island (undo brings them back). Tapping grass makes a small gust.
- A new **ball** piece (word “ball”). Barrel, crate and pumpkin become single movable pieces.
- Animals: the dog chases chickens, cats, rabbits, ducks and balls; prey runs away; sheep keep
  together; ducks swim in ponds and streams; animals do not overlap or walk through buildings,
  push loose objects, and gather by a barn or campfire at night.
- Wind sways trees, plants and grass, blows blossom petals, drives clouds and the windmill.
- Bees fly between a hive and nearby flowers; a scarecrow keeps birds off a vegetable garden;
  newly placed pieces drop in with a small bounce.
- Positions of moved objects are saved; older saves load unchanged.
- Reduced motion turns off ambient movement (wind, petals, bees, birds, wandering, drops).

## Scope

### May edit

- `src/lib/village/physics.ts` (new) — pure physics and water queries, testable in Node.
- `src/lib/village/data.ts`, `src/lib/village/props.ts`, `src/lib/village/scene.ts`, `src/lib/village.test.ts`
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- No physics library: a small 2D-plus-height solver keeps the bundle and phone cost low.
- Sleeping bodies cost nothing per frame; only moving ones are simulated.
- Save format stays version 1.

## Verification

- [x] `npm test`: 12 village tests pass, 5 of them for physics (friction brings a ball to rest; a
      wall turns it back and a house box keeps it out; a barrel knocks a ball and a gust pushes a
      crate; a stream carries a boat; a ball rolling off the edge falls; an animal pushes a
      crate). `habitSyncServer.test.ts` still fails only because `@neondatabase/serverless` is
      not installed in this workspace.
- [x] ESLint and `tsc` clean for every changed file.
- [x] Browser, StrictMode harness: the GAME-002 suite still passes 41/41 at 390px and 1280px. New
      suite 18/18 at 1280px with and without reduced motion: hand tool pinned; ball unlocked,
      dropped, thrown, its resting place saved, undo puts it back; a hand tap on grass blows it
      away; birds come to a garden and a scarecrow sends them off (none with reduced motion);
      beehive with flowers, dog with chickens and a night by the barn run with no errors.
- [x] Vercel production build of commit `52d68f5` succeeded and was deployed to Production.
- [ ] Live page check: not possible from this workspace (vercel.app is blocked); owner to open `/learning/village`.

## Result

- **Files changed:** `src/lib/village/physics.ts` (new), `src/lib/village/{data,props,scene}.ts`,
  `src/lib/village.test.ts`, `src/components/village/VillageGame.tsx`, one cursor rule in
  `src/app/globals.css`.
- **Evidence:** see Verification.
- **Not checked / remaining risk:** physics runs at the display's frame rate on a real phone, which
  was not measured (tests use software WebGL). A body that falls into a pond keeps drifting, so
  its saved position updates every few seconds. `scene.ts` is now about 2,100 lines; the animal
  and ambient-life code is a good candidate to move into its own module next time it changes.
  Real iPhone/Safari, speech voices and screen readers were not tested.
