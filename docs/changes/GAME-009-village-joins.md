# GAME-009 — Làng Rêu: walls, fences and hedges join what is already there

## Identity

- **Issue:** `GAME-009` (owner request, 2026-11-03: “Các phần nối vào nhau được đặt vào trước như
  tường không kết nối vào nhau nhỉ”)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-008-village-camera.md`

## User-visible problem

A new wall only joined an old one when its end landed within 0.9 of the old wall's *end*.
Reproduced in the harness: a wall started a little past another's end stood as two towers side by
side; a wall drawn round a yard did not close (two towers at the corner); a wall drawn up to the
side of another stopped short or poked through; fences and hedges never joined at all.

## Completion evidence

- When a wall, fence or hedge starts or ends near one of the same kind already built, it joins:
  onto the old line's end if one is close, otherwise onto its side (a T-joint). Walls also join a
  standalone tower. A line drawn back round to its own start closes into a ring.
- The reach is about a fingertip on screen (larger for touch), never less than before (0.9); for
  walls at least 1.6, a tower's width, since closer wall ends would stand as two towers.
- Points that overshoot the joint are dropped, so the line does not poke through.
- The preview while dragging already shows the join, before letting go.
- Paths and streams are unchanged (they overlap and already look joined).
- Found while checking: tapping an animal that was still dropping in placed a second one instead of
  petting it (distance was measured in 3D from the ground); it is now measured on the ground.

## Scope

### May edit

- `src/lib/village/data.ts` (`joinLine`, pure), `src/lib/village/scene.ts` (use it when drawing
  and in the preview; petting distance), `src/lib/village.test.ts`
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- Saved lines stay plain point lists (version 1); only new strokes are joined, old saves load as
  they were.

## Verification

- [x] `npm test`: 21 village tests, the new one covers end to end, T-joint without poking through,
      a tower, a closing ring, nothing near and a would-be stub. ESLint and `tsc` clean.
- [x] Browser harness, the same six strokes before and after (screenshots reviewed): before, a wall
      started 1.25 past another's end stood as two towers, a T-joint stopped 1.3 short, a yard did
      not close and two fences left a gap; after, the saved points start on the old end, end on
      the side, the ring's first and last points are equal and the fences share a post.
- [x] Earlier suites on the final build: main 41/41 (the pet-the-dog check, which had failed in
      the last three runs, passes: its failures were the dropping-animal bug above), physics 18/18,
      strip/castle/fish 27/27.
- [x] Vercel build + production deploy (`35271e1`).

## Result

- **Files changed:** `src/lib/village/data.ts` (`joinLine`), `scene.ts` (joining when drawing and
  in the preview, petting distance), `src/lib/village.test.ts`.
- **Not checked / remaining risk:** a real phone. A wall drawn deliberately close to and parallel
  with another may now attach to it at its ends; Undo removes it in one step.
