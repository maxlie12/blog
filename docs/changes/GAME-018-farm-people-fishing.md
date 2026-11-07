# GAME-018 — Farm: a farmer who follows the player, two helpers, and a livelier fishing scene

## Identity

- **Issue:** `GAME-018` (owner request, 2026-11-07: finish upgrading fishing; a few people who
  come out of the house and work like farmers in the garden; the angler is the same person and
  moves to each area. Owner chose: a lively fishing scene with the rules unchanged; one farmer
  plus two helpers; the farmer walks to what the player works on and acts it out)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-07
- **Builds on:** `GAME-017-farm-zoom-ranch-pens.md`, `docs/LEARNING-FARM.md`

## User-visible problem

- The farm has no people. The only person is an angler who sits still on the jetty; the rod
  barely moves, and the fish that comes out of the water is a rough blob.
- Working the fields, orchard, pond or ranch shows the result at once but nobody does the work.

## Completion evidence

- **Farmer:** one farmer (conical hat, blue shirt) is always in the area being viewed. Switching
  areas, he walks there along the paths (when the walk is long he leaves the screen and comes
  back into view from the right side, so the player never waits). He idles at a natural spot.
- **Acts out the work:** when the player hoes, sows, waters, weeds, catches bugs, fertilises or
  harvests a plot; digs, plants, waters or shakes a tree; feeds the pond, skims litter, nets or
  stocks fish; fills the feed store, collects products or turns eggs in the ranch, the farmer
  walks to that place by the paths and does the matching motion with the right tool (hoe,
  watering can, seed pouch, basket, net, sack, bucket). Results still apply at once; several
  quick actions queue up and he hurries.
- **Helpers:** two helpers leave the house in the morning (game clock), work in the fields and
  the orchard (tending, carrying a basket, checking trees), and walk home in the evening; at
  night they are indoors. They only act; they never change the farm.
- **Fishing:** at the river the farmer walks onto the jetty, sits at its end and picks up the
  rod. Casting swings the rod back and forward; the rod bends with the line tension; he leans
  in at a bite and leans back while reeling; the hooked fish darts and leaps with splashes; on a
  catch he lifts the fish (a proper body for each of the six wild fish and the boot) and drops
  it in a basket beside him, which shows the wild fish waiting in the barn. A miss gets a shake
  of the head.
- People walk on their own legs (feet do not slide), keep to the paths and gaps between plots,
  and do not walk through fences, buildings or water.
- Rules and saves are unchanged. Reduced motion: people still go where the work is, without
  idle fidgets or bobbing.

## Scope

### Read

- `docs/LEARNING-FARM.md`; `src/lib/farm/scene.ts`, `engine.ts` (state shapes), `fishing.ts`

### May edit

- `src/lib/farm/scene.ts` — people meshes, routines, fishing scene
- new `src/lib/farm/paths.ts` — walking paths between the house and every area (pure)
- new `src/lib/farm/chores.ts` — what the player just did, from two game states (pure)
- new `src/lib/farm/people.ts` — body sizes and poses: walking, each chore, fishing (pure)
- new `src/lib/farmPeople.test.ts` — tests for the three new modules
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules and saves (`engine.ts`, `fishing.ts`), lesson flow, Done/streak, learner accounts,
  Prisma, Studio, Làng Rêu, the GLB files, `FishingPanel.tsx` behaviour.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1.
- No new dependency; people are built from the game's own primitives, one draw call each
  (a skinned mesh) plus the tool in hand.
- 3D only; the 2D board is unchanged.

## Plan

1. `paths.ts`: a graph of walkable points (house yard, the lane north of the fields, the fields'
   gates and the lanes between plots, the road, the orchard gate, the pond bank and dock, the
   river bank and jetty, the ranch lane and pen gates) and `route()`; stand points for each plot,
   tree, trough and the pond; tests that every target is reachable from the house and no route
   crosses a plot, fence, building, the pond or the river.
2. `chores.ts`: compare the previous and next game state and list the player's actions by area
   and target; only player-made changes (time never raises soil moisture, unpicks fruit or
   removes litter); skipped after a load or reset.
3. `people.ts`: rest pose, walk cycle tied to distance, a pose program per chore and for each
   fishing phase; tests for foot travel and that each program starts and ends at rest.
4. Scene: three skinned people, tools on the hand bone; the farmer's queue and route following,
   off-screen skipping; the helpers' day; the fishing scene (bending rod, cast swing, fish fight
   and leap, lift and basket, wild fish bodies); the old static angler removed.
5. Checks and docs.

## Verification

- [x] `npm test`: `farmPeople.test.ts` 6 pass (every graph point and link clear at ranch levels 0
      and 3; routes from the house to every plot, tree, pond bank, trough, the incubator, the jetty
      and products in the pens, and back, never through a plot, fence, building or water; each
      player action read once with its place; ten minutes of farm time, a load and a reset read as
      nothing; planted feet slide under 12% of a step; every job starts and ends at rest; the
      angler's cast, lean and settle), 109 pass overall (`habitSyncServer` fails as before);
      ESLint, `tsc`.
- [x] Browser harness: earlier checks 30/30, 15/15, 11/11, 5/5, zoom 13/13, ranch 7/7 (its
      ducks-swim check sometimes runs out of time in the slower test browser: on a longer watch the
      ducks swam within 25 s), phone HUD 9/9, eating and reduced motion; people 20/20 (helpers out at 10:00 in the fields and orchard,
      out of the door at 6:12, indoors at 22:00; the farmer waters, weeds, hoes and harvests in
      the order clicked with the right tools, comes to each area, shakes the tree, skims, collects
      eggs in the poultry yard, sits at the jetty, a catch goes into his basket, and back to the
      fields); reduced motion and phone 4/4; screenshots desktop and phone.
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** new `src/lib/farm/paths.ts` (the fields, orchard and pond layout shared with
  the scene; obstacles; the walking graph; `route()`; where to stand for each job), new
  `src/lib/farm/chores.ts` (the player's actions from two game states), new
  `src/lib/farm/people.ts` (body sizes; walk cycle; a pose program per job; fishing poses), new
  `src/lib/farmPeople.test.ts` (6 tests); `scene.ts` (three skinned people with tools in hand,
  the farmer's queue, idling and off-screen skipping, the helpers' day; the farmer's bending rod,
  cast, bite, reel and catch, the fish's fight, the basket, the wild fish bodies; the static angler
  removed); `docs/LEARNING-FARM.md`.
- **Found while checking:** GAME-017 left the wheelbarrow right in front of the sheep pen's gate
  and, at the top level, a bunting post in the poultry gate's opening: both moved (the paths test
  caught them). At the plots the farmer stood with his back to the camera: he now stands west of a
  plot and south-west of a tree. Helpers were placed before the farm's clock was known (the scene
  starts at noon), so at 6:09 one appeared and walked home: they now wait for the game state.
  Skipping ahead judged "off screen" with the camera mid-glide: it now also checks where the camera
  is heading. A helper with nowhere else free kept finding a new route every frame: she waits.
- **Not checked / remaining risk:** real phones and iOS Safari, and GPU frame time with three
  skinned meshes (draw calls per area on the test browser's default preset: farm 57, orchard 50,
  pond 45, river 23, ranch 60, within the earlier range); the walk into the river view still shows
  the last stretch of road and bank (about 2–3 s on a device; slower in the software-rendered test
  browser); casting before the farmer reaches the jetty moves him straight to his seat; people do
  not step round animals, and the obstacle list mirrors the scene by hand (`paths.ts`).
