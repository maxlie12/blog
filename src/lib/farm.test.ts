import assert from "node:assert/strict";
import test from "node:test";
import * as Farm from "./farm/engine.ts";
import { BITE_WINDOW, castLine, idleFishing, rollCatch, stepFishing, type FishingState } from "./farm/fishing.ts";
import { QUALITY_PRESETS } from "./farm/quality.ts";

const NOW = Date.UTC(2026, 10, 4, 3, 0, 0);

test("a new farm has an orchard with two open spots, a lemon sapling and bait", () => {
  const game = Farm.createGame(NOW);
  assert.deepEqual(game.orchard.spots.map((spot) => spot.status), ["grass", "grass", "locked", "locked", "locked", "locked"]);
  assert.equal(game.saplings.lemon, 1);
  assert.equal(game.items.bait, 8);
});

test("a tree is dug, planted, grows, fruits, is shaken and fruits again", () => {
  let game = Farm.createGame(NOW);
  assert.equal(Farm.plantTree(game, 0, "lemon").ok, false, "needs a hole first");
  game = Farm.digSpot(game, 0).game;
  assert.equal(game.orchard.spots[0].status, "hole");
  assert.equal(Farm.plantTree(game, 0, "orange").ok, false, "orange needs level 2");
  const planted = Farm.plantTree(game, 0, "lemon");
  assert.ok(planted.ok);
  game = planted.game;
  assert.equal(game.saplings.lemon, 0);
  assert.equal(Farm.shakeTree(game, 0).ok, false, "a sapling has no fruit");
  const def = Farm.TREE_MAP.lemon;
  // Long enough even if the tree is dry the whole time.
  game = Farm.advance(game, NOW + (def.growSeconds + def.fruitSeconds) * 2 * 1000 + 5000, 7);
  assert.ok(Farm.isTreeRipe(game.orchard.spots[0]));
  const shaken = Farm.shakeTree(game, 0);
  assert.ok(shaken.ok);
  assert.equal(shaken.game.barn.fruit.lemon, def.yield);
  assert.equal(shaken.game.orchard.spots[0].fruit, 0);
  assert.ok(Farm.isTreeGrown(shaken.game.orchard.spots[0]), "the tree stays and fruits again");
  const cut = Farm.removeTree(shaken.game, 0);
  assert.equal(cut.game.orchard.spots[0].status, "hole");
});

test("fruit and river fish sell from the barn, and selling everything empties them", () => {
  let game = Farm.createGame(NOW);
  game = { ...game, barn: { ...game.barn, fruit: { lemon: 3 }, wild: { perch: 2 } } };
  const today = Farm.dateKeyVN(NOW);
  const keys = Farm.barnEntries(game, today).map((entry) => entry.key);
  assert.ok(keys.includes("fruit:lemon") && keys.includes("wild:perch"));
  const sold = Farm.sellAll(game, today);
  assert.equal(sold.game.coins, game.coins + 3 * Farm.TREE_MAP.lemon.sellPrice + 2 * Farm.WILD_FISH_MAP.perch.sellPrice);
  assert.deepEqual(sold.game.barn.fruit, {});
  assert.deepEqual(sold.game.barn.wild, {});
});

test("old saves get the orchard, a sapling and bait; newer saves keep theirs", () => {
  const old = Farm.createGame(NOW) as Partial<Farm.GameState>;
  delete old.orchard;
  delete old.saplings;
  const raw = JSON.parse(JSON.stringify(old));
  delete raw.items.bait;
  const upgraded = Farm.parseSave(JSON.stringify(raw), NOW);
  assert.ok(upgraded);
  assert.equal(upgraded.orchard.spots.length, Farm.ORCHARD_SPOTS);
  assert.equal(upgraded.saplings.lemon, 1);
  assert.equal(upgraded.items.bait, 8);
  const current = Farm.createGame(NOW);
  const spent = { ...current, saplings: {}, items: { ...current.items, bait: 0 } };
  const reloaded = Farm.parseSave(JSON.stringify(spent), NOW);
  assert.equal(reloaded?.items.bait, 0);
  assert.deepEqual(reloaded?.saplings, {});
});

function reeling(caught: FishingState["catch"]): FishingState {
  return { ...idleFishing(3), phase: "reeling", catch: caught, at: [0, 0.6], weight: 1, tension: 0.3, pullLeft: 0.6 };
}

function run(state: FishingState, seconds: number, holding: boolean) {
  let current = state;
  for (let t = 0; t < seconds && current.phase === state.phase; t += 1 / 30) current = stepFishing(current, 1 / 30, { holding, tapped: false });
  return current;
}

test("fishing: wait, strike in time, and the early or late strike", () => {
  const cast = castLine([0, 0.6], 0, 11);
  assert.equal(cast.phase, "waiting");
  assert.ok(cast.biteAt > 2 && cast.biteAt < 7.1);
  assert.equal(stepFishing(cast, 0.1, { holding: true, tapped: true }).phase, "spooked", "striking before the bite scares the fish");
  const bite = run(cast, 10, false);
  assert.equal(bite.phase, "bite");
  assert.equal(stepFishing(bite, 0.1, { holding: true, tapped: true }).phase, "reeling");
  assert.equal(stepFishing(bite, BITE_WINDOW + 0.05, { holding: false, tapped: false }).phase, "late");
});

test("fishing: a small fish reels in, a big one snaps a line held through its pulls, a slack line loses it", () => {
  assert.equal(run(reeling("goby"), 30, true).phase, "caught");
  assert.equal(run(reeling("featherback"), 30, true).phase, "snapped");
  assert.equal(run(reeling("perch"), 30, false).phase, "slack");
});

test("fishing: only fish open at the player's level bite, and a catch uses one bait", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i += 1) {
    const caught = rollCatch(0, random);
    assert.ok(caught === "boot" || Farm.WILD_FISH_MAP[caught].level === 1, caught);
  }
  const game = Farm.createGame(NOW);
  const landed = Farm.landCatch(game, "perch", 0.25);
  assert.equal(landed.game.items.bait, game.items.bait - 1);
  assert.equal(landed.game.barn.wild.perch, 1);
  const boot = Farm.landCatch(game, "boot", 0.7);
  assert.deepEqual(boot.game.barn.wild, {});
  assert.equal(Farm.loseBait(game, "snapped").game.items.bait, game.items.bait - 1);
});

test("graphics presets: only High runs the full-screen effects, and lighter presets draw less", () => {
  assert.deepEqual(Object.entries(QUALITY_PRESETS).filter(([, preset]) => preset.post).map(([name]) => name), ["high"]);
  const { high, medium, low } = QUALITY_PRESETS;
  assert.ok(high.grass > medium.grass && medium.grass > low.grass);
  assert.ok(high.flowers > medium.flowers && medium.flowers > low.flowers);
  assert.equal(low.shadows, false);
});
