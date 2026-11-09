import assert from "node:assert/strict";
import test from "node:test";
import { canFinishConversation, freshConversation, readConversationSessions, saveConversationSession } from "./conversationPractice.ts";
import { profileStorageKey, setActiveLearnerProfile } from "./learnerProfiles.ts";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
} });
test.beforeEach(() => { values.clear(); setActiveLearnerProfile("luan"); });

test("conversation drafts update without duplicates and keep older sessions", () => {
  const first = freshConversation("en-clarify");
  saveConversationSession(first);
  saveConversationSession({ ...first, writing: "My first attempt" });
  saveConversationSession(freshConversation("en-clarify"));
  const history = readConversationSessions("en-clarify");
  assert.equal(history.length, 2);
  assert.equal(history.find(s => s.id === first.id)?.writing, "My first attempt");
  setActiveLearnerProfile("phi");
  assert.deepEqual(readConversationSessions("en-clarify"), []);
});
test("corrupt history is not silently replaced", () => {
  const key = profileStorageKey("conversation-practice-v1:zh-drinks");
  values.set(key, "broken");
  assert.throws(() => saveConversationSession(freshConversation("zh-drinks")));
  assert.equal(values.get(key), "broken");
});
test("completion needs self-produced outputs and all skill activities", () => {
  const session = freshConversation("zh-drinks");
  assert.equal(canFinishConversation(session), false);
  Object.assign(session, { first: ["a", "b", "c"], retry: ["d", "e", "f"], spokeFirst: [true,true,true], spokeRetry: [true,true,true], listened: true, read: true, writing: "my message", gap: "tone", phrase: "water", repaired: "new sentence" });
  assert.equal(canFinishConversation(session), true);
  session.listened = false;
  assert.equal(canFinishConversation(session), false);
});

test("speaking turn survives save/reload and legacy sessions default to turn zero", () => {
  const session = freshConversation("en-clarify");
  saveConversationSession({ ...session, stage: 2, turn: 2, retry: ["a", "b", "last answer"] });
  assert.equal(readConversationSessions("en-clarify")[0].turn, 2);
  assert.equal(readConversationSessions("en-clarify")[0].retry[2], "last answer");
  const legacy = { ...session } as Partial<typeof session>;
  delete legacy.turn;
  values.set(profileStorageKey("conversation-practice-v1:en-clarify"), JSON.stringify([legacy]));
  assert.equal(readConversationSessions("en-clarify")[0].turn, 0);
});

test("invalid speaking turn cannot overwrite saved history", () => {
  const session = freshConversation("zh-drinks");
  saveConversationSession(session);
  assert.throws(() => saveConversationSession({ ...session, turn: 3 }));
  assert.equal(readConversationSessions("zh-drinks")[0].turn, 0);
});
