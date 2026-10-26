# LANG-001 — Chinese word and writing practice

## Identity

- **Issue:** `LANG-001`
- **Status:** active
- **Owner:** Codex
- **Date:** 2026-10-26

## User-visible problem

Chinese lessons currently show a whole model sentence and ask for speaking output, but they do
not help the learner identify meaningful chunks, reveal pinyin/meaning on demand, retrieve the
sentence from memory, type it for immediate feedback or optionally practise handwriting.

## Completion evidence

The current Chinese ordering lessons expose one compact practice block: tap a chunk to reveal
pinyin and meaning, hide the model, type the sentence and check it, then use the existing output
field to write a changed sentence before Done. An optional touch drawing pad supports one Han
character at a time and clearly states that it is neither saved nor automatically scored.

## Scope

### Read

- `docs/GUIDED-PRACTICE.md`
- `docs/LEVEL-LESSONS.md`
- `src/lib/dailyLessons.ts`
- `src/components/LessonDetailView.tsx`
- `src/components/PracticeCoach.tsx`
- the 25/10 and 26/10 Chinese daily lessons

### May edit

- `src/lib/dailyLessons.ts` — validate an optional Chinese practice payload.
- `src/lib/chineseWriting.ts` — small normalization and character helpers.
- `src/lib/chineseWriting.test.ts` — focused helper coverage.
- `src/components/ChineseWritingPractice.tsx` — leaf client interaction.
- `src/components/LessonDetailView.tsx` — pass optional Chinese payload.
- `src/components/PracticeCoach.tsx` — place practice before the existing required output.
- `src/app/globals.css` — direct responsive and accessible styles.
- `content/daily-lessons/2026-10-25.json` — base ordering exercise payload.
- `content/daily-lessons/2026-10-26.json` — review exercise payload.
- `docs/ISSUES.md`, `docs/changes/LANG-001-chinese-writing.md`, `docs/STATUS.md` — scope and evidence.

### Must not edit

- Authentication, database schema, sync API or Studio.
- English/Japanese lesson behavior.
- Lesson selection, streaks, assessment or AI feedback.

## Constraints

- A Chinese word is a meaningful chunk, not necessarily one Han character.
- The changed sentence remains the required Done evidence; recognition and copying alone do not.
- Handwriting is optional, local-only, unscored and not persisted.
- Add no dependency; keep interactivity in one leaf client component.
- Controls need visible labels/focus, 44px targets and a non-drawing alternative.

## Plan

1. Add the smallest optional Chinese practice content contract and one focused helper test.
2. Build chunk reveal, recall typing feedback and an optional local drawing pad.
3. Reuse the existing response/Done flow for the learner's changed sentence.
4. Run tests, lint, build and production browser verification.

## Verification

- [ ] Focused helper test
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Keyboard/touch/reduced-motion code review
- [ ] Production Chinese lesson interaction

## Result

- **Files changed:** pending.
- **Evidence:** pending.
- **Commit/deployment:** pending.
- **Not checked / remaining risk:** pending.
