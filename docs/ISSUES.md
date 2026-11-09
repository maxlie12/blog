# Active issues

Last reviewed: 2026-11-01.

This is the current work queue. It contains user-visible problems, not every possible feature.
An item moves to **Done** only with the evidence listed in that item. Activity/Done data is habit
evidence and never proves a CEFR, HSK or JLPT level.

## Priority order

| ID | Priority | Status | Problem | Next smallest outcome |
|---|---:|---|---|---|
| LEARN-014 | P1 | Verified on preview | Daily selects new before due and reviews record no recall result. | Daily adaptive slice verified; real-phone QA pending. See `docs/changes/LEARN-014-recall-loop.md` and `docs/MAX-LEARNING-CONTEXT.md`. |
| LEARN-013 | P2 | Verified locally | Conversation history is hidden and resume loses the speaking turn. | Resume saved turns and reopen completed practice; preview browser QA passed, real-phone QA pending. See `docs/changes/LEARN-013-resume-review.md`. |
| ASSESS-001 | P1 | Planned | The product has self-reported levels and milestone UI, but insufficient unseen four-skill evidence to claim progress. | Keep level unchanged; attach weekly checks and a 28-day assessment to evidence records. |
| LANG-001 | P1 | Active | English, Chinese and Japanese share an engine, but their teaching rules are not yet explicit data. | Ship one Chinese word/chunk and writing slice without splitting the shared lesson flow. |
| SPEAK-001 | P2 | Active | On-device transcription is live but only proven with one synthetic English test. | Check a real voice on a phone, then zh/ja, Safari and Firefox. See `docs/changes/SPEAK-001-browser-transcription.md`. |
| LEARN-012 | P2 | Active | The games can only be reached by address from Learning. | Add one quiet row of links. See `docs/changes/LEARN-012-game-entry.md`. |
| BLOG-005 | P2 | Active | The learner wants deeper English reading on building a small game, connected to Learning. | Publish three study articles with lessons. See `docs/changes/BLOG-005-game-study-articles.md`. |
| BLOG-006 | P2 | Active | Three 8 November articles were thin, and one was Vietnamese-only with no study words. | Rewrite all three as sourced English study articles. See `docs/changes/BLOG-006-career-ai-articles-update.md`. |
| BLOG-007 | P2 | Active | The learner wants to understand how Claude works inside and what a user should know. | Publish one sourced English study article. See `docs/changes/BLOG-007-inside-claude-article.md`. |
| BLOG-008 | P2 | Active | The owner wants a developer-grade article on how LLMs and Claude behave as a product component. | Publish one sourced English study article. See `docs/changes/BLOG-008-ai-features-developer-article.md`. |
| LEARN-011 | P1 | Active | The learner could not find the path, and it hid reviews and finished lessons. | Show it on `/learning`. See `docs/changes/LEARN-011-path-on-learning.md`. |
| LEARN-010 | P2 | Active | Backup gaps, a dead link, page language and stale docs. | Verified locally; deploy. See `docs/changes/LEARN-010-docs-backup-cleanup.md`. |
| FEEDBACK-001 | P2 | Blocked | Personal correction is manual; automatic AI feedback is not implemented or cost-controlled. | First collect real attempts and define a one-error feedback contract. |

Game and decorative progression are intentionally below these items. They may reward learning,
but they do not replace lesson quality, review or assessment.

## Issue details

### ASSESS-001 — evidence-based milestones

- **User problem:** activity is visible, but activity alone cannot establish B2, HSK or JLPT
  ability.
- **Required reading:** assessment decisions in `docs/DECISIONS.md`, lesson/attempt sections of
  `docs/ARCHITECTURE.md`, and the milestone component actually being changed.
- **Boundary:** unseen content, four separate skill results for English, and manual/reviewed
  evidence. Do not move the mountain from streak length.

### LANG-001 — language-specific teaching packs

- **User problem:** one generic lesson template cannot teach English argument structure,
  Chinese tones and Japanese kana/particles equally well.
- **Required reading:** `src/lib/languages.ts`, `docs/LEVEL-LESSONS.md`, related direct tests.
- **Boundary:** keep one shared lesson engine. Add language-specific rules/content, not separate
  page copies.
- **Target model:** English uses CEFR skill descriptors; Chinese combines practical Can-do tasks
  with optional HSK mapping; Japanese combines practical Can-do tasks with optional JLPT mapping.
- **Interaction rule:** English B1+ keeps source comprehension followed by a spoken/written
  transfer task. Beginner Chinese/Japanese may use a compact card sequence with native audio,
  active recall, immediate quiz feedback and one changed situation; recognition alone never marks
  the communicative task as mastered.

### FEEDBACK-001 — bounded feedback

- **Blocked by:** insufficient real learner submissions and no approved AI cost/privacy design.
- **First experiment:** for one submitted response, return one strength, one highest-value error
  and one retry task. Never rewrite the entire answer by default.
- **Do not build yet:** live pronunciation scoring, open-ended agents or per-page AI generation.

## Updating this file

- Add an issue only for a reproducible user problem.
- Give it one next outcome, an allowed scope and observable acceptance evidence.
- Mark **Blocked** with the missing decision, credential or data.
- Move completed items to `STATUS.md` with the commit/deployment and checks, then remove them
  from this active list. Do not leave two competing status descriptions.
