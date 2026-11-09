import assert from "node:assert/strict";
import test from "node:test";
import {
  exportLocalProgressBackup,
  getLocalCompletedLessonIds,
  getLocalLanguageActivity,
  getLocalLanguageSummary,
  getLocalDueReviews,
  getLocalScheduledReview,
  importLocalProgressBackup,
  recordLocalCompletion,
  recordLocalReview,
} from "./localLearningProgress.ts";
import { profileStorageKey, setActiveLearnerProfile } from "./learnerProfiles.ts";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });

const completion = {
  id: "lesson-en-1",
  lessonId: "lesson-en",
  language: "en",
  skill: "listening",
  minutes: 5,
  date: "2026-10-18",
  completedAt: "2026-10-18T01:00:00.000Z",
};

test.beforeEach(() => {
  storage.clear();
  setActiveLearnerProfile("luan");
});

test("backup import merges by completion id without duplicating progress", () => {
  storage.setItem("learning-completions-v1", JSON.stringify({ version: 1, completions: [completion] }));
  const backup = JSON.parse(exportLocalProgressBackup());
  backup.completions.push({ ...completion, id: "lesson-en-2", date: "2026-10-19" });

  const result = importLocalProgressBackup(JSON.stringify(backup));

  assert.deepEqual(result, { added: 1, skipped: 1, total: 2, syncProfileImported: false });
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 2);
});

test("backup carries known words and path marks and merges them", () => {
  storage.setItem("learning-profile:luan:study-words-known-v1", JSON.stringify(["routine"]));
  storage.setItem("learning-profile:luan:study-path-v1", JSON.stringify(["a:read"]));
  const backup = exportLocalProgressBackup();

  storage.clear();
  storage.setItem("learning-profile:luan:study-words-known-v1", JSON.stringify(["myth"]));
  importLocalProgressBackup(backup);

  assert.deepEqual(JSON.parse(storage.getItem("learning-profile:luan:study-words-known-v1")!), ["myth", "routine"]);
  assert.deepEqual(JSON.parse(storage.getItem("learning-profile:luan:study-path-v1")!), ["a:read"]);
});

test("a backup without study lists imports and keeps local words", () => {
  storage.setItem("learning-profile:luan:study-words-known-v1", JSON.stringify(["myth"]));
  const backup = JSON.parse(exportLocalProgressBackup());
  delete backup.studyWords;
  delete backup.studyPathMarks;
  importLocalProgressBackup(JSON.stringify(backup));
  assert.deepEqual(JSON.parse(storage.getItem("learning-profile:luan:study-words-known-v1")!), ["myth"]);
});

test("a backup with malformed study lists is rejected", () => {
  const backup = JSON.parse(exportLocalProgressBackup());
  backup.studyWords = [1];
  assert.throws(() => importLocalProgressBackup(JSON.stringify(backup)), /từ vựng/);
});

test("backup carries the private sync profile to a fresh browser", () => {
  storage.setItem("learning-completions-v1", JSON.stringify({ version: 1, completions: [completion] }));
  const backup = exportLocalProgressBackup();
  const expectedToken = JSON.parse(backup).syncToken;
  assert.match(expectedToken, /^[a-f0-9]{64}$/);

  storage.clear();
  const result = importLocalProgressBackup(backup);

  assert.equal(result.syncProfileImported, true);
  assert.equal(storage.getItem(profileStorageKey("learning-sync-token-v1", "luan")), expectedToken);
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);
});

test("invalid backup is rejected and leaves existing progress untouched", () => {
  storage.setItem("learning-completions-v1", JSON.stringify({ version: 1, completions: [completion] }));

  assert.throws(() => importLocalProgressBackup('{"format":"wrong"}'), /không phải bản sao/);
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);
});

test("activity calendar uses real completion dates and separates languages", () => {
  storage.setItem("learning-completions-v1", JSON.stringify({
    version: 1,
    completions: [completion, { ...completion, id: "zh-1", language: "zh", date: "2026-10-19" }],
  }));

  const days = getLocalLanguageActivity("en", 2, new Date("2026-10-19T12:00:00.000Z"));
  assert.deepEqual(days, [{ date: "2026-10-18", count: 1 }, { date: "2026-10-19", count: 0 }]);
});

test("Luân and Phi keep independent completions on the same browser", () => {
  recordLocalCompletion({ id: "shared-lesson", lessonId: "lesson-en", language: "en", skill: "listening", minutes: 5 });
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);

  setActiveLearnerProfile("phi");
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 0);
  recordLocalCompletion({ id: "shared-lesson", lessonId: "lesson-ja", language: "ja", skill: "listening", minutes: 5 });
  assert.equal(getLocalLanguageSummary("ja").totalCompleted, 1);

  setActiveLearnerProfile("luan");
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);
  assert.equal(getLocalLanguageSummary("ja").totalCompleted, 0);
});

test("completed lesson IDs are profile-local", () => {
  recordLocalCompletion({ id: "lesson:lesson-en", lessonId: "lesson-en", language: "en", skill: "listening", minutes: 5 });
  assert.deepEqual([...getLocalCompletedLessonIds()], ["lesson-en"]);

  setActiveLearnerProfile("phi");
  assert.deepEqual([...getLocalCompletedLessonIds()], []);
});

test("backup cannot be imported into a different learner profile", () => {
  const backup = exportLocalProgressBackup();
  setActiveLearnerProfile("phi");
  assert.throws(() => importLocalProgressBackup(backup), /thuộc hồ sơ Luân/);
});

test("backup rejects an unknown learner profile", () => {
  const backup = JSON.parse(exportLocalProgressBackup());
  backup.learnerProfile = { id: "attacker", name: "Unknown" };
  assert.throws(() => importLocalProgressBackup(JSON.stringify(backup)), /không hợp lệ/);
});

test("review events advance the schedule and do not inflate Done lesson count", () => {
  recordLocalCompletion({ id: "lesson:lesson-en", lessonId: "lesson-en", language: "en", skill: "listening", minutes: 5 }, new Date("2026-10-10T02:00:00.000Z"));

  assert.equal(getLocalScheduledReview("lesson-en", new Date("2026-10-11T02:00:00.000Z"))?.isDue, true);
  const result = recordLocalReview({ lessonId: "lesson-en", language: "en", skill: "listening", minutes: 3 }, new Date("2026-10-11T02:00:00.000Z"));

  assert.equal(result.newlyRecorded, true);
  assert.deepEqual(result.nextReview, { lessonId: "lesson-en", interval: 3, dueDate: "2026-10-14", isDue: false });
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);
});

test("due review uses the Asia/Ho_Chi_Minh calendar boundary", () => {
  recordLocalCompletion({ id: "lesson:lesson-en", lessonId: "lesson-en", language: "en", skill: "listening", minutes: 5 }, new Date("2026-10-18T02:00:00.000Z"));

  assert.deepEqual(getLocalDueReviews(new Date("2026-10-18T16:59:59.000Z")), []);
  assert.equal(getLocalDueReviews(new Date("2026-10-18T17:00:00.000Z"))[0]?.lessonId, "lesson-en");
});

test("multiple lessons completed on one day are all returned when due", () => {
  const completedAt = new Date("2026-10-10T03:00:00.000Z");
  recordLocalCompletion({ id: "lesson:lesson-a", lessonId: "lesson-a", language: "en", skill: "reading", minutes: 5 }, completedAt);
  recordLocalCompletion({ id: "lesson:lesson-b", lessonId: "lesson-b", language: "en", skill: "writing", minutes: 5 }, completedAt);

  assert.deepEqual(getLocalDueReviews(new Date("2026-10-11T03:00:00.000Z")).map((item) => item.lessonId), ["lesson-a", "lesson-b"]);
});

test("learn, save, leave, return, recall; one rating per local day and no extra Done", async () => {
  const { recordLocalRecall } = await import("./localLearningProgress.ts");
  const input = { lessonId: "daily-test", language: "en", skill: "reading", minutes: 3 };
  recordLocalCompletion({ ...input, id: "lesson:daily-test" }, new Date("2026-11-01T02:00:00Z"));
  assert.equal(recordLocalRecall(input, "remembered", new Date("2026-11-01T03:00:00Z")).nextReview?.interval, 1);
  assert.equal(recordLocalRecall(input, "again", new Date("2026-11-01T04:00:00Z")).newlyRecorded, false);
  const saved = exportLocalProgressBackup();
  storage.clear();
  importLocalProgressBackup(saved);
  assert.equal(getLocalDueReviews(new Date("2026-11-02T02:00:00Z"))[0]?.lessonId, "daily-test");
  assert.equal(recordLocalRecall(input, "remembered", new Date("2026-11-02T02:00:00Z")).nextReview?.interval, 3);
  assert.equal(recordLocalRecall(input, "again", new Date("2026-11-03T02:00:00Z")).newlyRecorded, false);
  assert.equal(recordLocalRecall(input, "hard", new Date("2026-11-05T02:00:00Z")).nextReview?.interval, 3);
  assert.equal(recordLocalRecall(input, "again", new Date("2026-11-08T02:00:00Z")).nextReview?.interval, 1);
  assert.equal(getLocalLanguageSummary("en").totalCompleted, 1);
});

test("recall without Done is ignored and a failed storage write remains retryable", async () => {
  const { recordLocalRecall } = await import("./localLearningProgress.ts");
  const input = { lessonId: "a", language: "zh", skill: "speaking", minutes: 3 };
  const now = new Date("2026-11-01T02:00:00Z");
  assert.equal(recordLocalRecall(input, "again", now).newlyRecorded, false);
  recordLocalCompletion({ ...input, id: "lesson:a" }, now);
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error("quota"); };
  try { assert.throws(() => recordLocalRecall(input, "again", now), /quota/); }
  finally { storage.setItem = setItem; }
  assert.equal(recordLocalRecall(input, "again", now).newlyRecorded, true);
});

test("recall metadata survives the unchanged server validation and a sync round trip", async () => {
  const { recordLocalRecall, syncLocalProgress } = await import("./localLearningProgress.ts");
  const { syncRequestSchema } = await import("./habitSyncServer.ts");
  const input = { lessonId: "a", language: "en", skill: "reading", minutes: 3 };
  const now = new Date("2026-11-01T02:00:00Z");
  recordLocalCompletion({ ...input, id: "lesson:a" }, now);
  recordLocalRecall(input, "again", now);
  const backup = JSON.parse(exportLocalProgressBackup());
  const parsed = syncRequestSchema.parse({ token: backup.syncToken, completions: backup.completions });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ completions: parsed.completions });
  storage.clear();
  try {
    await syncLocalProgress();
    assert.equal(getLocalScheduledReview("a", now)?.lastRecall?.rating, "again");
    assert.equal(getLocalScheduledReview("a", now)?.dueDate, "2026-11-02");
  } finally { globalThis.fetch = originalFetch; }
});
