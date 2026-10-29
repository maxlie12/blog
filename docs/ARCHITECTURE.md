# Architecture

## System diagram

```
 visitor's browser                    owner's browser (authenticated)
        │                                       │
        ▼                                       ▼
┌─────────────────┐                   ┌──────────────────────┐
│  Public routes   │                   │  /studio/* (private)  │
│  /, /blog,       │◀── revalidate ────│  Overview, Posts,      │
│  /projects,      │      on write     │  Learning, Journey     │
│  /learning       │                   └──────────┬─────────────┘
└────────┬─────────┘                              │ Server Actions
         │ reads                                   ▼
         ▼                                ┌──────────────────┐
┌─────────────────────────────┐           │  SQLite (Prisma)  │
│  content/articles/*.mdx      │──merge──▶│  data/blog.db      │
│  content/projects/*.mdx      │           │  Post, Lesson,     │
│  (git-committed, hand-edited)│           │  Attempt, Journey* │
└──────────────────────────────┘           │  LearningLog,      │
                                            │  InterviewRecord   │
                                            └────────────────────┘
                     ▲
                     │ gate: /studio/** only
              ┌──────┴──────┐
              │  middleware  │  checks a signed session cookie
              │ (src/middleware.ts) │ (src/lib/auth.ts)
              └─────────────┘
```

One Next.js app, deployed as a single unit. No separate CMS, no separate API service, no
separate auth provider.

Language-specific labels, level groups and review checkpoints live in
`src/lib/languages.ts`. Lesson rendering, filters and local habit progress consume that shared
configuration, so English, Chinese and Japanese do not require separate page implementations.

## Why this shape

- **One person operates Studio, and is also the only privileged writer.** That hasn't changed
  with Studio — Studio is that same one person's authoring tool, not a multi-user CMS. It gets
  a password gate because it can now change what the public site shows, not because there are
  multiple roles to manage. See "Studio auth," below, and [DECISIONS.md](DECISIONS.md).
- **Two content storage mechanisms, chosen per access pattern**, not one — and this still holds
  after Studio:
  - **MDX files in git** (`content/`) remain supported for hand-written articles/projects:
    long-form, infrequently updated, versioned by git.
  - **SQLite via Prisma** (`data/blog.db`) now also holds **Studio-authored content** (`Post`,
    `Lesson`, `Attempt`, `JourneyCheckpoint`, `JourneyEvidence`), not just the original
    `LearningLog`. Studio needs to write at runtime from a browser session — a git commit is
    not a viable "save" operation for a web form — so anything Studio publishes lives in the
    database. The public blog reads **both** sources and merges them (`src/lib/posts.ts`); on a
    slug collision the database wins, since Studio's uniqueness check already checked against
    both.
- **SQLite specifically**: unchanged rationale from before — zero network hop, trivial to back
  up, sufficient for single-operator write volume. The ephemeral-filesystem caveat on
  serverless hosts (see "Deployment implications") applies more now, since Studio's writes are
  exactly the kind of thing that must survive a redeploy.
- **Two meanings of completion stay separate.** A local-first Done action records the
  learner's self-reported activity and powers a rolling rhythm/history. The browser writes immediately; when Neon
  is configured it also syncs only completion metadata under a hashed random profile token.
  It remains intentionally easy and never changes public skill progress or CEFR claims.
  Studio's `Attempt` model remains the reviewed evidence layer:
  attempts are recorded by the owner in the database, and only reviewed attempts affect the
  public skill-progress numbers.

## Learner profiles and permissions

- Public lessons are shared read-only content.
- Studio remains the single-owner admin surface, protected by its signed session cookie.
- Public Learning is guest-first and shows no profile chooser, learner name or account gate.
  `src/lib/learnerProfiles.ts` still namespaces legacy drafts, Done records, Guided Practice and
  Farm state internally so existing browser data is not deleted. A fresh browser uses the
  default namespace; this compatibility detail is not user identity.
- Each profile has its own random 256-bit sync token and therefore a separate server-side habit
  history. The habit API still receives no name, email, answer or audio.
- Before sign-in is activated, this remains anonymous profile isolation. A learner can move the
  same profile by importing the private backup containing its sync token.
- Stage 2B uses Clerk for learner identity, while Studio keeps its separate owner/admin cookie.
  Linking is explicit: the signed-in learner claims the currently selected token-backed Luân or
  Phi profile. The same habit rows remain the source of truth; no second progress store is
  created. After a claim, token-only access is rejected and the authenticated account is needed.
- The Clerk code path is environment-gated so the existing local-first app still builds and
  works before the production integration is provisioned.

## Studio auth

Smallest workable scheme for a single owner, not a general auth system:

- With Clerk configured, the owner signs in with Clerk; `requireStudioSession()` admits only a
  verified `STUDIO_OWNER_EMAIL` (`src/lib/studioSession.ts`). The password below is a fallback.
- `STUDIO_PASSWORD` (env var) is checked with a constant-time string comparison
  (`src/lib/auth.ts`).
- On success, an HMAC-SHA256-signed session token (Web Crypto API, so the same code runs in
  both the Edge middleware runtime and normal server code) is stored in an httpOnly, `SameSite:
  lax` cookie for 7 days.
- `src/proxy.ts` gates every `/studio/**` route except `/studio/login` (letting any Clerk user
  through to the owner check above), redirecting to
  login with a `?from=` param if the cookie is missing or invalid.
- Every Server Action under `/studio` also calls `requireStudioSession()`
  (`src/lib/studioSession.ts`) itself, independent of the middleware — defense in depth, since
  a Server Action is technically callable directly and shouldn't rely on page-level gating
  alone.
- No user table, no roles, no OAuth. There is exactly one credential because there is exactly
  one writer. See [DECISIONS.md](DECISIONS.md) for what would justify revisiting this.

## Content model

```
Article (content/articles/<slug>.mdx)                  ─┐
  frontmatter: title, date, summary, areas[], draft?,    │  merged into one
  sample?, relatedProjects[], relatedLogAreas[]           │  "public article"
                                                           │  list/detail by
Post (SQLite, authored in Studio)                         │  src/lib/posts.ts
  title, excerpt, slug (unique), category?, tags[],       │
  coverImage?, content (Markdown), status (draft|         │
  published), relatedLearning, publishedAt              ─┘

Project (content/projects/<slug>.mdx) — unchanged from before.

Lesson (SQLite, authored in Studio)
  skill (writing|listening|speaking|reading), title, level, instructions,
  material?, exercises?, completionCriteria
  └─ attempts: Attempt[]

Daily lesson packet (content/daily-lessons/YYYY-MM-DD.json)
  same public lesson fields plus takeaway? (one authored phrase, one sentence pattern
  and one transfer prompt for the post-Done summary)

Attempt (SQLite) — recorded separately from Lesson so history can be corrected
  without editing the lesson definition itself.
  lessonId, learnerId?, isPublic=false, date, response?, feedback?,
  reviewStatus (pending|reviewed|needs-revision)

JourneyCheckpoint (SQLite, authored in Studio)
  label, title, order, optional, isCurrent (hand-set only — see docs/DECISIONS.md)
  └─ evidence: JourneyEvidence[]

JourneyEvidence (SQLite)
  checkpointId, label, note? — a free-text reference to a lesson/post/recording/reflection,
  not a relational pick-list (see docs/DECISIONS.md for why this was scoped down)

LearningLog (SQLite) — unchanged: the original hand-logged practice-streak table, kept
  deliberately separate from Lesson/Attempt (see docs/DECISIONS.md).

InterviewRecord (SQLite, schema only — still no UI, see docs/ROADMAP.md)
```

**Lesson material and attempt answers are text/URLs, not binary blobs.** A Listening lesson's
`material` can be an audio URL (played back with a plain `<audio>` element if it looks like one
— see `src/components/LessonDetailView.tsx`); a Speaking attempt's `response` is always a typed
transcript, even though the submission form offers an in-browser recording for the learner's
own playback. The learner may draft that transcript with on-device Whisper
(`src/lib/transcribeWorker.ts`, transformers.js in a Web Worker): only model files are
downloaded from Hugging Face/jsDelivr; the audio and draft never leave the browser until the
learner edits and submits the text. Neither ever uploads a file — there is no blob storage configured (see
[ROADMAP.md](ROADMAP.md)), so nothing would be able to persist one. See
[DECISIONS.md](DECISIONS.md).

**Skill progress is computed, never stored.** `src/lib/lessonsData.ts#getSkillProgress`
derives each skill's `completed/total` from live `Attempt` rows (a lesson counts once it has at
least one `reviewStatus: "reviewed"` attempt) every time it's read. There is no cached progress
number anywhere that could drift from the underlying attempts.

## Data flows

- **Read (visitor):** unchanged in shape — Server Components read MDX files and query SQLite at
  request time. `/`, `/blog`, `/learning` are now `force-dynamic` (not statically generated)
  specifically so a Studio publish/attempt is visible on the next request, not just the next
  deploy.
- **Write (Studio → Post/Lesson/Journey, and Studio's own attempt review):** a Server Action
  (`src/app/studio/**/actions.ts`) re-checks the session, validates input, writes via Prisma,
  and calls `revalidatePath` on every public route that could show the change. No separate API
  layer — Server Actions are the only write path, called directly from Studio's client
  components.
- **Write (attempt submission, from the public lesson page):** a separate Server Action
  (`src/app/learning/attemptActions.ts#submitAttempt`) accepts either an authenticated Clerk
  learner or the existing Studio owner. Learner submissions store the Clerk user ID, are private
  by default and always start `pending`; only Studio can review them. Attempt lists and detail
  routes scope reads to that learner unless the Studio owner is present.
- **Write (local-first practice):** `PracticeCoach` and `GuidedPractice` save drafts and
  explicit Done records in profile-namespaced, versioned `localStorage`. Farm state uses the
  same namespace. A lesson/session ID is idempotent inside one learner profile, and a
  calendar day can extend each language streak only once using the Asia/Ho_Chi_Minh date.
  Lesson Done records also seed a deterministic review queue: the next explicit review is due
  1, 3, 7 and 14 days after the previous learner-confirmed event. Review records reuse the
  metadata store with a `review:<interval>:<lessonId>` client ID, extend habit activity, and do
  not increase the unique Done-lesson count or feed proficiency claims. With
  `NEON_DATABASE_URL`, `/api/learning/progress` hashes a browser-generated 256-bit token and
  merge-syncs only lesson ID, language, skill, minutes and timestamps. Answers and audio never
  leave the browser through this path. A validated JSON export includes the private sync token,
  allowing a second device to import it once and continue the same history. This data never
  feeds reviewed attempts or CEFR progress.
- **Write (articles/projects, learning-log CLI):** unchanged from before — file edits + git
  commit, and `npm run log`, respectively.

## Privacy model

| Data | Public by default? | Enforcement |
|---|---|---|
| `Post.status: "draft"` | No | `getPublicArticles()`/`getPublicArticleBySlug()` only ever select `status: "published"` |
| Articles marked `draft: true` (MDX) | No | Filtered in `getAllArticles()` in production, same as before |
| `Attempt` rows | No | New attempts default `isPublic: false`, carry `learnerId`, and are returned only to that learner or Studio. Public aggregate counts include only explicitly public attempts. |
| `JourneyEvidence` | Yes, always | Free-text and short by design (see content model) — don't put anything in an evidence note you wouldn't want public. |
| `LearningLog` rows | Yes, but only if `isPublic: true` | Unchanged from before |
| `InterviewRecord` rows | No (defaults `isPublic: false`) | Unchanged — no UI yet |
| Everything under `/studio` | No | `src/middleware.ts` + per-action `requireStudioSession()` |

## Deployment implications

Unchanged core issue, now higher-stakes: Vercel's filesystem is ephemeral per-deployment, and
Studio's writes (posts, lessons, attempts, journey) must survive redeploys and cold starts, not
just the learning-log CLI's writes. Before deploying to Vercel:

1. Point `DATABASE_URL` at a networked SQLite-compatible database (Turso/libSQL) — no schema
   changes needed.
2. Set `STUDIO_PASSWORD` and `STUDIO_SESSION_SECRET` as Vercel environment variables (never
   commit them — see [OPERATIONS.md](OPERATIONS.md)).

Local dev and a non-serverless host (VPS, etc.) need no changes — the local SQLite file works
as-is.

## Security

- Studio is the only write surface with any privilege, and it's gated by the session cookie
  described above at both the middleware and Server Action layers.
- Cover images and evidence links are stored as plain URL strings (no file upload/blob storage
  yet — see [ROADMAP.md](ROADMAP.md)), so there's no upload endpoint to secure.
- Post content (Markdown) is authored only by the logged-in owner through Studio — never
  accepted as arbitrary visitor input — so there's no stored-content injection surface from the
  public side.
- The Studio preview renders through the exact same `Mdx` component the public site uses
  (`src/app/studio/(dashboard)/posts/previewAction.tsx` calls the shared component server-side
  and returns the rendered React tree to the client), so preview can't silently diverge from
  what actually gets published.

## Cost / maintenance / portability

Unchanged from before, plus: Studio adds no new services (no separate auth provider, no file
storage service) — it's more code in the same app, not more infrastructure.

## Scaling

Unchanged — not a design goal for a personal site with one writer.
