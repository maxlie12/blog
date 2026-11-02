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
