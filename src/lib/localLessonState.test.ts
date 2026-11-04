import assert from "node:assert/strict";
import test from "node:test";
import { chooseDailyDate, dailyLessonDate, localLessonStatus } from "./localLessonState.ts";

const packets = [
  { date: "2026-11-03", lessons: [{ id: "old", language: "en" }] },
  { date: "2026-11-04", lessons: [{ id: "today", language: "en" }] },
];
test("Done takes precedence over a retained draft", () => {
  assert.equal(localLessonStatus("old", new Set(["old"]), new Set(["old"])), "done");
  assert.equal(localLessonStatus("old", new Set(), new Set(["old"])), "draft");
  assert.equal(localLessonStatus("old", new Set(), new Set()), "new");
});
test("Daily resumes unfinished work, otherwise offers newest unfinished packet", () => {
  assert.equal(chooseDailyDate(packets, new Set(), new Set(["old"])), "2026-11-03");
  assert.equal(chooseDailyDate(packets, new Set(["old"]), new Set(["old"])), "2026-11-04");
  assert.equal(chooseDailyDate(packets, new Set(["today"]), new Set()), "2026-11-03");
  assert.equal(chooseDailyDate([], new Set(), new Set()), "");
});
test("Daily links derive their packet date only from Daily IDs", () => {
  assert.equal(dailyLessonDate("daily-2026-11-04-en-reading"), "2026-11-04");
  assert.equal(dailyLessonDate("level-en-b1-reading"), null);
});
