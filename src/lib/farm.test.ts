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
  game = Farm.advance(game, NOW + (def.growSeconds + def.fruitSeconds) / Farm.THIRSTY_GROWTH * 1000 + 5000, 7);
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

const HOUR_MS = Farm.GAME_HOUR_SECONDS * 1000;

function setPlot(game: Farm.GameState, index: number, patch: Partial<Farm.Plot>): Farm.GameState {
  const plots = game.plots.slice();
  plots[index] = { ...plots[index], ...patch };
  return { ...game, plots };
}

/** A farm whose clock reads `hour` on day `day` (1-based) at NOW. */
function farmAt(day: number, hour: number): Farm.GameState {
  const game = Farm.createGame(NOW);
  return { ...game, clockStart: NOW - ((day - 1) * 24 + hour) * HOUR_MS };
}

/** Advances in one-game-hour ticks, watering every plot and tree whenever it needs it. */
function tend(game: Farm.GameState, hours: number, waterIt = true): Farm.GameState {
  let current = game;
  for (let h = 0; h < hours; h += 1) {
    current = Farm.advance(current, current.lastTick + HOUR_MS, h + 1);
    if (!waterIt) continue;
    current.plots.forEach((_, i) => {
      const watered = Farm.water(current, i);
      if (watered.ok) current = watered.game;
    });
  }
  return current;
}

test("clock: a new farm starts at 6:00 on day 1 of spring; a day is 24 real minutes; seasons last a week", () => {
  const game = Farm.createGame(NOW);
  const start = Farm.gameClock(game, NOW);
  assert.equal(start.day, 1);
  assert.equal(Farm.formatClock(start.hour), "06:00");
  assert.equal(start.season, "spring");
  assert.equal(Farm.gameClock(game, NOW + 24 * 60 * 1000).day, 2);
  assert.equal(Farm.gameClock(game, NOW + 7 * 24 * HOUR_MS).season, "summer");
  assert.equal(Farm.gameClock(game, NOW + 28 * 24 * HOUR_MS).year, 2);
  assert.equal(Farm.daylightAt(12), 1);
  assert.equal(Farm.daylightAt(23), 0);
  assert.ok(Farm.daylightAt(6) > 0 && Farm.daylightAt(6) < 1);
  assert.equal(Farm.gameClock(game, NOW + 16 * HOUR_MS).asleep, true, "22:00");
});

test("water: soil dries over game hours, dry soil nearly stops growth, watering refills it", () => {
  let game = farmAt(1, 6);
  game = Farm.plant(game, 0, "cabbage").game;
  assert.equal(game.plots[0].moisture, 1);
  assert.equal(Farm.water(game, 0).ok, false, "freshly sown soil is moist");
  const dry = tend(game, 14, false);
  assert.equal(dry.plots[0].thirsty, true, "cabbage soil dries within a day");
  const tended = tend(game, 14);
  assert.equal(tended.plots[0].thirsty, false);
  assert.ok(tended.plots[0].growth > dry.plots[0].growth * 1.4, "a watered crop grows faster");
  const watered = Farm.water(dry, 0);
  assert.ok(watered.ok);
  assert.equal(watered.game.plots[0].moisture, 1);
});

test("seasons: out of season a crop grows at half speed; summer dries soil faster than winter", () => {
  const spring = Farm.plant(farmAt(1, 8), 0, "carrot").game;
  const summer = Farm.plant(farmAt(8, 8), 0, "carrot").game;
  const a = tend(spring, 10);
  const b = tend(summer, 10);
  assert.ok(Math.abs(b.plots[0].growth / a.plots[0].growth - Farm.OFF_SEASON_GROWTH) < 0.02);
  const summerDry = tend(Farm.plant(farmAt(8, 8), 0, "cabbage").game, 4, false).plots[0].moisture;
  const winterDry = tend(Farm.plant(farmAt(22, 8), 0, "cabbage").game, 4, false).plots[0].moisture;
  assert.ok(summerDry < winterDry);
});

test("crops: tomatoes harvest four times before the plant is spent; cabbage once", () => {
  const start = farmAt(1, 6);
  let game = Farm.plant({ ...start, xp: 9999, seeds: { ...start.seeds, tomato: 1 } }, 0, "tomato").game;
  assert.equal(game.plots[0].crop, "tomato");
  const def = Farm.CROP_MAP.tomato;
  game = setPlot(game, 0, { growth: def.growSeconds });
  for (let round = 1; round <= def.harvests; round += 1) {
    assert.ok(Farm.isRipe(game.plots[0]), `ripe before harvest ${round}`);
    game = Farm.harvest(setPlot(game, 0, { weeds: 0, bugs: 0 }), 0).game;
    if (round < def.harvests) {
      assert.equal(game.plots[0].status, "growing");
      assert.equal(Farm.cropStage(game.plots[0]), 2, "fruiting again, not a sprout");
      game = tend(game, def.regrowSeconds / Farm.GAME_HOUR_SECONDS + 1);
    }
  }
  assert.equal(game.plots[0].status, "withered");
  assert.equal(game.barn.crops.tomato, def.yield * def.harvests);
  let cabbage = Farm.plant(farmAt(1, 6), 1, "cabbage").game;
  cabbage = setPlot(cabbage, 1, { growth: Farm.CROP_MAP.cabbage.growSeconds });
  assert.equal(Farm.harvest(cabbage, 1).game.plots[1].status, "withered");
});

test("animals: bought young, grow up eating from the trough, then lay only by day", () => {
  let game = farmAt(1, 6);
  game = { ...game, coins: 500, items: { ...game.items, feed: 40 }, ranch: { ...game.ranch, animals: [] } };
  game = Farm.buyAnimal(game, "chicken").game;
  const chick = game.ranch.animals[0];
  assert.equal(Farm.isGrown(chick), false);
  assert.equal(Farm.animalName(chick), "Gà con");
  game = tend(game, Farm.ANIMAL_MAP.chicken.growSeconds / Farm.GAME_HOUR_SECONDS + 1, false);
  assert.ok(Farm.isGrown(game.ranch.animals[0]), "grown after a game day of eating");
  assert.equal(game.ranch.drops.length, 0, "the young lay nothing");
  // From 20:00 to 5:00 the hen sleeps.
  let night = { ...farmAt(1, 20), items: game.items, ranch: game.ranch };
  night = tend(night, 9, false);
  assert.equal(night.ranch.drops.length, 0);
  const day = tend({ ...farmAt(1, 6), items: game.items, ranch: game.ranch }, 12, false);
  assert.ok(day.ranch.drops.length >= 1);
});

test("orchard: an orange tree fruits in autumn and winter, slowly in spring", () => {
  const grownOrange = (game: Farm.GameState) => ({
    ...game,
    orchard: { spots: game.orchard.spots.map((spot, i) => (i === 0 ? { ...spot, status: "tree" as const, tree: "orange" as const, growth: Farm.TREE_MAP.orange.growSeconds, fruit: 0, moisture: 1 } : spot)) },
  });
  const spring = tend(grownOrange(farmAt(1, 8)), 10);
  const autumn = tend(grownOrange(farmAt(15, 8)), 10);
  assert.ok(Math.abs(spring.orchard.spots[0].fruit / autumn.orchard.spots[0].fruit - Farm.OFF_SEASON_FRUIT) < 0.02);
});

test("old saves get a clock at 6:00 in spring, keep their animals grown and their dry plots dry", () => {
  const game = Farm.createGame(NOW - 1000);
  const raw = JSON.parse(JSON.stringify({ ...game, plots: game.plots.map((plot, i) => (i === 0 ? { ...plot, status: "growing", crop: "carrot", growth: 30, thirsty: true } : plot)) }));
  delete raw.clockStart;
  for (const plot of raw.plots) {
    delete plot.moisture;
    delete plot.harvests;
  }
  raw.ranch.animals = [{ id: "a1", species: "cow", progress: 10, fed: true }];
  const loaded = Farm.parseSave(JSON.stringify(raw), NOW);
  assert.ok(loaded);
  assert.equal(Farm.formatClock(Farm.gameClock(loaded, NOW).hour), "06:00");
  assert.equal(loaded.plots[0].moisture, 0);
  assert.equal(loaded.plots[0].thirsty, true);
  assert.equal(loaded.plots[0].harvests, 0);
  assert.ok(Farm.isGrown(loaded.ranch.animals[0]));
  // 30 of the old 180 seconds is a sixth of the way, and stays a sixth of the new carrot time.
  assert.ok(Math.abs(loaded.plots[0].growth - Farm.CROP_MAP.carrot.growSeconds / 6) < 1);
  const ripe = JSON.parse(JSON.stringify(raw));
  ripe.plots[0].growth = 180;
  assert.ok(Farm.isRipe(Farm.parseSave(JSON.stringify(ripe), NOW)!.plots[0]), "a crop that was ripe stays ripe");
});
