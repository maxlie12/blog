# OPS-001 — Max Learning seven-stage role kit

Date: 2026-11-12. Baseline: `master` 3deb3cb0aa0e7d625769fd456d688e46c4c9b4b0. Scope: repository instructions only; no learner feature, schema, auth, deployment setting or private data changes.

**Existing:** root AGENTS.md, WORK-ROUTER, AI-WORKFLOW and pinned Ponytail/UI skills. PR #2 merged 2026-11-09. Newer listening/speaking releases on 2026-11-12. Do not duplicate code.

**Problem:** seven explicit PM/BA/Dev/TEST/QA/DevOps/Orchestrator handoff gates and proof are not recorded as reusable native skills. Historical context misleadingly describes the merged PR as draft.

**Allowed files:** `AGENTS.md`, `CLAUDE.md`, `docs/AI-WORKFLOW.md`, `docs/MAX-LEARNING-CONTEXT.md`, `docs/LEARNING-DELIVERY.md`, this brief, seven `.claude/skills/learning-*/SKILL.md` files, `scripts/check-learning-agent-kit.mjs`, `.github/workflows/learning-quality.yml`.

**Forbidden:** app source, lessons, existing vendor skills, Prisma, dependencies, learner data, env and other project domains.

**Acceptance:** 7 role manifests + one orchestrator; BA/QA distinguish Done vs grading; test commands plus mobile/reload gates; licensed vendor skills reused; CI verifies kit and existing unit/lint/build; exact PR SHA/production semantics; no false autonomous claims.

**Verification:** script + GitHub Actions evidence to attach; no interactive E2E or iPhone QA for this docs-only commit. Previously deployed product behavior unchanged. QA for actual learner-facing release must still be verified separately.
