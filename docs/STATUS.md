# Status

Last verified: 2026-09-25.

## What's implemented and working

- **Portfolio/About** (`/about`) — renders from `src/data/profile.ts`. **Content is
  placeholder** (clearly banner-labelled on the page) — real bio/skills/experience have not
  been provided yet.
- **Projects** (`/projects`, `/projects/[slug]`) — list + MDX detail pages, tech/status badges,
  repo/live links. One entry (`atlas`) exists, marked `sample: true` — **placeholder content**,
  banner-labelled, since no real Atlas details have been provided yet.
- **Writing** (`/writing`, `/writing/[slug]`) — list + MDX detail pages, reading time, area
  tags, related-projects box. One sample article ships (`welcome-to-this-site`, marked
  `sample: true`) so the section isn't empty.
- **Learning** (`/learning`) — current/longest streak computed from all `LearningLog` rows
  (public and private); a list of the 30 most recent **public** entries only. Verified: a
  private, backdated entry extends the streak count but does not appear in the entry list or
  page HTML (grepped for the entry's text — zero matches).
- **Content authoring** — adding an article/project is "add one `.mdx` file," documented in
  `docs/CONTENT-GUIDE.md`. Verified by exercising it for both the sample article and Atlas.
- **Practice logging** — `npm run log -- --area=... --activity=...` (see
  `docs/OPERATIONS.md`), with `--private`, `--date`, `--minutes`, `--note` flags. Verified
  working, including backdating and privacy filtering (see above).
- **SEO/metadata** — per-page `<title>`, `sitemap.ts`, `robots.ts`.
- **Empty states** — verified: Projects/Writing render a plain-text empty state when their
  content directory has zero entries (checked by reading `src/app/projects/page.tsx` and
  `src/app/writing/page.tsx`'s conditional branches; not screenshotted with content removed).
- **Error state** — `/learning` catches a Prisma/database failure and renders a specific
  "run migrations" message instead of a stack trace or blank page.
- **404 page** — custom `not-found.tsx`.

## Checks actually performed

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes. All routes compile; static pages prerendered (`/`, `/about`, `/projects`, `/writing`, article/project detail pages); `/learning` correctly marked dynamic (`ƒ`). |
| `npm run lint` | ✅ "No issues found." |
| `npx prisma migrate dev` | ✅ Applied cleanly; `data/blog.db` created at the documented path. |
| Dev server, all 7 MVP routes | ✅ All returned HTTP 200 (`curl` check against `/`, `/about`, `/projects`, `/projects/atlas`, `/writing`, `/writing/welcome-to-this-site`, `/learning`). |
| Streak logic | ✅ Logged one entry → streak `1/1`. Logged a second, backdated, **private** entry for the prior day → streak became `2/2`, and the private entry's text did not appear anywhere in the rendered page. |
| Playwright screenshot pass, desktop (1280×800) and mobile (390×844), all 7 routes | ✅ 14 screenshots captured, all HTTP 200, zero browser console/page errors across both viewports. Visually reviewed 3 of the 14 (`mobile /`, `mobile /learning`, `desktop /projects/atlas`): nav wraps correctly on mobile with no horizontal scroll, MDX (headings/blockquote/lists) renders correctly, placeholder banners are visible and legible. The remaining 11 screenshots were captured but not individually reviewed. |
| Production `npm run start` against the built output | ❌ Not run — only `next dev` was exercised end-to-end. |

## Known gaps / defects

- **Placeholder content is live in every content area** (About, Atlas project, one article).
  This is intentional per `docs/DECISIONS.md` (fabricating a plausible-sounding bio would
  violate the "never present fabricated content as real" constraint), but it means **the site
  is not ready to show to a real visitor yet**. Highest-priority next step — see below.
- **`npm run start` (production server) was not exercised**, only `next dev` — low risk given
  `next build` succeeded and the Learning route's data logic is identical between dev/prod, but
  unverified.
- **Not deployed.** Blocked on: a Vercel account/login (owner-only credential) and a networked
  SQLite-compatible database for production, since Vercel's filesystem is ephemeral — see
  `docs/OPERATIONS.md#deployment-vercel`. Nothing else about deployment is blocked; the config
  and steps are documented and ready to execute once those two things exist.
- **`relatedLogAreas` frontmatter field is stored but not rendered** on article pages yet
  (`src/lib/content.ts` parses it; no page reads it). Tracked in `docs/ROADMAP.md`.
- **`npm audit` reports 3 high-severity advisories**, all the same root cause: `prisma`
  CLI's own dependency `@prisma/config` → `deepmerge-ts` (stack exhaustion on recursive object
  graphs, GHSA-ggr8-5vv4-36mx). This is the CLI's build-time config merging, not
  `@prisma/client` (the runtime dependency the deployed app actually imports), so it isn't
  reachable by a visitor. `npm audit fix --force` would downgrade to `prisma@6.12.0` as a
  breaking change — not applied in this pass; re-check for a non-breaking patched release
  before the next deploy.
- **Interview prep and language exercises have no UI** — by design for this pass (see
  `docs/DECISIONS.md`), tracked as Phase 3/4 in `docs/ROADMAP.md`. Not a defect.

## Next priority

**Replace placeholder content with real content** — specifically `src/data/profile.ts` (bio,
skills, experience) and `content/projects/atlas.mdx` (what Atlas actually is). Everything else
in the MVP is functionally complete and verified; the site cannot be deployed to a real
audience honestly until this is done, since publishing invented biographical content would
violate the site's own stated purpose.
