# Study content update — 2026-10-10

Prepared for `maxlie12/blog`:

- A SmartOSC Angular retrospective draft based on Luân's recollection. Mock questions are explicitly identified; no recruitment outcome is inferred.
- Two new restart lessons: a 5-minute reading exercise and a 5–10-minute retelling exercise. These are assistant-authored additions, not recovered copies of previous notifications.
- `scripts/import-study-update.mjs` inserts only missing records. It never updates existing posts/lessons and does not create attempts, practice logs, or progress evidence.

## Import into the configured database

After configuring `DATABASE_URL` and applying the existing migrations:

```sh
node scripts/import-study-update.mjs
```

The article appears as a draft in `/studio/posts`, editable through the existing Studio. `/studio/posts/new` is the existing new-post editor. The two lessons appear in `/learning` and `/studio/learning`. The draft must be published in Studio to appear publicly.

## Verification in this checkout

The Prisma migration engine returned an unspecified schema-engine error in this runtime, including with an absolute database URL. For content verification only, the existing migration SQL was applied to a fresh temporary SQLite database using Python. The import was run twice against that database: exactly one draft, two lessons, and zero attempts remained. This does not migrate or verify any production database.

`npm run build` passed with the verification database configured, including TypeScript checks and all existing routes. Browser interactions were not re-tested in this pass.

## Hosting and source access

The active GitHub connection is `luanWeabu`, with read access and no push access to `maxlie12/blog`. No matching blog project was returned by the connected Vercel account. The app uses Prisma with a local SQLite file; deployment with persistent writes requires a compatible durable database/runtime. No source push, production import, or deployment has been completed for this update.
