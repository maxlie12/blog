import assert from "node:assert/strict";
import test from "node:test";
import { accentVoices, hasAccentVoice, onlyBasicVoices, pickVoices, voiceQuality } from "./englishVoice.ts";

// Roughly what iPhone Safari lists (novelty and Eloquence voices included), plus desktop voices.
const iphone = [
  { name: "Albert", lang: "en-US" },
  { name: "Bad News", lang: "en-US" },
  { name: "Bahh", lang: "en-US" },
  { name: "Eddy (English (UK))", lang: "en-GB" },
  { name: "Flo (English (US))", lang: "en-US" },
  { name: "Grandma (English (UK))", lang: "en-GB" },
  { name: "Linh", lang: "vi-VN" },
  { name: "Samantha", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Zarvox", lang: "en-US" },
  { name: "Karen", lang: "en-AU" },
];

test("robotic novelty voices are never picked, even when they come first", () => {
  assert.equal(pickVoices(iphone, "en-US")[0].name, "Samantha");
  assert.equal(pickVoices(iphone, "en-GB")[0].name, "Daniel");
  const names = pickVoices(iphone, "en-US").map((v) => v.name);
  for (const bad of ["Albert", "Bad News", "Bahh", "Zarvox", "Flo (English (US))", "Eddy (English (UK))", "Grandma (English (UK))", "Linh"]) assert.ok(!names.includes(bad), bad);
  assert.equal(voiceQuality({ name: "Grandpa (English (US))", lang: "en-US" }), -1);
});

test("downloaded Premium/Enhanced and natural online voices win; the learner's pick wins over all", () => {
  const better = [...iphone, { name: "Serena (Premium)", lang: "en-GB" }, { name: "Kate (Enhanced)", lang: "en-GB" }, { name: "Ava (Enhanced)", lang: "en-US" }];
  assert.deepEqual(accentVoices(better, "en-GB").map((v) => v.name), ["Serena (Premium)", "Kate (Enhanced)", "Daniel"]);
  assert.equal(pickVoices(better, "en-US")[0].name, "Ava (Enhanced)");
  assert.equal(pickVoices(better, "en-GB", "Daniel")[0].name, "Daniel");
  assert.equal(pickVoices([{ name: "Google UK English Female", lang: "en-GB" }, { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB" }], "en-GB")[0].name.startsWith("Microsoft Sonia"), true);
});

test("quality is read from the voice id or a Vietnamese-language name too", () => {
  assert.equal(voiceQuality({ name: "Serena", lang: "en-GB", voiceURI: "com.apple.voice.premium.en-GB.Serena" }), 0);
  assert.equal(voiceQuality({ name: "Kate", lang: "en-GB", voiceURI: "com.apple.voice.enhanced.en-GB.Kate" }), 1);
  assert.equal(voiceQuality({ name: "Ava (Nâng cao)", lang: "en-US" }), 1);
  assert.equal(voiceQuality({ name: "Zoe (Cao cấp)", lang: "en-US" }), 0);
  assert.equal(voiceQuality({ name: "Shelley", lang: "en-GB", voiceURI: "com.apple.eloquence.en-GB.Shelley" }), -1);
});

test("basic-only devices are flagged so the page can suggest downloading better voices", () => {
  assert.equal(onlyBasicVoices(iphone, "en-GB"), true);
  assert.equal(onlyBasicVoices([...iphone, { name: "Kate (Enhanced)", lang: "en-GB" }], "en-GB"), false);
  assert.equal(onlyBasicVoices([], "en-GB"), false);
});

test("a device without British voices still reads English and reports the gap", () => {
  const us = iphone.filter((v) => v.lang !== "en-GB");
  assert.equal(hasAccentVoice(us, "en-GB"), false);
  assert.equal(pickVoices(us, "en-GB")[0].name, "Samantha");
  assert.equal(hasAccentVoice([{ name: "Eddy (English (UK))", lang: "en-GB" }], "en-GB"), false, "novelty does not count");
  assert.deepEqual(pickVoices([], "en-GB"), []);
});
