# Content Guide

## Writing an article

1. Create `content/articles/<slug>.mdx` (the filename becomes the URL: `/writing/<slug>`).
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
4. Run `npm run dev` and check `/writing/<slug>` renders as expected.
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

Run, from the project root:

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

## Interview prep notes (schema-only today)

`InterviewRecord` exists in `prisma/schema.prisma` so the eventual UI needs no migration, but
there is no reading or writing flow yet — see [ROADMAP.md](ROADMAP.md). When it ships:

- `companyLabel` is meant to hold an anonymized label ("Series B fintech, Company A"), not a
  real company name, unless you've decided that specific record is safe to publish.
- Records default to `isPublic: false`. Never flip a record to public without re-reading it
  for anything that identifies a company or interviewer you haven't decided to name.
