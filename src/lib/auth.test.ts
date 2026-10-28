import assert from "node:assert/strict";
import test from "node:test";
import { isOwnerEmail } from "./auth.ts";

const owner = "owner@example.com";

test("only the owner's verified email opens Studio", () => {
  assert.equal(isOwnerEmail([{ emailAddress: "Owner@Example.com", verification: { status: "verified" } }], owner), true);
  assert.equal(isOwnerEmail([{ emailAddress: owner, verification: { status: "unverified" } }], owner), false);
  assert.equal(isOwnerEmail([{ emailAddress: owner, verification: null }], owner), false);
  assert.equal(isOwnerEmail([{ emailAddress: "someone@example.com", verification: { status: "verified" } }], owner), false);
});
