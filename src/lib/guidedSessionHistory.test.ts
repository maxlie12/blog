import assert from "node:assert/strict";
import test from "node:test";
import { readSavedSessions, saveSession } from "./guidedSessionHistory.ts";
import { profileStorageKey, setActiveLearnerProfile } from "./learnerProfiles.ts";

const values = new Map<string, string>();
let failHistoryWrite = false;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (failHistoryWrite && key.includes("history")) throw new Error("quota");
    values.set(key, value);
  },
} });
type Session = { language: "en" | "zh"; startedAt: string; response: string };
const valid = (v: unknown): v is Session => !!v && typeof v === "object" &&
  ["en", "zh"].includes((v as Session).language) && typeof (v as Session).startedAt === "string" && typeof (v as Session).response === "string";
const old: Session = { language: "en", startedAt: "2026-11-03T00:00:00Z", response: "Original" };
const next: Session = { ...old, startedAt: "2026-11-04T00:00:00Z", response: "New" };
test.beforeEach(() => { values.clear(); failHistoryWrite = false; setActiveLearnerProfile("luan"); });

test("new session preserves and migrates the legacy draft", () => {
  values.set("guided-practice-v1:en", JSON.stringify(old));
  assert.deepEqual(saveSession(next, valid), [next, old]);
  assert.deepEqual(readSavedSessions("en", valid), [next, old]);
});
test("editing an old session keeps its identity and all other sessions", () => {
  saveSession(old, valid); saveSession(next, valid);
  const edited = { ...old, response: "Corrected" };
  assert.deepEqual(saveSession(edited, valid), [next, edited]);
  assert.equal(readSavedSessions("en", valid).length, 2);
});
test("history stays separated by language and profile", () => {
  saveSession(old, valid);
  assert.deepEqual(readSavedSessions("zh", valid), []);
  setActiveLearnerProfile("phi");
  assert.deepEqual(readSavedSessions("en", valid), []);
});
test("corrupt history and storage failures never overwrite the legacy draft", () => {
  values.set(profileStorageKey("guided-practice-v1:en"), JSON.stringify(old));
  values.set(profileStorageKey("guided-practice-history-v1:en"), "broken");
  assert.throws(() => saveSession(next, valid));
  values.delete(profileStorageKey("guided-practice-history-v1:en"));
  failHistoryWrite = true;
  assert.throws(() => saveSession(next, valid), /quota/);
  assert.deepEqual(JSON.parse(values.get(profileStorageKey("guided-practice-v1:en"))!), old);
});
test("history is not silently pruned after 30 sessions", () => {
  for (let i = 1; i <= 35; i++) saveSession({ ...old, startedAt: `2026-10-${String(i).padStart(2, "0")}` }, valid);
  assert.equal(readSavedSessions("en", valid).length, 35);
});
