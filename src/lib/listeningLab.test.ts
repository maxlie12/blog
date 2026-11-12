import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, PART_EVIDENCE, WRITING_CHECKLIST, buildTest, compareDictation, drillLines, emptyLabStore, isComplete, labLesson, labLessons, labTotal,
  nextLabLesson, parseLabStore, withLessonResult, withTestResult, writeScore, writingCheck, writingRubric, type LabParts,
} from "./listeningLab.ts";

const done: LabParts = { listen: 1, read: 1, write: 1, speak: 1 };

test("every lesson is complete and its answers and line numbers are in range", () => {
  const ids = new Set<string>();
  for (const lesson of labLessons()) {
    assert.ok(!ids.has(lesson.id), `duplicate ${lesson.id}`);
    ids.add(lesson.id);
    assert.ok(LEVELS.some((level) => level.id === lesson.level));
    assert.ok(lesson.vocab.length >= 3 && lesson.transcript.length >= 6, lesson.id);
    assert.ok(lesson.listening.length >= 3 && lesson.reading.length >= 2, lesson.id);
    for (const item of [...lesson.listening, ...lesson.reading]) {
      assert.equal(item.a.length, 4, item.q);
      assert.ok(item.c >= 0 && item.c < 4 && item.why, item.q);
    }
    for (const line of [...lesson.dictation, ...lesson.speaking]) assert.ok(drillLines(lesson)[line], `${lesson.id} line ${line}`);
    if (lesson.audioUrl) {
      assert.match(lesson.audioUrl, /^https:\/\/voa-audio\.voanews\.eu\/vle\/.+\.mp3$/, lesson.id);
      assert.ok(lesson.sourceUrl?.startsWith("https://learningenglish.voanews.com/") && lesson.source, `${lesson.id} credits VOA`);
      assert.equal(lesson.textKind, "summary", `${lesson.id} reading text is our summary`);
    }
    assert.ok(lesson.write?.prompt && lesson.write.model, `${lesson.id} writing`);
  }
  for (const level of LEVELS) {
    assert.equal(labLessons(level.id).length, 6, level.id);
    assert.equal(labLessons(level.id).filter((lesson) => lesson.audioUrl).length, 2, `${level.id} VOA lessons`);
  }
  assert.deepEqual([...new Set(labLessons().map((lesson) => lesson.level))], ["easy", "medium", "hard"], "lessons run easy → hard");
  assert.equal(labLesson("nope"), null);
});

test("total weighs only the parts done", () => {
  assert.equal(labTotal({ listen: null, read: null, write: null, speak: null }), null);
  assert.equal(labTotal({ listen: 1, read: null, write: null, speak: null }), 100);
  assert.equal(labTotal({ listen: 1, read: 0, write: null, speak: null }), 58);
  assert.equal(labTotal(done), 100);
});

test("dictation forgives case, punctuation and a stray word", () => {
  assert.equal(compareDictation("Can I have a medium coffee, please?", "can i have a medium coffee please").score, 1);
  const result = compareDictation("Is that for here or to go?", "is that for hear or to go");
  assert.deepEqual(result.words.filter((w) => !w.ok).map((w) => w.w), ["here"]);
  assert.equal(compareDictation("Hello there", "").score, 0);
});

test("writing check counts sentences and lesson words; write score mixes dictation and checklist", () => {
  const lesson = labLesson("e1-coffee-shop")!;
  const check = writingCheck(lesson, "A medium tea, please. It is to go. Thanks");
  assert.equal(check.sentences, 2);
  assert.deepEqual(check.used, ["medium", "to go"]);
  assert.equal(writeScore(null, null), null);
  assert.equal(writeScore(0.5, null), 0.5);
  assert.equal(writeScore(null, WRITING_CHECKLIST.length), 1);
  assert.equal(writeScore(1, 0), 0.5);
});

test("a test is the same for the same day and uses two different lessons of its level", () => {
  for (const level of [undefined, ...LEVELS.map((item) => item.id)]) {
    for (const day of ["2026-11-12", "2026-11-13", "2027-01-01"]) {
      const a = buildTest(day, level);
      assert.deepEqual(a, buildTest(day, level));
      assert.equal(new Set(a.lessonIds).size, 2, `${day} ${level}`);
      if (level) for (const id of a.lessonIds) assert.equal(labLesson(id)!.level, level);
      assert.ok(a.questions.length >= 6 && a.dictations.length === 2);
      for (const q of a.questions) assert.ok(labLesson(q.lessonId)![q.kind][q.index], "question exists");
      for (const d of a.dictations) assert.ok(drillLines(labLesson(d.lessonId)!)[d.line]);
      assert.ok(drillLines(labLesson(a.speaking.lessonId)!)[a.speaking.line]);
    }
  }
});

test("store: best counts only full attempts, bad data reads as empty, next lesson moves on", () => {
  assert.deepEqual(parseLabStore("{oops"), emptyLabStore());
  assert.deepEqual(parseLabStore(JSON.stringify({ version: 2 })), emptyLabStore());
  let store = withLessonResult(emptyLabStore(), "e1-coffee-shop", { listen: 1, read: null, write: null, speak: null }, "2026-11-12");
  assert.equal(store.lessons["e1-coffee-shop"].best, 0);
  assert.equal(nextLabLesson(store).id, "e1-coffee-shop");
  store = withLessonResult(store, "e1-coffee-shop", done, "2026-11-12");
  assert.equal(store.lessons["e1-coffee-shop"].best, 100);
  assert.ok(isComplete(store.lessons["e1-coffee-shop"].parts));
  assert.equal(nextLabLesson(store).id, "e2-directions");
  store = withTestResult(store, { date: "2026-11-12", score: 7, total: 10, minutes: 12 });
  assert.equal(parseLabStore(JSON.stringify(store)).tests[0].score, 7);
});

test("four-skill evidence labels distinguish objective scoring from self-reported work", () => {
  assert.match(PART_EVIDENCE.listen.source, /Máy chấm/);
  assert.match(PART_EVIDENCE.read.source, /Máy chấm/);
  assert.match(PART_EVIDENCE.write.criterion, /không được máy chấm ngữ pháp/);
  assert.match(PART_EVIDENCE.speak.source, /tự chấm/);
  assert.deepEqual(Object.keys(PART_EVIDENCE), ['listen', 'read', 'write', 'speak']);
  assert.equal(isComplete({ listen: 1, read: null, write: 1, speak: 1 }), false);
  assert.equal(isComplete(done), true);
});

test("writing rubric offers evidence-based one-step retry without grading meaning", () => {
  const cafe = labLesson("e1-coffee-shop")!;
  const weak = writingRubric(cafe, "I want coffee");
  assert.deepEqual(weak.checks.map((item) => item.passed), [false, false, false, null]);
  assert.match(weak.nextStep, /ít nhất 2 câu/);
  const improved = writingRubric(cafe, "Can I have a medium coffee, please? I'd also like a muffin to go.");
  assert.deepEqual(improved.checks.map((item) => item.passed), [true, true, true, null]);
  assert.match(improved.nextStep, /đề và bài mẫu/);
  const hard = writingRubric(labLesson("h4-working-anywhere")!, "I work here. I like home.");
  assert.match(hard.checks[0].detail, /2\/4 câu/);
  const empty = writingRubric(cafe, "");
  assert.equal(empty.checks[0].passed, false);
  assert.equal(empty.checks[3].passed, null);
  assert.deepEqual(Object.keys(cafe.write), ["prompt", "model"]);
});
