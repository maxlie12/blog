# LEARN-016 — Learning entry and motion

Status: active · baseline `394dde72` · local review only

Learners should see the next short action on Learning before the longer listening lab.
Given a suggested lesson, its existing CTA opens the same lesson as before; the archive
and listening lab stay accessible. Android/iOS and keyboard users must be able to use
the same controls. Reduced motion must remove the new animations.

Allowed files: `src/app/learning/page.tsx` for hierarchy, `src/components/StartLearning.tsx`
for Daily presentation, and `src/app/learning/dashboard.module.css` for route-only styles.
Do not change selection, guest storage, lesson content, Done, streak, routes or dependencies.

Check tests, lint, build, and mobile keyboard/reduced motion behavior before release.
No push or production deploy before review.

Local results: 151 tests, lint, and production build passed. The production build,
served with a fresh local SQLite database, returned HTTP 200 on Learning, Daily and
Listening. The HTML placed Daily before Listening and exposed the archive link;
the served CSS contained the touch-target, focus and reduced-motion rules.
Browser QA is blocked here because Chromium could not open a local socket. Mobile
layout, keyboard interaction and reduced-motion behavior still need browser verification.
