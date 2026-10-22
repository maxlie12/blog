import assert from "node:assert/strict";
import test from "node:test";
import type { LessonSummary } from "./lessonTypes.ts";
import { selectNextLesson } from "./nextLesson.ts";

function lesson(id: string, language: string, level: string): LessonSummary {
  return {
    id,
    language,
    level,
    skill: "listening",
    title: id,
    instructions: "",
    material: null,
    exercises: null,
    completionCriteria: "",
    attemptCount: 0,
    reviewedCount: 0,
  };
}

const lessons = [
  lesson("daily-2026-10-10-en-listening", "en", "B1+ practice"),
  lesson("level-en-b1-listening", "en", "B1"),
  lesson("level-en-b2-listening", "en", "B2"),
  lesson("level-zh-beginner-listening", "zh", "Beginner"),
  lesson("level-ja-starter-listening", "ja", "Starter / A1"),
];

test("Luân gets current English practice before harder or secondary-language lessons", () => {
  const result = selectNextLesson(lessons, "luan", new Set(), new Set());
  assert.equal(result?.lesson.id, "daily-2026-10-10-en-listening");
  assert.equal(result?.reason, "next");
});

test("Phi starts with Japanese Starter", () => {
  assert.equal(selectNextLesson(lessons, "phi", new Set(), new Set())?.lesson.id, "level-ja-starter-listening");
});

test("an unfinished saved draft wins and Done lessons are skipped", () => {
  const result = selectNextLesson(
    lessons,
    "luan",
    new Set(["daily-2026-10-10-en-listening"]),
    new Set(["daily-2026-10-10-en-listening", "level-en-b2-listening"]),
  );
  assert.equal(result?.lesson.id, "level-en-b2-listening");
  assert.equal(result?.reason, "resume");
});

test("when everything is Done the selector offers a deterministic review", () => {
  const completed = new Set(lessons.map((item) => item.id));
  const result = selectNextLesson(lessons, "luan", completed, new Set());
  assert.equal(result?.lesson.id, "daily-2026-10-10-en-listening");
  assert.equal(result?.reason, "review");
});

test("a due review wins over a new lesson but not over an unfinished draft", () => {
  const completed = new Set(["daily-2026-10-10-en-listening"]);
  const due = [{
    lessonId: "daily-2026-10-10-en-listening",
    interval: 1 as const,
    dueDate: "2026-10-11",
    isDue: true,
  }];

  const review = selectNextLesson(lessons, "luan", completed, new Set(), due);
  assert.equal(review?.reason, "due-review");
  assert.equal(review?.lesson.id, "daily-2026-10-10-en-listening");

  const resume = selectNextLesson(lessons, "luan", completed, new Set(["level-en-b2-listening"]), due);
  assert.equal(resume?.reason, "resume");
  assert.equal(resume?.lesson.id, "level-en-b2-listening");
});
