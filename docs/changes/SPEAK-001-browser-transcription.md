# SPEAK-001 — on-device speaking transcription

## Identity

- **Issue:** `SPEAK-001`
- **Status:** verified locally
- **Owner:** Claude
- **Date:** 2026-10-29

## User-visible problem

After recording a speaking answer, the learner must retype everything they said into the
transcript field. On a phone this is slow, and the typed transcript often drifts from what was
actually said.

## Completion evidence

- On a speaking lesson, after recording, the learner can press one optional button
  ("Chép lời trên máy") that fills the transcript field with a draft of what they said.
- The draft is editable and is not submitted automatically; the learner still presses
  "Submit attempt". Nothing about review status, Done, streak or level changes.
- Audio never leaves the device: no request carries audio or the transcript beyond the existing
  attempt submission. The only new network request is the one-time model download.
- Before the first download the button states the approximate size; the model is cached by the
  browser afterwards. Progress and failure are announced (`aria-live`), and failure leaves the
  typed transcript path working exactly as today.
- Transcription runs off the main thread, so the page stays responsive on mobile.
- English, Chinese and Japanese lessons pass the lesson language to the model.

## Scope

### Read

- `docs/ARCHITECTURE.md` (attempt/speaking section), `docs/DECISIONS.md` (no audio upload)
- `src/components/AttemptSubmitForm.tsx` (`SpeakingRecorder`, transcript textarea)
- `src/lib/languages.ts` (language ids `en`, `zh`, `ja`)
- `node_modules/next/dist/docs/` guide for client-only modules/workers before coding

### May edit

- `src/components/AttemptSubmitForm.tsx` — pass the recording to transcription and fill the
  transcript textarea.
- `src/lib/transcribeWorker.ts` (new) — Web Worker that lazy-loads the model and returns text.
- `src/lib/transcribe.ts` (new) — message types shared by the form and the worker, so the
  client component does not import the worker module.
- `package.json`, `package-lock.json` — add `@huggingface/transformers` (see Constraints).
- Component styles for the new button/progress only.
- `docs/ARCHITECTURE.md` — the line saying a speaking transcript is always typed.
- `docs/ISSUES.md`, this brief — status and evidence.

### Must not edit

- `src/app/learning/attemptActions.ts`, Prisma schema, sync/habit API — the submitted payload is
  unchanged.
- `localLearningProgress`, Done/streak, review or CEFR logic.
- FEEDBACK-001 (AI feedback) — separate, still blocked.

## Constraints

- Audio and transcripts are never sent to Hugging Face or any server; inference is in-browser.
- New dependency is justified: the platform has no reliable speech-to-text (Web Speech API is
  missing in Firefox, sends audio to Google in Chrome, and does not take recorded audio).
  Import it only inside the worker, loaded on first click, so it adds nothing to page load.
- Model: multilingual Whisper tiny/base (ONNX, quantized). Pick the smallest that gives a usable
  draft for zh/ja in the browser check; record the size here.
- The AI draft is labelled as a draft to check, not as correction or evidence.
- One primary action stays "Submit attempt"; the new button is secondary, 44px, keyboard
  reachable, visible focus; no motion beyond a progress indicator that respects reduced motion.

## Plan

1. Keep the recorded `Blob` in `SpeakingRecorder` and expose it to the form.
2. Worker: decode to 16 kHz mono `Float32Array` on the main thread (`AudioContext`), post to the
   worker, run `automatic-speech-recognition` with `language` from the lesson, return text.
3. Fill the controlled transcript textarea with the result; never overwrite non-empty text
   without the learner choosing to (append or confirm).
4. Lint, build, then verify in a real browser on a speaking lesson in each language, including
   offline/failed download and a narrow mobile viewport.

## Verification

- [x] `npm run lint`
- [x] `npm run build`, and confirm the transformers chunk is not in the initial lesson page load
- [ ] Browser: record → transcribe → edit → submit, en/zh/ja speaking lesson
- [x] DevTools network: no request contains audio; only model files are fetched, once
- [ ] Download failure / unsupported browser leaves manual typing working
- [ ] Mobile width, keyboard-only, reduced motion

## Result

- **Files changed:** `src/components/AttemptSubmitForm.tsx`, `src/lib/transcribeWorker.ts`,
  `src/lib/transcribe.ts`, `package.json`, `package-lock.json`, `docs/ARCHITECTURE.md`,
  `docs/ISSUES.md`, this brief.
- **Model:** `onnx-community/whisper-base`, q8 — encoder 23.2MB + decoder 53.7MB, plus the
  ~20MB onnxruntime WASM from jsDelivr: about 100MB on first use, then browser-cached.
- **Evidence (2026-10-29, local `next start`, Playwright Chromium 390×844, fake mic playing a
  synthesized English sentence on `daily-2026-10-24-en-speaking`):** first run including
  download took 61s; the draft "I think people should spend less time on their phones because
  it helps them sleep better…" was appended after the already-typed text and the textarea was
  focused; the button is 44px tall; zero non-GET requests; external hosts were only
  huggingface.co, its CDN and cdn.jsdelivr.net. Submit was not pressed (payload is unchanged).
  The transformers chunk (~870KB) loads only in the worker, not with the lesson page.
- **Commit/deployment:** not committed.
- **Not checked / remaining risk:** zh/ja accuracy with a real voice (no local zh/ja TTS voice);
  real phone memory/time and mobile data cost of the ~100MB download; Safari/Firefox;
  keyboard-only and reduced-motion pass. Turbopack also emits the worker's source as an unused
  `/_next/static/media/transcribeWorker.*.ts` asset — harmless (public repo code), left as is.
