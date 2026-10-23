# Status

Last verified: 2026-10-23 (one purposeful Learning entry point verified in production).

## 2026-10-23 — one purposeful Learning entry point

- Removed the competing “Choose a lesson” catalog, skill cards, filters and duplicate level
  explanation from `/learning`. The page now asks the learner to make one decision: start the
  lesson selected for the active profile.
- The deterministic selection rule is unchanged: resume an unfinished draft, then serve a due
  1–3–7–14 review, then choose the next unfinished lesson for the profile. Deliberate browsing is
  still available through the secondary “Mở lịch sử bài học” link.
- Checks: 26 Node tests, ESLint and `tsc --noEmit` passed. Vercel's GitHub check succeeded for
  implementation commit `9fbf04f`. Production contained no catalog text or controls, and the
  primary action opened a real lesson with a goal, source, required output, response field and
  Done flow. There was no horizontal overflow at the verified desktop viewport.
- The only production console warning is the existing Clerk development-key warning. A local
  `next build` still stops on the workspace's invalid SQLite persistence fixture; Vercel built
  the same commit successfully. A real 375px viewport was unavailable. Dormant catalog code was
  left unmounted rather than deleted outside this issue's scope.

## 2026-10-23 — predictable lesson route and reusable takeaway

- Daily lesson pages now show one four-step route: goal, source, learner output, then Done and
  takeaway. The existing method choices and optional repair stay inside that route rather than
  becoming another mandatory checklist.
- Dated packets can author exactly one reusable phrase, one sentence pattern and one transfer
  prompt. The current weekly mini-test includes them for all four English skills and the Chinese
  speaking task. No AI call runs when the page opens.
- The takeaway appears only after the existing local-first Done action. It remains visible after
  refresh, works for anonymous and signed-in flows, and is explicitly separated from CEFR/HSK
  assessment.
- Checks: 26 Node tests, ESLint, TypeScript and JSON parsing passed. Vercel's GitHub check
  succeeded for commit `4abfc7b`; production displayed all four route steps, revealed exactly
  the phrase/pattern/transfer prompt after Done and preserved the card after refresh. There were
  no app-origin console errors or horizontal overflow at the verified desktop viewport.
- A local `next build` stopped on the workspace's existing invalid SQLite persistence fixture;
  the Vercel production build succeeded. A real 375px emulation was unavailable, so the two-column
  phone route received responsive code review rather than screenshot verification.

## 2026-10-22 — explicit 1–3–7–14 spaced review queue

- A Done lesson now seeds four deterministic retrieval dates. Each next interval is measured
  from the learner's last explicit review, so returning late does not stack several reviews on
  the same day.
- `/learning` resumes an unfinished draft first, then prioritizes the oldest due review before
  new content. The lesson page records a review only through the learner's “Đã ôn lại” action
  and shows the next date.
- Review metadata extends the real study streak, but is excluded from the Done-lesson count and
  never changes CEFR, HSK or JLPT claims.
- Checks: 26 Node tests, ESLint and `tsc --noEmit` passed. Fixed tests cover every interval,
  two lessons completed on the same day, and the Asia/Ho_Chi_Minh midnight boundary. Vercel's
  GitHub check succeeded for commit `0520649`; production `/learning` and the selected lesson
  loaded, the primary action measured 44.95px, and app-origin console errors were zero.
- A local `next build` could not bootstrap the workspace's missing/invalid SQLite fixture;
  the production Vercel build is the authoritative successful build for this release. The due
  review UI was not forced with fabricated production history; its due and persistence branches
  are covered by the fixed scheduler/storage tests.

## 2026-10-22 — one-tap start chooses the next suitable lesson

- `/learning` now presents one primary “Bắt đầu học” action directly after the learner profile.
  It resumes an unfinished profile-local draft first, otherwise opens the next unfinished lesson;
  when all lessons are Done it offers a deterministic review.
- Selection is local and explicit: Luân prioritizes English B1/B1+ before B2 and secondary
  languages; Phi prioritizes Japanese Starter. It does not call AI, use public review counts or
  raise a learner's level.
- Checks: 19 Node tests, ESLint and the Next.js 16 production build passed. Production displayed
  the recommendation and opened `daily-2026-10-10-en-listening` from the primary link. The link
  measured 44.95px high; the only console errors came from the cloud-browser extension, not the app.
- Commit `09a1e92` is visible at `https://maxlie-blog.vercel.app/learning`. A 375px browser
  emulation was unavailable; the mobile layout received a responsive code review.

## 2026-10-22 — focused learning methods and a shorter Done path

- Added one shared method catalogue filtered by skill: recall, shadowing, retelling, changing
  the situation and a short Learning Note. Anonymous and signed-in lesson forms use the same
  definitions instead of duplicating prompt text.
- Anonymous practice now needs one saved real output before Done. Self-check, one-point repair
  and ChatGPT export remain available but are optional disclosures, not gates.
- Signed-in learners see the same method choices. After a private attempt is submitted, they can
  separately record local-first Done/streak; pending review and habit completion remain distinct.
- Added `docs/WORK-ROUTER.md`, `docs/ISSUES.md` and `docs/CHANGE-BRIEF.md` so future agents start
  from a named issue and narrow file scope instead of reading the whole repository.
- Checks: 14 focused Node tests, ESLint and the Next.js 16 production build passed. Vercel
  reported a successful deployment for commit `57321db`. A local `next start` browser check was
  blocked by the managed runtime's `uv_interface_addresses` system error, and the connected web
  fetcher could not open the public route; direct production interaction QA is still pending.

## 2026-10-21 — Stage 2B account ownership and private attempts

- Added environment-gated Clerk learner sign-in/sign-up without changing Studio authorization.
- A signed-in learner can explicitly claim the selected Luân/Phi sync profile. Claims are
  one-account-to-one-profile; a claimed token no longer syncs anonymously.
- Added `Attempt.learnerId` and private-by-default attempt visibility. Learners see only their
  own history; Studio retains review access. Public aggregate counts exclude private attempts.
- Migrated Next.js interception from deprecated `middleware.ts` to `proxy.ts`.
- Verified locally: 12 tests, ESLint and production build pass. Production auth cannot be
  verified until Clerk is connected to the Vercel project and the migration runs there.

## 2026-10-21 — Stage 2A separates Luân and Phi on one browser

- `/learning` now starts with an explicit Luân/Phi switcher. Each local profile has independent
  lesson drafts, Guided Practice, Done/streak, 28-day activity, sync token and Farm state.
- Old unscoped browser data is copied to Luân on first access. New backups record their learner
  profile and cannot be imported into the other profile by mistake.
- The UI states the security boundary: this is data separation, not login. Anyone using the same
  browser can switch profiles. Real sign-in, recovery and per-user reviewed attempts are Stage 2B.
- Checks: 10 focused Node tests, ESLint and the Next.js 16 production build passed. Local
  browser preview could not start because the managed preview wrapper passes an unsupported
  `--host` option to Next.js; production browser verification is still required after deploy.

## 2026-10-21 — English, Chinese and Japanese share one lesson engine

- `src/lib/languages.ts` is now the source of truth for language labels, level groups, ordering
  and seven-day review prompts. Filters, Studio validation, dated-packet validation, lesson
  order and the Done/streak dashboard consume the same configuration.
- Japanese is available in the lesson filter and Studio. A four-skill Starter/A1 set links to
  Japan Foundation Irodori native audio and uses original Can-do micro-tasks; it does not copy
  source transcripts or present Starter/A1 as a JLPT result.
- Anonymous learner progress remains separated by each browser's private random sync token.
  Studio is still the only admin account. Named/email learner accounts and per-user reviewed
  Attempts are not built in this phase.
- Checks: 7 focused Node tests passed, ESLint passed, Next.js 16 production build and TypeScript
  passed. A local production server returned HTTP 200 for `/learning` and the Japanese Starter
  lesson; SSR output contained the Japanese filter, Starter lessons and dynamic streak row.
  Visual Playwright QA was not run because the browser executable is not installed.

## 2026-10-16 (evening) — Meshy models generated; lint verified

Chicken, duck, sheep, cow and truck were generated with `npm run models:meshy` (about 3k triangles and one 512 px WebP texture each; 76–110 KB per file, ~440 KB total, downloaded only after entering the farm) and are listed in `public/models/manifest.json`; the cow and truck needed `rotationY` corrections. With network access enabled, `npm ci` and `npm run lint` ran clean. `next build` compiled successfully, but its type-check step could not complete here because Prisma engines (binaries.prisma.sh) and Google Fonts were unreachable, so the generated Prisma client was missing; the reported errors are all in existing database code, none in the game.

## 2026-10-16 (later) — ranch, workshops, truck, graphics presets, Meshy hook

The farm game gained a ranch (chickens, ducks, sheep, cows, trough and feed mill), four workshops, a truck that sells in town for +20%, a 2D battery-saver board, and graphics presets with automatic downgrade. Scene geometry is now baked into vertex-coloured meshes: measured 344–376 draw calls per frame before, 53–61 on the high preset (with shadows) and 27–29 on low. Optional Meshy models are generated by `npm run models:meshy` on the owner's machine and loaded from `public/models/manifest.json` when present; none are committed yet. Checked in the same local harness: type check, desktop and phone play-throughs of the ranch chain (feed, collect, mill, workshop, truck payout after time away), GLB loading with a test model, the no-WebGL fallback, and the Meshy script against a mock API. Not checked: real iPhone/Inspiron frame rates, real Meshy output, `npm run lint`/`next build` (npm registry unreachable). See [LEARNING-FARM.md](LEARNING-FARM.md).

## 2026-10-16 — Learning Farm game

`/learning/world` now contains a playable farm + fishpond game (fields, crop care, pond, market, barn, levels, daily and study gifts) that replaces the earlier decorative zone scene. State is per-browser localStorage only; no schema or deployment change. Checked in a local harness (React 19 + three r180 bundled with Bun, Chromium with SwiftShader): type check with `noUnusedLocals`, desktop and phone-size play-throughs (sow, offline growth, harvest, sell, gifts, fry, a simulated day away, netting fish, litter, 2D board) and the no-WebGL fallback, with no console errors. `npm run lint` and `next build` were not run in that environment because the npm registry was unreachable. See [LEARNING-FARM.md](LEARNING-FARM.md).

## 2026-10-10 — source published; hosting pending

Published to `master` and `content/smartosc-english-restart` in commit `e254270`. Source is updated; the application is not deployed and the content payload has not been imported into a live database:

- Shared Prisma/libSQL connection for local SQLite and hosted Turso; Vercel refuses to fall back to a local database. Timestamp format preserves existing Prisma numeric dates.
- Additive language column (`en` default, `zh` supported), Studio language selector, lesson-picker language filter, and counters based on the selected language. The existing mountain remains an English CEFR journey.
- Aggregate attempt counts for the picker rather than transferring each attempt status; still no catalog pagination.
- SmartOSC draft and two new restart lessons, imported only if missing. No practice is marked completed by import.
- Transactional/checksummed migration script recognizing existing Prisma migration history, deployment configuration and [deployment guide](VERCEL-TURSO.md).

Checks performed: production build/TypeScript passed; migration re-run skipped applied migrations; an existing Prisma-history fixture preserved an old lesson/attempt and timestamp; Unicode Chinese answer persisted; pending/reviewed counts stayed independent across languages. Production HTTP checks returned 200 for public pages and signed owner-session Studio pages, with anonymous Studio access redirected to login. These owner-session checks used a generated valid test cookie; they did not exercise the login form or submit/publish buttons. No browser QA was possible because the installed Playwright browser executable is absent. No live Turso or deployed persistence check has run.

GitHub connection verified as `maxlie12` with push permission; the remote master ref and source tree were verified after publishing. Remaining blockers: Vercel returned empty team/project lists; no Turso connection/credentials are available. Owner-local database content is not in Git and has not been transferred. See the guide for preview/production database separation and import steps.

The sections below record the previous September implementation checks, not a new hosted verification.

## What's implemented and working

### Lesson attempt submission (new this pass)

- **Public lesson page is now interactive for signed-in sessions.** `/learning/[lessonId]`
  shows instructions/material/exercise (unchanged) plus, only when the visitor has a valid
  Studio session, a real answer form and **Submit attempt** button. Signed-out visitors see the
  same page with a "Sign in to submit an attempt" link instead — verified live: an anonymous
  Playwright session saw zero submit forms and one sign-in prompt; after logging in, the same
  URL showed a working form.
- **Skill-appropriate input:**
  - Writing/Reading: a required textarea.
  - Listening: if the lesson's `material` field is a direct audio URL, it renders as a real
    `<audio controls>` player above the answer textarea (none of the seeded sample lessons
    currently have one set — this is real code, exercised with placeholder URLs during testing,
    not yet with production audio).
  - Speaking: an in-browser record/playback control (`MediaRecorder`), clearly labelled as
    **not** uploaded or saved, plus a required transcript textarea — the transcript is the
    actual submitted answer. Verified: the recorder correctly reports "unsupported" and falls
    back to the transcript-only view when mic access isn't available.
- **Validation, verified live:** clicking Submit with an empty answer is blocked by native
  `required`/`minLength` validation; the server action independently re-validates (min 3
  characters) and returns an inline error if bypassed.
- **Persistence, verified live, not just asserted:** submitted an attempt → reloaded the
  dedicated attempt-detail page (`/learning/[lessonId]/attempts/[attemptId]`) → the answer was
  still there after a hard refresh. This is a real database row (`Attempt`, via Prisma/SQLite),
  not `localStorage` — it would show up identically from any signed-in browser/device pointed
  at the same database.
- **Retry, verified live:** submitted a second attempt against the same lesson; both appeared,
  unmodified, in the lesson's "Attempt history" list, each linking to its own permalink.
- **Explicit completion rule, verified live with a before/after check:** two pending attempts
  left the lesson's skill progress at `0/2` (unchanged). Only after the owner reviewed one
  attempt in Studio (`/studio/learning/lessons/[id]` → Correct → status: reviewed) did the
  progress become `1/2` — confirmed on both `/studio/learning` and the public `/learning` page.
  Submitting, by itself, never changed a progress number.
- **Save-failure handling:** a failed/rejected submission (e.g. validation error) leaves the
  typed answer in the textarea — it isn't cleared, since the form only resets after the server
  action reports a real success (a success view replaces the form; "Submit another attempt"
  mounts a fresh, empty one).

### Everything from the previous two passes (unchanged, re-verified via full `build`+`lint`)

- Studio (`/studio/**`, password-gated): blog post publish flow (draft/preview/publish/
  unpublish/delete), lesson definitions, journey checkpoints/evidence.
- Public site: `/`, `/blog`, `/blog/[slug]`, `/projects`, `/projects/[slug]`, `/about`,
  `/learning` (journey map, skill cards, lesson picker), theme/accent switcher, SEO,
  accessibility (focus states, `prefers-reduced-motion`), empty/error states, 404.

## Checks actually performed (this pass)

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes. 21 routes, including the new attempt-detail route. |
| `npm run lint` | ✅ "No issues found." |
| Live Playwright session: anonymous visitor sees no submit form, sees a sign-in prompt | ✅ |
| Live Playwright session: signed-in visitor sees the form; empty submit blocked | ✅ |
| Live Playwright session: submit → success view → attempt-detail permalink → **hard reload** → answer still present | ✅ |
| Live Playwright session: second submission (retry) → both attempts present in history, in order | ✅ |
| Live Playwright session: two pending attempts leave skill progress unchanged (`0/2`); reviewing one in Studio changes it to `1/2` on both Studio and the public page | ✅ |
| Zero console/page errors across the full flow (checked on every step, not just page load) | ✅ |
| Test attempts cleaned up from the database after verification | ✅ |
| Production `npm run start` | ❌ Still not run — only `next dev` has been exercised end-to-end across all three passes so far. |

## What's real data vs. still sample/placeholder (as requested)

**Real, persisted, verified:**
- Every `Attempt` created through the public submission form or Studio — stored in
  `data/blog.db`, survives refresh, would survive a device change against a shared database.
- Skill progress numbers — computed live from real `Attempt.reviewStatus` values, not cached or
  guessed.
- Lesson definitions — real database rows (seeded originally from the old prototype, editable
  in Studio since the last pass).
- Blog posts published through Studio.

**Sample / placeholder, clearly labelled or documented as such:**
- The 6 seeded lessons' *content* (instructions/material/exercises) is the original sample
  copy from the very first prototype pass — real rows, sample text. Editable in Studio at any
  time; nothing stops the owner from replacing it with real lesson content.
- No seeded lesson has a real audio `material` URL yet, so the Listening audio player is
  implemented and tested but not yet exercised with production content.
- Speaking "recordings" are always local-only by design (see [DECISIONS.md](DECISIONS.md)) —
  never sample data pretending to be real, but also never persisted audio.
- About page bio and the Atlas project — unchanged placeholder from the first pass, still
  unconfirmed (see "Known gaps").

## Known gaps / defects

- **No audio/image upload anywhere in the app** (cover images, journey evidence, Speaking
  recordings, Listening material) — all URL-paste or local-only. Consistent limitation,
  documented in [ROADMAP.md](ROADMAP.md), not fixed this pass.
- **The site owner's actual name is still unconfirmed** ("Luân" vs. "Max Lie" — see the previous
  two passes' notes). Unchanged.
- **Not deployed.** Unchanged blocker — Vercel account + networked SQLite (Turso) both still
  needed, and now even more load-bearing: attempt submissions are a live, interactive feature
  that only works meaningfully once accessible from more than one machine.
- **`npm run start` (production server) still not exercised.**
- **`middleware.ts` deprecation warning** and **`npm audit`'s 3 build-time-only advisories** —
  unchanged, low-priority, documented in [OPERATIONS.md](OPERATIONS.md).
- **Interview prep still has no UI** (schema only) — unchanged.
- **Journey evidence is still a free-text label**, not linked to real `Post`/`Lesson` rows —
  unchanged scope decision from the previous pass.

## Next priority

Unchanged from the previous pass, now slightly more urgent: **deploy**, since the site now has
a genuinely interactive feature (submitting lesson attempts) whose main value — practicing from
anywhere, reviewing from anywhere — isn't realized while everything runs against one local
SQLite file on one machine. See [OPERATIONS.md](OPERATIONS.md#deployment-vercel) for the exact
blocking steps, all of which need the site owner's action (a Vercel account, a Turso database),
not more code.
