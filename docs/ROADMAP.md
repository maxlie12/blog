# Roadmap

Everything below is **planned, not built**, unless marked "done." See [STATUS.md](STATUS.md)
for the authoritative, currently-verified picture.

## Learning rollout — Stage 2: learner separation

### 2A — local learner profiles: done 2026-10-21

- Luân and Phi can be selected explicitly on `/learning`.
- Drafts, Guided Practice, Done/streak, backup/sync token, heatmap and Farm save are namespaced
  per profile. Legacy browser data belongs to Luân and is preserved lazily.
- Import refuses a backup from the other named profile, preventing accidental history merges.
- This is not authentication: someone on the same browser can switch profiles.

### 2B — real accounts: implementation ready, production activation pending

- Clerk is integrated behind environment flags; its provider supplies sign-in, sign-up and
  recovery instead of a hand-built password system. Production still needs the Clerk
  Marketplace connection and environment variables before the UI appears.
- The learner must explicitly claim the currently selected Luân/Phi sync profile. One account
  owns one profile and a claimed profile rejects anonymous-token access.
- New attempts carry `learnerId`, default private, and are readable only by that learner or
  Studio. The database migration is included and must run in each deployed environment.
- Studio's owner/admin cookie remains separate from the learner role.
- Do not start AI personalization until account ownership and privacy tests pass.

## Phase 2 — real content, deployed

Conditions to start: build/lint clean, flows verified (done as of 2026-09-26 — see
[STATUS.md](STATUS.md)).

- Replace placeholder profile (`src/data/profile.ts`) and the Atlas project body with real
  content, and confirm the site owner's actual name (see [STATUS.md](STATUS.md)).
- Deploy to Vercel with a networked SQLite database (Turso or equivalent) — see
  [OPERATIONS.md](OPERATIONS.md#deployment-vercel). **Higher priority now that Studio writes to
  this database** — a Vercel deploy with the wrong `DATABASE_URL` would silently lose Studio's
  posts/lessons/attempts on the next deploy.
- Wire `--article=<slug>` into `scripts/log.mjs` so log entries can point at the article that
  discusses them (schema field `articleSlug` already exists).
- Render `relatedLogAreas` on article pages (currently only stored, not displayed).

## ~~Phase 4~~ — Studio for blog + learning: done, this pass (2026-09-26)

What was planned as "give the lesson prototype a backend" grew into a full private Studio,
covering both blog publishing and learning management. See
[ARCHITECTURE.md](ARCHITECTURE.md#studio-auth) and [STATUS.md](STATUS.md) for what's real vs.
still scoped down. Not carried forward as a future phase — what's left from the original scope
is folded into the items below instead of kept as its own phase.

## Phase 3 — interview prep UI

Conditions to start: Studio's auth pattern exists (it now does — reuse `requireStudioSession()`
rather than inventing a second auth mechanism), and the owner has real interview records to
enter.

- A Studio page for `InterviewRecord`, following the same pattern as Posts/Lessons: a list +
  editor, gated the same way.
- A public, anonymization-enforced view for records marked `isPublic: true` — should refuse to
  render `companyLabel`/`questions`/`lessons` unless the owner has explicitly reviewed that
  record for identifying details. Anonymization is a manual editorial step, not code that can
  detect what needs redacting; the UI's job is to default closed and never leak a non-public
  record.

## Phase 4 (renumbered) — deepen Studio's learning tools

Conditions to start: enough real lesson/attempt history exists to know what's actually missing.

- Review scheduling (e.g. simple Leitner-style intervals) — no need for a full SRS algorithm at
  single-user scale.
- Turn journey evidence into a real relational link (pick an existing `Post` or `Lesson` rather
  than typing a free-text label) — see [DECISIONS.md](DECISIONS.md) for why this was scoped
  down initially.
- Link a `LearningLog` entry to a specific `Lesson`/`Attempt` if the owner wants that connection
  — currently deliberately separate systems (see [DECISIONS.md](DECISIONS.md)).

## Phase 5 — media, ergonomics, polish

- **Media upload (images and audio).** Cover images and journey evidence take a pasted URL
  only; Speaking-lesson recordings play back locally and are never saved (see
  [DECISIONS.md](DECISIONS.md)) — no blob storage is configured for any of these. Adding this
  needs a storage decision (Vercel Blob, S3, etc.), an upload endpoint gated the same way as
  other Studio/attempt writes, and — for recordings specifically — a new `Attempt` field (e.g.
  `audioUrl`) rather than overloading `response`.
- Calendar heatmap of practice days on the Learning page.
- Rich-text (not just Markdown-with-toolbar) editing, if plain Markdown proves limiting.
- ~~Migrate `src/middleware.ts` to `proxy.ts`.~~ Done as part of Stage 2B so Studio and Clerk
  share the single Next.js 16 request-interception entry point.

## Explicitly deferred

- Comments and public visitor-generated content remain out of scope. Real learner accounts are
  now Stage 2B because Luân and Phi need named cross-device ownership; Studio remains one-writer.
- Deeper Japanese content beyond the Starter pack — the shared language configuration and four
  Starter skills are in place; expand from observed learner attempts rather than guessing a
  full N5 curriculum upfront.
- A generic, reusable CMS — Studio is deliberately specific to this site's content types
  (Post/Lesson/Attempt/Journey), not a general-purpose admin panel; see
  [ARCHITECTURE.md](ARCHITECTURE.md#why-this-shape).
