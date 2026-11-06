# GAME-016 — Farm: animals lower their heads to eat, nicer fruit

## Identity

- **Issue:** `GAME-016` (owner request, 2026-11-06: animals should bend their neck down to eat
  instead of tipping the whole body; update the look of the fruit)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-015-farm-legs-grazing-fish.md`, `docs/LEARNING-FARM.md`

## User-visible problem

To peck, dabble or graze, the whole animal tips forward. Fruit on the orchard trees are plain
balls, banana hands are sticks; tomatoes, strawberries, pumpkins, watermelons and corn cobs are
simple shapes with one colour.

## Completion evidence

- **Heads:** chickens peck, ducks dabble, sheep and cows graze by lowering the head and neck; the
  body and legs stay level. Works for the Meshy models and the built-in ones (the head is found
  from the mesh like the legs and bent in the vertex shader, normals included so the light stays
  right).
- **Fruit:** each fruit has its own shape and colouring: lemons pointed at both ends, dimpled
  oranges with a leaf, mangoes on long stalks with a red blush, banana hands curving upwards on a
  hanging stalk, a cluster of ridged coconuts; tomatoes with lobes and green sepals, strawberries
  with seeds and a leafy cap, striped watermelons, ribbed pumpkins with a stem, corn with kernels
  in its husk. Unripe fruit is green and turns as it ripens.

## Scope

### May edit

- `src/lib/farm/scene.ts`, `src/lib/farm/legs.ts`, `src/lib/farmLegs.test.ts`
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules and saves (`engine.ts`), lesson flow, Done/streak, learner accounts, Prisma, Studio,
  Làng Rêu, the GLB files.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1.
- No new dependency. Reduced motion: heads stay level like the rest of the motion.
- Fruit stays within the low preset's triangle budget (fewer segments on Low).

## Verification

- [x] `npm test`: `farmLegs.test.ts` 3 pass (new: the head bends fully, the back, chest and
      foreleg do not, the neck pivot sits at the shoulders); 97 pass overall, the one failure is
      the existing `habitSyncServer` test. ESLint and `tsc` clean.
- [x] Browser harness with the Meshy models: 30/30, 15/15, 11/11, 5/5 (one new: animals pausing
      or eating keep the body level), reduced motion 2/2 (legs and heads at rest), and 3 new:
      each kind eats at the grass; while eating the head goes down (chicken 1.25, duck 1.1, sheep
      1.0, cow 0.9 rad) with the body pitched under 0.15 rad; no console errors.
- [x] Screenshots reviewed: every animal side-on with the head level, half and fully down (Meshy
      and built-in), a sheep and a cow grazing in play; all five trees at the turning and ripe
      stage; tomatoes, strawberries, corn, pumpkin and watermelon close up; the orchard and a ripe
      field at play zoom.
- [x] Worst case (all twelve plots ripe, six trees fruiting), triangles per frame before → after:
      low fields 232k → 182k (tomatoes) and 191k → 215k (strawberries), orchard 203k → 214k;
      high 630k → 661k and 635k → 667k.
- [x] Vercel build + production deploy (`a27aba4`).

## Result

- **Files changed:** `src/lib/farm/scene.ts`, `src/lib/farm/legs.ts`, `src/lib/farmLegs.test.ts`,
  `docs/LEARNING-FARM.md`, `docs/STATUS.md`, this brief.
- **Found while checking:** turning the head alone left the Meshy sheep and cow muzzles far above
  the grass, so the head also sinks (a long neck reaching down); the chicken's chest bent with
  its head until the neck was marked higher; the built-in heads stretched across the bend, so
  their head parts are marked as they are built and turn as one piece about a fixed pivot
  without sinking; seeds and melon stripes smeared until they were put on the mesh's own grid
  (the melon is built end to end along the sphere's axis); a ring of five leaves per tomato
  sepal set cost too many triangles, replaced by one drooping star.
- **Not checked / remaining risk:** shadows still show the head up and the legs still (the
  shadow pass uses the plain depth material); a real phone's frame rate; how the stretched
  neck of the Meshy cow reads to the owner close up.
