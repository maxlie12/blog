# LANG-001 — Chinese retry cards

## Identity

- **Issue:** `LANG-001`
- **Status:** active
- **Owner:** Codex
- **Date:** 2026-10-30

## User-visible problem

Chinese practice currently checks the full model sentence, but a wrong answer only asks the
learner to look again and retry immediately. Immediate retry can become copying rather than
retrieval, and the learner does not practise the individual chunks before rebuilding the sentence.

## Completion evidence

The existing Chinese practice block gains a short active-recall deck. Each card shows a meaning
and asks for the Hanzi chunk. A missed card returns after up to two other cards. After the deck,
the learner rebuilds the full sentence and still has to create a changed sentence in the existing
required output before Done.

## Scope

### Read

- `docs/GUIDED-PRACTICE.md`
- `docs/LEVEL-LESSONS.md`
- `docs/ARCHITECTURE.md`
- `src/components/ChineseWritingPractice.tsx`
- `src/lib/chineseWriting.ts`
- `src/lib/chineseWriting.test.ts`
- the existing scheduled-review flow

### May edit

- `src/lib/chineseWriting.ts` — deterministic retry placement helper.
- `src/lib/chineseWriting.test.ts` — retry-order coverage.
- `src/components/ChineseWritingPractice.tsx` — in-session recall cards.
- `src/app/globals.css` — direct responsive and accessible card styles.
- `docs/changes/LANG-001-chinese-retry-cards.md` — scope and evidence.

### Must not edit

- Authentication, database schema, sync API or Studio.
- English/Japanese lesson behavior.
- Lesson selection, streaks, assessment, AI feedback or the existing 1/3/7/14-day review schedule.
- Daily lesson content.

## Constraints

- The card round is local component state and stores no learner answer.
- A changed sentence remains the required Done evidence; card recognition alone does not.
- The learner may skip cards and go directly to sentence recall when only five minutes are available.
- Add no dependency; preserve keyboard, touch, visible focus and reduced-motion behavior.

## Plan

1. Add and test a deterministic helper that places a missed card after up to two other cards.
2. Insert the recall deck between chunk study and full-sentence recall.
3. Run tests, lint, build and production interaction verification.

## Verification

- [x] Focused helper test
- [x] `npm run test` — 32/32 passing
- [x] `npm run lint`
- [x] `npm run build`
- [x] Keyboard/touch/reduced-motion code review
- [ ] Production Chinese lesson interaction

## Result

- **Files changed:** one leaf component, one helper and its test, direct CSS, and this brief.
- **Evidence:** a missed card is deterministically inserted after two remaining cards (or at the
  end of a shorter queue); the full suite, lint and production build pass.
- **Commit/deployment:** pending publication.
- **Not checked / remaining risk:** production interaction remains to be checked after deployment;
  card progress is intentionally session-only and resets when the page reloads.
