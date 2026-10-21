import assert from "node:assert/strict";
import test from "node:test";
import { canReadAttempt } from "./attemptAccess.ts";

test("private attempts are visible only to their learner or Studio", () => {
  assert.equal(canReadAttempt("user_phi", "user_phi", false), true);
  assert.equal(canReadAttempt("user_phi", "user_luan", false), false);
  assert.equal(canReadAttempt(null, null, false), false);
  assert.equal(canReadAttempt("user_phi", null, true), true);
});
