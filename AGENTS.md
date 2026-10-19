<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-ai-workflow -->

# Project AI workflow

This is a personal learning product. Prefer a small, complete change over a broad rewrite.

## Required reading

Before editing, read the files that own the behavior plus:
- `docs/ARCHITECTURE.md` for data boundaries.
- `docs/AI-WORKFLOW.md` for the delivery and review sequence.
- `.claude/skills/ponytail/SKILL.md` for coding changes.
- `.claude/skills/ui-ux-pro-max/SKILL.md` for any visible or interactive change.

## Working rules

1. Trace the real user flow and storage path before editing.
2. Reuse current helpers, tokens, and components. Do not add a dependency when platform code is enough.
3. Public-browser Done/streak is self-reported habit data. Server-reviewed attempts and CEFR evidence are separate and must never be presented as equivalent.
4. Mobile, keyboard access, visible focus, reduced motion, clear labels, and a 44px touch target are release requirements.
5. Run `npm run lint` and `npm run build` after code changes. For an interaction, verify the full production flow in a browser.
6. Review the connected code, not only the diff. Use the Ponytail review format for findings and fix must-fix items before shipping.
7. Never commit secrets, private answers, audio, or personal feedback.

<!-- END:project-ai-workflow -->
