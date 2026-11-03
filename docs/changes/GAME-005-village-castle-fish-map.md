# GAME-005 — Làng Rêu: larger island, scrollable tool strip, castle and fish

## Identity

- **Issue:** `GAME-005` (owner request, 2026-11-03: “mở rộng map lên được không và có thể kéo sang
  bên … khi quá nhiều đồ vật để chọn t không thể kéo sang phải được và t muốn xây dựng lâu đài và
  sông có thể thêm cá không hoặc cho cá riêng”)
- **Status:** done (live page check by owner); shipped together with `GAME-006-village-talk-clock.md`
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-004-village-people-vocab.md`

## User-visible problem

- The island fills up quickly.
- With a mouse, the tool strip and group tabs cannot be moved sideways: the scrollbar is hidden
  and the wheel scrolls the page, so pieces past the right edge cannot be reached.
- There is no castle to build, and ponds and streams have no fish.

## Completion evidence

- The island is about twice as large by area; old saves load unchanged and the camera can zoom out
  far enough to see all of it.
- The tool strip and the group tabs scroll with the mouse wheel, by dragging with the mouse, and
  with arrow buttons that appear only when there is more in that direction; touch swiping still
  works. A drag does not pick a tool by accident.
- A **castle** piece (word “castle”): walls, four corner turrets, a central keep with a banner,
  a gatehouse and a drawbridge; Look labels its parts.
- A **knight** profession (word “knight”) who guards the nearest castle gate or patrols the
  village (“The knight is guarding the castle gate.”).
- **Fish** (word “fish”), released by tapping or brushing on a pond or stream only. They swim
  around their water, jump out now and then with a ripple, and Look reads “The fish is jumping
  out of the water.” Hand on a fish makes it jump.

## Scope

### May edit

- `src/lib/village/data.ts`, `vocab.ts`, `props.ts`, `people.ts`, `scene.ts`, `src/lib/village.test.ts`
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- Save format stays version 1; a larger island only widens what loads.
- No new dependency; the strip uses platform scrolling with a wheel listener and pointer events.
- Arrow buttons are 44px; keyboard users still reach every tool with Tab (the browser scrolls the
  focused tool into view), so the arrows are pointer conveniences.

## Verification

- [x] `npm test` (17 village tests at this point: larger island keeps pieces out to the new edge,
      fish are water animals, castle and fish in their groups), ESLint and `tsc` clean.
- [x] Browser harness, new suite 27/27 at 1280px and 390px: right arrow shown when tools
      overflow; the mouse wheel scrolls the strip; a mouse drag scrolls it without picking a
      tool; a touch swipe scrolls it; the arrows scroll, are 44px and reach the last tool; fish
      refuse dry land, are saved when released on a pond, and Look reads “The fish is jumping
      out of the water.”; the knight guards; tapping the castle labels keep, turret, gate and
      drawbridge; zoomed out the whole island fits; no console errors.
- [x] Frame rate in the software-rendering harness measured equal to the previous release after
      lifting the clouds above the usual camera height and using 1,200 grass tufts (1,600 halved
      the rate there).
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** `src/lib/village/data.ts` (island radius 22 → 32, castle, fish, knight),
  `vocab.ts` (guard, jump; keep, turret, drawbridge, helmet, shield, sword, fin, scale),
  `props.ts` (castle and fish models, part anchors), `people.ts` (knight), `scene.ts` (fish
  swimming and jumping, water-only release, ripples, clouds higher and hidden near the camera,
  more grass tufts, zoom out to 150), `VillageGame.tsx` (scrolling strip), `globals.css`, tests.
- **Not checked / remaining risk:** shadows cover a larger area with the same shadow map, so they
  are a little softer; `next build`, a real phone and the live page are checked by Vercel and the
  owner.
