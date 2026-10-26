# Active issues

Last reviewed: 2026-10-23.

This is the current work queue. It contains user-visible problems, not every possible feature.
An item moves to **Done** only with the evidence listed in that item. Streak/Done data is habit
evidence and never proves a CEFR, HSK or JLPT level.

## Priority order

| ID | Priority | Status | Problem | Next smallest outcome |
|---|---:|---|---|---|
| LEARN-005 | P0 | Active | Public learning asks for a named profile/account before a five-minute lesson. | Make the flow anonymous and device-local, with no profile or login gate. |
| ASSESS-001 | P1 | Planned | The product has self-reported levels and milestone UI, but insufficient unseen four-skill evidence to claim progress. | Keep level unchanged; attach weekly checks and a 28-day assessment to evidence records. |
| LANG-001 | P1 | Planned | English, Chinese and Japanese share an engine, but their teaching rules are not yet explicit data. | Define language-pack rules without splitting the page into three implementations. |
| FEEDBACK-001 | P2 | Blocked | Personal correction is manual; automatic AI feedback is not implemented or cost-controlled. | First collect real attempts and define a one-error feedback contract. |

Game and decorative progression are intentionally below these items. They may reward learning,
but they do not replace lesson quality, review or assessment.

## Issue details

### LEARN-005 — anonymous public learning

- **User problem:** the profile chooser and learner sign-in make the site feel like account
  management instead of an ESL Lab-style practice page.
- **Boundary:** remove identity/account UI from public learning only. Keep Studio auth and the
  existing local-first storage/sync implementation intact.
- **Acceptance evidence:** a fresh visitor can open `/learning`, start the suggested lesson,
  save one output and record Done without selecting a person or signing in.

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
