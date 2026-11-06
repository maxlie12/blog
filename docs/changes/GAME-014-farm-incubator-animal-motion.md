# GAME-014 — Farm: an incubator for eggs, and livelier animals and fish

## Identity

- **Issue:** `GAME-014` (owner request, 2026-11-06: “sẽ có thêm cơ chế cho gà và vịt để trứng …
  giống như phòng ấp”, then “ok vậy làm luôn nhé” for animal and fish motion made in code rather
  than with Meshy, whose rigging API only supports humanoid characters)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-013-farm-biology.md`

## Completion evidence

- **Incubator (lò ấp):** built at the ranch (level 2, 150 xu), four slots. Eggs and duck eggs from
  the barn hatch after 21 and 28 game hours (like 21 and 28 days) into a chick or duckling. An egg
  must be turned at least every 12 game hours or it stops developing; the last 15% needs no
  turning (lockdown). Hatchlings wait beside the hut until brought out to the pasture (as young
  animals) and wait longer if the pasture is full. A hut south of the pasture shows the eggs under
  a warm lamp, the waiting chicks, and a star or a turn icon; the ranch card, a sheet and the 2D
  board give every action a button.
- **Animals:** chickens peck in bursts and bob their heads as they walk, ducks waddle, dabble and
  preen, sheep and cows graze with their heads down; they turn smoothly, sometimes walk to the
  trough to eat, chicks and ducklings follow a grown one of their kind, and at night grown animals
  lie down and breathe slowly. Whole-body poses, so they work with the Meshy models too.
- **Pond fish:** swim in an S (tail and body bend against each other), dart now and then, lean
  into turns and sometimes rise towards the surface.

## Scope

- `src/lib/farm/engine.ts` (incubator), `src/lib/farm.test.ts`, `src/lib/farm/scene.ts` (hut,
  motion), `src/components/farm/` (FarmGame, cards, sheets, shared, Board2D), `docs/`.
- Must not edit: lesson flow, Done/streak, accounts, Prisma, Làng Rêu.

## Verification

- [x] `farm.test.ts` 16 pass (new: incubator slots and barn eggs, stalling without turning,
      hatching times, hatchlings waiting for space); 94 pass overall, the one failure is the
      existing `habitSyncServer` test. ESLint and `tsc` clean.
- [x] Browser: 11 new checks (open from the ranch card, build, set eggs, times and free slots, tap
      the hut, hatched and stalled eggs shown in the card and sheet, bringing out a chick and a
      duckling as young animals, turning, 2D button, no console errors); earlier suites 30/30 and
      15/15. Screenshots reviewed (hut with eggs, hatchlings, pecking and dabbling by day, lying
      down at night). Reduced motion: no poses or swimming changes.
- [x] Vercel build + production deploy.

## Result

- **Not checked / remaining risk:** how the poses look on the Meshy models on the live site (the
  harness uses the built-in models); a real phone.
