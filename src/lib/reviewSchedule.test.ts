import assert from "node:assert/strict";
import test from "node:test";
import { dueReviews, nextScheduledReview, reviewCompletionId } from "./reviewSchedule.ts";

test("schedules 1, 3, 7 and 14 days from the last explicit review", () => {
  const history = [
    { id: "lesson:lesson-en", lessonId: "lesson-en", date: "2026-10-01" },
    { id: reviewCompletionId("lesson-en", 1), lessonId: "lesson-en", date: "2026-10-02" },
    { id: reviewCompletionId("lesson-en", 3), lessonId: "lesson-en", date: "2026-10-05" },
  ];

  assert.deepEqual(nextScheduledReview(history, "lesson-en", "2026-10-11"), {
    lessonId: "lesson-en",
    interval: 7,
    dueDate: "2026-10-12",
    isDue: false,
  });
  assert.equal(nextScheduledReview(history, "lesson-en", "2026-10-12")?.isDue, true);
});

test("returns every lesson due after multiple completions on one day", () => {
  const history = [
    { id: "lesson:lesson-a", lessonId: "lesson-a", date: "2026-10-10" },
    { id: "lesson:lesson-b", lessonId: "lesson-b", date: "2026-10-10" },
  ];

  assert.deepEqual(dueReviews(history, "2026-10-11").map((item) => item.lessonId), ["lesson-a", "lesson-b"]);
});

test("does not schedule arbitrary activity records as lessons", () => {
  const history = [{ id: "guided:one", lessonId: "guided-practice", date: "2026-10-10" }];
  assert.deepEqual(dueReviews(history, "2026-10-20"), []);
});
