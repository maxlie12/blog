# GAME-015 — Farm: animals walk on their legs, graze, and fish swim

## Identity

- **Issue:** `GAME-015` (owner request, 2026-11-06: better-looking fish and chickens; animals
  should walk on their own legs, two for a chicken and four for a cow; chickens, sheep and cows
  stop for a while when they reach grass; can Meshy make better fish)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-014-farm-incubator.md`, `docs/LEARNING-FARM.md`

## User-visible problem

Animals glide over the pasture with a small hop; their legs never move. They stop at random
points, not at grass. Pond fish are an oval with a tail that turns as one piece.

## Completion evidence

- **Legs:** chickens and ducks step on two legs, one after the other; sheep and cows walk on four,
  in diagonal pairs (left front with right hind). The step rate follows the walking speed so feet
  do not slide; legs settle when the animal stops. The body rises a little over each step, ducks
  waddle and chickens bob their heads. Works for the built-in animals and for the Meshy models
  (which have no skeleton: each leg is found from the mesh and swung in the vertex shader).
- **Grazing:** the pasture has clumps of taller grass. Grown animals walk over to one and eat for
  a few seconds (chickens peck, ducks dabble, sheep and cows lower their heads and chew), stop for
  grass they pass on the way, and the clump is cropped short and grows back over about a minute
  and a half. One animal per clump. Chicks and ducklings still follow their mother. Animals keep a
  little room from each other instead of walking through one another, inside the fence.
- **Fish:** each pond species gets its own body: tapered and flattened, darker back and pale belly,
  its markings (tilapia bars, koi red patches, puffer spots and spines, sturgeon plates and
  pointed snout, goldfish double tail), tail, dorsal, anal and side fins, eyes, barbels on carp,
  koi and sturgeon. The whole body bends in a wave from head to tail, faster when the fish darts.
- **Meshy fish:** `npm run models:meshy` can now make the six pond fish (side-view prompts, a
  `length` in the manifest). The game uses a fish GLB when the manifest lists one, with the same
  swimming wave. Generating them spends the owner's Meshy credits, so it is left to the owner.
- Reduced motion: legs, grazing walks and the swim wave hold still, as other motion does.

## Scope

### May edit

- `src/lib/farm/scene.ts`, new `src/lib/farm/legs.ts`, new `src/lib/farmLegs.test.ts`
- `scripts/meshy-models.mjs` (fish entries, `length` in the manifest)
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules and saves (`engine.ts`), lesson flow, Done/streak, learner accounts, Prisma, Studio,
  Làng Rêu. No GLB is added or changed in this change.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1.
- No new dependency; no skeleton or animation files: the motion is computed from the mesh.
- Each animal and fish has its own material copy (so its own step); they are freed when it leaves.

## Verification

- [x] `npm test`: `farmLegs.test.ts` 2 pass (two legs alternate, four legs in diagonal pairs,
      body and udder stay still) and `farm.test.ts` 16; 96 pass overall, the one failure is the
      existing `habitSyncServer` test. ESLint and `tsc` clean.
- [x] Browser harness, with the committed Meshy models served: 30/30, 15/15 (one run lost the
      tomato toast to the slow-renderer quality toast; passes on rerun) and 11/11 as before, plus
      6 new: grass patches in the pasture; animals graze and crop them; every pond fish has a swim
      wave; no console errors; under reduced motion animals stand still with legs at rest and fish
      do not bend.
- [x] Screenshots reviewed: the Meshy chicken and duck stepping on alternate legs, sheep and cow
      in diagonal pairs at four step phases, built-in animals the same; animals eating at a clump;
      all six fish close up.
- [x] Vercel build + production deploy (`4ab8e3d`).

## Result

- **Files changed:** `src/lib/farm/scene.ts`, new `src/lib/farm/legs.ts` and
  `src/lib/farmLegs.test.ts`, `scripts/meshy-models.mjs`, `docs/LEARNING-FARM.md`,
  `docs/STATUS.md`, this brief.
- **Found while checking:** the swim wave first ran from tail to head (sign fixed); a stepping
  bird's swing was too wide for its speed so feet slid (the step rate now follows the swing and
  the hip height); the Meshy models are taller than the built-in ones, so the hip is measured on
  each body; a clump stayed claimed when its animal was rebuilt on growing up (claims now lapse);
  animals crowded through each other at the clumps (soft spacing added).
- **Not checked / remaining risk:** Meshy fish were not generated (they cost the owner's credits),
  so the fish GLB path is only type-checked and shares the tested model loader; a real phone's
  frame rate with per-animal materials (one shared shader program); legs on future Meshy models
  whose legs touch or hide under fleece.
