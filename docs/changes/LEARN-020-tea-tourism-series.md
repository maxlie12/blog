# LEARN-020 — Bài học chủ đề trà, truyền thống, du lịch; luyện nói mời trà và phiên dịch

## Identity

- **Issue:** `LEARN-020` (owner, 2026-11-26: các bài gần nhất về truyền thống, du lịch, mời trà
  khi gặp khách nước ngoài, và làm sao thay người thưởng trà phiên dịch cuộc trò chuyện hay nói
  về trà và lịch sử)
- **Status:** active
- **Owner:** Claude
- **Date:** 2026-11-26
- **Builds on:** `LEARN-019-daily-in-listening-lab.md`, `LEARN-017-speaking-room.md`

## Acceptance

- Phòng nghe daily lessons 2026-11-27 → 2026-12-01 (original, schema-valid): offering tea (easy),
  tea etiquette (medium), West Lake lotus tea (medium), interpreting at a tea tasting with "He
  says…" (medium), a short history of tea in Vietnam (hard). Facts are well-known and hedged.
- Phòng nói gains "Mời trà khách nước ngoài" (medium; cases: welcome a guest / guest finds it too
  strong) and "Phiên dịch buổi thưởng trà" (hard; cases: relay the tea master / questions about
  tea history without inventing facts). Counts in the UI and the ChatGPT coach text follow.
- `docs/DAILY-LEARNING.md`: a theme section telling the ChatGPT automation to continue the series
  from 2026-12-02 (topic order, interpreting phrases, fact rules) until 2026-12-21.
- CI quality gates also run when a PR changes `content/listening-lab/**`.

## Scope

### May edit

- new `content/listening-lab/2026-11-27.json` … `2026-12-01.json`
- `src/lib/speakingRoom.ts` (+ test), `src/lib/studyBrief.ts` (+ test, coach text),
  `src/components/listening/LabIndex.tsx` and `src/app/learning/speaking/page.tsx` (situation count)
- `docs/DAILY-LEARNING.md`, `.github/workflows/learning-quality.yml` (path filter), `docs/STATUS.md`,
  this brief

### Must not edit

- Lesson flow, scoring, Done/streak, storage.

## Release path

Branch `claude/learn-020-tea-tourism` → PR → CI → Vercel preview → merge. Rollback: revert the merge.
