# Content Guide

## Writing a blog post (Studio — recommended)

1. Sign in at `/studio/login`, then `/studio/posts/new`.
2. Fill in Title (slug auto-fills from it — edit the slug field directly if you want a
   different one), Excerpt, Cover image (a URL — see "Cover images," below), Content
   (Markdown, with a toolbar for bold/italic/links/lists/quotes/code/images), Category, Tags,
   and the "Related learning" toggle if the post connects to something on `/learning`.
3. **Save draft** any time — it's saved to the database immediately, visible only in Studio.
4. **Preview** to see it rendered exactly as the public site would show it (same `BlogCard` and
   article-page rendering, not an approximation).
5. **Publish** when ready — it appears on `/blog` immediately (no rebuild/redeploy needed).
   **Unpublish** takes it back to draft without deleting it; **Delete** removes it permanently.
6. Required fields: title, excerpt, slug, content. The slug must be lowercase
   letters/numbers/hyphens and unique across both Studio posts and `content/articles/*.mdx` —
   Studio checks both and shows an inline error if it's taken.

### Cover images

There's no file upload yet (see [ROADMAP.md](ROADMAP.md)) — paste a URL to an already-hosted
image (e.g. one you've uploaded elsewhere). This is a real limitation, not a placeholder: an
image upload flow needs blob storage (Vercel Blob, S3, etc.), which hasn't been set up.

## Writing an article (legacy path — hand-edited `.mdx` files)

Still fully supported for articles you'd rather write in a text editor / commit via git; the
public `/blog` page merges these with Studio posts.

1. Create `content/articles/<slug>.mdx` (the filename becomes the URL: `/blog/<slug>`).
2. Add frontmatter:

   ```yaml
   ---
   title: "A clear, specific title"
   date: "2026-09-25"        # publish date, YYYY-MM-DD
   summary: "One or two sentences — this shows in lists and social previews."
   areas: ["dev"]            # any of: dev, work, learning, life
   draft: true               # omit or set false to publish
   relatedProjects: ["atlas"]        # optional, Project slugs
   relatedLogAreas: ["english"]      # optional, LearningLog.area values
   ---
   ```
3. Write the body in Markdown/MDX below the frontmatter.
4. Run `npm run dev` and check `/blog/<slug>` renders as expected.
5. Set `draft: false` (or remove the field) and commit when ready to publish.

### What makes a good article here

- **State the claim, then the evidence.** If you say a method worked, link the practice log,
  exercise, or project it came from. "I did X and it worked" needs `relatedLogAreas` or
  `relatedProjects` pointing at something concrete.
- **Write for a beginner** unless the piece says otherwise. Define jargon on first use.
- **Cite sources.** Link the reference, doc, or course you learned something from, rather than
  restating it as if it were self-evident.
- **Mark drafts as drafts.** `draft: true` keeps a piece out of the production build entirely
  (see `src/lib/content.ts`), so half-finished writing never accidentally goes live.

## Adding a project

1. Create `content/projects/<slug>.mdx`.
2. Frontmatter fields: `title`, `summary`, `date`, `status` (`active` | `paused` | `shipped` |
   `archived`), `tech` (string array), `repoUrl?`, `liveUrl?`, `featured?` (shows it on the
   homepage).
3. Body: what it is, what you built, what you learned — link to articles that go deeper on
   specific decisions.

## Logging practice (streaks)

This is the original hand-logged practice tracker — separate from Studio's Lesson/Attempt
system above. Use it for practice that isn't tied to a specific Studio lesson (or keep using
both; they track different things and are shown in different sections of `/learning`). Run,
from the project root:

```bash
npm run log -- --area=english --activity="Shadowing practice, HSK4 unit 3" --minutes=20
```

- `--area` — free text, but stay consistent (`english`, `chinese`, `dev`, `other`) so the
  Learning page's labels make sense.
- `--activity` — required, short label.
- `--minutes` — optional integer.
- `--note` — optional longer reflection, shown publicly if the entry is public.
- `--date=YYYY-MM-DD` — optional, defaults to today in `SITE_TIMEZONE`. Use this to backdate
  an entry you forgot to log.
- `--private` — omit the entry's activity/note from the public Learning page. It still counts
  toward the streak (see [ARCHITECTURE.md](ARCHITECTURE.md#privacy-model)).

Full flag reference and troubleshooting: [OPERATIONS.md](OPERATIONS.md).

## Connecting content across areas

An article, a project, and a learning-log area are linked by **soft references** — plain
slugs/strings, not database foreign keys (see [ARCHITECTURE.md](ARCHITECTURE.md#content-model)
for why). In practice:

- From an article, list `relatedProjects: ["<project-slug>"]` to show a "Related projects"
  box at the bottom of the article page.
- From an article, list `relatedLogAreas: ["chinese"]` to note which practice area the piece
  discusses (rendering this on the page is planned — see [ROADMAP.md](ROADMAP.md)).
- From a learning-log entry, pass `--article=<slug>` (maps to `articleSlug` in the database)
  if a specific write-up discusses that session. *(Not yet wired into `scripts/log.mjs` — see
  STATUS.md.)*

If a slug is misspelled, the link silently doesn't render rather than breaking the build —
double-check slugs against the actual filenames in `content/`.

## Managing lessons (Studio)

1. `/studio/learning` → **+ New lesson**. Fields: skill, title, target level (a CEFR-style
   label — cosmetic, never derived from anything), instructions, source/material (optional — for
   a Listening lesson, paste a direct audio file URL here to get a playable player on the public
   lesson page; anything else renders as plain text), exercise(s) (optional), and completion
   criteria (what "done" means for this lesson).
2. Deleting a lesson deletes all its attempts (confirmed before it happens).

## Taking a lesson and submitting an attempt

This happens on the **public** lesson page (`/learning/<lessonId>`), while signed into Studio —
not inside `/studio` itself, so you can practice from the normal site without switching context.
Signed-out visitors see the same page read-only, with a "Sign in" link instead of the form.

1. Open a lesson from `/learning` (or a skill card's lesson list).
2. Read the instructions/material/exercise, then fill in the answer field:
   - **Writing / Reading:** a plain text answer.
   - **Listening:** if the lesson has an audio `material` URL, it plays inline; write your
     answer/notes below it.
   - **Speaking:** an in-browser **Record** button lets you record and play back your own voice
     for self-checking — **this recording is never uploaded or saved** (no audio storage is
     configured, see [ROADMAP.md](ROADMAP.md)). Type a transcript of what you said in the field
     below; the transcript is what actually gets submitted.
3. **Submit attempt.** The button is disabled/blocked until you've written a real answer (a few
   characters minimum) — this is enforced both by the browser (`required`/`minLength`) and
   again on the server, so a stripped-down request can't skip it either.
4. On success you get a confirmation and a permalink to the attempt (`/learning/<lessonId>/
   attempts/<attemptId>`) that persists — reload it, or open it on another signed-in device, and
   the answer is still there (it's a real database row, not browser storage).
5. **Submitting again does not overwrite the previous attempt** — each submission is a new row,
   and the lesson page's "Attempt history" list shows all of them, each linking to its own
   permalink.
6. **A submitted attempt does not by itself mark the lesson complete.** It starts
   `reviewStatus: "pending"`. To review it: `/studio/learning/lessons/<id>` → find the attempt →
   **Correct** → set review status to `reviewed` (optionally add feedback) → **Save correction**.
   Only then does it count toward that skill's progress bar, on both `/studio/learning` and the
   public `/learning` page. This is a deliberate, explicit step — see
   [DECISIONS.md](DECISIONS.md) for why nothing infers completion automatically.

## Editing the mountain-journey map (Studio)

`/studio/journey` lists the checkpoints (B1+ → B2 → C1 → optional C2 by default). For each one
you can edit its label/title/optional flag, and **set it as the current checkpoint by hand** —
this is a deliberate click, never automatic. Nothing in the codebase derives "you are here"
from lesson or attempt counts; see [DECISIONS.md](DECISIONS.md) for why that's a hard rule, not
just a current gap.

**Evidence** attached to a checkpoint (a completed lesson, a writing sample, a recording, a
reflection) is a short free-text label + optional note — not a picker linking to an actual
`Post`/`Lesson` row. This was scoped down deliberately (see [DECISIONS.md](DECISIONS.md)); name
the thing you're pointing at in the label (e.g. "Attempt on 'Interview: Tell me about
yourself', 2026-09-25") since there's no live link to click through yet.

Add a new checkpoint (e.g. a personal milestone between B2 and C1) with the form at the bottom
of the page — it's appended after the existing checkpoints.

## Theme and accent color

The moon/sun toggle and the four accent swatches in the header are visitor-facing preferences,
persisted per-browser (`localStorage`, via `src/lib/theme.tsx`) — there's no "default theme"
setting to configure beyond the CSS custom properties in `src/app/globals.css` (`:root` for
light, `:root[data-theme="dark"]` for dark, `:root[data-accent="..."]` for each accent). To add
a fifth accent color, add both a CSS variable and a matching entry in the `ACCENTS` array in
`src/components/SiteHeader.tsx`.

## Interview prep notes (schema-only today)

`InterviewRecord` exists in `prisma/schema.prisma` so the eventual UI needs no migration, but
there is no reading or writing flow yet — see [ROADMAP.md](ROADMAP.md). When it ships:

- `companyLabel` is meant to hold an anonymized label ("Series B fintech, Company A"), not a
  real company name, unless you've decided that specific record is safe to publish.
- Records default to `isPublic: false`. Never flip a record to public without re-reading it
  for anything that identifies a company or interviewer you haven't decided to name.
