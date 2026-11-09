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

test("adaptive intervals reset, hold, advance and cap; immediate recall does not advance", async () => {
  const { recallInterval } = await import("./reviewSchedule.ts");
  assert.equal(recallInterval(7, "again", true), 1);
  assert.equal(recallInterval(7, "hard", true), 7);
  assert.equal(recallInterval(7, "remembered", true), 14);
  assert.equal(recallInterval(14, "remembered", true), 14);
  assert.equal(recallInterval(1, "remembered", false), 1);
});

test("latest recall survives reordered history and determines due date", async () => {
  const { recallCompletionId } = await import("./reviewSchedule.ts");
  const original = { id: "lesson:a", lessonId: "a", date: "2026-11-01" };
  const older = { id: recallCompletionId("remembered", 7), lessonId: "a", date: "2026-11-02", completedAt: "2026-11-02T01:00:00Z" };
  const latest = { id: recallCompletionId("again", 1), lessonId: "a", date: "2026-11-03", completedAt: "2026-11-03T01:00:00Z" };
  for (const history of [[original, older, latest], [latest, original, older]]) {
    assert.deepEqual(nextScheduledReview(history, "a", "2026-11-04"), {
      lessonId: "a", interval: 1, dueDate: "2026-11-04", isDue: true,
      lastRecall: { rating: "again", date: "2026-11-03" },
    });
  }
});

test("legacy final milestone continues at fourteen days", () => {
  const history = [{ id: "lesson:a", lessonId: "a", date: "2026-10-01" },
    ...[1, 3, 7, 14].map(interval => ({ id: `review:${interval}:a`, lessonId: "a", date: "2026-10-20" }))];
  assert.equal(nextScheduledReview(history, "a", "2026-11-03")?.dueDate, "2026-11-03");
});

test("same-day merged recalls use a deterministic latest timestamp and malformed IDs are ignored", async () => {
  const { recallCompletionId } = await import("./reviewSchedule.ts");
  const original = { id: "lesson:a", lessonId: "a", date: "2026-11-01" };
  const early = { id: recallCompletionId("remembered", 3), lessonId: "a", date: "2026-11-02", completedAt: "2026-11-02T01:00:00.000Z" };
  const late = { id: recallCompletionId("again", 1), lessonId: "a", date: "2026-11-02", completedAt: "2026-11-02T02:00:00.000Z" };
  const invalid = { id: "review:recall:again:99:invalid", lessonId: "a", date: "2026-11-09" };
  assert.deepEqual(nextScheduledReview([original, late, invalid, early], "a", "2026-11-02"), nextScheduledReview([early, late, original], "a", "2026-11-02"));
  assert.equal(nextScheduledReview([original, late, invalid, early], "a", "2026-11-02")?.dueDate, "2026-11-03");
});
