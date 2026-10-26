import test from "node:test";
import assert from "node:assert/strict";
import { getHandwritingCharacters, normalizeChineseAnswer } from "./chineseWriting.ts";

test("Chinese recall comparison ignores spaces and punctuation", () => {
  assert.equal(normalizeChineseAnswer("我 要 两杯咖啡，谢谢！"), "我要两杯咖啡谢谢");
});

test("handwriting practice keeps unique Han characters in sentence order", () => {
  assert.deepEqual(getHandwritingCharacters("我要一杯茶，谢谢。要"), ["我", "要", "一", "杯", "茶", "谢"]);
});
