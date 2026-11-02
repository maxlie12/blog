import assert from "node:assert/strict";
import test from "node:test";
import { chaikin, emptyScene, isAnswer, lineLength, parseProgress, parseSavedScene, resample, STARTER, type Point } from "./village/data.ts";

test("resampling keeps both ends and spaces points evenly", () => {
  const pts = resample([[0, 0], [3, 0], [3, 2.2]], 0.5);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [3, 2.2]);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const step = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    assert.ok(step <= 0.5 + 1e-9, `step ${step} too long`);
  }
});

test("smoothing keeps end points and does not lengthen the line", () => {
  const raw: Point[] = [[0, 0], [2, 0], [2, 2], [4, 2]];
  const smooth = chaikin(raw, 2);
  assert.deepEqual(smooth[0], raw[0]);
  assert.deepEqual(smooth[smooth.length - 1], raw[raw.length - 1]);
  assert.ok(lineLength(smooth) <= lineLength(raw));
});

test("saved scenes drop malformed and off-island items", () => {
  const scene = emptyScene();
  scene.paths.push({ id: 3, pts: [[0, 0], [1, 1]] });
  scene.walls.push({ id: 4, pts: [[0, 0]] });
  scene.houses.push({ id: 5, x: 1, z: 1, len: 9, r: 0, seed: 1 });
  const raw = JSON.stringify({ v: 1, idSeq: 2, scene: { ...scene, trees: [{ id: 6, x: 99, z: 0, s: 1, k: 0, r: 0 }, "x"], sheep: [{ id: "7" }] } });
  const parsed = parseSavedScene(raw);
  assert.ok(parsed);
  assert.equal(parsed.scene.paths.length, 1);
  assert.equal(parsed.scene.walls.length, 0, "a one-point wall is dropped");
  assert.equal(parsed.scene.houses[0].len, 4.4, "house length is clamped");
  assert.equal(parsed.scene.trees.length, 0, "off-island tree is dropped");
  assert.equal(parsed.scene.sheep.length, 0);
  assert.equal(parsed.idSeq, 6, "new ids never collide with stored ones");
  assert.equal(parseSavedScene("{bad"), null);
  assert.equal(parseSavedScene(JSON.stringify({ v: 2, scene })), null);
});

test("progress always keeps the starter tools and ignores unknown ones", () => {
  const progress = parseProgress(JSON.stringify({ unlocked: ["tower", "rocket"], learned: { tower: { at: 1 }, rocket: { at: 2 } }, time: 4 }));
  assert.deepEqual(progress.unlocked, [...STARTER, "tower"]);
  assert.deepEqual(Object.keys(progress.learned), ["tower"]);
  assert.equal(progress.time, 1);
  assert.deepEqual(parseProgress("nope").unlocked, STARTER);
});

test("typed answers ignore case and outer spaces", () => {
  assert.ok(isAnswer("  Tower ", "tower"));
  assert.ok(!isAnswer("towers", "tower"));
});

test("every buildable piece has a usable word card and a group", async () => {
  const { TOOLS, WORDS, WORD_ORDER, CATEGORIES, wordsIn } = await import("./village/data.ts");
  assert.equal(WORD_ORDER.length, 53);
  assert.equal(TOOLS.length, 55, "53 pieces plus orbit and erase");
  assert.equal(CATEGORIES.reduce((n, c) => n + wordsIn(c.id).length, 0), WORD_ORDER.length);
  for (const word of WORD_ORDER) {
    const card = WORDS[word];
    assert.equal(card.sentence.split("___").length, 2, `${word}: one blank`);
    assert.match(card.ipa, /^\/.+\/$/, `${word}: IPA in slashes`);
    assert.ok(card.vi && card.viS, `${word}: Vietnamese meaning and sentence`);
    assert.match(word, /^[a-z]+$/, `${word}: one typeable word`);
  }
});

test("older saves without the new lists still load, and new pieces are validated", () => {
  const old = JSON.stringify({ v: 1, idSeq: 3, scene: { paths: [{ id: 1, pts: [[0, 0], [2, 0]] }], houses: [] } });
  const parsed = parseSavedScene(old);
  assert.ok(parsed);
  assert.deepEqual([parsed.scene.props, parsed.scene.streams, parsed.scene.hedges], [[], [], []]);

  const scene = emptyScene();
  const raw = JSON.stringify({
    v: 1,
    scene: {
      ...scene,
      streams: [{ id: 4, pts: [[18, 0], [19, 1]] }],
      props: [
        { id: 5, kind: "barn", x: 15, z: 3, r: 0.5, seed: 9 },
        { id: 6, kind: "dragon", x: 0, z: 0, r: 0, seed: 1 },
        { id: 7, kind: "cow", x: 30, z: 0, r: 0, seed: 1 },
      ],
    },
  });
  const next = parseSavedScene(raw);
  assert.ok(next);
  assert.equal(next.scene.streams.length, 1, "points out to the larger island are kept");
  assert.deepEqual(next.scene.props.map((p) => p.kind), ["barn"], "unknown kinds and off-island pieces are dropped");
  assert.equal(next.idSeq, 6);
});
