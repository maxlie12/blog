# Status

Last verified: 2026-09-26 (lesson-attempt-submission pass).

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
