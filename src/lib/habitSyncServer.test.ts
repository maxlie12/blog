import assert from "node:assert/strict";
import test from "node:test";
import { canAccessClaimedProfile } from "./habitSyncServer.ts";

test("a claimed habit profile rejects anonymous and other-account access", () => {
  assert.equal(canAccessClaimedProfile(null, null), true);
  assert.equal(canAccessClaimedProfile("user_phi", "user_phi"), true);
  assert.equal(canAccessClaimedProfile("user_phi", null), false);
  assert.equal(canAccessClaimedProfile("user_phi", "user_luan"), false);
});
