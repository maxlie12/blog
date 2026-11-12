# ASSESS-002 — Speaking retry feedback (small slice)

Date: 2026-11-12. Baseline: `eb9f9a62020fff032022e5bbfd56323eac64057b`. Existing `SpeakingRecorder` already supports microphone recording, local playback, and optional on-device speech-to-text. No new recorder, service, model or dependency.

## PM and BA — acceptance
- Learner hears the model, records and replays on their device where supported, or can use the self-practice guide without microphone permission.
- Learner opens **Xem gợi ý luyện lại**. Without transcript: three self-review prompts and one specific next step. With on-device transcript: words which ASR may have missed and a suggested fragment to repeat.
- Speech-to-text overlap is **not a pronunciation score**. No claims of phoneme/intonation accuracy, CEFR or automatic pass/fail.
- **Luyện lại câu này** clears the previous recorder session and transcript, increments an ephemeral attempt counter, and leaves the stored self-rating unchanged until explicitly reselected.
- No audio/transcript upload or new persisted data, no changes to previous score schema or lesson Done logic. Existing recorder's 'download' feature stays accessible.
- Unsupported microphone/transcription remains optional and visible, not a blocker.

## Architect and Dev
- Pure `speakingRetryFeedback(expected, transcript)` helper in listeningLab for stable checks; lightweight `SpeakLine` UI and reset via existing recorder component remount.
- No new packages, schema or model. Rollback = revert PR; scores/keys remain readable.

## Test and QA
- Unit: null/blank transcript, missing word, all-words-recognized, no invented pronunciation grade.
- Chromium + WebKit at 390/320px: existing English/Chinese save/reload/Done/recall; Listening Lab Writing rubric; Speaking guide visible without microphone, retry counter changes and no automatic scoring.
- Real iPhone/Safari microphone permissions, recording quality and model accuracy **NOT VERIFIED**, require manual hardware testing. Test uses synthetic profiles only.
- CI unit/integration, lint, production build, browser E2E plus Vercel preview exact SHA all pass before release.
