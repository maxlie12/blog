# Max Learning — seven-stage delivery contract

**What this is:** reusable AI-role instructions and QA/release gates, not autonomous background workers or a new product feature. Start at [WORK-ROUTER](WORK-ROUTER.md) and the active [ISSUES](ISSUES.md) item or [CHANGE-BRIEF](CHANGE-BRIEF.md); read only relevant ownership paths.

| Stage | Reusable skill | Evidence required |
| --- | --- | --- |
| 1 PM | `learning-pm` | Existing behavior, recent PR/deploy SHA, smallest release scope and exclusions |
| 2 BA | `learning-ba` | Learner action, assessment rubric, recorded data and Done criteria |
| 3 Architect + Dev | `learning-architect-dev` | Minimal design, branch diff, regression tests and rollback |
| 4 TEST | `learning-test` | Unit/integration/E2E, mobile 320/390px, reload and storage evidence |
| 5 QA | `learning-qa` | Independent PASS/FAIL/BLOCKED matrix, bug reproduction and retest |
| 6 DevOps | `learning-devops` | CI result, Vercel preview, tested SHA and safe release/rollback |
| 7 Orchestrator | `learning-orchestrator` | Version, completed scope, test evidence, production URL/SHA, risks |

## Product truth and boundaries

- This is a small English/Chinese daily practice experience, not a new LMS. Keep Japanese and the rest of Blog/World stable. PR #2 `codex/learning-resume-review` was **merged** into `master` on **2026-11-09**; archived "draft / do not merge" notes describe that prior QA checkpoint. Current master also includes newer listening/speaking work dated 2026-11-12. Reinspect current HEAD/STATUS and deployment before deciding what still needs to be built.
- Preserve draft → resume → explicit Done → recall before comparison → self-rating → next due date. Do not rewrite existing StartLearning, PracticeCoach, ReviewCompletion, nextLesson, reviewSchedule or progress stores without a reproducible issue.
- Self-reported Done, streak and self-rated recall are **habit / recall scheduling evidence**, not validated CEFR/HSK proficiency, writing correctness or pronunciation. Objective questions need explicit answer keys; open writing and speaking need a stated scoring rubric and real assessment evidence.
- BA must specify exactly which data is saved (draft, answer, audio, review outcome, metadata), in what location, device/account scope, privacy and expiry. Never claim a private draft/audio synchronizes just because metadata sync exists.
- Reuse existing MIT-pinned Ponytail and UI/UX skills in `.claude/skills/`. Do not download/install duplicate skills, new dependencies, hook scripts, models, stores or APIs just to implement the workflow.
- Preserve legacy profile/backups and current auth/security boundaries. Never commit learner answers, audio, secrets or genuine session tokens.

## Required artifacts and release gates

**PM:** baseline SHA + PR history + user-visible outcome + explicit allowed/must-not-edit paths and risk tier in the active brief.

**BA:** Given/When/Then acceptance for start, save, leave, reload, resume, Done, review, retry and error. Spell out what earns credit vs what is self-rated, plus what persists locally/server-side.

**Architect/Dev:** caller impact, smallest working module change, feature branch, tests and rollback. No unsolicited system architecture change.

**TEST:** run `npm test`, `npm run lint`, `npm run build`; record exact SHA, command results, integration tests and browser E2E. For changed Daily flows: start → save draft → leave → reload → resume exact response → Done → recall before comparison → rate → reload saved outcome and next date. Test 320px and 390px, keyboard, visible focus, 44px controls, overflow, storage failures and corrupted drafts. Only synthetic profile/answers on isolated preview.

**QA:** independently compare BA criteria to actual behavior. Each is PASS (observed evidence), FAIL (exact reproduction/expected/actual/severity) or BLOCKED (unavailable runtime/device/permission). Send concrete bugs back to Dev and retest; never sign off with words alone. Real iPhone/Safari, touch/virtual keyboard and microphone quality are separate from a desktop/emulated viewport; missing evidence is NOT VERIFIED.

**DevOps:** verify reviewed branch SHA equals preview SHA, green CI and the actual production deployment SHA. Record previous production deployment for rollback. No learner-facing release when required E2E/QA evidence is missing. A docs-only change uses a docs-only gate but is not a verified learner feature release.

**Orchestrator:** output SHIP / HOLD / BLOCKED; branch/commit, finished behavior, acceptance matrix, command counts, browser/device evidence, CI URL, preview/production URLs and SHA, remaining risk, rollback and next small step. Never invent agent runs, test passes or links.

## Reuse and quota checkpoint

Call `/learning-orchestrator` (Claude Code) or ask an available coding agent to read this file and run the seven stages. Native skills are instructions; they do not employ human contractors or create always-running autonomous agents. If the host cannot spawn subagents, carry out these roles **sequentially**, recording which checks were genuinely independent.

ChatGPT/GitHub do not expose a reliable ChatGPT usage % through this repo. When the user or a reliable host meter reports remaining quota **at or below 85%**, checkpoint scope, branch, SHA, tests, blockers and exact next operation, and stop starting new work. Automatic restart after quota reset is not available; a later user/host invocation must resume.

**Current smallest next task:** original Daily loop already shipped in PR #2. Verify the existing loop on a real phone before adding features; only fix demonstrated blockers. Four-skill evidence-based assessment is tracked separately as `ASSESS-001`.
