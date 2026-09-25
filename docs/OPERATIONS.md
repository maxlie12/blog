# Operations

## Environment variables

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Prisma/SQLite connection string | `file:./data/blog.db` |
| `SITE_TIMEZONE` | No (defaults `UTC`) | IANA timezone used to compute "today" for streaks/log dates | `Asia/Shanghai` |
| `SITE_URL` | No (defaults `http://localhost:3000`) | Absolute base URL used in `sitemap.ts`/`robots.ts` | `https://maxlie.dev` |

Copy `.env.example` to `.env` for local dev. In Vercel, set these under Project Settings →
Environment Variables.

## Local setup

```bash
npm install
cp .env.example .env         # adjust SITE_TIMEZONE if not UTC
npx prisma migrate dev --name init   # creates data/blog.db and applies the schema
npm run dev                  # http://localhost:3000
```

## Adding content

- Articles/projects: add/edit a `.mdx` file under `content/` — see
  [CONTENT-GUIDE.md](CONTENT-GUIDE.md).
- Learning log entries: `npm run log -- --area=<area> --activity="<text>" [--minutes=N]
  [--note="<text>"] [--date=YYYY-MM-DD] [--private]`.

## Database migrations

Schema lives in `prisma/schema.prisma`. After changing it:

```bash
npx prisma migrate dev --name <short-description>
```

This updates `data/blog.db` locally and records the migration under `prisma/migrations/`
(committed to git — migrations themselves are portable SQL, unlike the database file).

## Production build

```bash
npm run build
npm run start
```

`next build` statically generates all article/project pages at build time
(`generateStaticParams`); the Learning page is rendered per-request (`force-dynamic`) since it
reads live data.

## Backups

- **Articles/projects:** already backed up by git — every commit is a restore point. Push to
  the GitHub remote regularly.
- **`data/blog.db`:** copy the file. A simple approach for a single-operator site:

  ```bash
  cp data/blog.db backups/blog-$(date +%Y-%m-%d).db
  ```

  Keep `backups/` out of git (large/binary) and instead sync it somewhere durable (cloud
  storage, a second machine) on whatever cadence matches how often you log entries.

## Restore

```bash
cp backups/blog-<date>.db data/blog.db
```

If the schema has changed since that backup, run `npx prisma migrate deploy` afterward to
bring it up to date.

## Deployment (Vercel)

**Status: not yet deployed — blocked on account access.** To deploy:

1. `npx vercel login` (needs the site owner's Vercel account — not something this assistant
   can create or authenticate on your behalf).
2. `npx vercel link` to connect this repo to a Vercel project.
3. Set `DATABASE_URL`, `SITE_TIMEZONE`, `SITE_URL` in the Vercel project's environment
   variables.
4. **Important:** Vercel's filesystem is ephemeral per deployment. A local `file:./data/blog.db`
   path will not persist writes across deployments or scale-to-zero cold starts. Before
   deploying, point `DATABASE_URL` at a networked SQLite-compatible database (e.g. Turso/
   libSQL) — see [ARCHITECTURE.md](ARCHITECTURE.md#deployment-implications). This requires
   creating a Turso account/database, which also needs the site owner's action.
5. `git push` to the connected branch (or `npx vercel --prod`) to deploy.
6. Verify: load the deployed URL, check `/`, `/projects`, `/writing`, `/learning` all render,
   and confirm `/learning` reads from the networked database rather than erroring.

## Troubleshooting

- **Learning page shows a database setup error:** `DATABASE_URL` isn't set or migrations
  haven't run. Run `npx prisma migrate dev` locally, or `npx prisma migrate deploy` in
  production.
- **`npm run build` fails on `better-sqlite3`:** this package is an optional dependency used
  only if you switch to the driver-adapter Prisma API; Prisma's default SQLite provider
  doesn't require it. If it fails to compile in a given environment (it needs a native
  toolchain), it's safe to remove: `npm uninstall better-sqlite3`.
- **A new article/project doesn't show up:** check `draft` isn't `true` (production builds
  filter drafts out), and confirm the filename ends in `.mdx` inside `content/articles/` or
  `content/projects/`.
