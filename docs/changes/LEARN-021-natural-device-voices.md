# LEARN-021 — Giọng đọc bớt "máy": bỏ giọng vui, ưu tiên giọng Premium/Enhanced, cho chọn giọng

## Identity

- **Issue:** `LEARN-021` (owner, 2026-11-26: Anh-Anh/Anh-Mỹ đã thật sự áp dụng chưa, giọng còn máy
  quá; có cái nào nhiều giọng hơn không)
- **Status:** active
- **Owner:** Claude
- **Date:** 2026-11-26
- **Builds on:** `LEARN-019-daily-in-listening-lab.md`

## Finding (PM)

The accent switch is applied (every read-aloud uses the saved en-US/en-GB), but voice choice was
"first English voice of that accent". iPhone/Mac list many novelty voices (Albert, Bad News, Bahh,
Zarvox…) and Eloquence voices (Eddy, Flo, Grandma…) under en-US/en-GB, so the first one — or the
second speaker in a dialogue — could be one of those very robotic voices. Downloaded Premium/
Enhanced voices were only preferred when their English name matched; on a Vietnamese iPhone the
label may be "Cao cấp"/"Nâng cao".

## Acceptance

- Novelty and Eloquence voices are never used. Ranking: the learner's chosen voice → Premium/
  Natural/Neural (name, Vietnamese label or `voiceURI` ".premium.") → Enhanced/Google/Online
  (".enhanced.") → familiar standard voices (Samantha, Daniel…) → others.
- Next to "Giọng đọc", a list of the device's voices for that accent (best first, with a quality
  label), "Tự chọn giọng tốt nhất" as default, and "Nghe thử". The choice is saved per accent on the
  device and used by every read-aloud.
- When only basic voices exist for the accent, the page says so and how to download Premium/
  Enhanced voices for free (iPhone path, Edge "Natural" on computers).
- Dialogues: other speakers also use decent voices; with one good voice, pitch varies instead.

## Scope

- `src/lib/englishVoice.ts` (+ test), `src/components/listening/labShared.tsx`,
  `src/components/PronounceButton.tsx`, `src/app/globals.css` (`ll-voice`, `ll-select`),
  `docs/STATUS.md`, this brief.

## Not in this change

Natural pre-generated audio (e.g. Kokoro, open source) for every lesson: needs the owner's choice
(repo size, generation in CI). Offered as the next step.
