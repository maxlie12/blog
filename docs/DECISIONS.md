# Decisions

Reverse-chronological log of decisions with material impact and their rationale. See linked
docs for full detail; this file is the "why," not the "how."

## 2026-09-26 — Attempt submission requires the Studio session, on the public lesson page

**Decision:** `/learning/[lessonId]` now shows a real answer form and Submit action, but only
to a visitor with a valid Studio session (`hasStudioSession()`); everyone else sees a read-only
page with a "Sign in to submit an attempt" link. The submit Server Action
(`src/app/learning/attemptActions.ts`) independently re-checks the session and refuses
(returns an error, doesn't silently no-op) if it's missing.

**Why:** asked directly and confirmed explicitly (see chat) rather than assumed — the
alternative (open to any visitor) would have made attempt submission the site's first
unauthenticated write endpoint, which didn't fit the existing model where every write goes
through the same one-owner session. Keeping it gated means the public lesson page can host the
"do the lesson" experience directly (no need to detour through `/studio` to practice) without
changing who can write to the site.

**Consequence:** the answer form lives on the public URL, not under `/studio`, so the owner can
browse the normal public site while signed in and practice there — the gating is by session,
not by route.

## 2026-09-26 — Speaking recordings are local-only; the persisted answer is always text

**Decision:** the Speaking lesson type offers an in-browser record/playback control
(`MediaRecorder` via `SpeakingRecorder` in `AttemptSubmitForm.tsx`), but the audio is never
uploaded — `Attempt.response` always stores a typed transcript, which is what's actually
validated and saved.

**Why:** there's no blob/file storage configured (cover images have the same limitation — see
`docs/ROADMAP.md`), so there is nothing to persist a recording *to*. Silently discarding the
recording without saying so would violate the instruction to label the transcript fallback
clearly; the UI says outright, next to the record button, that the recording is for
self-review only and the transcript is what gets submitted. This is an honest scope limit, not
a hidden one.

**Revisit when:** blob storage is added (see `docs/ROADMAP.md`) — at that point `Attempt` would
need a new field (e.g. `audioUrl`) rather than overloading `response`.

## 2026-09-26 — Submitting an attempt never changes skill progress by itself

**Decision:** `getSkillProgress()` (unchanged by this pass) still only counts a lesson as
complete once it has an attempt with `reviewStatus: "reviewed"`. A freshly submitted attempt
always starts `"pending"`, regardless of whether it was submitted via the public page or
Studio's own form.

**Why:** explicit, repeated instruction across every pass touching this feature — never infer
CEFR proficiency or completion from submitted attempts alone. Verified live: submitting two
attempts against a lesson left its skill progress at `0/2`; only after the owner reviewed one
attempt in Studio did it become `1/2`, on both the Studio and public pages.

## 2026-09-26 — Studio auth: single password + signed cookie, not a real auth system

**Decision:** `/studio` is gated by one `STUDIO_PASSWORD` env var and an HMAC-signed session
cookie (`src/lib/auth.ts`, `src/middleware.ts`) — no user table, no OAuth provider, no roles.

**Why:** there is exactly one writer. A real auth system (accounts, password hashing/reset,
sessions table, roles) solves a multi-user problem this site doesn't have. The password lives
in an env var (never committed); the session secret is rotatable to invalidate all sessions at
once. This reverses the earlier "no auth in the MVP" decision, but only because Studio can now
change public content — the underlying reasoning (avoid building for an audience of one) is the
same, just applied to "smallest auth that's still real" instead of "no auth."

**Revisit when:** a second person needs write access (a co-author, an editor) — at that point
this needs actual accounts, not a bigger version of a shared password.

## 2026-09-26 — Studio's lesson/attempt model replaces the localStorage lesson prototype

**Decision:** the `Lesson`/`Attempt` Prisma models (and Studio's UI for them) replace
`src/data/lessons.ts` and `src/lib/progress.tsx` (both deleted). Public skill progress is now
computed from real `Attempt` rows, not a per-browser `localStorage` map.

**Why:** the previous prototype let any visitor's browser mark a lesson "complete," which
never represented anything real — a stranger completing Luân's English lesson isn't
meaningful data, and `localStorage` isn't durable or cross-device besides. The task's own
instruction not to treat `localStorage` as durable publishing storage matches what STATUS.md
had already flagged as the prototype's biggest weakness. A lesson now counts as complete for
public progress purposes only once the owner records a `reviewed` attempt against it in
Studio — see [ARCHITECTURE.md](ARCHITECTURE.md#content-model).

**Consequence:** the public lesson-detail page (`/learning/[lessonId]`) is now read-only — it
shows instructions/material/exercise and whether attempts exist, but the "Mark complete"
button is gone. This is intentional, not a regression: completion is now an owner-recorded
fact, not a self-reported visitor checkbox.

## 2026-09-26 — Mountain-journey evidence is a free-text label, not a relational link

**Decision:** `JourneyEvidence.label`/`note` are plain strings. There's no picker to attach an
actual `Post` or `Lesson` row as evidence, even though both now exist as real database records
that could in principle be linked.

**Why:** scope control. The task's two named vertical slices were the blog publish flow and the
lesson/attempt/progress flow; journey checkpoint editing was requested but not one of the two
flows to build first. A free-text evidence label is enough to make the feature usable now
(describe what the evidence is) without building a cross-entity picker UI in the same pass.
Tracked as a real gap, not hidden — see [ROADMAP.md](ROADMAP.md).

## 2026-09-26 — `currentCheckpointId` remains hand-set only — now enforced by Studio's UI, not just convention

**Decision:** `JourneyCheckpoint.isCurrent` is only ever changed by
`setCurrentCheckpoint(id)`, a Server Action triggered by an explicit "Set as current" click in
Studio. No code path — not lesson completion, not attempt counts, not the practice-log streak —
ever calls it automatically.

**Why:** explicit, repeated instruction across both the original build and this Studio
extension: never award or imply a CEFR level from streaks or lesson counts. Making this a
manual, single-purpose action (rather than, say, a side effect of some other save) keeps the
rule enforceable by inspection — anyone auditing the codebase can grep for
`setCurrentCheckpoint` and see every place "you are here" can change.

## 2026-09-26 (earlier pass) — Lesson exercises shipped as a client-only prototype, not wired to a backend

**Superseded the same day** by "Studio's lesson/attempt model replaces the localStorage lesson
prototype," above — kept here for the historical reasoning, since the *why* (don't conflate
practice-log entries with lesson-completion checkboxes) still holds even though the mechanism
changed.

**Decision:** the Writing/Listening/Speaking/Reading lesson browser and "Mark complete" action
(`src/data/lessons.ts`, `src/lib/progress.tsx`) store completion state in `localStorage` only.
No database table was added for it.

**Why:** the request asked for a *usable* lesson detail screen with a completion action, but
explicitly scoped a real backend as later work ("what needs a later backend" was asked for in
the report, implying it's expected to be absent now). Reusing the existing `LearningLog` table
would have conflated two different kinds of data — real, timestamped practice sessions the
owner logs by hand (`docs/ARCHITECTURE.md#privacy-model`) vs. a UI-driven "did I do this canned
exercise" checkbox — so they're kept visibly separate on `/learning` instead ("Practice log
(tracked)" vs. the lesson explorer above it).

**Revisit when:** the owner wants lesson completion to survive clearing browser storage or to
sync across devices — at that point it likely belongs in its own table, not bolted onto
`LearningLog`.

## 2026-09-26 (earlier pass) — Mountain-journey position is a manually-edited constant, never computed

**Superseded the same day** by "`currentCheckpointId` remains hand-set only," above — the data
moved from a hardcoded file to a `JourneyCheckpoint.isCurrent` database column, but the rule
itself (hand-set, never derived) is unchanged and is now enforced by Studio's UI having exactly
one action that can flip it.

**Decision:** `currentCheckpointId` in `src/data/journey.ts` is a hardcoded string the owner
edits by hand. No code path derives it from lesson completion counts, the practice-log streak,
or any other activity metric.

**Why:** explicit instruction — do not claim a CEFR level from streaks or lesson counts. Any
automatic derivation (e.g. "5 completed lessons = B2") would be exactly that claim, dressed up
as data-driven. A hand-set value with a visible disclaimer keeps the map honest: it shows what
the owner believes about their own level, not what an activity count implies.

## 2026-09-26 — Full visual redesign; nav route renamed `/writing` → `/blog`

**Decision:** replaced the MVP's plain utility-class styling with an editorial design system
(CSS custom properties for theme/accent, serif headings, textured surfaces) and renamed the
"Writing" section to "Blog" (route, nav label, and internal links) to match the supplied
reference design.

**Why:** requested directly, with a reference image. The rename happened pre-launch (no
indexed URLs, no real visitors yet), so there was no redirect cost to renaming now rather than
carrying an inconsistent nav label indefinitely.

**Follow-up:** the About page's placeholder name was changed from "Max Lie" (guessed from the
`maxlie12` GitHub handle in the previous pass) to "Luân" (the name used in this pass's brand
header, per the reference image). This is still a guess, now a different one — see
`docs/STATUS.md` for the open question.

## 2026-09-25 — Prisma 6.19.3 over Prisma 7/8

**Decision:** pinned `prisma` and `@prisma/client` to `6.19.3`, not the `7.10.0`/`8.0.0-rc`
versions npm resolved by default.

**Why:** Prisma 7 removed `datasource.url` from `schema.prisma` in favor of a
`prisma.config.ts` + driver-adapter model, and the CLI that `npm install prisma` resolved to
was `8.0.0-rc.17` — a release candidate. Both add real setup complexity (adapter wiring) and
version risk for a single-operator site with no team to absorb a breaking upgrade. Prisma 6 is
stable, uses the simpler schema-only config, and is what the OPERATIONS/ARCHITECTURE docs
describe.

**Revisit when:** Prisma 6 approaches end-of-life, or a feature only in 7+ becomes necessary.

## 2026-09-25 — Dropped `better-sqlite3` dependency

**Decision:** installed then removed `better-sqlite3`.

**Why:** it was added speculatively for a Prisma driver-adapter setup that turned out to be
unnecessary — Prisma's built-in SQLite provider (in the 6.x config model actually used) needs
no separate native driver. Keeping it would have added a native-compile step (Python/build
tools) for zero benefit.

## 2026-09-25 — No admin UI / no auth in MVP

**Decision:** content is added by editing `.mdx` files and committing; learning-log entries are
added via `npm run log`. No login, no browser-based write UI.

**Why:** exactly one person writes to this site. An admin UI implies auth, which implies a
security surface (sessions, password/token storage, rate limiting) to build and maintain for
an audience of one. Editing files and running a script is already within the owner's existing
skill set. See [ARCHITECTURE.md](ARCHITECTURE.md#why-this-shape).

**Revisit when:** the CLI/file-edit workflow becomes a genuine blocker (e.g. wanting to log
practice from a phone with no dev environment) — see [ROADMAP.md](ROADMAP.md#phase-5).

## 2026-09-25 — Interview prep and language exercises: schema now, UI later

**Decision:** `InterviewRecord` is defined in `prisma/schema.prisma`; no page reads or writes
it. Language exercises have no schema yet at all.

**Why:** the task's own completion criteria rule out shipping features whose main flow can't
be completed and verified in this pass. Interview records need a privacy-sensitive UI
(anonymization, private-by-default) that deserves its own careful pass rather than being rushed
alongside the MVP. Exercises need real usage data (what does a Chinese-practice entry actually
need to capture?) before the schema is worth fixing in place — guessing now risks a wasted
migration later.

## 2026-09-25 — About page ships with placeholder profile data

**Decision:** `src/data/profile.ts` contains clearly-labelled placeholder bio/skills/experience,
not fabricated-but-plausible content.

**Why:** the task requires authentic personal content that only the site owner can provide, and
explicitly forbids presenting fabricated content as real. A single source file, an on-page
placeholder banner, and a documented edit path (see [STATUS.md](STATUS.md)) make this safe to
ship without misrepresenting anything.
