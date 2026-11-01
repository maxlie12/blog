import assert from "node:assert/strict";
import test from "node:test";
import { pathSteps, todaySteps } from "./studyPath.ts";

const topic = { slug: "a", title: "A", lessonId: "daily-1", words: ["one", "two"] };
const doneIds = (steps: ReturnType<typeof pathSteps>) => steps.filter((step) => step.done).map((step) => step.id);

test("a new topic has four open steps", () => {
  const steps = pathSteps(topic, [], [], new Set());
  assert.deepEqual(steps.map((step) => step.id), ["read", "words", "speak", "lesson"]);
  assert.deepEqual(doneIds(steps), []);
});

test("the words step needs every word of the topic", () => {
  assert.deepEqual(doneIds(pathSteps(topic, ["one"], [], new Set())), []);
  assert.deepEqual(doneIds(pathSteps(topic, ["one", "two", "other"], [], new Set())), ["words"]);
});

test("marks belong to one topic and the lesson step reads Done", () => {
  assert.deepEqual(doneIds(pathSteps(topic, [], ["b:read", "a:speak"], new Set(["daily-1"]))), ["speak", "lesson"]);
});

test("a topic without a lesson has no lesson step", () => {
  assert.deepEqual(pathSteps({ ...topic, lessonId: undefined }, [], [], new Set()).map((step) => step.id), ["read", "words", "speak"]);
});

test("today marks optional lessons from the title and reads Done", () => {
  const lessons = [
    { id: "a", title: "Nhiệm vụ chính 5 phút — nghe", skill: "listening" as const, language: "en" },
    { id: "b", title: "Tùy chọn 5 phút — nói", skill: "speaking" as const, language: "zh" },
    { id: "c", title: "Blog Seed tùy chọn — viết", skill: "writing" as const, language: "en" },
  ];
  assert.deepEqual(todaySteps(lessons, new Set(["b"])).map(({ optional, done }) => [optional, done]), [[false, false], [true, true], [true, false]]);
});
