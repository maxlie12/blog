import assert from "node:assert/strict";
import test from "node:test";
import { articleParagraphs, compareReading } from "./studyText.ts";

const long = "one two three four five six seven eight nine ten eleven twelve";

test("keeps prose and drops headings, notes, lists, citations and sources", () => {
  const mdx = `> note ${long}\n\n## Title\n\n**Bold** ${long} ([APS](https://a.b/c)).\n\n- item ${long}\n\n1. step ${long}\n\nshort line\n\n## Sources\n\nAfter ${long}`;
  assert.deepEqual(articleParagraphs(mdx), [`Bold ${long}.`]);
});

test("keeps the link text of an inline link", () => {
  assert.deepEqual(articleParagraphs(`See [the docs](https://a.b) ${long}`), [`See the docs ${long}`]);
});

test("matches words in order, ignoring case and punctuation", () => {
  const result = compareReading("Sleep helps, memory!", "sleep memory");
  assert.deepEqual(result.map((word) => word.matched), [true, false, true]);
  assert.equal(result[1].text, "helps,");
});

test("an empty transcript matches nothing", () => {
  assert.deepEqual(compareReading("one two", "").map((word) => word.matched), [false, false]);
});
