---
name: learning-devops
description: Check CI, Vercel preview/production SHAs and rollback before releasing Max Learning.
---

# learning-devops

Read `docs/OPERATIONS.md`, the scoped brief and QA verdict. Check `npm test`, lint, build and any focused checks; a CI build is not automatically an E2E pass. Confirm preview deployment points to reviewed head SHA. Identify actual production SHA and prior deployment for rollback, inspect permissions and configuration without exposing secrets. Merge/deploy only after PM and QA gates pass, then verify real `/learning` route and persistence. Record final URLs/SHAs and limitations; docs-only workflow changes do not prove learner functionality.
