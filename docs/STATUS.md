# Status

Last verified: 2026-09-26 (Studio pass).

## What's implemented and working

### Studio (new this pass)

- **Auth** — `/studio/**` is unreachable without the `STUDIO_PASSWORD`; verified live: a fresh
  browser session hitting `/studio` was redirected to `/studio/login?from=%2Fstudio`, and after
  submitting the correct password landed on `/studio` with a working session.
- **Blog publish flow, verified end-to-end in a live browser session:**
  1. Created a new post in the Studio editor (title, excerpt, Markdown content).
  2. Clicked **Preview** — rendered through the same `Mdx`/`BlogCard` components the public
     site uses (confirmed the heading `## The problem` rendered as a real `<h2>`, not raw text).
  3. Clicked **Publish** — the editor correctly picked up the new post's real database id and
     "published" status (this required a fix: a server action's `redirect()` doesn't reliably
     trigger client navigation when the action is called as a plain function rather than a
     native form submission — the editor now updates its own state/URL from the action's return
     value instead of relying on `redirect()`).
  4. Confirmed the post appeared on `/blog` and at `/blog/<slug>` (grepped the rendered HTML for
     the post's title — found on both).
  5. Clicked **Unpublish** in the Studio posts list — confirmed the post disappeared from
     `/blog` (grepped again — zero matches).
- **Lesson/attempt/progress flow, verified end-to-end in the same session:**
  1. Created a new lesson (skill: writing, title, level, instructions, completion criteria).
  2. Recorded an attempt against it with `reviewStatus: reviewed`.
  3. Confirmed the attempt appears in the lesson's history in Studio.
  4. Confirmed the skill's progress count updated from `0/2` to `1/3` (a new lesson was added
     and immediately counted as complete, since it had a reviewed attempt) — checked both in
     Studio (`/studio/learning`) and on the public `/learning` page.
- **Mountain journey editor** (`/studio/journey`) — checkpoint label/title/optional editing,
  "set as current" (verified it flips exactly one checkpoint's `isCurrent` flag via a database
  transaction), and free-text evidence add/remove. Not part of the two named vertical slices,
  built as a secondary feature — see "Known gaps," below, for what's scoped down here.
- **Validation** — required fields (title/excerpt/slug/content for posts; skill/title/level/
  instructions/completion-criteria for lessons) are enforced server-side and shown inline;
  duplicate slugs (checked against both Studio posts and legacy `.mdx` articles) are rejected
  with a specific error message.
- **Save/error/unsaved-change states** — a dirty-check compares the current form state against
  the last-saved snapshot ("Unsaved changes" indicator, screenshotted); a pending/saving
  indicator during the save request; field errors render inline rather than failing silently.

### Public site (carried over + updated)

- **Blog** (`/blog`, `/blog/[slug]`) — now merges Studio-authored posts (database, published
  only) with legacy hand-written `content/articles/*.mdx` files. Both render through the same
  components.
- **Learning** (`/learning`, `/learning/[lessonId]`) — mountain journey (now database-backed),
  four skill cards with real progress, a filterable lesson list, and a **read-only** lesson
  detail page (the old visitor-facing "Mark complete" button was removed — see
  [DECISIONS.md](DECISIONS.md) for why). Below that, the original Prisma-backed practice-log
  streak section is unchanged and kept visibly separate.
- **Portfolio/About, Projects** — unchanged from the previous pass; still placeholder content
  (see "Known gaps").
- **Theme/accent switcher, accessibility (focus states, `prefers-reduced-motion`), SEO,
  empty/error states, 404** — unchanged and still working; reused as-is by Studio.

## Checks actually performed (this pass)

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes. 20 routes, including all of `/studio/**`. |
| `npm run lint` | ✅ "No issues found" (fixed one `react-hooks/set-state-in-effect` error along the way, in the Studio preview loader, by using `useTransition` instead of a manual loading-state setState in an effect). |
| `npx prisma migrate dev` | ✅ New migration (`studio_posts_lessons_journey`) applied cleanly alongside the existing `LearningLog`/`InterviewRecord` tables. |
| Seed script (`prisma/seed.mjs`) | ✅ Carried the original 6 sample lessons and 4 journey checkpoints from the deleted `src/data/lessons.ts`/`journey.ts` prototypes into the database, so nothing was lost. |
| Live Playwright session: unauthenticated `/studio` access | ✅ Redirected to login, as expected. |
| Live Playwright session: full blog vertical slice (draft → preview → publish → visible on `/blog` → unpublish → gone from `/blog`) | ✅ All steps verified against actual rendered HTML/URLs, not just that a request returned 200. Caught and fixed one real bug in the process (see above). |
| Live Playwright session: full learning vertical slice (create lesson → record reviewed attempt → progress updates in Studio and publicly) | ✅ Verified with a before/after comparison of the skill's completed/total count. |
| Live Playwright session, mobile viewport (390×844): login, posts list, post editor | ✅ No horizontal scroll, sidebar collapses to a wrapping top bar, editor stacks to one column. Zero console/page errors across every screenshot taken this pass. |
| Test data cleanup | ✅ All Playwright-created posts/lessons were deleted from the database after verification — nothing test-only was left in `data/blog.db`. |
| Production `npm run start` | ❌ Still not run — only `next dev` has been exercised end-to-end, in this pass and the previous one. |

## Known gaps / defects

- **No image/file upload.** Cover images (posts) and evidence (journey) are pasted URLs only —
  there's no upload endpoint or blob storage configured. This is a real, documented limitation,
  not an oversight — see [ROADMAP.md](ROADMAP.md#phase-5--media-ergonomics-polish).
- **Journey evidence is free-text, not a relational link** to an actual `Post`/`Lesson` row,
  even though both exist as real records now. Deliberately scoped down this pass — see
  [DECISIONS.md](DECISIONS.md).
- **Studio auth is intentionally minimal**: one password, no rate limiting, no password reset,
  no audit log of who published what (there's only one "who"). Documented as correct-for-now in
  [ARCHITECTURE.md](ARCHITECTURE.md#studio-auth), not a gap to close casually — closing it
  means real multi-user auth, which isn't needed yet.
- **Placeholder content is still live**: About page bio (`src/data/profile.ts`, currently says
  "Luân" — an unconfirmed guess, see below) and the Atlas project (`content/projects/atlas.mdx`).
  Unchanged from the previous pass.
- **The site owner's actual name is still unconfirmed.** The first build session guessed "Max
  Lie" from the `maxlie12` GitHub handle; this session's reference image said "Luân," so
  `src/data/profile.ts` now says "Luân" — but neither has been confirmed by the owner. Whoever
  is right, this should be set once and not guessed a third time.
- **Not deployed.** Same blockers as before, now with an added stake: a Vercel deploy pointed at
  local SQLite would lose every Studio-published post/lesson/attempt on the next deploy, not
  just miss learning-log entries. See [OPERATIONS.md](OPERATIONS.md#deployment-vercel).
- **`npm run start` (production server) still not exercised**, only `next dev`.
- **`middleware.ts` triggers a Next.js 16 deprecation warning** (prefers `proxy.ts`) — cosmetic,
  build still succeeds; the official codemod refused to run against this pass's uncommitted
  changes, so it's deferred to a clean-tree moment (see [OPERATIONS.md](OPERATIONS.md)).
- **`npm audit`** — same 3 high-severity advisories as the previous pass, all in Prisma CLI's
  build-time `deepmerge-ts` dependency (not runtime-reachable). Unchanged, not re-triaged this
  pass since nothing about the dependency changed.
- **Interview prep still has no UI** (schema only) — unchanged, tracked in
  [ROADMAP.md](ROADMAP.md).

## Next priority

Two independent items, roughly equal priority:

1. **Confirm the site owner's real name and replace remaining placeholder content**
   (`src/data/profile.ts`, `content/projects/atlas.mdx`) — unchanged blocker from before, now
   also relevant to Studio's "Related learning" and journey-evidence copy referencing "Luân."
2. **Deploy, with the ephemeral-filesystem issue actually fixed first** — Studio makes this more
   urgent than it was: the site is now a real (if minimal) authoring tool, and running it only
   against a local SQLite file on one machine means Studio's value (publish from anywhere) isn't
   realized yet. See [OPERATIONS.md](OPERATIONS.md#deployment-vercel) for the exact blocking
   steps (Vercel account, Turso database) — both need the site owner's action, not more code.
