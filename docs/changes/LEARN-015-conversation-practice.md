# LEARN-015 · Conversation-first pilot

Status: local implementation only; owner review before push or deployment.

Release approval: owner explicitly requested pushing the reviewed pilot on 2026-11-06. Mobile/microphone verification limitations below remain disclosed.

## Outcome
Learning opens with an English/Chinese practical scenario, not an exam or a link catalog. A complete practice loop connects initial speaking, listening/reading support, changed-role retry, a short written message and one self-selected repair.

## Scope
- `src/lib/conversationPractice.ts`, direct test: two authored language scenarios, validated browser-local drafts and completion conditions.
- `src/components/ConversationPractice.tsx`, matching CSS module: home entry, guided turns, hints, audio fallback, writing, reflection and save feedback.
- `src/app/learning/page.tsx`, `src/app/learning/conversation/page.tsx`: entry and scenario route; keep Daily, blog and legacy drafts available.
- `src/components/SpeakingRecorder.tsx`: stop microphone and release temporary audio URLs on exit.
- This brief: boundaries, evidence and follow-up.

## Boundaries
No API keys, paid provider, hosted AI agent, third-party skill installation, avatar generator, proficiency score or audio upload. Existing repo engineering/design guidance is sufficient for this pilot; agent skills guide implementation and are not runtime AI functionality. Turns are explicitly scripted, not an intelligent conversational partner. External voice tools can use an optional copied roleplay brief, with manual user action only.

Keep old learning data untouched. Private responses stay in profile-local browser storage; display this limitation. Save each edit with explicit error feedback, allow editing after Done without duplicate completion, and do not prune prior drafts automatically. Native-speaker resources and synthetic device audio must be labelled separately. A self-reported spoken/listened checkbox is practice evidence only, not scored evidence.

## Verification
Focused validation/storage/completion tests, full tests, lint, build, browser/mobile only when supported. No push/deploy in this stage. No edits to the pending user-requested reading packet.

## Local verification result
- 85 tests passed, including three new draft isolation/history/completion tests.
- ESLint and TypeScript passed; production build passed after moving the broken Turbopack cache aside (no source workaround).
- Browser/mobile, microphone permissions and device speech voices have not been exercised. This is a local pilot, not a production-ready live AI tutor.
- Session completion is recorded in its own browser-local history, not silently converted into a proficiency score or the legacy global streak. Audio is temporary and must be downloaded manually to keep it.
- No new dependencies, provider accounts, skill installations, push or deployment. Existing implementation/design guidance was reused.
