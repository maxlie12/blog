# Roadmap

Everything below is **planned, not built**. See [STATUS.md](STATUS.md) for what actually
exists today.

## Phase 2 — real content, deployed

Conditions to start: MVP passes its own checks (build/lint clean, flows verified).

- Replace placeholder profile (`src/data/profile.ts`), the Atlas project body, and the sample
  article with real content.
- Deploy to Vercel with a networked SQLite database (Turso or equivalent) — see
  [OPERATIONS.md](OPERATIONS.md#deployment-vercel).
- Wire `--article=<slug>` into `scripts/log.mjs` so log entries can point at the article that
  discusses them (schema field `articleSlug` already exists).
- Render `relatedLogAreas` on article pages (currently only stored, not displayed).

## Phase 3 — interview prep UI

Conditions to start: Phase 2 deployed; owner has real interview records to enter.

- A private read path for `InterviewRecord` (owner-only — needs an auth decision at that
  point, e.g. a single shared secret via middleware, since there is exactly one writer).
- A public, anonymization-enforced view for records marked `isPublic: true` — should refuse to
  render `companyLabel`/`questions`/`lessons` unless the owner has explicitly reviewed that
  record for identifying details. Anonymization is a manual editorial step, not code that can
  detect what needs redacting; the UI's job is to default closed and never leak a
  non-public record.
- A CLI (mirroring `scripts/log.mjs`) or minimal form to add records without hand-writing SQL.

## Phase 4 — language exercises: give the prototype a backend

**Update (2026-09-26): a client-only prototype of this already exists** — `/learning` has a
working skill-card + lesson-picker + lesson-detail flow (`src/data/lessons.ts`,
`src/components/LearningExplorer.tsx`, `src/components/LessonDetailView.tsx`) with a "Mark
complete" action. It's real UI, not a mockup — but completion state lives in `localStorage`
only (see `docs/DECISIONS.md`), lesson content is a hardcoded data file, and there's no review
scheduling. This phase is about giving that prototype a backend, not building the UI from
scratch:

- A database table for lesson content and/or completion (evaluate whether lesson *content*
  should move to the DB too, or stay in `src/data/lessons.ts` like articles/projects stay in
  MDX — depends on whether the owner wants to add lessons without a deploy).
- Move completion tracking server-side so it survives clearing browser storage and syncs
  across devices.
- Review scheduling (e.g. simple Leitner-style intervals) — no need for a full SRS algorithm
  at single-user scale.
- Link exercises to articles (`relatedProjects`-style soft reference) and to `LearningLog`
  entries (an exercise session could also count as a practice day, once that relationship is
  wanted — right now they're deliberately kept separate, see `docs/DECISIONS.md`).

## Phase 5 — streak visualization & content admin ergonomics

Conditions to start: owner finds the CLI genuinely limiting (i.e. this is explicitly *not* a
default assumption that a UI is needed).

- Calendar heatmap of practice days on the Learning page.
- A minimal authenticated write UI (single-owner auth, e.g. a signed cookie from a CLI-issued
  token) for logging entries from a phone, if the CLI proves inconvenient while away from a
  dev machine.
- Markdown/MDX editor with live preview for articles, if editing raw files becomes friction
  rather than a feature.

## Explicitly deferred, no planned phase

- Multi-user accounts, comments, or any visitor-generated content — this site has one writer
  by design; adding visitor accounts would be a different product.
- Japanese content — the content model already supports any language today (an article is
  just an MDX file); this item is about deciding *when* to start writing in/about Japanese,
  not a technical blocker.
- A generic CMS admin panel — deliberately avoided; see
  [ARCHITECTURE.md](ARCHITECTURE.md#why-this-shape).
