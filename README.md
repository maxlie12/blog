# blog

Personal site: portfolio, blog, and an English-learning space. Built with Next.js (App
Router), MDX content files, and a SQLite database (via Prisma) for frequently-updated data.

**Status: MVP + editorial redesign built and passing checks locally; not yet deployed and
still running placeholder content in every content area.** See
[docs/STATUS.md](docs/STATUS.md) for the full, current picture — what works, what's
placeholder, and what's next.

## Quick start

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000.

## Documentation

- **[docs/PRODUCT.md](docs/PRODUCT.md)** — goals, users, MVP scope, what's deliberately excluded.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — system diagram, content model, data flows,
  decisions and tradeoffs behind the shape of the system.
- **[docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md)** — how to write an article, add a project,
  add a lesson, edit the journey map, and log practice.
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — environment variables, local setup, migrations,
  backup/restore, deployment, troubleshooting.
- **[docs/STATUS.md](docs/STATUS.md)** — what's actually built and verified, known gaps, next
  priority. Read this before assuming anything described elsewhere is live.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — future phases and the conditions for starting each.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decisions with material impact and why they were
  made.

## Repository layout

```
content/articles/*.mdx     Blog posts (frontmatter + Markdown/MDX body)
content/projects/*.mdx     Portfolio project write-ups
src/app/                   Routes (Next.js App Router): /, /blog, /projects, /learning, /about
src/components/            UI: SiteHeader/Footer, BlogCard, MountainJourney, LearningExplorer,
                            LessonDetailView, DailyGoalWidget, PracticeLogSection
src/lib/                   Content loading, DB client, streak logic, theme + progress stores
src/data/profile.ts        About-page data (currently placeholder — see STATUS.md)
src/data/lessons.ts        Lesson exercise content (client-only prototype — see STATUS.md)
src/data/journey.ts        Mountain-journey checkpoints; current position is hand-set, not
                            computed — see DECISIONS.md
prisma/schema.prisma       LearningLog + InterviewRecord (SQLite)
scripts/log.mjs            CLI to add a learning-log entry (`npm run log -- ...`)
```
