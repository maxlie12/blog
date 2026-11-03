# GAME-004 — Làng Rêu: villagers, action sentences and part names

## Identity

- **Issue:** `GAME-004` (owner request, 2026-11-03: “thêm người và mở rộng thêm các từ vựng không”;
  owner chose: every house has residents **and** professions unlocked by words; vocabulary as
  action sentences, names of parts, more pieces and review)
- **Status:** phase 1 done (live page check by owner); phase 2 (about 25 new countryside pieces,
  daily spaced review) follows in its own commit
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-003-village-physics.md`

## User-visible problem

The village has animals but no people, and the only English is the name of each piece. Once a
piece is unlocked there is nothing more to learn from it.

## Completion evidence (phase 1)

- Every house has one or two residents (man, woman, grandpa, grandma, boy, girl). They walk the
  paths, fill a bucket at a well, sit or read on a bench, buy fruit at a stall, sweep, talk to
  each other, and go indoors at night.
- A new **Người** group with eight professions, each unlocked by its word like any piece:
  farmer (waters a vegetable garden, picks pumpkins), baker (sells at a stall, carries bread to
  houses), fisherman (fishes at the nearest pond or stream), shepherd (follows the sheep),
  woodcutter (chops at a woodpile, log or stump), postman (visits each mailbox), musician (plays
  by a campfire, fountain or gazebo) and child (kicks balls, plays on a swing, runs around).
- A pinned **Xem** (Look) tool. Tapping a person or animal shows a card with the name, the IPA, a
  sentence of what they are doing now (“The farmer is watering the vegetables.” / “Bác nông dân
  đang tưới rau.”) with the -ing verb marked, a listen button, and the verb's base form. The
  sentence follows them as they change activity.
- Tapping a house, tower, well, windmill, wall, bridge, tree, animal or other piece puts English
  labels on its parts in 3D (roof, chimney, door, window; horn, tail, hoof…), listed on the card
  with Vietnamese and a listen button. Locked pieces offer their lesson from the card.
- The Hand tool on a person makes them wave (“The man is waving at you.”).
- The word book lists what was found with Look: villagers (6), verbs (29) and parts (70), saved
  per learner profile in the existing progress key. Nothing here counts toward Done, the rhythm
  or a level.
- Keyboard: with Look selected, Enter steps through the people and animals near the middle of the
  view; a screen-reader live region reads each new selection once.

## Scope

### May edit

- `src/lib/village/vocab.ts` (new) — verbs, parts, residents, action sentences; pure, tested in Node.
- `src/lib/village/people.ts` (new) — villager models, jobs, movement, day and night.
- `src/lib/village/data.ts`, `kit.ts` (part marks in the painter), `props.ts` (person models,
  part anchors), `scene.ts`, `src/lib/village.test.ts`
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`, and the Vercel line of `SITE-001-play-replaces-projects.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- Save format stays version 1: professions are ordinary saved pieces; residents are derived from
  houses and never saved; `seen` is an optional progress field with only known keys kept.
- Residents and their jobs come from what is built nearby; nothing is scripted per village.
- No new dependency. Label positions are computed in the scene and drawn as a DOM layer
  (`aria-hidden`; the card carries the same words for assistive technology).
- Reduced motion: villagers stand still (day) or are indoors (night); Look still works.

## Verification

- [x] `npm test`: 14 village tests pass, including: every verb, part and resident has IPA and
      Vietnamese; every action sentence starts with its own -ing verb and its Vietnamese with
      “đang”; `describe` fills a chase target; the people group has eight placeable words with
      Vietnamese names; only known `seen` keys survive a reload. `habitSyncServer.test.ts` still
      fails only because `@neondatabase/serverless` is not installed in this workspace.
- [x] ESLint and `tsc` clean for every changed file.
- [x] Browser, StrictMode harness, Playwright at 1280px, 390px (touch) and with reduced motion:
      new suite 64/64 — Look pinned; residents named by keyboard; sentences read “The X is …ing”
      with one highlighted verb; person part labels drawn without overlapping; close button
      44px; closing removes the labels; tapping finds a house with roof and door labels and
      several other kinds of pieces; a farmer is unlocked, placed, saved and named with
      “Bác nông dân …”; the word book counts villagers, verbs and parts; seen words are saved;
      no horizontal scroll; no console errors. Physics suite 18/18. The GAME-002 suite passes
      after updating its counts (62 words, four pinned tools).
- [ ] Not checked here: `next build` (the workspace cannot install Clerk), a real phone, and the
      live page. Vercel's build is the check.

## Result

- **Files changed:** see Scope.
- **Not checked / remaining risk:** each villager is one draw call; a village with very many
  houses on a slow phone may drop frames (the existing low-fps fallback still turns shadows off).
  Villagers use simple steering and give up on a target they cannot reach after a while.
