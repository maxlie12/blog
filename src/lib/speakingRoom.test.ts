import assert from "node:assert/strict";
import test from "node:test";
import {
  RESCUE, SITUATIONS, dueSituations, emptySpeakRecord, nextSituation, parseSpeakStore, readiness, scheduleReview,
  speakSituation, withSpeakResult, type SpeakStore,
} from "./speakingRoom.ts";

test("every situation is complete: chunks, two cases of four turns, a retell prompt", () => {
  const ids = new Set<string>();
  for (const item of SITUATIONS) {
    assert.ok(!ids.has(item.id), item.id);
    ids.add(item.id);
    assert.ok(item.chunks.length >= 5 && item.goal && item.retell, item.id);
    assert.equal(item.cases.length, 2, item.id);
    for (const c of item.cases) {
      assert.ok(c.plan && c.name, `${item.id}/${c.id}`);
      assert.equal(c.turns.length, 4, `${item.id}/${c.id}`);
      for (const t of c.turns) assert.ok(t.partner && t.cue && t.model, `${item.id}/${c.id}`);
    }
  }
  for (const level of ["easy", "medium", "hard"]) assert.equal(SITUATIONS.filter((s) => s.level === level).length, 3, level);
  assert.ok(RESCUE.length >= 5);
  assert.equal(speakSituation("nope"), null);
});

test("ready needs ≥80% chunks and ≥80% in both cases; otherwise almost or practice", () => {
  const s = SITUATIONS[0];
  const [a, b] = s.cases.map((c) => c.id);
  const record = (chunks: number | null, x?: number, y?: number) => ({ ...emptySpeakRecord("2026-11-12"), chunks, cases: { ...(x === undefined ? {} : { [a]: x }), ...(y === undefined ? {} : { [b]: y }) } });
  assert.equal(readiness(s, record(1, 1)), null, "one case missing");
  assert.equal(readiness(s, record(null, 1, 1)), null, "chunks missing");
  assert.equal(readiness(s, record(0.8, 0.875, 1)), "ready");
  assert.equal(readiness(s, record(1, 1, 0.75)), "almost");
  assert.equal(readiness(s, record(0.2, 0.25, 0.5)), "practice");
});

test("review spacing: 1 / 3 / 7 days, doubling while it stays ready, at most 30", () => {
  const prev = (ready: "ready" | "almost", interval: number) => ({ ...emptySpeakRecord("2026-11-01"), ready, interval });
  assert.deepEqual(scheduleReview(undefined, "practice", "2026-11-12"), { interval: 1, due: "2026-11-13" });
  assert.deepEqual(scheduleReview(undefined, "almost", "2026-11-30"), { interval: 3, due: "2026-12-03" });
  assert.deepEqual(scheduleReview(prev("almost", 3), "ready", "2026-11-12"), { interval: 7, due: "2026-11-19" });
  assert.deepEqual(scheduleReview(prev("ready", 7), "ready", "2026-11-12"), { interval: 14, due: "2026-11-26" });
  assert.equal(scheduleReview(prev("ready", 28), "ready", "2026-11-12").interval, 30);
});

test("store: saves, schedules, surfaces due situations first; bad data reads empty", () => {
  assert.deepEqual(parseSpeakStore("{"), { version: 1, situations: {} });
  const s = SITUATIONS[0];
  let store: SpeakStore = parseSpeakStore(null);
  assert.equal(nextSituation(store, "2026-11-12").reason, "new");
  const full = { ...emptySpeakRecord("2026-11-12"), chunks: 1, cases: Object.fromEntries(s.cases.map((c) => [c.id, 1])), fluency: 3 };
  store = withSpeakResult(store, s, full);
  assert.equal(store.situations[s.id].ready, "ready");
  assert.equal(store.situations[s.id].due, "2026-11-19");
  assert.equal(nextSituation(store, "2026-11-12").situation.id, SITUATIONS[1].id);
  assert.deepEqual(dueSituations(store, "2026-11-19").map((x) => x.id), [s.id]);
  assert.deepEqual(nextSituation(store, "2026-11-20"), { situation: s, reason: "due" });
  // Saving again the same day keeps the first interval (no double counting).
  store = withSpeakResult(store, s, full);
  assert.equal(store.situations[s.id].interval, 7);
  // A partial save keeps the old schedule.
  store = withSpeakResult(store, s, { ...emptySpeakRecord("2026-11-21"), chunks: 1 });
  assert.equal(store.situations[s.id].due, "2026-11-19");
});
