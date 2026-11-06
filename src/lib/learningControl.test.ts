import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHabblaudOrigin, isWebsiteHealth } from "./learningControl.ts";

test("private entry accepts HTTPS and same-device loopback only", () => {
  assert.equal(normalizeHabblaudOrigin(" https://my-machine.example:4748/ "), "https://my-machine.example:4748");
  assert.equal(normalizeHabblaudOrigin("http://127.0.0.1:4747"), "http://127.0.0.1:4747");
  assert.equal(normalizeHabblaudOrigin("http://[::1]:4747/"), "http://[::1]:4747");
  for (const value of ["http://192.168.1.2:4747", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com/?token=secret", "https://example.com/#secret", "https://example.com/terminal", "not a url"]) {
    assert.throws(() => normalizeHabblaudOrigin(value), value);
  }
});

test("health must be the website probe payload, not an agent status", () => {
  assert.equal(isWebsiteHealth({ service: "maxlie-blog", status: "responding", checkedAt: new Date().toISOString() }), true);
  assert.equal(isWebsiteHealth({ status: "working", connected: true }), false);
  assert.equal(isWebsiteHealth({ service: "maxlie-blog", status: "responding", checkedAt: "wrong" }), false);
});
