import assert from "node:assert/strict";
import test from "node:test";
import { hasAccentVoice, pickVoices } from "./englishVoice.ts";

const voices = [
  { name: "Linh", lang: "vi-VN" },
  { name: "Samantha", lang: "en-US" },
  { name: "Google US English", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Karen", lang: "en_AU" },
];

test("chosen accent first, better voices first, non-English dropped", () => {
  assert.deepEqual(pickVoices(voices, "en-GB").map((v) => v.name), ["Google UK English Female", "Daniel", "Google US English", "Samantha", "Karen"]);
  assert.deepEqual(pickVoices(voices, "en-US").slice(0, 2).map((v) => v.name), ["Google US English", "Samantha"]);
});

test("a device without British voices still reads English and reports the gap", () => {
  const us = voices.filter((v) => v.lang !== "en-GB");
  assert.equal(hasAccentVoice(us, "en-GB"), false);
  assert.equal(pickVoices(us, "en-GB")[0].name, "Google US English");
  assert.equal(hasAccentVoice(voices, "en-GB"), true);
  assert.deepEqual(pickVoices([], "en-GB"), []);
});
