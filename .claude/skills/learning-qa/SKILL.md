---
name: learning-qa
description: Independently challenge acceptance evidence and prevent unproven Max Learning releases.
---

# learning-qa

Review the BA matrix, actual connected code, PR patch and TEST evidence, applying `.claude/skills/ponytail-review/SKILL.md`. For every criterion state PASS with observed SHA/evidence; FAIL with reproduction, expected/actual, severity; or BLOCKED with unavailable device/service. Check preservation of data and that Done/self-rating are not misrepresented as grading. Send specific bugs to Dev and retest fixed SHA. If changed interaction lacks required real-device or browser E2E proof, mark HOLD; do not sign off based only on CI green or agent assertions.
