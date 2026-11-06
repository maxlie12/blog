# GAME-012 — Farm: cozy graphics (light, greenery, rounded props, decor)

## Identity

- **Issue:** `GAME-012` (owner request, 2026-11-06, with two screenshots of stylised cozy garden
  games: “Liệu có thể update game lên đồ hoạ như này k”; owner chose the farm first, and light +
  greenery + rounded props + decor, all built in code)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-06
- **Builds on:** `GAME-011-farm-river-orchard.md`, `docs/LEARNING-FARM.md`

## User-visible problem

The farm is flat-shaded low-poly: one flat green, sharp boxes, cone trees, a plain sky, soil
slabs for plots and almost no decoration. The reference pictures feel warm and lived-in: soft
warm light, lush leafy plants, chunky rounded wooden beds and furniture, glowing lanterns and a
hazy distance. An exact match is not possible in a browser on an iPhone 14 Pro Max and a Dell
Inspiron 15 3000 (hand-made art, Unreal Engine lighting), but the look can move much closer.

## Completion evidence

- **Light:** warmer sun and sky light, soft shadows on Medium/High, gentle darkening where things
  meet the ground and under trees (baked, so it costs nothing per frame), a gradient sky with
  hazy far islands. On High: lanterns and string lights glow (bloom), the edges blur slightly
  like a miniature (tilt-shift) and the corners darken a little.
- **Greenery:** grass tufts and wild flowers across the island that sway, clumpy leafy tree
  crowns, bushes, vines with grapes on a trellis, big banana plants.
- **Rounded props and crops:** plots are raised wooden beds with soil mounds; crops have more
  leaves and fruit; buildings get shingled roofs, trims and window boxes; rounded fence posts.
- **Decor:** a cosy corner near the house (rug, bean bags, umbrella, easel, lanterns), string
  lights, flower pots, crates.
- Low stays light: no post-processing, fewer tufts, no shadows; the baked shading and new models
  still apply. Every tap target, view and gameplay rule is unchanged.

## Scope

### May edit

- `src/lib/farm/scene.ts` (models, ground, lights, render loop), new `src/lib/farm/look.ts`
  (sky, grass and flowers, wind, post-processing), `src/lib/farm/quality.ts` (preset fields),
  `src/lib/farm.test.ts` (a preset test)
- `src/lib/village/graphics.ts`: only an optional opacity range for `waterMaterial` (default
  unchanged), so the farm can reuse Làng Rêu's rippling water while its pond fish stay visible.
- `docs/LEARNING-FARM.md`, this brief, `docs/STATUS.md`

### Must not edit

- Game rules (`engine.ts`, `fishing.ts`), saves, UI components, Làng Rêu (apart from the
  opacity option above), lesson flow, Done/streak, accounts, Prisma.

## Constraints

- Games never count toward Done/streak/CEFR. No new dependency (three.js examples only).
- Draw calls stay low: static scenery stays baked; grass, flowers and foliage are one instanced or
  baked mesh each. Post-processing only on High; the automatic step-down turns it off first.
- Reduced motion: no swaying grass or leaves. Taps and drags hit the same objects as before.

## Verification

- [x] `npm test`: 81 pass, including a new preset test in `farm.test.ts` (only High runs the
      full-screen effects; lighter presets draw less grass and flowers); the one failure is the
      existing `habitSyncServer` test. ESLint clean; `tsc` shows only the existing Next/Prisma
      type errors, none in the farm or village files.
- [x] Browser harness 30/30 (desktop 3D and 2D, phone touch drag without scrolling, old save,
      pond and ranch, fishing rounds, Space on the fishing button, no console errors). Three
      waits in the harness were lengthened because software rendering now runs at about 3 frames
      a second (the next cast waits 0.4 s of game time; a toast was read after a slow drag).
- [x] Làng Rêu main suite 41/41 after the water option.
- [x] Reduced motion: two frames 2.5 s apart are the same except a pond fish's existing bob.
- [x] Draw calls and triangles per view (shadow pass included): low 8–47 and 69–170k, medium
      26–79 and 167–369k, high 41–96 and 191–401k (before: about 14k triangles). Screenshots
      reviewed at every preset, desktop and phone, empty and fully planted, before and after.
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** `src/lib/farm/scene.ts`, new `src/lib/farm/look.ts`,
  `src/lib/farm/quality.ts`, `src/lib/farm.test.ts`, `src/lib/village/graphics.ts` (opacity
  option only), `docs/LEARNING-FARM.md`, `docs/STATUS.md`.
- **Found while checking:** fence and trellis "shade" was first painted as big discs that darkened
  half the yard, so it was dropped; plots, buildings and workshops were also being hit-tested
  triangle by triangle for nothing (only their hit boxes answer), which is skipped now that they
  are far more detailed.
- **Not checked / remaining risk:** frame rate on a real iPhone 14 Pro Max and Dell Inspiron 15
  3000 (the test browser renders in software, about 2.4× slower than before; automatic mode
  steps down when a device is slow); how strong the edge blur feels on a small phone.
