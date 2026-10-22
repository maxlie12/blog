# Change brief

Copy this file to `docs/changes/<ISSUE-ID>-<short-name>.md` only when work is approved. A small
content-only edit may fill this template in the task description instead of creating a file.

## Identity

- **Issue:** `<ID from docs/ISSUES.md>`
- **Status:** `planned | active | blocked | verified`
- **Owner:**
- **Date:**

## User-visible problem

One observable problem. Do not describe the desired technology here.

## Completion evidence

What the learner can see or do when this is solved. Include persistence, privacy and mobile
behavior when relevant.

## Scope

### Read

- `<owning documentation>`
- `<entry component/module>`
- `<direct helper/caller/test>`

### May edit

- `<exact path or narrow glob>` — `<reason>`

### Must not edit

- `<unrelated subsystem>`

If another file becomes necessary, add it to **May edit** before changing it and record why.

## Constraints

- Done/streak is habit data, not proficiency evidence.
- Do not store private answers, audio, feedback or secrets in the public repository.
- Reuse current helpers/components and add no dependency unless the brief proves it necessary.
- Keep one primary action and a 44px touch target; respect reduced motion for visible changes.

Delete constraints that do not apply and add task-specific boundaries.

## Plan

1. Trace the named flow.
2. Implement the smallest vertical change.
3. Run focused tests, lint and build as required.
4. Review connected code and verify the real route.

## Verification

- [ ] Focused test or fixture check:
- [ ] `npm run lint` for code changes
- [ ] `npm run build` for code changes
- [ ] Mobile/keyboard/reduced-motion check for interaction changes
- [ ] Persistence after refresh for stored state
- [ ] Production route check after deployment

## Result

- **Files changed:**
- **Evidence:**
- **Commit/deployment:**
- **Not checked / remaining risk:**
