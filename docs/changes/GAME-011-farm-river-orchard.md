# GAME-011 — Farm: river fishing, a fruit orchard and hands-on field work

## Identity

- **Issue:** `GAME-011` (owner request, 2026-11-04: “phần nông trại bây giờ có thêm chức năng câu
  cá và tự trồng cây. Thao tác thực luôn thì sao”; owner chose a new river with wild fish, and
  both a fruit orchard and hands-on field work)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-04
- **Builds on:** `GAME-010-cozy-music.md`, `docs/LEARNING-FARM.md`

## User-visible problem

The farm's pond is raised and netted, and every field job is a tap. There is no fishing with a rod
and nothing to plant that keeps giving. Actions do not feel like doing the work.

## Completion evidence

- **River (new “Sông” view):** a river along the east of the island, with a jetty, a bridge for the
  road and a waterfall off the cliff. Tap the water to cast where you tap (or press **Thả câu**).
  The float bobs; small nibbles are not a bite; when the fish bites (the float plunges, “!”), tap
  within about a second to strike. Then hold to reel and let go when the line goes red, or it
  snaps; a slack line for too long lets the fish go. Six wild fish (and an old boot) by level;
  each bite uses one bait (🪱, sold at the market, five in the daily gift). Catches go to the barn.
- **Orchard (new “Vườn” view):** six tree spots (two open at the start, more for coins and level).
  Dig a hole, plant a sapling (lemon, orange, banana, mango, coconut by level), water it when dry;
  the tree grows through sapling and young stages and then fruits again and again. Shake a ripe
  tree: the fruit falls and goes to the barn. A tree can be cut down to plant another.
- **Hands-on work:** in the fields and the orchard, press and drag the tool across plots or trees;
  each one it passes is worked. The tool follows the finger (hoe chops, seed bag scatters, can
  pours, glove pulls) with dirt, seeds, water, leaves, sparkles, harvested crops or falling fruit.
  A tap still does one plot; every action still has a button in the card.
- Old saves keep everything and get the orchard, one lemon sapling and some bait. Fruit and wild
  fish sell at the barn and on the truck. The 2D board has the orchard and the river too.

## Scope

### May edit

- `src/lib/farm/engine.ts` (orchard, wild fish, bait, barn), new `src/lib/farm/fishing.ts`
  (pure fishing state machine), `src/lib/farm/scene.ts` (river, orchard, tool and effects),
  new `src/lib/farm.test.ts`
- `src/components/farm/*` (FarmGame, FarmScene3D, Board2D, cards, sheets, shared, new
  FishingPanel), `src/app/globals.css` (`fg-` and `fg2-` only)
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, Làng Rêu.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1; old saves load.
- Keyboard: every action has a button; fishing works with Space/Enter. Reduced motion: no
  bobbing or flowing, but bites still show clearly. 44px targets.
- Draw calls stay low: the river and orchard ground are baked into the static island.

## Verification

- [x] `npm test`: new `farm.test.ts` (7 tests: new farm, the tree's whole life, barn and selling,
      old and new saves, strike timing, reeling outcomes, level-gated catches and bait), 73 pass
      (the one failure is the existing `habitSyncServer` test). ESLint and `tsc` clean.
- [x] Reeling tuned by simulation (200 seeds per fish, holding all the time vs. letting go in the
      red): small fish always land; holding through the pulls snaps 15% of catfish, 60% of
      snakehead and 94% of featherback, while letting go in the red lands all of them in 6–10 s.
- [x] Browser harness 30/30 (desktop 3D and 2D, phone, an old save): a seed-bag drag sows the
      four plots it crosses and uses four seeds; a hoe drag over planted plots stays quiet; the hand
      digs and plants in the orchard and the tree card shows it; a hand drag shakes a ripe tree
      (+4 lemons) and waters the dry one next to it; tapping the water casts, an early strike
      scares the fish and keeps the bait, three full rounds caught three fish into the barn and
      used three bait; Space on the 52px fishing button plays a whole round in 2D; an old save gets
      the orchard, a sapling and 8 bait and keeps its coins and pond; netting and collecting at the
      pond and ranch still work; on the phone a touch drag sows two plots without scrolling the
      page and the five view buttons fit; no console errors. Screenshots reviewed (river, reeling,
      catch, orchard with ripe and dry trees, falling fruit, tool in hand, 2D river and orchard).
- [x] Draw calls per view on the low preset: 10–42.
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** `src/lib/farm/engine.ts`, new `fishing.ts`, `scene.ts`, new
  `src/lib/farm.test.ts`; `src/components/farm/` FarmGame, FarmScene3D, Board2D, cards, sheets,
  shared, new FishingPanel; `globals.css`; `docs/LEARNING-FARM.md`.
- **Found while checking:** in the orchard, tall pick boxes let the tree in front catch a tap meant
  for the spot behind it; spots are now picked by the tree under the pointer, then by the ground.
- **Not checked / remaining risk:** a real phone (touch drags and holding were tested with
  synthetic touches; iOS Safari not tried); the feel of the bite window and reeling on a real
  device; vibration on a bite only works on Android.
