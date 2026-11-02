# GAME-001 — Làng Rêu village builder

## Identity

- **Issue:** `GAME-001` (owner request, 2026-11-02; game work stays below the learning issues in `docs/ISSUES.md`)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-02

## User-visible problem

The owner wants a calm building game in the spirit of Tiny Glade inside the site, where new
building pieces are earned by learning their English word. A prototype exists only as a private
claude.ai page, so the learner cannot reach it from the blog.

## Completion evidence

- `/learning/village` shows a floating island with a sample village. The learner can draw paths
  and walls (a wall crossing a path opens an arched gate; wall ends and sharp corners get towers),
  place and stretch houses, plant trees, erase, undo and change the time of day.
- Seven pieces (tower, fence, well, pond, windmill, lantern, sheep) are locked. Each unlocks after
  a three-step vocabulary card: see/hear the word, pick its meaning, type it into a sentence.
- The village and unlocks persist after refresh under the active learner profile on this device.
  The page states that vocabulary unlocks are not a level test and write no Done, streak or attempt.
- Works at 390px and 1280px: 44px controls, keyboard-reachable tools and dialogs, visible focus,
  reduced motion stops camera easing and animal wandering, no horizontal scroll.
- The Learning Farm page links to the village and back.

## Scope

### Read

- `docs/LEARNING-FARM.md` (game boundary), `src/lib/learnerProfiles.ts` (profile storage)
- `src/components/LearningWorld.tsx`, `src/app/learning/world/page.tsx` (entry pattern)
- `src/components/PronounceButton.tsx` (existing speech helper)

### May edit

- `src/lib/village/scene.ts` (new) — three.js island, builders, input, time of day; loaded on demand.
- `src/lib/village/data.ts` (new) — tools, words, stroke helpers and save parsing (pure).
- `src/lib/village.test.ts` (new) — stroke smoothing and save validation.
- `src/components/village/VillageGame.tsx` (new) — HUD, word book, lesson dialog.
- `src/app/learning/village/page.tsx` (new) — the route.
- `src/components/LearningWorld.tsx` — one link to the village.
- `src/app/globals.css` — `vg-` styles, using existing tokens.
- `docs/changes/GAME-001-village-builder.md`, `docs/STATUS.md` — evidence.

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm engine.

## Constraints

- Vocabulary unlocks are game progress only: never Done, streak, attempt or CEFR evidence.
- No new dependency: `three` is already installed. No external CDN at runtime.
- Local data uses the existing profile storage helpers and says it is device-specific.
- 44px touch targets; reduced motion respected; tools and dialogs reachable by keyboard.

## Plan

1. Move the prototype's pure data/helpers into `data.ts` with a focused test.
2. Move the three.js scene into `scene.ts` behind a small controller (tool, time, undo, reset).
3. Build the HUD and lesson dialog in React with site tokens.
4. Lint, test, build, browser-check both widths, review, push.

## Verification

- [x] `npm test`: the 5 new village tests pass. `habitSyncServer.test.ts` fails before and after
      this change because `@neondatabase/serverless` is not installed in this workspace.
- [x] `npm run lint` scope: ESLint passes on every new or edited file; `tsc --noEmit` reports no
      errors in them (remaining errors come from the missing Prisma client and new packages).
- [x] Build: not runnable here (no network for `npm ci` to install `@clerk/nextjs`,
      `@neondatabase/serverless`, `@huggingface/transformers`). Vercel's production build of
      commit `d6a7d13` succeeded and was deployed to Production.
- [x] Browser at 390px (touch) and 1280px, React StrictMode harness with the real components:
      44/44 checks. Path + wall gives an arched gate, house, tree, tower unlocked through the
      lesson, erase, undo, night, refresh keeps village and unlock, Enter places a tree and
      Ctrl+Z undoes it, Escape closes the dialog, every control at least 44px, no horizontal
      scroll, no console errors, and only the two village keys are written to storage.
- [ ] Production route check: not possible from this workspace (vercel.app is blocked); owner to open `/learning/village`.

## Result

- **Files changed:** `src/lib/village/{data,scene}.ts`, `src/lib/village.test.ts`,
  `src/components/village/VillageGame.tsx`, `src/app/learning/village/page.tsx`, one link in
  `src/components/LearningWorld.tsx`, `vg-` styles in `src/app/globals.css`.
- **Evidence:** see Verification. Saves live under `learning-profile:<id>:village-scene-v1` and
  `…:village-progress-v1`, are validated on load (bad or off-island items are dropped) and never
  touch Done, streak, attempts or server data.
- **Behaviour beyond the prototype:** the canvas is focusable; arrows orbit, Shift + arrows pan,
  +/− zoom and Enter places the selected object near the centre of the view, so building is
  possible without a pointer (paths, walls and fences still need dragging). A start on the grass
  rim is pulled inside the build area instead of being refused.
- **Commit/deployment:** see `docs/STATUS.md`.
- **Not checked / remaining risk:** opening the live page; real iPhone/Safari and a real low-end
  laptop GPU (tests ran on software WebGL); real speech voices; screen-reader output.
