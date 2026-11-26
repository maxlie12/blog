import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { dailySummaries, getDailyLabLessons, parseDailyLabLesson } from "./labDaily.ts";
import { labLesson, todayDaily } from "./listeningLab.ts";

const dir = path.join(process.cwd(), "content/listening-lab");

test("every published daily Phòng nghe lesson is valid, unique and not a fixed lesson id", async () => {
  const lessons = await getDailyLabLessons(dir);
  assert.ok(lessons.length >= 1);
  assert.equal(new Set(lessons.map((l) => l.id)).size, lessons.length);
  for (const lesson of lessons) assert.equal(labLesson(lesson.id), null, lesson.id);
  assert.deepEqual(lessons.map((l) => l.date), [...lessons.map((l) => l.date)].sort().reverse(), "newest first");
});

test("bad files are rejected with a reason", async () => {
  const good = JSON.parse(await readFile(path.join(dir, "2026-11-26.json"), "utf8"));
  assert.throws(() => parseDailyLabLesson(good, "2026-11-27.json"), /file name/);
  assert.throws(() => parseDailyLabLesson({ ...good, id: "d-2026-11-25" }, "2026-11-26.json"), /id must be/);
  assert.throws(() => parseDailyLabLesson({ ...good, dictation: [3, 40] }, "2026-11-26.json"), /outside the transcript/);
  assert.throws(() => parseDailyLabLesson({ ...good, listening: [{ ...good.listening[0], a: ["A", "a", "B", "C"] }, ...good.listening.slice(1)] }, "2026-11-26.json"), /must differ/);
  assert.throws(() => parseDailyLabLesson({ ...good, answerKey: "x" }, "2026-11-26.json"));
  assert.throws(() => parseDailyLabLesson({ ...good, level: "B1" }, "2026-11-26.json"));
});

test("today's lesson is the newest one dated on or before today", () => {
  const list = dailySummaries([
    { date: "2026-11-27", id: "d-2026-11-27" }, { date: "2026-11-26", id: "d-2026-11-26" }, { date: "2026-11-20", id: "d-2026-11-20" },
  ].map((x) => ({ ...x, title: "t", titleVi: "v", level: "easy", minutes: 10 })) as never);
  assert.equal(todayDaily(list, "2026-11-26")?.id, "d-2026-11-26");
  assert.equal(todayDaily(list, "2026-11-25")?.id, "d-2026-11-20");
  assert.equal(todayDaily(list, "2026-11-19"), null);
  assert.equal(todayDaily([], "2026-11-26"), null);
});
