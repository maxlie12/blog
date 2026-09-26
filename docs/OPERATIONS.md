# Operations

## Environment variables

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Prisma/SQLite connection string | `file:./data/blog.db` |
| `SITE_TIMEZONE` | No (defaults `UTC`) | IANA timezone used to compute "today" for streaks/log dates | `Asia/Shanghai` |
| `SITE_URL` | No (defaults `http://localhost:3000`) | Absolute base URL used in `sitemap.ts`/`robots.ts` | `https://maxlie.dev` |
| `STUDIO_PASSWORD` | Yes, to use `/studio` | The single owner password checked on `/studio/login` | a long random string |
| `STUDIO_SESSION_SECRET` | Yes, to use `/studio` | Signs the session cookie (HMAC-SHA256) | 32+ random bytes, hex-encoded |

Copy `.env.example` to `.env` for local dev. In Vercel, set these under Project Settings →
Environment Variables.

### Studio authentication

Generate a secret once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put it in `STUDIO_SESSION_SECRET`, and pick any password for `STUDIO_PASSWORD`. Without both
set, `/studio/login` shows a config-error message instead of a broken login form — see
`src/app/studio/login/actions.ts`.

**Rotating the secret** invalidates every existing session immediately (all signed cookies stop
verifying) — use this as your "log out everywhere" lever if needed. **Changing the password**
does not invalidate existing sessions on its own; rotate the secret too if you want to force
re-authentication.

There is no password-reset flow, no multiple accounts, and no rate limiting on login attempts —
deliberately minimal for a single owner. If the password is ever compromised, rotate both env
vars and redeploy.

## Local setup

```bash
npm install
cp .env.example .env         # set STUDIO_PASSWORD, STUDIO_SESSION_SECRET, adjust SITE_TIMEZONE
npx prisma migrate dev --name init   # creates data/blog.db and applies the schema
node prisma/seed.mjs         # optional: seeds the original sample lessons + journey checkpoints
npm run dev                  # http://localhost:3000
```

Sign in at `/studio/login` with the `STUDIO_PASSWORD` you set.

## Adding content

- Articles/projects (legacy path, still supported): add/edit a `.mdx` file under `content/` —
  see [CONTENT-GUIDE.md](CONTENT-GUIDE.md).
- Blog posts, lessons, attempts, and the mountain-journey map: use `/studio` — see
  [CONTENT-GUIDE.md](CONTENT-GUIDE.md) for the editorial workflow.
- Learning log entries (the original hand-logged practice streak, separate from Studio's
  lessons): `npm run log -- --area=<area> --activity="<text>" [--minutes=N] [--note="<text>"]
  [--date=YYYY-MM-DD] [--private]`.

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

`next build` statically generates content-only pages (`/about`, `/projects`, `/studio/login`);
anything reading the database (`/`, `/blog`, `/learning`, and all of `/studio`) is
`force-dynamic` so a Studio publish is visible on the next request, not just the next deploy.

## Backups

- **Articles/projects (`content/*.mdx`):** already backed up by git — every commit is a restore
  point. Push to the GitHub remote regularly.
- **`data/blog.db`** (now includes Studio's posts, lessons, attempts, and journey data, not
  just the learning log): copy the file. A simple approach for a single-operator site:

  ```bash
  cp data/blog.db backups/blog-$(date +%Y-%m-%d).db
  ```

  Keep `backups/` out of git (large/binary) and instead sync it somewhere durable (cloud
  storage, a second machine). Back this up **more frequently now than before Studio existed** —
  it's the only copy of anything published through Studio; there is no git history for it the
  way there is for `.mdx` files.

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
3. Set `DATABASE_URL`, `SITE_TIMEZONE`, `SITE_URL`, `STUDIO_PASSWORD`, `STUDIO_SESSION_SECRET`
   in the Vercel project's environment variables. **Generate a fresh, production-only
   `STUDIO_SESSION_SECRET`** — don't reuse the local-dev one.
4. **Important:** Vercel's filesystem is ephemeral per deployment. A local `file:./data/blog.db`
   path will not persist writes across deployments or scale-to-zero cold starts — and Studio
   now writes to this database, not just the learning-log CLI. Before deploying, point
   `DATABASE_URL` at a networked SQLite-compatible database (e.g. Turso/libSQL) — see
   [ARCHITECTURE.md](ARCHITECTURE.md#deployment-implications). This requires creating a Turso
   account/database, which also needs the site owner's action.
5. `git push` to the connected branch (or `npx vercel --prod`) to deploy.
6. Verify: load the deployed URL, check `/`, `/blog`, `/projects`, `/learning` all render; sign
   in at `/studio/login`; confirm a test post publish appears on `/blog` and an unpublish
   removes it.

## Troubleshooting

- **`TypeError: Cannot read properties of undefined (reading 'findMany')`** (or similar, on
  `prisma.<model>.something`): the generated Prisma Client is stale — it was generated before
  that model existed in `prisma/schema.prisma`. Run `npx prisma generate` (this normally
  happens automatically via the `postinstall` script after `npm install`, but a long-running
  `next dev` process started before a schema/migration change won't pick up a client
  regenerated in another terminal without a restart). Fix: `npx prisma generate`, then restart
  `next dev`.
- **`/studio/login` shows "Studio auth isn't configured":** `STUDIO_PASSWORD` or
  `STUDIO_SESSION_SECRET` isn't set in the current environment. Set both (see above) and
  restart the dev server / redeploy.
- **Logged in, but immediately redirected back to login:** the session cookie didn't get set or
  didn't verify — check that `STUDIO_SESSION_SECRET` is identical between the process that
  issued the cookie and the one verifying it (e.g. after rotating the secret, old sessions are
  expected to fail).
- **Learning page shows a database setup error:** `DATABASE_URL` isn't set or migrations
  haven't run. Run `npx prisma migrate dev` locally, or `npx prisma migrate deploy` in
  production.
- **A Studio-published post/lesson doesn't show up publicly:** confirm its status is
  "published" (posts) — lessons and attempts are always visible once saved, only posts have a
  draft/published gate. If it should show and doesn't, check the server logs for a
  `revalidatePath` or Prisma error.
- **A new `.mdx` article/project doesn't show up:** check `draft` isn't `true` (production
  builds filter drafts out), and confirm the filename ends in `.mdx` inside
  `content/articles/` or `content/projects/`.
- **`npm run build` warns about the "middleware" file convention being deprecated:** known,
  low-priority — Next.js 16 prefers `proxy.ts` over `middleware.ts`, but the latter still works.
  Not fixed in this pass because the official codemod refuses to run against an uncommitted
  changeset; run `npx @next/codemod@canary middleware-to-proxy .` on a clean tree when
  convenient.
