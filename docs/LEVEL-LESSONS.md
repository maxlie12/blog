# Level lesson library

The Learning picker filters language, task level, skill, search text and server review status. English task levels are derived from the first CEFR-style label (e.g. B1+ practice / B2 source belongs to B1+, not B2). Chinese uses Beginner and Elementary as internal teaching groups, not certified HSK/CEFR levels. Switching language clears the selected level. Counts reflect the selected language and task level; local drafts do not affect reviewed progress.

The library adds 24 original tasks: four English skills at A2, B1, B2 and C1, and four Chinese skills in each of two beginner groups. Existing B1+ daily practice is preserved. English listening/reading links use free British Council audio and transcripts, checked 2026-10-14. Chinese audio uses accessible native recordings in HelloChinese, whose free content is limited and whose Premium is paid. No scripts or answer keys are copied.

Library tasks are typed definitions in src/lib/levelLessons.ts, merged with stored and daily lessons. A stored lesson keeps precedence. Authenticated submission materializes a missing library definition without overwriting Studio edits. Read-only preview continues using local PracticeCoach drafts; no server writes or CEFR upgrades are inferred. Selecting a higher-level task is optional exploration, not an assessment result.
