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
  assert.equal(WORD_ORDER.length, 88);
  assert.equal(TOOLS.length, 92, "88 pieces plus orbit, look, hand and erase");
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

test("physics: friction stops a rolling ball and reports it settled", async () => {
  const { makeWorld, makeBody, stepBodies } = await import("./village/physics.ts");
  const world = makeWorld({ islandR: 22 });
  const ball = makeBody({ id: 1, kind: "ball", x: 0, z: 0, r: 0 });
  Object.assign(ball, { vx: 6, awake: true });
  let settledAt = -1;
  for (let i = 0; i < 900 && settledAt < 0; i += 1) if (stepBodies(world, [ball], [], 1 / 60).settled.length) settledAt = i;
  assert.ok(settledAt > 0, "the ball comes to rest");
  assert.ok(ball.x > 2 && ball.x < 20, `rolled ${ball.x.toFixed(2)}`);
  assert.equal(ball.awake, false);
});

test("physics: a wall turns a ball back and a house box keeps it out", async () => {
  const { makeWorld, makeBody, stepBodies } = await import("./village/physics.ts");
  const wall = Array.from({ length: 9 }, (_, i) => ({ x: 3, z: -2 + i * 0.5, r: 0.3 }));
  const world = makeWorld({ islandR: 22, circles: wall, boxes: [{ x: -4, z: 0, hx: 1, hz: 0.8, rot: 0.5 }] });
  const ball = makeBody({ id: 1, kind: "ball", x: 0, z: 0, r: 0 });
  Object.assign(ball, { vx: 9, awake: true });
  let maxX = 0;
  for (let i = 0; i < 600; i += 1) { stepBodies(world, [ball], [], 1 / 60); maxX = Math.max(maxX, ball.x); }
  assert.ok(maxX < 3 - 0.3 - 0.26 + 0.01, `never passes the wall (max x ${maxX.toFixed(2)})`);
  assert.ok(ball.x < 0, "bounced back the way it came");
  assert.ok(ball.x > -4 + 1.3, `stopped outside the house box (x ${ball.x.toFixed(2)})`);
});

test("physics: a moving barrel knocks a resting ball, and a gust pushes things away", async () => {
  const { makeWorld, makeBody, stepBodies, gust } = await import("./village/physics.ts");
  const world = makeWorld({ islandR: 22 });
  const barrel = makeBody({ id: 1, kind: "barrel", x: 0, z: 0, r: 0 });
  const ball = makeBody({ id: 2, kind: "ball", x: 1.5, z: 0, r: 0 });
  Object.assign(barrel, { vx: 4, awake: true });
  for (let i = 0; i < 120; i += 1) stepBodies(world, [barrel, ball], [], 1 / 60);
  assert.ok(ball.x > 2.5, `ball was knocked forward to ${ball.x.toFixed(2)}`);
  const crate = makeBody({ id: 3, kind: "crate", x: 1, z: 1, r: 0 });
  assert.deepEqual(gust([crate], 0, 0).map((b) => b.id), [3]);
  assert.ok(crate.vx > 0 && crate.vz > 0 && crate.awake);
});

test("physics: water carries a body down a stream; off the island it falls", async () => {
  const { makeWorld, makeBody, stepBodies } = await import("./village/physics.ts");
  const stream = Array.from({ length: 21 }, (_, i) => [-5 + i * 0.5, 0] as [number, number]);
  const world = makeWorld({ islandR: 22, streams: [stream] });
  const boat = makeBody({ id: 1, kind: "boat", x: -4, z: 0, r: 0 });
  boat.awake = true;
  for (let i = 0; i < 120; i += 1) stepBodies(world, [boat], [], 1 / 60);
  assert.ok(boat.floating && boat.x > -2.6, `drifted downstream to ${boat.x.toFixed(2)}`);

  const ball = makeBody({ id: 2, kind: "ball", x: 21.6, z: 0, r: 0 });
  Object.assign(ball, { vx: 6, awake: true });
  let fell = false;
  for (let i = 0; i < 400 && !fell; i += 1) fell = stepBodies(world, [ball], [], 1 / 60).fell.length > 0;
  assert.ok(fell && ball.gone, "rolled off the edge and fell");
});

test("physics: an animal walking into a sleeping crate pushes it", async () => {
  const { makeWorld, makeBody, stepBodies } = await import("./village/physics.ts");
  const crate = makeBody({ id: 1, kind: "crate", x: 0.5, z: 0, r: 0 });
  stepBodies(makeWorld({ islandR: 22 }), [crate], [{ x: 0, z: 0, vx: 1.2, vz: 0, r: 0.4 }], 1 / 60);
  assert.ok(crate.awake && crate.vx > 0 && crate.x >= 0.73 - 1e-9);
});

test("discovery words are complete and every action sentence uses its verb", async () => {
  const { ACTIONS, PARTS, RESIDENTS, VERBS, describe } = await import("./village/vocab.ts");
  for (const [id, entry] of [...Object.entries(VERBS), ...Object.entries(PARTS), ...Object.entries(RESIDENTS)]) {
    assert.equal(entry.en, id, `${id}: key is the English word`);
    assert.match(entry.ipa, /^\/.+\/$/, `${id}: IPA in slashes`);
    assert.ok(entry.vi, `${id}: Vietnamese meaning`);
  }
  for (const [id, action] of Object.entries(ACTIONS)) {
    assert.ok(action.en.startsWith(`is ${VERBS[action.verb].ing}`), `${id}: “${action.en}” starts with its -ing verb`);
    assert.ok(action.vi.startsWith("đang "), `${id}: Vietnamese uses “đang”`);
  }
  const chase = describe({ en: "dog", vi: "con chó" }, "chase", { en: "chicken", vi: "con gà" });
  assert.deepEqual(chase, { en: "The dog is chasing the chicken.", vi: "Con chó đang đuổi theo con gà.", verb: "chase", highlight: "chasing" });
  assert.equal(describe({ en: "farmer", vi: "bác nông dân" }, "waterGarden").vi, "Bác nông dân đang tưới rau.");
});

test("people are words with a Vietnamese name, and seen words survive a reload", async () => {
  const { TOOL, wordsIn, viWho } = await import("./village/data.ts");
  assert.deepEqual(wordsIn("people"), ["farmer", "baker", "fisherman", "shepherd", "woodcutter", "postman", "musician", "child"]);
  for (const word of wordsIn("people")) assert.ok(TOOL[word].person && viWho(word).length > 2, `${word}: placeable person with a Vietnamese name`);
  assert.equal(viWho("cow"), "con bò");
  const progress = parseProgress(JSON.stringify({ unlocked: [], seen: { "verb:walk": 5, "part:roof": 6, "noun:grandma": 7, "verb:dance": 1, "part:roof2": 2, "noun:man": "x", junk: 3 } }));
  assert.deepEqual(progress.seen, { "verb:walk": 5, "part:roof": 6, "noun:grandma": 7 });
  assert.deepEqual(parseProgress(null).seen, {});
});

test("daily review: met words come back after 1, 3, 7 and 14 days, a miss starts again", async () => {
  const { DAY, choicesFor, dueItems, nextReview, startOfDay } = await import("./village/review.ts");
  const met = new Date(2026, 10, 3, 20, 0).getTime();
  const progress = parseProgress(JSON.stringify({ unlocked: ["tower"], learned: { tower: { at: met } }, seen: { "part:roof": met, "verb:walk": met + DAY * 3 } }));
  assert.deepEqual(dueItems(progress, met + 3600_000).map((i) => i.key), [], "not due on the day it was met");
  assert.deepEqual(dueItems(progress, startOfDay(met) + DAY).map((i) => i.key), ["part:roof", "word:tower"], "due from the next midnight");

  let state = nextReview(undefined, true, met);
  const gaps = [];
  for (let k = 0; k < 4; k += 1) {
    gaps.push(Math.round((state.due - startOfDay(met)) / DAY));
    state = nextReview(state, true, met);
  }
  assert.deepEqual(gaps, [3, 7, 14, 30]);
  assert.deepEqual(nextReview({ due: 0, step: 3 }, false, met), { due: startOfDay(met) + DAY, step: 0 });

  const later = { ...progress, review: { "part:roof": { due: startOfDay(met) + DAY * 10, step: 2 } } };
  assert.deepEqual(dueItems(later, startOfDay(met) + DAY * 2).map((i) => i.key), ["word:tower"], "a saved schedule wins");

  const [roof] = dueItems(progress, startOfDay(met) + DAY);
  const choices = choicesFor(roof, () => 0.3);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map((c) => c.key)).size, 4);
  assert.ok(choices.some((c) => c.key === "part:roof") && choices.every((c) => c.group === "part"), "choices come from the same group");
  const tower = dueItems(progress, startOfDay(met) + DAY).find((i) => i.key === "word:tower");
  assert.ok(tower && choicesFor(tower).every((c) => c.group === "word:build"));
});

test("saved review schedules keep only known words", () => {
  const progress = parseProgress(JSON.stringify({ review: { "word:house": { due: 5, step: 1.7 }, "word:rocket": { due: 5, step: 1 }, "part:roof": { due: "x" }, "verb:dance": { due: 1, step: 0 }, "verb:fly": { due: 1, step: 0 } } }));
  assert.deepEqual(progress.review, { "word:house": { due: 5, step: 1 }, "verb:fly": { due: 1, step: 0 } });
});
