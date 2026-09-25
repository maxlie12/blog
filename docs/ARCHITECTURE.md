# Architecture

## System diagram

```
                    ┌─────────────────────────────┐
  git commit  ───▶  │   content/articles/*.mdx    │
  (owner edits      │   content/projects/*.mdx    │──▶ read at build/request
   files directly)  └─────────────────────────────┘     time via src/lib/content.ts
                                                          │
                                                          ▼
┌────────────┐   npm run log   ┌──────────────────┐   ┌─────────────────┐
│  owner's   │ ───────────────▶│  SQLite (Prisma) │──▶│  Next.js app    │──▶ visitor's
│  terminal  │                 │  data/blog.db    │   │  (App Router)   │    browser
└────────────┘                 └──────────────────┘   └─────────────────┘
                                       │
                                       ▼
                            (future) admin/exercise UI,
                            interview-record UI
```

One Next.js app, deployed as a single unit. No separate CMS, no separate API service.

## Why this shape

- **One person operates this.** The owner is the only writer. A full CMS (auth, roles,
  editorial workflow) would add operational surface area with no corresponding user need.
  Editing a file and running a CLI command is enough, and it's the same skill set the owner
  already uses to write code.
- **Two content storage mechanisms, chosen per access pattern**, not one:
  - **MDX files in git** (`content/`) for articles and projects: long-form, infrequently
    updated, benefits from version history, diffing, and being editable in any text editor —
    including from a phone via GitHub's web editor if needed.
  - **SQLite via Prisma** (`data/blog.db`) for learning-log entries (and, later, interview
    records and exercises): short, frequent, structured writes where querying ("all entries in
    the last 30 days", "distinct practice dates for the streak") matters more than diffability.
    A `.mdx` file per log entry would make git history noisy and streak computation harder.
- **SQLite specifically** (over Postgres/MySQL): zero network hop, zero separate service to
  provision, trivial to back up (copy one file), and more than sufficient for single-operator
  write volume. The tradeoff is it doesn't survive a serverless platform's ephemeral
  filesystem — see "Deployment" below and [OPERATIONS.md](OPERATIONS.md).
- **No authentication system in the MVP.** The only writer is the operator running commands
  directly against their own machine/deploy target. Building login, sessions, and
  authorization for an audience of one writer is pure risk with no offsetting benefit yet. If
  a browser-based admin UI is added later (see [ROADMAP.md](ROADMAP.md)), auth becomes
  necessary at that point, not before.

## Content model

Two content families, linked loosely by slug/area references rather than foreign keys, to
avoid a database migration every time an article mentions a project:

```
Article (content/articles/<slug>.mdx)
  ├─ frontmatter: title, date, summary, areas[], draft?, sample?
  ├─ relatedProjects: string[]   ──▶ Project.slug (soft reference)
  └─ relatedLogAreas: string[]   ──▶ LearningLog.area (soft reference, e.g. "chinese")

Project (content/projects/<slug>.mdx)
  └─ frontmatter: title, summary, date, status, tech[], repoUrl?, liveUrl?, sample?

LearningLog (SQLite table)
  ├─ date, area, activity, minutes?, note?, isPublic
  └─ articleSlug?                ──▶ Article.slug (soft reference, optional)

InterviewRecord (SQLite table, schema only — no UI yet)
  └─ roleTitle, companyLabel (anonymized), stage, date, prepMethod?, questions?, lessons?,
     improvements?, isPublic (defaults false)
```

Rationale for **soft references** (plain strings, not enforced foreign keys) instead of a
relational join across the file/DB boundary: the two stores are different systems, so there is
nothing to enforce a foreign key against at write time. A broken reference (e.g. a typo'd
project slug in an article) fails safe — the link section on the article just doesn't render —
rather than blocking a build. This is checked informally by the author, not the database.

## Data flows

- **Read (visitor):** Next.js Server Components read MDX files from disk
  (`src/lib/content.ts`) and query SQLite via Prisma (`src/lib/db.ts`) at request time. No
  client-side data fetching for MVP pages.
- **Write (articles/projects):** owner edits/adds a file under `content/`, commits, pushes;
  the next deploy picks it up. No runtime write path exists for this content type.
- **Write (learning log):** owner runs `npm run log -- --area=... --activity=...` locally
  (or against the production `DATABASE_URL` if operating remotely), which inserts one row via
  Prisma. See [OPERATIONS.md](OPERATIONS.md) for exact usage.

## Privacy model

| Data | Public by default? | Enforcement |
|---|---|---|
| Articles/projects marked `draft: true` | No | Filtered out of `getAllArticles()` in production |
| LearningLog rows | Yes, but only `activity`/`note`/`date`/`area`/`minutes` — never raw private notes | `isPublic` column; the Learning page only selects `where: { isPublic: true }` for the entry list. The streak count uses **all** dates (public+private) but never renders private entries' content. |
| InterviewRecord rows | No (defaults `isPublic: false`) | Not read by any page yet; when a UI is built, it must default-filter the same way |

## Deployment implications

The chosen host is Vercel (serverless). **Vercel's filesystem is ephemeral per-deployment**,
so `data/blog.db` cannot live inside the deployed function bundle if writes need to persist
across deploys/instances. Two supported paths, documented in [OPERATIONS.md](OPERATIONS.md):

1. Point `DATABASE_URL` at a persistent SQLite location reachable over the network (e.g. a
   Turso/libSQL database, which speaks the same SQL dialect) — no schema changes needed,
   only a Prisma datasource/driver change.
2. Run the learning-log CLI against a database that lives outside the serverless deploy (e.g.
   a small persistent VM/volume, or the Turso option above) rather than the ephemeral
   filesystem Vercel gives each deployment.

For local development and for a non-serverless deploy target (a VPS, a Raspberry Pi, etc.),
the plain local SQLite file works with no changes.

## Backup / restore

See [OPERATIONS.md](OPERATIONS.md) for exact commands. Summary: articles/projects are backed
up by git itself (every commit is a restore point); `data/blog.db` is a single file, backed up
by copying it (or, in production, by whatever backup mechanism the chosen SQLite host
provides).

## Security

- No user accounts, no auth tokens, no cookies that carry privilege — there is nothing to
  authenticate against because there are no write endpoints exposed to visitors.
- Private data (draft articles, non-public log entries, all interview records) is filtered at
  the query/file-read layer, not hidden client-side, so it is never sent to the browser.
- MDX content is authored by the site owner only (it is not accepted as visitor input), which
  rules out the stored-XSS risk that user-submitted MDX would otherwise carry.

## Cost / maintenance / portability

- **Cost:** Vercel free tier covers a low-traffic personal site; SQLite/Turso free tier
  covers single-operator write volume. Expect $0/month at MVP scale.
- **Maintenance:** one Next.js app, one dependency tree, no separate services to patch.
- **Portability:** content is plain `.mdx` files in git (portable to any static host or SSG);
  the database is a single SQLite file (portable to any SQL-compatible host). Nothing is
  locked into a proprietary CMS format.

## Scaling

Not a design goal — this is a personal site. If traffic or write volume ever became a
concern, the read path (static generation of articles/projects) already scales for free on
Vercel's CDN; only the SQLite-backed Learning page would need attention, and Turso's read
replicas would be the first lever, not a rewrite.
