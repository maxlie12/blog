# GAME-017 — Farm: zoom and pan, easier on phones; a ranch with separate pens

## Identity

- **Issue:** `GAME-017` (owner request, 2026-11-06: make each area bigger or easier to see,
  also on mobile web; a small pond in the ranch for the ducks; straw and small pretty details;
  the ranch can grow; separate chicken, cow and sheep pens and a middle area. Owner chose: pens
  grow with the existing capacity upgrade; ducks share the poultry yard with the chickens; a
  closer view on phones with zoom buttons, pinch and drag to look around)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-016-farm-heads-fruit.md`, `docs/LEARNING-FARM.md`

## User-visible problem

- On a phone the whole learning-world page is laid out wider than the screen (about 464 px on
  a 390 px phone), so the browser shrinks everything, and each area is framed to fit its full
  width, so plots, trees and animals are small. There is no way to zoom in or look around.
- The ranch is one fenced field: every animal mixes in it, with one trough and three hay bales.

## Completion evidence

- **Page width:** the learning-world page and the game fit a 360–430 px screen without
  sideways overflow (no shrink to fit).
- **Closer on phones:** on a narrow screen each area is framed closer (it no longer has to fit
  its full width); drag sideways to see the rest, the page still scrolls up and down.
- **Zoom:** `+`, `−` and “fit” buttons (44 px, keyboard reachable, labelled) on every 3D area;
  pinch with two fingers and Ctrl/⌘ + scroll (trackpad pinch) zoom; when zoomed in, drag with
  one finger or the mouse to look around, kept within the area; arrow keys pan while a zoom
  button has focus. Taps and tool drags on plots, trees, fish and animals keep working.
- **Ranch pens:** the ranch is larger and split into a poultry yard (chickens and ducks, a hen
  house, straw nests and a small duck pond), a sheep pen with a shelter, a cow pen with a shed
  and hay rack, each with its own trough, and a middle lane with the feed store, hay, a water
  pump and the incubator hut. Each animal stays in its own pen; ducks swim in the pond.
- **Growing:** pens start smaller and grow with each capacity upgrade (4 → 6 → 8 → 10 animals);
  each step adds details (straw piles, hay stacks, a wheelbarrow, flower boxes, milk cans, a
  bench, bunting and lanterns).
- Rules and saves are unchanged.

## Scope

### May edit

- `src/lib/farm/scene.ts`, new `src/lib/farm/view.ts` (zoom and pan limits) and
  `src/lib/farm/ranchLayout.ts` (pen layout), with tests in new `src/lib/farmLayout.test.ts`
- `src/components/farm/FarmScene3D.tsx` (zoom controls), `src/components/farm/FarmGame.tsx` and
  `src/components/farm/cards.tsx` / `sheets.tsx` only if a label or help line needs it
- `src/app/globals.css`: `fg-` rules and the `.learning-world` grid column (needed: its
  `auto` column lets wide content stretch the whole page on phones)
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules and saves (`engine.ts`), lesson flow, Done/streak, learner accounts, Prisma, Studio,
  Làng Rêu, the GLB files.

## Constraints

- Games never count toward Done/streak/CEFR. Save stays version 1.
- No new dependency. 44 px targets, visible focus, labels; reduced motion keeps the camera
  still apart from what the player does.
- Vertical page scrolling over the game keeps working on phones when not zoomed in.

## Verification

- [x] `npm test`: `farmLayout.test.ts` 4 pass (zoom and pan limits; the covered top and bottom
      on phones; pens do not overlap, stay on the island, grow with the level and hold their
      buildings; room for the animals), 101 pass overall (`habitSyncServer` fails as before);
      ESLint, `tsc`.
- [x] Browser harness: earlier checks 30/30, 15/15, 11/11, 5/5 and the eating and reduced-motion
      checks; no sideways overflow at 360/390/412 px; zoom 13/13 (buttons, pinch, ctrl+wheel,
      drag-pan, arrow keys, taps after panning, reset); phone HUD 9/9; ranch 7/7 (each species in
      its pen, ducks swim, all three troughs, pens grow on upgrade); every plot in view on phones
      and the phone touch-drag sows two plots without scrolling the page; screenshots desktop and
      phone.
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** new `src/lib/farm/view.ts` (framing, zoom and pan limits, the covered top
  and bottom on phones), new `src/lib/farm/ranchLayout.ts` (pens, fixtures, duck pond, where
  animals may stand), new `src/lib/farmLayout.test.ts` (4 tests); `scene.ts` (zoom, pinch,
  Ctrl/⌘ + scroll, drag to look around, phone framing; the ranch buildings, duck pond, troughs,
  fences and level details; animals kept in their pens, ducks swim); `FarmScene3D.tsx` (zoom
  buttons, arrow keys, measures the top bar and bottom bar or card); `sheets.tsx` (upgrade and
  help lines); `globals.css` (zoom buttons, the page and game columns `minmax(0, 1fr)`, a compact
  phone HUD); `docs/LEARNING-FARM.md`.
- **Found while checking:** the page laid out at about 464 px on a 390 px phone (the
  `.learning-world` and `.fg` grid columns stretched to the widest content), so phones shrank the
  whole game; on phones the side buttons overlapped the area tabs; the closer phone framing cut
  off the farm's left column of plots (a touch there landed off the canvas and scrolled the page);
  the bottom card covered the lower third of the pond, river and ranch, so the closer framing
  hid part of each area under it; the first pens were too small for their buildings and animals.
  All fixed: phones now frame each area between the top bar and the bottom bar or card, and the
  fields start centred on the plots.
- **Not checked / remaining risk:** real phones and iOS Safari (checked in headless Chromium
  with touch emulation at 360, 390 and 412 px); the side buttons still cover the far right of
  each area on phones, as before; the cover is measured when the area or screen size changes,
  so a bottom card that later grows much taller (long fishing text) can cover a little more.
