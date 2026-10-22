import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultLearningMethod, getLearningMethods, isLearningMethodId } from "./learningMethods.ts";

test("each skill receives useful methods and its default is available", () => {
  for (const skill of ["listening", "reading", "speaking", "writing"] as const) {
    const methods = getLearningMethods(skill);
    assert.ok(methods.length >= 2);
    assert.ok(methods.some((method) => method.id === getDefaultLearningMethod(skill)));
  }
});

test("method validation rejects unknown stored values", () => {
  assert.equal(isLearningMethodId("shadow"), true);
  assert.equal(isLearningMethodId("watch-video"), false);
  assert.equal(isLearningMethodId(null), false);
});
