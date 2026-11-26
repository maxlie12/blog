# Daily learning

## Tiếng Anh mỗi ngày = một bài Phòng nghe (từ 2026-11-27)

Owner decision (LEARN-019): English daily practice is **one new Phòng nghe lesson per day**, with
the same six steps and scoring as the 18 fixed lessons (Từ vựng → Nghe → Đọc → Viết → Nói → Kết
quả). Do **not** add English lessons to `content/daily-lessons` packets any more; those packets
are for Chinese (and Japanese) only. The template is `content/listening-lab/2026-11-26.json`.

**ChatGPT, every day:**

1. Read the latest `master`. Pick the next date that has no file yet in `content/listening-lab/`
   (publishing tomorrow's lesson the evening before is fine: the app shows a lesson only from its
   date, in Asia/Ho_Chi_Minh time).
2. Create `content/listening-lab/YYYY-MM-DD.json` — one JSON object, nothing else in the file:

   | Field | Rule |
   |---|---|
   | `date` | `YYYY-MM-DD`, equal to the file name |
   | `id` | `d-YYYY-MM-DD` (same date) |
   | `level` | `easy` (≈A2), `medium` (≈B1) or `hard` (≈B2). Mostly `medium`; one `easy` and one `hard` per week |
   | `title` / `titleVi` | English title / Vietnamese title, ≤ 90 chars |
   | `minutes` | 10–20 (5–25 allowed) |
   | `intro` | 1–2 Vietnamese sentences: the situation and what to listen for |
   | `vocab` | 4–8 items `{ "w", "pos", "vi", "ex" }`; every word appears in the transcript; `ex` is a new example sentence |
   | `transcript` | 6–16 lines `{ "s": speaker, "t": text }`, each ≤ 240 chars; 2–3 named speakers; **original dialogue** |
   | `listening` | 3–5 questions answerable by ear: `{ "q", "a": [4 different options], "c": 0–3, "why" }` |
   | `reading` | 2–4 questions on meaning, phrases or inference, same shape |
   | `dictation` | exactly 2 transcript line indices (0-based), lines of 8–16 words |
   | `speaking` | 2–3 transcript line indices: useful sentences to repeat |
   | `write` | `{ "prompt": English task (2–4 sentences, linked to the situation), "model": a model answer }` |

3. Content rules:
   - Write original dialogue; never copy scripts, articles or song lyrics. Real-life situations for an adult
     Vietnamese learner: travel and transport, work meetings and email, office and accounting
     tasks, tourism and customer service, shopping, health, everyday plans and problems.
   - Correct answers must be stated in the transcript; distractors plausible but clearly wrong.
     Spread `c` across 0–3 instead of always 0. `why` is Vietnamese and quotes the line that proves it.
   - No extra fields: no answer key, no URL, no audio file (the app reads lines with the device
     voice, Anh-Mỹ or Anh-Anh as the learner chooses).
   - Do not change an already published file's `id` or `date`; fixing typos in it is fine.
4. Check: valid JSON, `id`/`date`/file name match, indices inside `transcript`, four different
   options per question. The schema is `src/lib/labDaily.ts`; `npm test` and the build reject a
   wrong file, so it never reaches the site.
5. Commit only that file to `master` with the message
   `content: publish Phòng nghe lesson for YYYY-MM-DD`. It is live after the Vercel deploy.

Do not edit code, other lessons or learner data. Without saved attempts, do not infer progress or
raise difficulty on your own; follow the level mix above.

### Chủ đề hiện tại: trà, truyền thống và du lịch (owner, 2026-11-26 → 2026-12-21)

Owner wants the coming lessons to prepare him to **offer tea to foreign tourists, talk about tea and
its history, and interpret a tea tasting** between a Vietnamese tea master and a foreign guest.
Lessons 2026-11-27 → 2026-12-01 are already written (offering tea · tea etiquette · lotus tea ·
interpreting at a tasting · a short history of tea). From **2026-12-02** continue the series,
roughly in this order, then repeat the cycle with new situations:

1. Buying tea at a market or shop with a tourist (kinds, price per 100 g, gift boxes, polite bargaining)
2. Describing taste and smell (fresh, grassy, floral, smoky, bitter, sweet aftertaste, strong/light)
3. Tea and snacks for guests (green bean cake, candied fruit, peanuts); offering and politely refusing
4. Tea at Tết and in family traditions (making tea for elders and visitors, gifts of tea)
5. A tea farm visit (picking, drying, seasons) — Thai Nguyen or the northern mountains
6. Interpreting a longer explanation: take notes, split it into short "He says…" sentences, check meaning
7. A two-minute talk for tourists: "Tea in Vietnam" (opening, three points, a question to the group)
8. Questions you cannot answer: say so honestly, offer to check, give what you do know
9. Every 7th day: a review lesson mixing phrases from the week (level `medium`)

Interpreting skills to recycle: "He says (that)…", "She'd like to know…", "Let me ask him.",
"What he means is…", "In Vietnamese we call it…, which roughly means…", asking to repeat, and
turning long Vietnamese sentences into two short English ones.

**Facts:** use only well-known, stable facts (Thai Nguyen green tea, West Lake lotus tea, old Shan
Tuyet trees in the northern mountains, street iced tea, offering tea to guests, using both hands).
Hedge numbers and history ("people often say…", "many researchers think…"); never invent years,
prices, records or legends. If unsure, make it a character's opinion or leave it out. Keep names
without diacritics in English lines (Thai Nguyen, Ha Giang) so the device voice reads them.

## Daily packets (Chinese, Japanese and older English)

`/learning/daily` provides dated language packets. The schema accepts the configured English, Chinese and Japanese language IDs. Start with one five-minute task. Since LEARN-019 the English daily lesson lives in Phòng nghe (above); packets dated 2026-11-27 or later carry Chinese/Japanese only, and older English packets stay readable under "Bài Daily dạng cũ" on /learning. The default opens the oldest packet containing an English lesson without reviewed evidence. Dates do not advance proficiency. The archive allows explicit selection.

Packets are versioned under `content/daily-lessons/YYYY-MM-DD.json`. They are validated by `src/lib/dailyLessons.ts`, merged into the existing lesson picker, and bundled for deployment. Lesson IDs must be globally unique and start with `daily-`. The first owner submission materializes its lesson in the database without overwriting Studio edits. Existing attempts are preserved. No schema migration is required for daily packets.

Use the 2026-10-12 packet as the base JSON contract: date, title, kind (`restart`, `practice`, `weekly-test`, `monthly-test`), note and lessons (id, language, skill, title, level, instructions, material, exercises, completionCriteria). A lesson may also carry an authored `takeaway` with exactly one `phrase`, one sentence `pattern` and one `reusePrompt`; this is revealed after local Done and is not generated at page load. Do not publish answer keys with questions. The app cannot receive audio: when a task asks for audio, name ChatGPT as the recipient ("gửi ChatGPT audio"), never imply the lesson page accepts it. Cite source URLs without copying copyrighted scripts. Source-backed lessons retain the same IDs across days when reusing a lesson; reference that packet instead of duplicating IDs. For new dated packets use new IDs.

The linked ChatGPT automation may add a packet through the authorized GitHub connector. It must inspect the latest master branch and use a lease for updates. Repository content is public: never commit learner answers, recordings, secrets or private feedback. Without access to saved attempts, it must not infer progress, mark completion or raise difficulty. Keep a restart task until evidence is supplied. Weekly/monthly tests remain assigned at the existing intervals, but can be split into short sessions.

After each content update, a deployment is needed: commits are not a running website. Pushing to `master` deploys to https://maxlie-blog.vercel.app, so a packet is live only after its commit is pushed and deployed. Do not announce a live URL before that.

Text submissions require owner Studio sign-in. They are stored pending; manual feedback and review are available in Studio. Attempt permalinks require authentication. Audio can be recorded, played and downloaded locally, but is not uploaded or automatically scored. Cross-device persistence requires the production database described in VERCEL-TURSO.md. No automatic CEFR assessment or AI feedback is implemented.

## Naming optional lessons

The packet schema has no optional flag. The path on `/learning` reads the title: any lesson whose title
contains "Tùy chọn" is shown as optional, and every other lesson counts as a main task. Always name
extra work this way, for example "Tùy chọn 5 phút — …". A lesson whose `material` is a `/blog/…` path
is shown in that article's stage instead of today's stage.
