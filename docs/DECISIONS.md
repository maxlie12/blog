# Decisions

Reverse-chronological log of decisions with material impact and their rationale. See linked
docs for full detail; this file is the "why," not the "how."

## 2026-09-25 — Prisma 6.19.3 over Prisma 7/8

**Decision:** pinned `prisma` and `@prisma/client` to `6.19.3`, not the `7.10.0`/`8.0.0-rc`
versions npm resolved by default.

**Why:** Prisma 7 removed `datasource.url` from `schema.prisma` in favor of a
`prisma.config.ts` + driver-adapter model, and the CLI that `npm install prisma` resolved to
was `8.0.0-rc.17` — a release candidate. Both add real setup complexity (adapter wiring) and
version risk for a single-operator site with no team to absorb a breaking upgrade. Prisma 6 is
stable, uses the simpler schema-only config, and is what the OPERATIONS/ARCHITECTURE docs
describe.

**Revisit when:** Prisma 6 approaches end-of-life, or a feature only in 7+ becomes necessary.

## 2026-09-25 — Dropped `better-sqlite3` dependency

**Decision:** installed then removed `better-sqlite3`.

**Why:** it was added speculatively for a Prisma driver-adapter setup that turned out to be
unnecessary — Prisma's built-in SQLite provider (in the 6.x config model actually used) needs
no separate native driver. Keeping it would have added a native-compile step (Python/build
tools) for zero benefit.

## 2026-09-25 — No admin UI / no auth in MVP

**Decision:** content is added by editing `.mdx` files and committing; learning-log entries are
added via `npm run log`. No login, no browser-based write UI.

**Why:** exactly one person writes to this site. An admin UI implies auth, which implies a
security surface (sessions, password/token storage, rate limiting) to build and maintain for
an audience of one. Editing files and running a script is already within the owner's existing
skill set. See [ARCHITECTURE.md](ARCHITECTURE.md#why-this-shape).

**Revisit when:** the CLI/file-edit workflow becomes a genuine blocker (e.g. wanting to log
practice from a phone with no dev environment) — see [ROADMAP.md](ROADMAP.md#phase-5).

## 2026-09-25 — Interview prep and language exercises: schema now, UI later

**Decision:** `InterviewRecord` is defined in `prisma/schema.prisma`; no page reads or writes
it. Language exercises have no schema yet at all.

**Why:** the task's own completion criteria rule out shipping features whose main flow can't
be completed and verified in this pass. Interview records need a privacy-sensitive UI
(anonymization, private-by-default) that deserves its own careful pass rather than being rushed
alongside the MVP. Exercises need real usage data (what does a Chinese-practice entry actually
need to capture?) before the schema is worth fixing in place — guessing now risks a wasted
migration later.

## 2026-09-25 — About page ships with placeholder profile data

**Decision:** `src/data/profile.ts` contains clearly-labelled placeholder bio/skills/experience,
not fabricated-but-plausible content.

**Why:** the task requires authentic personal content that only the site owner can provide, and
explicitly forbids presenting fabricated content as real. A single source file, an on-page
placeholder banner, and a documented edit path (see [STATUS.md](STATUS.md)) make this safe to
ship without misrepresenting anything.
