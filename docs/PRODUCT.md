# Product

## Goals

A single public site that is a genuine record of growth, not a highlight reel:

- Show what has been built (portfolio/projects).
- Show what is being learned and how (English, Chinese, software), including setbacks.
- Provide a space to practice explaining technical topics clearly.
- Track daily practice as a streak that reflects real activity, not public performance.
- Support interview preparation notes with strict privacy defaults.
- Give the owner a private, authenticated workspace ("Studio") to publish and manage all of the
  above without hand-editing files or running scripts for every change.

## Users

- **Primary: the site owner (Luân).** Writes blog posts, manages lessons/attempts, edits the
  mountain-journey map, and (still, for the original workflow) can hand-edit `.mdx` files and
  run the learning-log CLI. This is a single-operator, single-writer site — see
  [ARCHITECTURE.md](ARCHITECTURE.md) for what that implies architecturally, including for
  Studio's auth model.
- **Secondary: visitors** — recruiters/hiring managers evaluating the portfolio, and readers of
  the blog (peers, other learners). Visitors only ever see public data; they cannot reach
  `/studio` at all without the owner's password.

## Core flows

1. **Reading** — a visitor browses projects and blog posts, reads the learning streak/log and
   lesson progress, with no login required. Drafts, interview records, private log notes, and
   all of `/studio` are never visible to this flow.
2. **Publishing a post** — the owner signs into `/studio`, drafts a post, previews it (same
   rendering as the public site), and publishes it — visible on `/blog` immediately. Unpublish
   returns it to draft without deleting it. See [CONTENT-GUIDE.md](CONTENT-GUIDE.md).
3. **Writing a legacy article** — the owner can still add/edit an `.mdx` file under
   `content/articles/` or `content/projects/` and commit it; the public blog merges both
   sources. Kept for content that benefits from being in git (see
   [ARCHITECTURE.md](ARCHITECTURE.md)).
4. **Managing a lesson and its attempts** — the owner defines a lesson (skill, instructions,
   completion criteria) in Studio, then records attempts against it over time (date,
   response/notes, feedback, review status). A lesson counts toward its skill's public progress
   once it has a reviewed attempt. History can be corrected, not just appended to.
5. **Practicing (tracked, non-lesson)** — the owner runs `npm run log` to record a day's
   practice that isn't tied to a specific Studio lesson. The entry always counts toward the
   streak; it's only shown publicly if marked public. Kept deliberately separate from
   Lesson/Attempt — see [DECISIONS.md](DECISIONS.md).
6. **Updating the mountain journey** — the owner edits checkpoints and attaches evidence in
   Studio, and explicitly sets which checkpoint is current. Never automatic.

## MVP scope (original) + Studio extension

**In (original MVP, unchanged unless noted):**
- About/portfolio page (About, Skills, Experience — placeholder data, see
  [STATUS.md](STATUS.md)).
- Projects list + detail pages, rendered from MDX, including Atlas as a placeholder entry.
- Blog list + detail pages — **now merges Studio-authored posts (database) with hand-written
  `.mdx` articles.**
- Learning page: mountain-journey milestone map (hand-set, not computed) — **now database-backed
  and editable in Studio**; four skill cards with a filterable lesson picker — **lessons and
  progress now come from the database, not a static file**; the original tracked streak/public
  log-entries section, unchanged and kept visibly separate from lessons.
- A documented, git-based way to add/edit legacy articles and projects.
- A documented CLI (`npm run log`) for the original practice-log flow.
- Theme (light/dark) and accent-color switcher, persisted per-browser.
- Mobile-friendly layout, basic SEO, accessible semantic HTML, real empty states.

**In (new, this pass — Studio):**
- `/studio`, password-gated: Overview, Blog posts (list + editor with Save Draft / Preview /
  Publish / Unpublish / Delete), Learning (lesson list + editor + attempt recording/correction),
  Mountain journey (checkpoint + evidence editor).
- All Studio-authored data persists in the existing SQLite database (`Post`, `Lesson`,
  `Attempt`, `JourneyCheckpoint`, `JourneyEvidence`) — not `localStorage`, not files.

**Deliberately excluded / scoped down** (see [ROADMAP.md](ROADMAP.md)):
- **Image/file upload.** Cover images and journey evidence are URL strings you paste in — no
  blob storage is configured yet.
- **Journey evidence as a relational link.** Evidence is a free-text label/note, not a picker
  that attaches an actual `Post`/`Lesson` row (see [DECISIONS.md](DECISIONS.md)).
- **Interview record UI** — schema exists, no reading/writing flow yet, unchanged from before.
- **Multi-user Studio access** — one password, one writer; see
  [ARCHITECTURE.md](ARCHITECTURE.md#studio-auth).
- Streak calendar heatmap / visual history beyond the two headline numbers.
- Multilingual (Chinese/Japanese) UI chrome.

## Success criteria

- All public pages render with real or clearly-labelled sample content, on desktop and mobile,
  with no dead links or console errors.
- `npm run build` and `npm run lint` pass.
- **End-to-end, verified:** create a draft in Studio → preview it → publish it → it appears on
  `/blog` → unpublish it → it disappears from `/blog`.
- **End-to-end, verified:** create a lesson in Studio → record a reviewed attempt → the skill's
  progress count updates, both in Studio and on the public `/learning` page.
- `/studio` is unreachable without the correct password, from a fresh browser session.
- Every placeholder (profile bio, Atlas project body, the sample article) is visually marked
  as a sample/placeholder so it can never be mistaken for real content.
