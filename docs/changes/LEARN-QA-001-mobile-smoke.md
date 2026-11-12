# LEARN-QA-001 — mobile viewport persistence regression

Date: 2026-11-12. Base `407cce0bcc64` after seven-role workflow PR #3 merge.

**PM:** PR #2 already merged; do not rebuild Daily selection, storage or recall. The smallest valuable next change is a repeatable smoke gate for the previously unverified narrow viewport experience. **No changes to `src/`**.

**BA contract:** As a synthetic guest learner using English or Chinese, a 5–10 minute lesson has an editable answer. Clicking Save persists a *draft*, not Done. Navigating away and returning preserves exact answer. Clicking Done records completion without claiming correctness. Learner can compare and self-rate recall. Reload retains response, Done and recall. Viewports 390px/320px have no horizontal overflow and Save is at least 44px high.

**Architect/Dev:** add a self-contained Node/Playwright script under `scripts/` and one dedicated GitHub Actions workflow. Use already installed Playwright dependency. No schema/key/API/feature/dependency changes. All synthetic browser contexts are local ephemeral CI only. Rollback = revert this PR, production app remains unchanged.

**TEST:** the E2E job installs Chromium, migrates a temporary local sqlite DB, runs a Next production build, starts a local Next server, and exercises two real browser viewport flows. It is *Chromium emulation*, not real Safari/iPhone; no microphone or transcription quality assertion. Unit/integration, lint and build continue in the existing Max Learning quality workflow.

**QA:** on failure report failing assertion, SHA and logs; retest before merge. On pass, mark viewport and reload E2E PASS only; physical iPhone/Safari/touch keyboard remains NOT VERIFIED.

**DevOps/Orchestrator:** verify CI, PR SHA and Vercel preview. Docs + test-only changes may merge on passing tests; no new learner behavior released. Record production SHA and risks. Next real device test performed by the owner, not fabricated.
