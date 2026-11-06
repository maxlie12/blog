# GAME-013 — Farm: a day clock, seasons and living crops and animals

## Identity

- **Issue:** `GAME-013` (owner request, 2026-11-06: crops need water every so often and grow
  through stages, some crops harvest several times, animals are raised from young and lay eggs
  when grown, orchard trees grow and fruit more slowly, seasons, a 24-hour day with morning and
  night; owner chose 1 game day = 24 real minutes and four seasons where out-of-season crops grow
  slowly)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-012-farm-cozy-graphics.md`, `docs/LEARNING-FARM.md`

## User-visible problem

Crops ripen in one to 120 real minutes, harvest once, and get thirsty at random. Animals arrive
grown and produce around the clock. There is no time of day and no season.

## Completion evidence

- **Clock:** each farm has its own clock: one game day is 24 real minutes (one game hour per real
  minute), with dawn, day, dusk and night in the 3D scene (sun moves, sky and light change,
  lanterns, fairy lights and windows glow at night). A new farm starts at 6:00 on day 1 of spring.
- **Seasons:** spring, summer, autumn and winter, seven game days each. Each crop and fruit tree
  has its own seasons; out of season a crop grows at half speed and dries faster, a tree fruits
  slowly. Grass and leaves change colour with the season.
- **Water:** soil moisture drains over game hours (faster in summer and by day, slower in winter
  and at night, at each crop's own pace); dry soil nearly stops growth until watered. Watering
  refills it; the card shows how moist the soil is.
- **Crops:** grow over game days through seed, sprout, growing and ripe; tomatoes, strawberries
  and watermelons regrow and harvest several times before the plant is spent; the rest harvest
  once. Times, yields, prices and XP are rebalanced for the slower pace.
- **Animals:** bought young (chick, duckling, lamb, calf), they eat from the trough and grow up
  over game days, then produce; adults sleep at night and produce in the day. Product and goods
  prices are rebalanced.
- **Orchard:** trees take game days to grow and fruit again every one to three game days, in
  their fruiting seasons.
- Old saves keep everything: their clock starts now at 6:00 in spring, animals stay grown, dry
  plots stay dry. Fishing, pond fish, workshops and the truck keep their pace.

## Scope

### May edit

- `src/lib/farm/engine.ts`, `src/lib/farm.test.ts`
- `src/lib/farm/scene.ts`, `src/lib/farm/look.ts` (day/night, season tint, young animals)
- `src/components/farm/*` (clock and season in the HUD, cards, shop, help, 2D board),
  `src/app/globals.css` (`fg-` and `fg2-` only)
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, Làng Rêu.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1; old saves load.
- Time stays real: growth also happens while the page is closed (up to 14 days, as before).
- Keyboard, 44px targets and reduced motion as before. The light follows the hour slowly (a full
  day takes 24 minutes), so it is not treated as motion; grass and leaves still hold still.

## Verification

- [x] `npm test`: `farm.test.ts` 15 pass (clock and seasons; drying, watering and dry-soil growth;
      out-of-season growth and summer vs winter drying; tomatoes harvesting four times; a chick
      growing up and a hen laying only by day; an orange tree fruiting slowly in spring; old saves
      getting a clock, keeping grown animals, dry plots and growth shares). 93 pass overall; the
      one failure is the existing `habitSyncServer` test. ESLint and `tsc` clean.
- [x] Browser harness: the earlier 30 checks pass (one updated for the new lemon times), plus 15
      new ones: a new farm at about 6:00 on spring day 1 and the clock advancing a game minute per
      second; the moisture bar and the water button only below 60%; the hand watering a drying
      plot; a tomato harvest leaving the plant with “Còn 3 lứa”; seasons and extra harvests in the
      seed list; young animals in the animal list; a chick's growing time; the hen asleep at night
      on the 2D board; the night clock with a moon; no console errors; the phone clock beside the
      coins without covering the view or side buttons.
- [x] Screenshots reviewed: morning, dusk and night; autumn and winter; chicks and ducklings, the
      lamb, sleeping animals; phone HUD.
- [x] Vercel build + production deploy (`4bbddef`).

## Result

- **Files changed:** `src/lib/farm/engine.ts`, `src/lib/farm.test.ts`, `src/lib/farm/scene.ts`,
  `src/lib/farm/look.ts`, `src/components/farm/` FarmGame, cards, sheets, Board2D,
  `src/app/globals.css`, `docs/LEARNING-FARM.md`, `docs/STATUS.md`.
- **Found while checking:** old saves would have lost their ripe crops (the old growth seconds
  were a small share of the new times), so old progress is now scaled to the new times; the clock
  first pushed the phone's view buttons into the side buttons, so on phones it sits beside the
  coins and shows only the hour.
- **Not checked / remaining risk:** the pace on real play (a cabbage now takes 20 real minutes,
  leveling is slower than before); a real phone; night readability on a dim screen.
