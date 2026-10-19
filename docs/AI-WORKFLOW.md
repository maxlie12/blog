# AI-assisted engineering workflow

This repository vendors two MIT-licensed skill sets so Claude Code and other agents can work from the same rules instead of inventing a new process in every session.

## Installed sources

| Skill | Purpose | Pinned upstream commit |
|---|---|---|
| Ponytail | Smallest complete solution, code review, audit, debt and impact helpers | `09c434ab73ca43761c5d8b0c5d341926c2fba710` |
| UI/UX Pro Max | Searchable UI/UX, accessibility and stack guidance | `56ea9cf174ed86786187daa9de0e6247cb0747e4` |

Upstream:
- https://github.com/DietrichGebert/ponytail
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Both are MIT licensed. Their licenses are copied into the relevant skill folders. The files are vendored and pinned; updates must be reviewed as code changes, never pulled automatically during a build.

## Delivery loop

1. **Define evidence.** State the user problem and the visible result that proves it is solved.
2. **Trace the flow.** Read the page, component, storage helper, callers, and relevant architecture note.
3. **Choose the smallest complete change.** Apply Ponytail: reuse existing code, native browser features, and current dependencies.
4. **Design before polish.** For visible work, query UI/UX Pro Max for the outcome and detected stack. Accessibility and touch behavior come before decoration.
5. **Implement one vertical slice.** Make the core path work end to end before adding optional animation or game features.
6. **Verify locally.** Run `npm run lint` and `npm run build`. Add one focused test for non-trivial logic.
7. **Review connected code.** Use the Ponytail review format: correctness, safety/privacy, real load, test gap, performance, then lean code.
8. **Verify production.** Test the actual deployed route on mobile-sized and desktop-sized viewports. Confirm persistence after refresh when storage is involved.
9. **Document the boundary.** Update architecture/decision docs when a data meaning changes.

## UI/UX commands

From the repository root:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "personal language learning calm playful" --design-system -p "Maxlie Learning"
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "completion feedback streak mobile" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form progress responsive touch" --stack nextjs
```

Do not use `--persist --force` unless the owner explicitly approves replacing an existing design system.

## Product-specific review gates

- A lesson must expose one primary next action.
- Draft, Done, reviewed, and CEFR evidence must have different labels.
- One calendar day can extend a streak only once per language.
- Completing old content counts on the real completion date, not the lesson publication date.
- Local browser data must say that it is device-specific.
- ChatGPT feedback is optional; the site itself must be able to save a Done state.
- Motion must explain progress, respect `prefers-reduced-motion`, and never block the lesson.
