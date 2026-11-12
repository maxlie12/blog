import assert from "node:assert/strict";
import test from "node:test";
import { emptyLabStore, withLessonResult, withTestResult } from "./listeningLab.ts";
import { SITUATIONS, emptySpeakRecord, parseSpeakStore, withSpeakResult } from "./speakingRoom.ts";
import {
  COACH_INSTRUCTIONS, PLAN_MAX_CHARS, buildStudyBrief, parsePlans, planFor, previousPlan, summarizeListening,
  summarizeSpeaking, weakestPart, withPlan, type StudyBriefData,
} from "./studyBrief.ts";

const base: StudyBriefData = {
  date: "2026-11-12",
  streak: 4,
  totalDone: 37,
  week: { activeDays: 5, doneCount: 9, reviewCount: 3, skills: { listening: 4, reading: 1, writing: 2, speaking: 2 } },
  dueDailyReviews: 2,
  nextDaily: "Daily 2026-11-12",
  listening: {
    done: 3,
    total: 18,
    parts: { listen: 0.78, read: 0.7, write: 0.85, speak: 0.66 },
    lastLesson: { title: "At the Coffee Shop", score: 88, date: "2026-11-12" },
    lastTest: { score: 7, total: 10, date: "2026-11-12", level: "Dễ" },
  },
  speaking: { ready: 1, almost: 1, practice: 0, total: 9, due: ["Gọi đồ ở quán cà phê"], next: "Hỏi đường" },
  previousPlan: { date: "2026-11-11", text: "1. Phòng nghe bài 2 (15 phút)\n2. Phòng nói: Hỏi đường (10 phút)" },
};

test("weakest part ignores missing scores", () => {
  assert.equal(weakestPart({ listen: 0.9, read: 0.7, write: null, speak: 0.75 }), "read");
  assert.equal(weakestPart({ listen: null, read: null, write: null, speak: null }), null);
});

test("a full brief carries every section, the previous plan and the coach tasks — and no name", () => {
  const brief = buildStudyBrief(base);
  for (const expected of [
    "PHIẾU HỌC TIẾNG ANH — 2026-11-12",
    "7 ngày qua: 5/7 ngày có học · 9 lượt Done · 3 lượt ôn · theo kỹ năng: Nghe 4, Đọc 1, Viết 2, Nói 2",
    "Chuỗi ngày học: 4 ngày liên tiếp · tổng 37 lần Done",
    "Daily: 2 bài đến hạn ôn · bài tiếp theo: Daily 2026-11-12",
    "Phòng nghe: 3/18 bài xong đủ 4 phần. Điểm trung bình: Nghe 78% · Đọc 70% · Viết 85% · Nói 66% (yếu nhất: Nói)",
    "Bài gần nhất: At the Coffee Shop — 88% (2026-11-12)",
    "Đề luyện gần nhất: 7/10 (2026-11-12, mức Dễ)",
    "Nói được 1 · Gần được 1 · Cần luyện 0 · Chưa luyện 7",
    "Đến hạn ôn: Gọi đồ ở quán cà phê",
    "KẾ HOẠCH LẦN TRƯỚC (bạn giao ngày 2026-11-11):\n1. Phòng nghe bài 2 (15 phút)",
    "KẾ HOẠCH HÔM NAY 20–30 phút",
    "5 câu kiểm tra nhanh",
  ]) assert.ok(brief.includes(expected), `missing: ${expected}`);
  assert.ok(!/hồ sơ|@/.test(brief), "no profile name or email");
});

test("an empty start says so instead of inventing numbers", () => {
  const brief = buildStudyBrief({
    ...base,
    streak: 0, totalDone: 0, dueDailyReviews: 0, nextDaily: null,
    listening: summarizeListening(emptyLabStore(), 18),
    speaking: summarizeSpeaking(parseSpeakStore(null), "2026-11-12"),
    previousPlan: null,
  });
  assert.ok(brief.includes("Điểm trung bình: Nghe chưa có · Đọc chưa có · Viết chưa có · Nói chưa có"));
  assert.ok(brief.includes("Chưa làm bài nào ở Phòng nghe."));
  assert.ok(brief.includes("Chưa làm đề luyện nào."));
  assert.ok(brief.includes("Chưa luyện 9"));
  assert.ok(brief.includes("KẾ HOẠCH LẦN TRƯỚC: chưa có"));
  assert.ok(!brief.includes("yếu nhất"));
});

test("summaries read the real listening and speaking stores", () => {
  let lab = withLessonResult(emptyLabStore(), "e1-coffee-shop", { listen: 1, read: 0.5, write: 1, speak: 1 }, "2026-11-10");
  lab = withLessonResult(lab, "e2-directions", { listen: 0.5, read: null, write: null, speak: null }, "2026-11-12");
  lab = withTestResult(lab, { date: "2026-11-12", score: 6, total: 10, minutes: 9, level: "easy" });
  const listening = summarizeListening(lab, 18);
  assert.equal(listening.done, 1);
  assert.deepEqual(listening.parts, { listen: 0.75, read: 0.5, write: 1, speak: 1 });
  assert.equal(listening.lastLesson?.date, "2026-11-12");
  assert.equal(listening.lastTest?.level, "Dễ");

  const s = SITUATIONS[0];
  const speak = withSpeakResult(parseSpeakStore(null), s, { ...emptySpeakRecord("2026-11-01"), chunks: 1, cases: Object.fromEntries(s.cases.map((c) => [c.id, 1])) });
  const speaking = summarizeSpeaking(speak, "2026-11-12");
  assert.equal(speaking.ready, 1);
  assert.deepEqual(speaking.due, [s.titleVi]);
  assert.equal(speaking.next, null, "a due review is the next step; no extra suggestion");
});

test("plans: one per day, newest first, kept 7 days, capped, removable; bad data reads empty", () => {
  assert.deepEqual(parsePlans("{oops"), []);
  assert.deepEqual(parsePlans(JSON.stringify([{ date: "x", text: "a" }, { date: "2026-11-01", text: "  " }])), []);
  let plans = withPlan([], "2026-11-11", "  Plan A  ");
  plans = withPlan(plans, "2026-11-12", "Plan B");
  plans = withPlan(plans, "2026-11-12", "Plan B2");
  assert.deepEqual(plans.map((p) => p.text), ["Plan B2", "Plan A"]);
  assert.equal(planFor(plans, "2026-11-12")?.text, "Plan B2");
  assert.equal(previousPlan(plans, "2026-11-12")?.text, "Plan A");
  assert.equal(previousPlan(plans, "2026-11-13")?.text, "Plan B2");
  for (let day = 1; day <= 9; day++) plans = withPlan(plans, `2026-10-0${day}`, `old ${day}`);
  assert.equal(plans.length, 7);
  assert.equal(plans[0].date, "2026-11-12");
  assert.equal(withPlan([], "2026-11-12", "x".repeat(PLAN_MAX_CHARS + 50))[0].text.length, PLAN_MAX_CHARS);
  assert.deepEqual(withPlan(plans, "2026-11-12", "").find((p) => p.date === "2026-11-12"), undefined);
  assert.deepEqual(parsePlans(JSON.stringify(plans)), plans);
  const long = buildStudyBrief({ ...base, previousPlan: { date: "2026-11-11", text: "y".repeat(2000) } });
  assert.ok(long.includes(`${"y".repeat(1200)}…`) && !long.includes("y".repeat(1201)));
});

test("coach instructions name the app's sections and forbid CEFR claims", () => {
  for (const word of ["Daily", "Phòng nghe", "Phòng nói", "KẾ HOẠCH HÔM NAY", "CEFR"]) assert.ok(COACH_INSTRUCTIONS.includes(word), word);
});
