# Status

Last verified: 2026-09-26.

## What's implemented and working

- **New editorial UI** (this pass) — full visual redesign matching the reference brief: charcoal/deep-teal + warm-ivory palette, serif headings (Fraunces), paper texture, soft-shadow cards, on every page. Nav renamed **Blog** (was "Writing" — route moved from `/writing` to `/blog`), **Projects**, **Learning**, **About**.
- **Theme switcher** — moon/sun toggle (light ivory ↔ dark teal) plus 4 accent-color swatches (ivory/teal/deep-teal/amber). Both persist to `localStorage` (`site-theme`, `site-accent`) and apply before first paint via an inline script in `layout.tsx` (no flash of the wrong theme). Verified: toggling both in a live browser session actually recolors the whole UI, including the mountain-journey hero and all cards.
- **Home (`/`)** — three-column layout: recent blog cards (left), the mountain-journey hero + 4 skill cards (center), lesson picker + daily-goal widget (right), matching the reference image's structure.
- **Mountain journey** (`src/components/MountainJourney.tsx`, data in `src/data/journey.ts`) — B1+ → B2 → C1, with C2 marked "Optional". `currentCheckpointId` is a **hand-set value in a data file**, not derived from lesson completion or the practice-log streak. A visible caption states this explicitly. Verified: the caption renders on every page that shows the journey (`/`, `/learning`).
- **Skill cards + lesson picker** (`/`, `/learning`) — four skill cards (Writing/Listening/Speaking/Reading) with a completed/total count and progress bar; clicking one filters the lesson list to that skill (verified live: clicking "Speaking" narrowed 6 lessons to 2, and re-clicking cleared the filter). Skill cards and the lesson list share filter state via `LessonFilterProvider` (React context) so they can live in separate layout regions.
- **Lesson detail** (`/learning/[lessonId]`) — sample prompt + sample response for 6 placeholder lessons across all four skills (realistic frontend-dev/Atlas/interview-prep content, not real assessment material). "Mark complete" / "Mark as not done" toggles work and are **saved to `localStorage` only** — verified live: marking a lesson complete updates its checkmark in the list, its skill card's count, and the daily-goal widget, all without a page reload.
- **Practice log (tracked)** — the original, Prisma/SQLite-backed streak + public-entries section from the previous MVP pass is preserved on `/learning`, below the new lesson explorer, under its own heading ("Practice log (tracked)") with copy explicitly distinguishing it from the sample lesson exercises above. This is real, persisted data; the lesson-completion tracking above it is not.
- **Portfolio/About** (`/about`) — restyled; content is still placeholder (see Known gaps).
- **Projects** (`/projects`, `/projects/[slug]`) — restyled cards; `atlas` entry still placeholder.
- **Accessibility** — visible focus rings (`:focus-visible`, accent-colored) on all interactive elements; `aria-current`, `aria-pressed`, `aria-selected` used on nav/theme/filter controls; `prefers-reduced-motion` disables transitions/animations globally; verified via a live keyboard-tab screenshot showing a clear focus outline.
- **SEO/metadata, empty states, error states, 404** — unchanged from the previous pass, updated only where routes moved (`sitemap.ts` now points at `/blog/...`).

## Checks actually performed (this pass)

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes. 17 routes compile, including 6 statically-generated lesson pages. |
| `npm run lint` | ✅ "No issues found" (after fixing two `react-hooks/set-state-in-effect` errors by rewriting the theme/progress stores on `useSyncExternalStore` instead of effect+setState). |
| Playwright pass, desktop (1280×900) and mobile (390×844), 8 routes (`/`, `/blog`, `/blog/welcome-to-this-site`, `/projects`, `/projects/atlas`, `/learning`, `/learning/speaking-interview-intro`, `/about`) | ✅ All HTTP 200, zero console/page errors. Visually reviewed the home page, `/learning`, and the About page on both viewports — no horizontal scroll on mobile, header nav wraps cleanly. |
| Interaction check: dark-theme toggle | ✅ Screenshotted before/after — full palette swap confirmed live, including header, cards, and journey hero. |
| Interaction check: accent-swatch change (teal) | ✅ Screenshotted — accent color propagated to active nav underline, active filter chips, progress bars, and the "Continue learning" button. |
| Interaction check: skill-card filter | ✅ Clicking "Speaking" narrowed the lesson list from 6 to 2 items live; screenshotted. |
| Interaction check: lesson completion | ✅ "Mark complete" on a lesson flipped its state and persisted (`localStorage`); screenshotted. |
| Interaction check: keyboard focus | ✅ Tab-only navigation produces a visible accent-colored focus ring; screenshotted. |
| Production `npm run start` | ❌ Not run this pass either — only `next dev` was exercised end-to-end (carried over from the previous pass's gap). |

## Known gaps / defects

- **Placeholder content is still live** in About (`src/data/profile.ts`), the Atlas project, and the sample blog article — unchanged from the previous pass. The About page's placeholder name was updated to "Luân" to match the new header branding (previously said "Max Lie" from before this UI existed) — **this is a guess at the actual name and needs confirming**, since the earlier session inferred "Max Lie" from the `maxlie12` GitHub handle and this session's reference image says "Luân." Whichever is correct should be set once, in `src/data/profile.ts`.
- **Lesson-completion tracking is per-browser only**, not synced across devices and not backed by any server — this is by design for a prototype (see `docs/DECISIONS.md`), but it means the "0/2" counts and daily-goal widget reset if `localStorage` is cleared or a different browser/device is used. A real backend (or reusing the existing Prisma database) would be needed to make this durable — tracked in `docs/ROADMAP.md`.
- **The mountain-journey "you are here" position is manually edited**, not automatically kept in sync with anything — if lesson content changes significantly, a human needs to re-decide whether the milestone still applies.
- **Not deployed**; same blockers as before (Vercel account, networked SQLite) — see `docs/OPERATIONS.md#deployment-vercel`.
- **`npm run start` (production server) still not exercised**, only `next dev`.
- **`npm audit` still reports the same 3 high-severity advisories** in Prisma CLI's build-time-only `deepmerge-ts` dependency (not runtime-reachable) — unchanged from the previous pass.
- **Interview prep still has no UI** (schema only) — unchanged, tracked in `docs/ROADMAP.md`.

## Next priority

Same as before, now with one addition: **confirm the site owner's actual name** (Luân vs. Max Lie) alongside replacing the rest of the placeholder content in `src/data/profile.ts` and `content/projects/atlas.mdx`. The lesson/journey UI is a working prototype layer that can ship as-is (clearly labelled as self-tracked/placeholder), but publishing a guessed name would be worse than publishing no name.
