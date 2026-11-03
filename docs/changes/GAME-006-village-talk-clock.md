# GAME-006 — Làng Rêu: conversations and a running day

## Identity

- **Issue:** `GAME-006` (owner request, 2026-11-03: “Hãy có thêm hội thoại giữa con người và động vật.
  Và cho thời gian có thể chạy được chạy nhanh hơn hoặc tính thời gian thực”)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-03
- **Builds on:** `GAME-005-village-castle-fish-map.md` (shipped in the same commit; the two share files)

## User-visible problem

Villagers and animals act but never speak, and the day only changes when the slider is moved.

## Completion evidence

- **Conversations** as speech bubbles (English, Vietnamese underneath) over whoever is speaking:
  neighbours chat (greetings that fit the time of day, the market, lunch, the weather, asking
  for help…), and villagers walk up to a dog, cat, cow, chicken, sheep, horse, pig, duck, rabbit,
  goat, goose, buffalo or frog and talk to it; the animal stops, turns and answers storybook
  style (“Woof! Yes, throw the ball!”). A fisherman greets fish that swim close. 26 chats.
- The Look card shows the whole conversation of the person or animal it names, with the line
  being said marked and a listen button per line, and the sentence “The farmer is talking to the
  cow.” Conversations seen this way are listed in the word book (“Câu giao tiếp”).
- **Clock modes** with one 44px button by the time slider: still (set by hand, as before), fast
  (a village day in 6 minutes) and real time (the device's clock: dawn about 5:00, noon, sunset
  about 18:00, night from about 21:00). The time shows next to the slider while it runs; moving the
  slider returns to setting it by hand. The mode and the fast-day hour are saved per profile.
  Villagers go indoors and lights come on by themselves as the day turns.

## Scope

### May edit

- `src/lib/village/talk.ts` (new) — conversation scripts and picking; pure, tested in Node.
- `src/lib/village/data.ts` (clock mapping, progress fields, chat keys), `people.ts`, `scene.ts`,
  `vocab.ts`, `src/lib/village.test.ts`
- `src/components/village/VillageGame.tsx`, `src/app/globals.css` (`vg-` only)
- This brief, `docs/STATUS.md`

### Must not edit

- Lesson flow, Done/streak, learner accounts, Prisma, Studio, the farm.

## Constraints

- Bubbles are a DOM layer marked `aria-hidden`; the Look card carries the same lines for
  assistive technology. At most four bubbles show, nearest the camera.
- The running clock moves the light twice a second and saves at most every 15 seconds.
- Save format stays version 1; `clock` and `hour` are optional progress fields.

## Verification

- [x] `npm test`: 19 village tests (adds: every chat line bilingual, unique ids, every talking
      animal has its own chat, no “good morning” in the evening; hours map to morning, noon,
      sunset and night with dawn running back; clock label; saved clock fields and chat keys).
- [x] ESLint and `tsc` clean for changed files.
- [x] Earlier suites on the same build: 41/41, physics 18/18, Look 64/64, countryside 20/20,
      strip, castle and fish 27/27.
- [x] Browser harness, new suite 26/26 at 1280px and 390px: bubbles show English with
      Vietnamese, animals answer; the Look card lists the conversation and saves it; the fast
      clock runs, real time matches the device clock, manual hides it, the slider stops a running
      clock; the button is 44px; mode and hour saved; word book section; no horizontal scroll; no
      console errors.
- [ ] Vercel build + production deploy.

## Result

- **Not checked / remaining risk:** a real phone and the live page. Speech bubbles are not shown
  with reduced motion only in that villagers then stand still and do not start conversations.
