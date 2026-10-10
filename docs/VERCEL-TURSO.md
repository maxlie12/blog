# Vercel + Turso deployment

The application uses Prisma 6.19.3 with its matching libSQL adapter. Both the web app and CLI imports use the same connection factory. Existing local SQLite data remains compatible (`unixepoch-ms` timestamps); existing lessons gain `language=en` without deleting attempts. Studio can author English (`en`) and Chinese (`zh`) lessons. The lesson picker filters by language and skill, and its completion counters follow the selected language. The mountain journey remains the existing English CEFR journey, not a Chinese proficiency assessment.

## Account setup

1. Connect GitHub account `maxlie12` and allow access to `maxlie12/blog`.
2. Create a free Turso database; keep its URL and auth token in the hosting environment, never in Git or public chat. Create another database for previews so preview submissions cannot alter production.
3. Import the repository into Vercel with the Next.js preset. Use Node.js 22.
4. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `STUDIO_PASSWORD`, `STUDIO_SESSION_SECRET` (a long random secret), and `SITE_TIMEZONE=Asia/Ho_Chi_Minh`. Set `DATABASE_URL=file:../data/blog.db` for Prisma schema tooling; hosted runtime always selects Turso and refuses a local fallback.

## Migrate and import before the first build

Use a private local `.env.local` with the target database credentials. CLI scripts load `.env.local`, then `.env`, without overriding environment variables.

```sh
npm ci
npm run db:migrate
npm run content:import
npm run build
```

`db:migrate` applies repository SQL migrations in order, transactionally records their checksums, recognizes completed Prisma migrations, and refuses changes to applied migrations. It does not clear tables. Existing databases without migration history need reconciliation first. The current script supports simple DDL migrations; migrations with triggers or PRAGMA/explicit transaction handling require a reviewed migration process.

`content:import` adds the SmartOSC draft and two new restart lessons only when missing. It does not record completed practice. The article is editable and publishable in `/studio/posts`; new articles can be written at `/studio/posts/new`.

Do not run database migrations in every Vercel preview build. Apply them deliberately to the appropriate preview or production database before deploying code that needs new columns.

## Existing data on the owner's computer

The Git repository contains schema and sample content, not the owner's local database. To carry existing posts/attempts over, back up the actual database and import it into a fresh Turso database following Turso's current database-import instructions; then run the additive migration. Do not seed a replacement database and assume the old attempts were transferred.

## Verification before handing off a live URL

- Anonymous visitors can read published posts and lessons, but cannot submit owner attempts or enter Studio.
- Sign in, save/edit/publish a post, then verify it appears in the public blog after refresh.
- Submit an English attempt, refresh its permalink, and verify the saved response remains.
- Create a Chinese lesson and check both language filters and counters. A pending attempt must not count as complete; a reviewed one can.
- Redeploy and verify the same records remain in Turso.

Audio recordings remain browser-local in this version. Persistent audio/image uploads require separate object storage; the Turso change does not implement them. All lessons are currently fetched for the picker; pagination is a future step for a large catalog.

## Current execution status

Source published to `maxlie12/blog` on `master` and `content/smartosc-english-restart` (commit `e254270`), with the GitHub account `maxlie12` and push permission verified. Not deployed: Vercel returned empty team/project lists and no Turso connection/credentials are available. The article/lesson payload has not been imported into a live database. No production database has been changed.
