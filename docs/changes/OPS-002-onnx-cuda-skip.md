# OPS-002 — Fix failing installs: skip onnxruntime-node CUDA download

- **Found:** 2026-11-26 while shipping LEARN-019. Every Vercel deploy and every "Max Learning
  quality gates" run on `master` has failed since `3abb368` (2026-11-18); production still serves
  `dde60dc` (2026-11-17), so the daily packets from 2026-11-18 onward are not live.
- **Cause (CI log):** `npm ci` → `onnxruntime-node` postinstall → downloads
  `onnxruntime-linux-x64-gpu-1.21.0.tgz` → `404 Not Found` → install fails. The lockfile has not
  changed since 2026-11-06; the upstream asset went away.
- **Fix:** project `.npmrc` with `onnxruntime-node-install-cuda=skip` (the option the install
  script names). The app uses transformers.js in the browser (onnxruntime-web); no CUDA needed.
- **Scope:** `.npmrc`, this note. Nothing else.
- **Verification:** CI `npm ci` + test + lint + build green on the PR; Vercel preview green; after
  merge, production deploy green.
- **Rollback:** revert the commit (installs fail again).
