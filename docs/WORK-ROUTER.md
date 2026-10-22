# Work router

This is the first file an agent reads before changing the project. Its purpose is to find the
smallest safe reading and editing scope. It is not a request to inspect every file in a row.

## Start here

1. Find the active issue in [ISSUES.md](ISSUES.md), or copy [CHANGE-BRIEF.md](CHANGE-BRIEF.md)
   and fill it in for a new request.
2. Read only the required references and owning files named by that issue/brief.
3. Use `rg` to find callers of a function or consumer of a data field. Do not browse unrelated
   folders for context.
4. Edit only the allowed files. If the real flow requires another file, add it to the brief with
   a one-line reason before editing it.
5. Run the checks named in the brief. Update the issue with evidence, not a percentage guess.

## Route by work type

| Work type | Read first | Typical owning files | Do not read by default |
|---|---|---|---|
| Daily lesson content | `docs/DAILY-LEARNING.md` | One `content/daily-lessons/YYYY-MM-DD.json` packet; `src/lib/dailyLessons.ts` only if the contract changes | Farm, auth, Studio, Prisma |
| Lesson pedagogy or curriculum | `docs/GUIDED-PRACTICE.md`, `docs/LEVEL-LESSONS.md` | Packet(s), `src/lib/languages.ts`, `src/lib/lessonTypes.ts` | Deployment and blog code |
| Lesson page or Done/streak UX | Relevant section of `docs/ARCHITECTURE.md` | `src/app/learning/**`, named component, `src/lib/localLearningProgress.ts`, direct tests | Studio posts, Farm, unrelated routes |
| Learner profile or account | `docs/ARCHITECTURE.md`, relevant decision in `docs/DECISIONS.md` | `src/lib/learner*`, account API, `src/proxy.ts`, Prisma only when persistence changes | Content packets and visual game |
| Studio authoring/review | `docs/CONTENT-GUIDE.md`, relevant architecture section | Named `src/app/studio/**` route/action and its component | Public routes not revalidated by the action |
| Blog article/project content | `docs/CONTENT-GUIDE.md` | One MDX file or the named Studio flow | Learning engine and database schema |
| Deployment or environment | `docs/OPERATIONS.md`, `docs/VERCEL-TURSO.md` | Deployment config and the failing integration only | Product UI and content |
| Farm/game | `docs/LEARNING-FARM.md` | `src/lib/farm/**`, `src/components/farm/**`, `/learning/world` | Core lesson flow unless integration changes |
| Visual or interactive change | Relevant row above + UI/UX skill | Named component and styles; shared tokens only when required | Whole-site redesign |

## Escalate the scope only when

- A public type or stored field changes and all consumers must be found.
- Auth, privacy, migration or destructive data behavior changes.
- A shared component affects more routes than the request names.
- The user explicitly asks for a whole-project audit.

When one of these applies, list the extra paths and risk in the change brief. Broad curiosity is
not a reason to broaden the scope.

## Sources of truth

- `ISSUES.md`: open work, priority, evidence and blockers.
- `STATUS.md`: verified release history; not the current task queue.
- `ROADMAP.md`: possible future work; planned items are not approved automatically.
- `DECISIONS.md`: why a durable boundary exists; update only when that boundary changes.
- `ARCHITECTURE.md`: current system and data meanings; update only when those meanings change.

If these disagree, stop and resolve the smallest relevant contradiction in the active brief.
