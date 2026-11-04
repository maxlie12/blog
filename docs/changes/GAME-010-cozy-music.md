# GAME-010 — Cozy background music for Làng Rêu and the farm

## Identity

- **Issue:** `GAME-010` (owner request, 2026-11-04: “Thêm 1 tí nhạc Cozy vào cho phần này được
  không”; owner chose music in both Làng Rêu and the farm)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-04
- **Builds on:** `GAME-009-village-joins.md`

## User-visible problem

Both games are silent. The owner wants a little cozy music while building and farming.

## Completion evidence

- Soft lofi-style music made in the browser (Web Audio): electric-piano chords, a round bass, a
  kalimba (village) or plucked (farm) melody that changes a little every time round, brushed drums,
  tape hiss and birdsong. No audio file is downloaded.
- Làng Rêu: a music button in the header (pressed state, 44px) and a volume slider in the
  graphics sheet. At night the music gets calmer (no drums, darker tone, crickets).
- Farm: a music button with the side buttons and a volume slider next to the graphics menu.
- One setting for both games (on/off and volume), stored in this browser. On by default; it starts
  after the first tap or key press (browsers block sound before that), fades in, pauses when the
  tab is hidden or the game is scrolled out of view, and stops when leaving the page.

## Scope

### May edit

- New `src/lib/cozyMusic.ts` (sound engine, no React), `src/lib/useCozyMusic.ts` (hook) and
  `src/lib/cozyMusic.test.ts`
- `src/components/village/VillageGame.tsx`, `src/components/farm/FarmGame.tsx`,
  `src/app/globals.css` (`vg-` and `fg-` only)
- `docs/LEARNING-FARM.md` (one line), this brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, game rules and saves.

## Constraints

- No dependency, no audio files. Games never count toward Done/streak/CEFR.
- WCAG 1.4.2: any sound that plays by itself has a visible control to stop it.

## Verification

- [x] ESLint and `tsc` clean for changed files; `npm test` (new `cozyMusic.test.ts`: settings
      fallback and clamping; melody stays in the bar and lands on chord notes on strong beats).
- [x] Offline render (Chromium `OfflineAudioContext`, 24 s each): never silent for more than
      0.25 s, no NaN; at 60% volume peaks 0.2–0.26, at 100% peaks 0.52–0.63 (no clipping) before
      the louder volume curve (×1.4) that shipped.
- [x] Browser harness, desktop and phone, 38/40: the village button (46/44px) and the farm button
      start pressed; a tap starts the sound; the button and Enter turn it off and on; off is saved
      and survives a reload, and then a tap does not start it; the volume slider (44px) moves
      with the arrow keys and saves; the farm starts its music with the entry button and suspends
      it when scrolled away; no console errors. The two failures: the test browser let the village
      start before any tap; on a fresh page load real browsers block sound until the first tap, and
      the code then waits for it.
- [x] Vercel build + production deploy (`0a138ca`).

## Result

- **Files changed:** new `src/lib/cozyMusic.ts`, `src/lib/useCozyMusic.ts`,
  `src/lib/cozyMusic.test.ts`; `VillageGame.tsx`, `FarmGame.tsx`, `globals.css`,
  `docs/LEARNING-FARM.md`.
- **Not checked / remaining risk:** how it sounds on real speakers (checked by numbers, not by
  ear); iPhone plays Web Audio only with the ringer switch on.
