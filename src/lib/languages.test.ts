import assert from "node:assert/strict";
import test from "node:test";
import { getLanguageLabel, getLanguageLevels, isValidLanguage, languageRank } from "./languages.ts";
import { lessonLevel } from "./lessonLevels.ts";
import { orderPractice } from "./practiceOrder.ts";

test("language packs expose Japanese without changing existing IDs", () => {
  assert.equal(isValidLanguage("en"), true);
  assert.equal(isValidLanguage("zh"), true);
  assert.equal(isValidLanguage("ja"), true);
  assert.equal(isValidLanguage("jp"), false);
  assert.equal(getLanguageLabel("ja", true), "日本語");
  assert.deepEqual(getLanguageLevels("ja"), ["Starter", "A1", "N5", "Other"]);
});

test("Japanese levels and language order are deterministic", () => {
  assert.equal(lessonLevel("Starter / A1", "ja"), "Starter");
  assert.equal(lessonLevel("JLPT N5 practice", "ja"), "N5");
  assert.equal(lessonLevel("A1 Can-do", "ja"), "A1");
  assert.ok(languageRank("en") < languageRank("zh"));
  assert.ok(languageRank("zh") < languageRank("ja"));
});

test("practice order uses configured language order, then skill order", () => {
  const result = orderPractice([
    { id: "ja-speaking", language: "ja", skill: "speaking" as const },
    { id: "en-writing", language: "en", skill: "writing" as const },
    { id: "zh-listening", language: "zh", skill: "listening" as const },
    { id: "en-listening", language: "en", skill: "listening" as const },
  ]);
  assert.deepEqual(result.map((item) => item.id), ["en-listening", "en-writing", "zh-listening", "ja-speaking"]);
});
