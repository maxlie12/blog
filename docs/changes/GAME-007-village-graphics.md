# GAME-007 — Làng Rêu: better graphics with a quality setting

## Identity

- **Issue:** `GAME-007` (owner request, 2026-11-03: “cải thiện đồ họa thì sao”; owner chose all of:
  living water, light and effects, sky and weather, grass/ground/models; with a quality setting)
- **Status:** in progress
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-006-village-talk-clock.md`

## User-visible problem

The village is flat-shaded with a plain sky colour, still water and identical grass; there is no
weather and nothing distinguishes a strong computer from a weak phone.

## Completion evidence

- **Water:** ponds and streams ripple, streams flow downhill, the surface reflects the sky at a
  glancing angle, the sun glints on it, and foam lines the banks. Rain dots it with rings.
- **Light and effects:** pieces darken softly where they meet the ground; on High, lamps and
  windows glow (bloom), the edges of the view blur like a miniature (tilt-shift) and the corners
  darken slightly (vignette).
- **Sky and weather:** a gradient sky with the sun or moon; morning mist; chimneys smoke; the
  weather changes now and then between clear, cloudy and rain (with a bilingual note: “It's
  raining. Trời đổ mưa!”).
- **Grass, ground and models:** denser, varied grass and wild flowers that sway; tiled roofs.
- **Quality and weather sheet:** a header button “Đồ họa và thời tiết” opens radio choices
  Tự động / Thấp / Vừa / Cao and Tự đổi / Nắng / Nhiều mây / Mưa (with the English word). Auto
  picks by device (software rendering → Thấp, phones → Vừa or Thấp, desktops → Cao or Vừa) and
  steps down a level if the frame rate stays under about 28 fps, saying so. Both choices are saved
  per profile.

## Scope

### May edit

- `src/lib/village/graphics.ts` (new) — water, sky, rain, smoke and post-processing builders.
- `src/lib/village/data.ts` (quality presets and auto choice, progress fields), `kit.ts` (optional
  ground shading in `bake`), `scene.ts`, `people.ts`, `src/lib/village.test.ts`
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- No new dependency: three.js add-ons already in `three` (EffectComposer, UnrealBloomPass,
  tilt-shift and vignette shaders, BufferGeometryUtils), loaded only with the village chunk.
- Reduced motion: no rain, smoke or rippling animation; weather stays clear or cloudy.
- Save format stays version 1; `quality` and `weather` are optional progress fields.
- Time spent hidden or scrolled away does not count as slow frames.

## Verification

- [x] `npm test`: 20 village tests (adds: auto level for desktop, software rendering and phones;
      stepping down; every setting grows with the level and post-processing only on High; saved
      and unknown `quality` / `weather` values). ESLint and `tsc` clean for changed files.
- [x] Browser harness, new suite: desktop 17/17, phone 17/17, reduced motion 10/10. The button
      and every choice row are at least 44px; auto reports Thấp on software rendering; arrow keys
      move between radios with a visible focus ring and the choice is saved; Medium, High (with
      post-processing) and Low all render; rain is announced in both languages and dims the light;
      night on High renders the glow; both choices survive a reload; reduced motion shows its note
      and keeps rain off; no horizontal scroll; no console errors. Screenshots reviewed: water,
      smoke, sunset, rain, night bloom, cloudy morning mist, phone sheet.
- [ ] Earlier suites (41, physics 18, Look 64, countryside 20, strip/castle/fish 27, talk/clock
      26) on the final build — running when this was committed.
- [ ] Vercel build + production deploy.

## Result

- **Files changed:** `src/lib/village/graphics.ts` (new: water shader, stream and pond surfaces,
  sky dome, rain, chimney smoke, post-processing), `data.ts` (levels, auto choice, `quality` and
  `weather` progress fields), `kit.ts` (ground shading in `bake`), `scene.ts` (wiring, weather,
  mist, quality switching and auto step-down, tiled roofs, denser grass and wild flowers),
  `VillageGame.tsx` (device check, “Đồ họa và thời tiết” sheet), `globals.css`, tests.
  `people.ts` was not needed.
- **Not checked / remaining risk:** real GPUs and phones (the harness renders in software, so
  frame rates and the auto step-down were only exercised by logic, not by a real slow device);
  `next build` is checked by Vercel.
