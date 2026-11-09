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

test("the newest daily packet comes first, listening before writing on the same day", () => {
  const daily = [
    lesson("daily-2026-10-10-en-listening", "en", "B1+ practice"),
    { ...lesson("daily-2026-10-28-en-writing", "en", "B1+ restart"), skill: "writing" as const },
    lesson("daily-2026-10-28-en-listening", "en", "B1+ restart"),
  ];
  assert.equal(selectNextLesson(daily, "luan", new Set(), new Set())?.lesson.id, "daily-2026-10-28-en-listening");
  assert.equal(
    selectNextLesson(daily, "luan", new Set(["daily-2026-10-28-en-listening"]), new Set())?.lesson.id,
    "daily-2026-10-28-en-writing",
  );
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

test("due review wins over new lessons while an unfinished draft remains first", () => {
  const completed = new Set(["daily-2026-10-10-en-listening"]);
  const due = [{
    lessonId: "daily-2026-10-10-en-listening",
    interval: 1 as const,
    dueDate: "2026-10-11",
    isDue: true,
  }];

  const next = selectNextLesson(lessons, "luan", completed, new Set(), due);
  assert.equal(next?.reason, "due-review");
  assert.equal(next?.lesson.id, "daily-2026-10-10-en-listening");

  const review = selectNextLesson(lessons, "luan", new Set(lessons.map((item) => item.id)), new Set(), due);
  assert.equal(review?.reason, "due-review");
  assert.equal(review?.lesson.id, "daily-2026-10-10-en-listening");

  const resume = selectNextLesson(lessons, "luan", completed, new Set(["level-en-b2-listening"]), due);
  assert.equal(resume?.reason, "resume");
  assert.equal(resume?.lesson.id, "level-en-b2-listening");
});

test("due selection ignores future, missing and uncompleted records and sorts oldest first", () => {
  const completed = new Set(lessons.slice(0, 2).map(l => l.id));
  const due = [
    { lessonId: lessons[0].id, interval: 1 as const, dueDate: "2026-11-02", isDue: true },
    { lessonId: lessons[1].id, interval: 3 as const, dueDate: "2026-11-01", isDue: true },
    { lessonId: lessons[2].id, interval: 1 as const, dueDate: "2026-10-01", isDue: true },
    { lessonId: "missing", interval: 1 as const, dueDate: "2026-10-01", isDue: true },
  ];
  assert.equal(selectNextLesson(lessons, "luan", completed, new Set(), due)?.lesson.id, lessons[1].id);
  assert.equal(selectNextLesson(lessons, "luan", completed, new Set(), due.map(r => ({ ...r, isDue: false })))?.reason, "next");
});

test("Chinese one-tap recommendation uses the same draft/due/new priorities independent of English", () => {
  const chinese = [
    lesson("daily-2026-11-09-zh-listening", "zh", "Beginner"),
    lesson("daily-2026-11-08-zh-listening", "zh", "Beginner"),
  ];
  const completed = new Set(["daily-2026-11-08-zh-listening"]);
  const due = [{ lessonId: "daily-2026-11-08-zh-listening", interval: 1 as const, dueDate: "2026-11-09", isDue: true }];
  assert.equal(selectNextLesson(chinese, "luan", completed, new Set(), due)?.reason, "due-review");
  assert.equal(selectNextLesson(chinese, "luan", completed, new Set(["daily-2026-11-09-zh-listening"]), due)?.reason, "resume");
  assert.equal(selectNextLesson(chinese, "luan", completed, new Set(), [])?.lesson.id, "daily-2026-11-09-zh-listening");
});

test("English subset stays available when the main recommendation is a due Chinese lesson", () => {
  const zh = lessons.find(l => l.language === "zh")!;
  const due = [{ lessonId: zh.id, interval: 1 as const, dueDate: "2026-11-01", isDue: true }];
  const completed = new Set([zh.id]);
  assert.equal(selectNextLesson(lessons, "luan", completed, new Set(), due)?.lesson.language, "zh");
  const english = selectNextLesson(lessons.filter(l => l.language === "en"), "luan", completed, new Set(), due);
  assert.equal(english?.lesson.language, "en");
  assert.equal(english?.reason, "next");
});
