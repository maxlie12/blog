# LEARN-011 — show the path on the Learning page

## Identity

- **Issue:** `LEARN-011`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-11-01

## User-visible problem

The learner could not find the path: it lived on a separate page behind a small link, and it did
not show reviews or lessons already finished, so progress after a lesson was hard to follow.

## Completion evidence

- `/learning` shows the path directly under the next-session card, with no extra click.
- The path covers now and after: today's lessons, reviews that are due, blog stages and a list of
  finished lessons that can be reopened. When the main task is Done, a note says what to do next.
- This revises LEARN-004 at the learner's request: the next-session card keeps the primary action
  and stays first, and the path is the route below it. The mixed catalog stays removed.
- `/learning/path` redirects to the path section, so old links keep working.
- Done, reviews and marks keep their meanings. The path only reads Done and due reviews.

## Scope

### May edit

- `src/lib/learningPathData.ts` (new) — server data for the path.
- `src/components/LearningPath.tsx`, `src/components/StartLearning.tsx`.
- `src/app/learning/page.tsx`, `src/app/learning/path/page.tsx`, `src/app/globals.css`.
- `docs/ARCHITECTURE.md`, `docs/CONTENT-GUIDE.md`, `docs/DAILY-LEARNING.md`, `docs/PRODUCT.md`,
  `docs/ISSUES.md`, this brief.

### Must not edit

- Done/streak logic, review schedule, lesson packets, Prisma, Studio.

## Verification

- [x] `npm run lint`, `npm run build`, `npm test` (44/44)
- [x] Browser: path visible on `/learning` at 1280px and 390px; due review and finished list after
      real or seeded completions; redirect; 44px; no horizontal scroll

## Result

- **Evidence (2026-11-01, local `next start`, Playwright):** on `/learning` the path starts at 547px
  at 1280px wide and 822px at 390px, under the unchanged primary action. With an older lesson seeded
  as Done, the path showed today, one due review and "Bài đã xong · 1". A real Done on the main task
  added the "Xong nhiệm vụ chính" note, moved next to the review and raised the list to 2 links
  (not clicked). `/learning/path` redirects to `/learning#learning-path`. No horizontal scroll, no
  node past the edge, no control under 44px, no page errors.
- **Not checked / remaining risk:** on a 390px phone the path starts at the bottom of the first
  screen, so a short scroll is needed. The page no longer auto-scrolls to the next step, because
  that would hide the next-session card. After the main task, the card can suggest a different next
  step from the path: it prefers an unfinished lesson, the path prefers a due review. The finished
  list covers daily-packet lessons only. The 1.75rem heading size was checked by build, not by a
  new screenshot.
