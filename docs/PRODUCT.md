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
3. **Practicing** — the owner runs `npm run log` (or a future UI) to record a day's practice.
   The entry always counts toward the streak; it is only shown publicly if marked public.

## MVP scope

**In:**
- About/portfolio page (About, Skills, Experience — placeholder data, see
  [STATUS.md](STATUS.md)).
- Projects list + detail pages, rendered from MDX, including Atlas as a placeholder entry.
- Writing (articles) list + detail pages, rendered from MDX, with links to related projects.
- Learning page: current/longest streak (computed from all practice days, public or private)
  and a list of the most recent **public** log entries.
- A documented, git-based way to add/edit articles and projects (edit a file, commit).
- A documented CLI (`npm run log`) to add learning-log entries.
- Mobile-friendly layout, basic SEO (`sitemap.ts`, `robots.ts`, per-page metadata), and
  accessible semantic HTML with a real empty state on every list page.

**Deliberately excluded from MVP** (schema exists, UI does not — see
[ROADMAP.md](ROADMAP.md)):
- Language exercise flows (goals/prompts/answers/feedback/spaced repetition).
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
