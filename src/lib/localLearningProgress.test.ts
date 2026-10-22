import assert from "node:assert/strict";
import test from "node:test";
import {
  exportLocalProgressBackup,
  getLocalCompletedLessonIds,
  getLocalLanguageActivity,
  getLocalLanguageSummary,
  importLocalProgressBackup,
  recordLocalCompletion,
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
