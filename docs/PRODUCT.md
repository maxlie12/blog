# Product

## Goals

A single public site that is a genuine record of growth, not a highlight reel:

- Show what has been built (portfolio/projects).
- Show what is being learned and how (English, Chinese, software), including setbacks.
- Provide a space to practice explaining technical topics clearly.
- Track daily practice as a streak that reflects real activity, not public performance.
- Support interview preparation notes with strict privacy defaults.

## Users

- **Primary: the site owner.** Writes articles, logs practice, reviews interview notes,
  maintains the portfolio. This is a single-operator site — see
  [ARCHITECTURE.md](ARCHITECTURE.md) for what that implies architecturally.
- **Secondary: visitors** — recruiters/hiring managers evaluating the portfolio, and readers
  of the writing (peers, other learners). Visitors only ever see public data.

## Core flows

1. **Reading** — a visitor browses projects and articles, reads the learning streak/log, with
   no login required. Interview records and private log notes are never visible to this flow.
2. **Writing** — the owner adds/edits an `.mdx` file under `content/articles/` or
   `content/projects/`, commits it, and it appears on next deploy. No admin UI in the MVP; see
   [CONTENT-GUIDE.md](CONTENT-GUIDE.md).
3. **Practicing (tracked)** — the owner runs `npm run log` (or a future UI) to record a day's
   practice. The entry always counts toward the streak; it is only shown publicly if marked
   public.
4. **Practicing (exercises)** — a visitor (usually the owner) works through a sample lesson on
   `/learning` and marks it complete. This is a separate, lighter-weight flow from #3: it's
   browser-local (not synced, not verified) and exists to make the Learning section usable
   today rather than an empty shell — see [ARCHITECTURE.md](ARCHITECTURE.md) and
   [DECISIONS.md](DECISIONS.md).

## MVP scope

**In:**
- About/portfolio page (About, Skills, Experience — placeholder data, see
  [STATUS.md](STATUS.md)).
- Projects list + detail pages, rendered from MDX, including Atlas as a placeholder entry.
- Blog (articles) list + detail pages, rendered from MDX, with links to related projects.
- Learning page: a mountain-journey milestone map (hand-set, not computed), four skill cards
  with a filterable lesson picker and working lesson-detail/completion flow (browser-local),
  and — kept clearly separate — the real, tracked current/longest streak (computed from all
  practice days, public or private) and a list of the most recent **public** log entries.
- A documented, git-based way to add/edit articles and projects (edit a file, commit), plus a
  plain data file for lesson content (`src/data/lessons.ts`).
- A documented CLI (`npm run log`) to add learning-log entries.
- Theme (light/dark) and accent-color switcher, persisted per-browser.
- Mobile-friendly layout, basic SEO (`sitemap.ts`, `robots.ts`, per-page metadata), and
  accessible semantic HTML (focus states, `prefers-reduced-motion`) with a real empty state on
  every list page.

**Deliberately excluded from MVP** (see [ROADMAP.md](ROADMAP.md)):
- A backend for lesson exercises — the lesson browser and completion action are real and
  usable, but completion state is `localStorage`-only (schema exists for interview records;
  lesson content/completion has no database table at all yet, by design — see
  [DECISIONS.md](DECISIONS.md)).
- Interview record public/anonymized UI (the `InterviewRecord` table exists so the schema
  doesn't change later, but there is no reading or writing flow for it yet).
- Any authenticated admin UI — content is edited by editing files/running a CLI script
  directly against the repo and database, which is appropriate for a single operator and
  avoids building and securing an auth system for an audience of one.
- Streak calendar heatmap / visual history beyond the two headline numbers.
- Multilingual (Chinese/Japanese) UI chrome — content itself can already be written in any
  language today.

## Success criteria

- All MVP pages render with real or clearly-labelled sample content, on desktop and mobile,
  with no dead links or console errors.
- `npm run build` and `npm run lint` pass.
- Adding a new article or project requires **only** adding one `.mdx` file — no code changes.
- Adding a learning-log entry requires **only** one CLI command.
- Every placeholder (profile bio, Atlas project body, the sample article) is visually marked
  as a sample/placeholder so it can never be mistaken for real content.
