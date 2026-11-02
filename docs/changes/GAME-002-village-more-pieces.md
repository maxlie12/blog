# GAME-002 — Làng Rêu: more pieces and a larger island

## Identity

- **Issue:** `GAME-002` (owner request, 2026-11-02: “thêm khoảng 30–50 đồ nữa và mở rộng map ra”)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-02
- **Builds on:** `GAME-001-village-builder.md`

## User-visible problem

The village has only 13 tools and a small island, so it fills up quickly and the word book ends
after 11 words.

## Completion evidence

- 42 new pieces in five groups (buildings, plants, water, decor, animals), each unlocked by its
  English word through the same three-step card. Total: 53 words.
- New drawn pieces: a stream (a path drawn across it gets a wooden bridge) and a hedge.
  Plants such as bushes and flowers can be brushed on like trees. Animals wander and can be petted.
- The island is about 2.5× larger by area. Existing saves load unchanged; the camera still opens
  on the village and can zoom out to the whole island.
- The tool dock has group tabs and small 3D previews of every piece; the word book is grouped.
- Same rules as GAME-001: unlocks are game progress only, 44px targets, keyboard, reduced motion.

## Scope

### May edit

- `src/lib/village/data.ts`, `src/lib/village/scene.ts`, `src/lib/village.test.ts`
- `src/lib/village/kit.ts` (new) — shared three.js primitives and baking.
- `src/lib/village/props.ts` (new) — models of the new pieces.
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` styles only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- Save format stays version 1; new lists are optional so older saves still parse.
- No new dependency; three.js still loads only on the village page.
- Brushed plants are instanced so large meadows stay cheap on phones.

## Verification

- [x] `npm test`: 7 village tests pass (53 word cards well-formed, old saves without the new lists
      load, unknown or off-island pieces dropped). `habitSyncServer.test.ts` still fails only
      because `@neondatabase/serverless` is not installed in this workspace.
- [x] ESLint and `tsc` clean for every changed file.
- [x] Browser at 390px (touch) and 1280px, StrictMode harness with the real components: 41/41.
      A GAME-001 save and its unlocks load unchanged; each group tab shows its tools with
      previews; stream, flower, barn, bench and dog unlocked through the lesson; a path across
      the stream gets a bridge; flowers brush on; tapping the dog pets it; erase and undo a barn;
      the sample village shows the new pieces; zoom out shows the whole island; 44px controls,
      no horizontal scroll, reload keeps everything, no console errors.
- [x] Screenshot sheet of all 53 previews; night view with lit lighthouse and campfire.
- [ ] Vercel build + production deploy (see `docs/STATUS.md`)

## Result

- **Files changed:** `src/lib/village/{data,scene,kit,props}.ts`, `src/lib/village.test.ts`,
  `src/components/village/VillageGame.tsx`, `vg-` styles in `src/app/globals.css`.
- **Evidence:** see Verification.
- **Not checked / remaining risk:** every commit re-bakes all non-instanced pieces, so a very large
  village (many hundreds of buildings) may stutter on a phone when placing; brushed plants,
  trees and grass are instanced and unaffected. Real iPhone/Safari, real low-end GPU, speech
  voices and screen readers were not tested. Tool previews need a second, short-lived WebGL
  context; if a browser refuses it, tools show a plain placeholder instead.
