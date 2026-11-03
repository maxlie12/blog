# SITE-001 — “Nghỉ dưỡng & vui chơi” replaces Projects

## Identity

- **Issue:** `SITE-001` (owner request, 2026-11-03: “bỏ giúp t phần project thay vào đó thành nghỉ dưỡng vui chơi trong đó”)
- **Status:** done (live page check by owner)
- **Owner:** Claude
- **Date:** 2026-11-03
- **Related:** `LEARN-012-game-entry.md` (its remaining risk: the site header has no game link)

## User-visible problem

The header and home page promote a Projects section whose only entry is a placeholder (Atlas,
`sample: true`), while the two games can only be found through a small row on Learning.

## Completion evidence

- The header shows **Vui chơi** instead of Projects. It opens `/play`, titled “Nghỉ dưỡng & vui
  chơi”, with Làng Rêu and the Learning Farm as large picture cards and a short list of the three
  cozy-game articles. It is also highlighted while playing either game.
- The home page's “Featured project” card becomes a card for this corner.
- Projects are gone: `/projects` pages, the placeholder Atlas entry, “Related projects” under
  articles, sitemap entries and project helpers. Old `/projects` links redirect to `/play`.
- The page states the games do not count towards Done, the rhythm or a level.
- 44px targets, keyboard focus, no horizontal scroll at 390px, dark mode via tokens.

## Scope

### May edit

- `src/app/play/page.tsx` (new), `public/images/play-village.jpg`, `public/images/play-farm.jpg` (new)
- `src/components/SiteHeader.tsx`, `src/app/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/sitemap.ts`, `src/app/layout.tsx` (description)
- `src/lib/content.ts` (remove project helpers), `next.config.ts` (redirects, tracing)
- Remove `src/app/projects/**` and `content/projects/atlas.mdx`
- `content/articles/welcome-to-this-site.mdx` (sample article's project link)
- `src/app/globals.css` (project styles out, `play-` styles in)
- `README.md`, `docs/CONTENT-GUIDE.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md` (project mentions), this brief, `docs/STATUS.md`

### Must not edit

- Game code, lesson flow, Done/streak, learner accounts, Prisma, Studio.

## Verification

- [x] ESLint clean and no `tsc` errors in changed files (remaining `tsc` errors come from the
      missing Clerk/Prisma packages in this workspace); `npm test` unchanged.
- [x] Static render of the real `SiteHeader` and `/play` page with the site CSS, Playwright at
      1280px and 390px, light and dark: 18/18. Header shows Learning, **Vui chơi**, no Projects;
      Vui chơi is active on `/play` and `/learning/village`, Learning on `/learning`; both cards
      link to the games and their pictures load; three cozy-game articles listed; links ≥44px;
      visible focus; no horizontal scroll.
- [ ] Not checked here: `next build`, the `/projects` → `/play` redirect and the home card in a
      running Next server (the workspace cannot install Clerk). Vercel's build is the check.
- [ ] Vercel build + production deploy

## Result

- **Files changed:** new `src/app/play/page.tsx` and two cover images; `SiteHeader`, home page,
  blog detail, sitemap, layout description, `src/lib/content.ts`, `next.config.ts` (redirects),
  `globals.css`; removed `src/app/projects/**` and the placeholder `content/projects/atlas.mdx`;
  sample welcome article link; README and docs.
- **Evidence:** see Verification.
- **Not checked / remaining risk:** the blog category label “PROJECTS” for `work` articles in
  `BlogCard` was left as is (it is a topic tag, not the removed section).
