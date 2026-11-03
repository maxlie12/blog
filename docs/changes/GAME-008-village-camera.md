# GAME-008 — Làng Rêu: move the view and focus on a spot

## Identity

- **Issue:** `GAME-008` (owner request, 2026-11-03: “Hiện tại đang để camera ở giữa trung tâm làm t
  không thể xem hoặc focus các điểm mình muốn được”)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-007-village-graphics.md`

## User-visible problem

The view turns and zooms around the middle of the island. Moving it needs the middle mouse button
or Shift + arrows; two fingers only slide it sideways; zooming always heads for the middle. There is
no way to go to a spot or keep a villager in view.

## Completion evidence

- The mouse wheel, a trackpad pinch and a two-finger pinch zoom towards the pointer or the fingers,
  so the spot under them stays put. Zoomed far out, the view settles back over the whole island.
- Two fingers drag the view in every direction (twist still turns it); the middle mouse button and
  Shift + arrows still drag it, now at the speed of the pointer.
- **Xoay** tool: a tap (without dragging) glides the view to that spot and comes a little closer.
- Keyboard: W A S D move the view, Q and E turn it, Home goes back to the middle.
- **Về giữa làng** button (44px, header) appears when the view is away from the middle and brings
  it back.
- **Look card:** “Đi theo” keeps a villager or animal in the middle of the view as it walks
  (pressed state; turning and zooming keep following; moving the view away, picking something
  else, closing the card or pressing again stops it); for a building or other piece, “Lại gần”
  brings it to the middle, closer. On a phone the followed thing sits a little low so the card does
  not cover it.

## Scope

### May edit

- `src/lib/village/scene.ts` (camera, input, follow, controller), `src/lib/village/data.ts`
  (Xoay hint)
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- No new dependency. Reduced motion: the view jumps instead of gliding (as now).
- The view is not saved (as now); following stops when the selection goes.

## Verification

- [x] ESLint and `tsc` clean for changed files; `npm test` (village tests unchanged, all pass).
- [x] Browser harness, new suite 30/30 (desktop 17, phone 13), read through a temporary
      read-only hook removed before commit: wheel zoom from 28 to 11 moved the spot under the
      pointer by 0.02; a pinch from 55 to 13 moved the spot between the fingers by 0.11; two
      fingers drag the view forward; the way-back button is hidden at the start, appears (44px),
      recentres and hides; a Xoay tap moves the view to the spot and a Xoay drag still turns;
      D, W move and Home recentres; “Đi theo” (44px) is pressed, the view tracks the villager and
      stops on A or a second press; “Lại gần” brings a path or house to the middle at radius 14;
      zoomed right out the view is back over the middle; no horizontal scroll; no console errors.
- [x] Earlier suites on the same build: graphics 44/44, countryside 20/20, strip/castle/fish 27/27,
      talk/clock 26/26; main 40/41 (the pet-the-dog timing check again; it passed on the
      GAME-007 rerun); physics needed the test to put the page scroll back before the throw (the
      longer help text makes the test page scroll when a tool is clicked), then 9/9; Look 63/64
      then 42/42 on a rerun (labels were measured before the next frame had placed them).
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** `src/lib/village/scene.ts` (zoom towards a point, pointer-speed drag,
  two-finger drag, Xoay tap, W A S D / Q E / Home, follow and focus, view reports),
  `data.ts` (Xoay hint), `VillageGame.tsx` (way-back button, “Đi theo” / “Lại gần”, help text),
  `globals.css`.
- **Not checked / remaining risk:** a real phone and trackpad (the harness sends synthetic touch
  and wheel events); two-finger tilt is gone (tilt with the Xoay tool or the arrow keys); a pinch
  while following ignores small drifts of the fingers, which was not tested.
