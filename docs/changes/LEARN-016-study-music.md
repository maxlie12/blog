# LEARN-016 · Optional study music

Local preview only; do not push or deploy before owner review.

Release approval: owner explicitly requested pushing the reviewed changes on 2026-11-06. Browser/real-microphone limitations below remain open.

Scope: new StudyMusic.tsx and CSS module; PublicChrome.tsx mounts a persistent public-page control except game/studio routes; reuse cozyMusic.ts unchanged. SpeakingRecorder.tsx and ConversationPractice.tsx emit a pause request before microphone/TTS so background music cannot compete. No lesson/progress/account changes.

Three synthesized instrumental moods using the existing engine, no external tracks or copyright downloads. Explicit play only; remember volume/mood but never autoplay. Stop on tab hide/navigation/unmount, native media play, microphone or TTS start. Visible toggle, volume and keyboard focus, 44px targets. Verify lint/tests/build plus phone viewport and microphone flow where browser access permits; do not claim real-device mic validation with a fake input.

Also allowed: src/lib/studyMusicSettings.ts and direct test for malformed browser preferences, volume clamping and valid mood selection.

Phone review also allows ConversationPractice.module.css: constrain the native audio player within narrow cards and keep its touch height at least 44px.

Verification: ESLint, 86 tests and final clean production build passed. Browser attempt could not reach local server (ERR_CONNECTION_REFUSED); phone visual and real microphone tests remain blocked. Native audio width was constrained during code review, not claimed as visually verified. No push/deploy.
