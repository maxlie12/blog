# blog

Personal site: portfolio, writing, and a public learning log. Built with Next.js (App
Router), MDX content files, and a SQLite database (via Prisma) for frequently-updated data.

**Status: MVP built and passing its own checks locally; not yet deployed and still running
placeholder content in every content area.** See [docs/STATUS.md](docs/STATUS.md) for the
full, current picture — what works, what's placeholder, and what's next.

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
  log practice, and link them together.
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — environment variables, local setup, migrations,
  backup/restore, deployment, troubleshooting.
- **[docs/STATUS.md](docs/STATUS.md)** — what's actually built and verified, known gaps, next
  priority. Read this before assuming anything described elsewhere is live.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — future phases and the conditions for starting each.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decisions with material impact and why they were
  made.

## Repository layout

```
content/articles/*.mdx   Blog posts (frontmatter + Markdown/MDX body)
content/projects/*.mdx   Portfolio project write-ups
src/app/                 Routes (Next.js App Router)
src/lib/                 Content loading (content.ts), DB client (db.ts), streak logic
src/data/profile.ts      About-page data (currently placeholder — see STATUS.md)
prisma/schema.prisma     LearningLog + InterviewRecord (SQLite)
scripts/log.mjs          CLI to add a learning-log entry (`npm run log -- ...`)
```
