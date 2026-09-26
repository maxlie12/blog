# blog

Personal site: portfolio, blog, and an English-learning space, with a private "Studio"
workspace for publishing. Built with Next.js (App Router) and a SQLite database (via Prisma).

**Status: MVP + editorial redesign + private Studio built and passing checks locally; not yet
deployed and still running placeholder content in About/Projects.** See
[docs/STATUS.md](docs/STATUS.md) for the full, current picture — what works, what's
placeholder, and what's next.

## Quick start

```bash
npm install
cp .env.example .env         # set STUDIO_PASSWORD + STUDIO_SESSION_SECRET, see below
npx prisma migrate dev --name init
node prisma/seed.mjs         # optional: seeds sample lessons + journey checkpoints
npm run dev
```

Open http://localhost:3000 for the public site, or http://localhost:3000/studio/login to sign
into Studio (see [docs/OPERATIONS.md](docs/OPERATIONS.md#studio-authentication) for generating
a session secret).

## Documentation

- **[docs/PRODUCT.md](docs/PRODUCT.md)** — goals, users, scope, what's deliberately excluded.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — system diagram, content model, data flows,
  Studio's auth model, decisions and tradeoffs behind the shape of the system.
- **[docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md)** — how to publish a post in Studio, write a
  legacy `.mdx` article, manage lessons/attempts, edit the journey map, and log practice.
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — environment variables, local setup, migrations,
  backup/restore, deployment, troubleshooting.
- **[docs/STATUS.md](docs/STATUS.md)** — what's actually built and verified, known gaps, next
  priority. Read this before assuming anything described elsewhere is live.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — future phases and the conditions for starting each.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decisions with material impact and why they were
  made.

## Repository layout

```
content/articles/*.mdx     Legacy hand-written blog posts (still supported, merged with Studio)
content/projects/*.mdx     Portfolio project write-ups
src/app/                   Public routes: /, /blog, /projects, /learning, /about
src/app/studio/            Private routes: login (unauthenticated) + (dashboard) route group
                            (Overview, Posts, Learning, Mountain journey — all session-gated)
src/middleware.ts          Gates /studio/** by verifying the signed session cookie
src/components/            Public UI (SiteHeader/Footer, BlogCard, MountainJourney,
                            LearningExplorer, LessonDetailView, PracticeLogSection)
src/components/studio/     Studio UI (StudioSidebar, PostEditor, LessonForm, AttemptsPanel)
src/lib/                   Content/DB access (content.ts, posts.ts, lessonsData.ts,
                            journeyData.ts, db.ts, streak.ts), auth.ts, theme.tsx
src/data/profile.ts        About-page data (currently placeholder — see STATUS.md)
prisma/schema.prisma       Post, Lesson, Attempt, JourneyCheckpoint/Evidence, LearningLog,
                            InterviewRecord (SQLite)
prisma/seed.mjs            One-time seed carrying the original sample lessons/journey into the DB
scripts/log.mjs            CLI to add a learning-log entry (`npm run log -- ...`)
```
