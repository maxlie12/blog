# LEARN-006 — guided five-minute lesson flow

## Identity

- **Issue:** `LEARN-006`
- **Status:** verified
- **Owner:** Codex
- **Date:** 2026-10-26

## User-visible problem

The lesson has the correct source, task and Done control, but it does not state the session scope
at a glance. Its four route steps look equally active, the main action disappears while scrolling
on a phone, and completion does not close the session with a concise learning takeaway.

## Completion evidence

On a public lesson, the learner sees `5–10 phút · 1 nguồn · 1 đầu ra`, a route whose current step
is identified by text as well as color, and one mobile bottom action. Opening the source advances
the action to the response field. Recording Done shows a compact completion closure with the
lesson phrase/pattern and clear review or return actions. Refresh preserves existing drafts and
Done state.

## Scope

### Read

- `docs/AI-WORKFLOW.md`
- `.claude/skills/ponytail/SKILL.md`
- `.claude/skills/ui-ux-pro-max/SKILL.md`
- `src/components/LessonDetailView.tsx`
- `src/components/PracticeCoach.tsx`
- `src/lib/localLearningProgress.ts`
- direct Learning styles in `src/app/globals.css`

### May edit

- `src/components/LessonDetailView.tsx` — compose the guided lesson hierarchy.
- `src/components/PracticeCoach.tsx` — expose response focus and completion closure.
- `src/components/LessonFlowGuide.tsx` — isolate browser-only step and mobile action state.
- `src/app/globals.css` — accessible responsive states and safe-area dock.
- `docs/ISSUES.md` — track the active user-visible problem.
- `docs/changes/LEARN-006-guided-lesson-flow.md` — record scope and evidence.
- `docs/STATUS.md` — record the verified result after completion.

### Must not edit

- Lesson packets or source content.
- Authentication, Studio, database schema or sync API.
- Domain, game, assessment or lesson-generation subsystems.

## Constraints

- Preserve existing local drafts and Done records.
- Done is habit evidence, not proficiency evidence.
- Do not store private answers, audio, feedback or secrets in the public repository.
- Add no dependency and keep browser state in leaf client components.
- Keep one primary action, 44px touch targets and visible keyboard focus.
- The fixed mobile action must respect safe areas, reserve page space and reduced motion.

## Plan

1. Add the session contract and replace the static route with a stateful leaf component.
2. Connect source-open, response-focus and existing Done events to one next-action dock.
3. Close a completed session with the existing takeaway data and two subordinate exits.
4. Run focused tests, lint, build and mobile/keyboard production verification.

## Verification

- [x] Focused test or fixture check
- [x] `npm run lint`
- [x] `npm run build`
- [x] Mobile/keyboard/reduced-motion code check
- [x] Draft and Done persistence regression tests
- [x] Production route check after deployment

## Result

- **Files changed:** lesson composition, the leaf browser flow guide, anonymous practice closure,
  direct responsive styles and issue/status documentation.
- **Evidence:** 26 Node tests, ESLint and the Next.js production build pass. On production, the
  session contract is visible; opening British Council changes step 1 to a check and marks step 2
  current; focusing the response changes step 2 to a check and marks step 3 current.
- **Commit/deployment:** implementation commit `2c33d88`; Vercel's GitHub deployment check
  succeeded and the production alias served the new flow.
- **Not checked / remaining risk:** Done was not clicked in production to avoid adding fabricated
  learning metadata. Completion restoration remains covered by the existing local-progress tests.
  The 720px safe-area dock passed responsive CSS and accessibility review, but this cloud browser
  did not expose a real phone viewport for screenshot verification.
