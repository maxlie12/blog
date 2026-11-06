# OPS-001 — World operations and private Habblaud entry

- Status: active
- Date: 2026-11-06
- Owner: project owner + Codex

## User-visible problem

The owner can use World away from home but cannot distinguish a responding website from a connected home Habblaud. Add a compact management area on World, with a real same-origin website response check and an explicit private Habblaud entry.

## Completion evidence

World keeps its current farm and learning flow. A keyboard/mobile user opens the management disclosure, checks the website response, opens Atlas online management, and can save/remove a credential-free private Habblaud origin on this browser. No animation or open link claims the home agent is connected. Errors/timeouts are visible. Private sessions stay on their separately authenticated services.

## Read

AGENTS.md; docs/WORK-ROUTER.md; docs/ISSUES.md; docs/AI-WORKFLOW.md; docs/ARCHITECTURE.md; docs/OPERATIONS.md; docs/LEARNING-FARM.md; local Ponytail and UI/UX skills; LearningWorld; learnerProfiles; proxy; CSS tokens; Next route-handler guide after installation.

## May edit

- docs/changes/OPS-001-world-control.md — scope and verification.
- src/components/LearningWorld.tsx — one management component entry, pass farm-open state.
- src/components/LearningControlPanel.tsx — responsive disclosure, health check, external private links.
- src/components/LearningControlPanel.module.css — scoped tokens, 44px controls, focus and responsive rules.
- src/lib/learningControl.ts and src/lib/learningControl.test.ts — validated credential-free origin and health payload contract.
- src/app/api/learning/control-health/route.ts — read-only same-origin response probe, no DB/env secrets or external proxy.
- docs/ARCHITECTURE.md — document device-local URL and separate auth/data boundary.

## Must not edit

Farm engine, saves, learning progression, lessons, auth configuration, schema, other repositories, unrelated ongoing work.

## Constraints

No dependency additions. No cross-origin agent requests from blog. No embedded tokens or transcript. Saved URL is device/profile-local and has no credential/query/hash/path. HTTPS is required except same-device loopback. Opening private Habblaud does not indicate connection. Website health means only that the probe endpoint replied, not a guarantee about every route or database. Atlas remains responsible for private heartbeat/history behind ChatGPT sign-in.

## Verification

Focused validation tests; npm run lint; npm run build; connected-code review; public production disclosure, response probe, URL validation and removal, farm entry preserved. Browser viewport controls may limit mobile emulation; disclose limits. Actual home agent unavailable until owner activates bridge.

## Local verification result

- Focused tests: 2 passed (HTTPS/loopback validation, reject URL credentials/query/hash/path and malformed health payload).
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and new dynamic endpoint.
- `git diff --check`: passed.
- Connected review: no must-fix finding after correcting profile-local removal and adding aria-invalid. Correctness: farm state only passed as a boolean, never written. Safety/privacy: no cross-origin fetch, no credential URL, no server persistence. Real load/performance: one user-triggered same-origin request, 8-second timeout and unmount abort; no polling or new dependency. Test gap: actual private Habblaud/home machine remains unconnected and cannot be verified here. Lean code: reuse buttons, theme tokens, profile storage and native details disclosure.
- Dependency install: existing ONNX CUDA download timed out; local dependencies installed with scripts disabled, then Prisma generated explicitly. No package/lockfile changes. Runtime transcription/GPU behavior is outside this change.
- Production interaction check follows release; do not equate local tests with an active home connection.
