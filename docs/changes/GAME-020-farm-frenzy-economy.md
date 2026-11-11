# GAME-020 — Farm: things to spend coins on (workshop levels, second-tier goods, truck, helpers, a bear, orders)

## Identity

- **Issue:** `GAME-020` (owner request, 2026-11-11: upgrade the game further with gameplay like
  Farm Frenzy 1–2 so coins have a use; with a lot of coins there is nothing left to do. Owner
  chose: no preference among the coin sinks (so all four), a gentle bear, and a separate timed
  challenge mode — the challenge mode is the next brief, `GAME-021`)
- **Status:** done (live page check by owner); the timed challenge mode is `GAME-021`, not started
- **Owner:** Claude
- **Date:** 2026-11-11
- **Builds on:** `GAME-019-farm-duck-yard.md`, `docs/LEARNING-FARM.md`

## User-visible problem

Every upgrade tops out at a few hundred coins (pond 700, ranch 500, workshops 150–350), and
goods only go one step (egg → cake). A player with thousands of coins has nothing to buy.

## Completion evidence

- **Workshop levels:** each workshop upgrades from level 1 to 4 (cost 3×, 8×, 20× its build
  price). Level 2 opens a second-tier recipe made from the workshop's own goods (salted eggs →
  mooncake, cake → cream cake, scarf → sweater, cheese → pizza); levels 3 and 4 work faster and
  run 2 then 3 batches at once. The building shows its level.
- **Truck levels:** three upgrades (more items per trip, a shorter trip, a better city price).
- **Helpers:** a cat (then a second) that picks up eggs, milk and wool by itself; a dog that
  chases the bear away.
- **Bear (gentle):** now and then, only while the game is open, a bear wanders into the ranch
  lane; animals stop producing while it is there. Tapping it a few times cages it and it is sold
  for coins; ignored, it leaves after a while (quickly with a dog). No animal is ever lost.
- **Orders:** three standing orders ask for goods the farm can make; delivering one pays well
  above the market price plus XP, and a new one arrives. An order can be swapped for a small fee.
- Old saves keep working (new fields default); save stays version 1.

## Scope

### May edit

- `src/lib/farm/engine.ts` (new state fields with defaults, recipes, levels, helpers, bear,
  orders), `src/lib/farm.test.ts` or a new `src/lib/farmEconomy.test.ts`
- `src/lib/farm/chores.ts` (a cat's pick-up is not the player's)
- `src/lib/farm/scene.ts` (workshop level look, cat, dog, bear)
- `src/components/farm/sheets.tsx`, `cards.tsx`, `FarmGame.tsx`, `Board2D.tsx` (labels, new
  sheet for orders and helpers), `src/app/globals.css` (`fg-` rules only)
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, Làng Rêu, the GLB files.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1 (new fields optional on load).
- No new dependency. 44 px targets, labels, keyboard access for every new control.
- Nothing bad happens while the player is away: the bear only comes during live play.

## Verification

- [x] `npm test`: `farmEconomy.test.ts` 6 pass (levels and costs, second recipes, batches, truck
      levels, a cat's pick-ups are not the farmer's chore, the bear's rules, orders, old saves);
      128 pass overall (the 2 failures need `@neondatabase/serverless`, not installed here);
      ESLint, `tsc`.
- [x] Browser harness: economy 13/13 (upgrade the bakery and make a cream cake, two batches in
      a level-3 loom, deliver an order, a new truck, buy a cat and a dog, the cat carries
      products, tap a bear into its cage); the play test 30/30 after its orchard coordinates
      were updated to the moved orchard. Not rerun: zoom, HUD, people and the other older checks;
      the ranch check's pen table predates the larger yards (commits `47294d8`, `95637f5`) and
      fails on that alone.
- [x] Vercel build + production deploy (`bbcae86`).

## Result

- **Files changed:** `engine.ts` (workshop levels, second recipes and batches, truck levels, cat,
  dog, bear, orders, save loading), `chores.ts` (only a pick-up that earned XP is the player's),
  `scene.ts` (workshop level look, cats, dog, bear and its cage), `sheets.tsx` (workshop sheet
  with recipes and upgrades, orders sheet, truck upgrade, helpers in the shop), `cards.tsx`,
  `FarmGame.tsx`, `shared.ts`, `globals.css`, new `farmEconomy.test.ts`, `docs/LEARNING-FARM.md`.
- **Found while checking:** the bear button first pulsed in size, which made it a moving target:
  it pulses a ring instead. A tap on a level-2 workshop opens the sheet (two recipes to choose
  from) instead of starting the first one.
- **Not checked / remaining risk:** real phones; balance (prices and the bear's timing are first
  guesses); cats and the bear walk straight to their targets, through fences; the 2D board has
  the orders and bear buttons on the ranch card but draws no cat, dog or bear.
