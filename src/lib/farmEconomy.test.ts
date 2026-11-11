import assert from "node:assert/strict";
import test from "node:test";
import * as Farm from "./farm/engine.ts";
import { choresBetween } from "./farm/chores.ts";

const NOW = Date.UTC(2026, 10, 11, 3);

/** A rich, high-level farm at 10:00 with every workshop built. */
function richFarm(): Farm.GameState {
  let game = Farm.createGame(NOW);
  game = { ...game, clockStart: NOW - 10 * 60_000, coins: 100_000, xp: 1_000_000 };
  for (const def of Farm.WORKSHOPS) game = Farm.buildWorkshop(game, def.id).game;
  return game;
}
const stock = (game: Farm.GameState, barn: Partial<Farm.GameState["barn"]>): Farm.GameState => ({ ...game, barn: { ...game.barn, ...barn } });
function run(game: Farm.GameState, seconds: number, from = game.lastTick): Farm.GameState {
  let next = game;
  for (let t = 1; t <= seconds; t += 1) next = Farm.advance(next, from + t * 1000, t);
  return next;
}

test("workshops: levels cost more each time, open a second recipe, then work faster in batches", () => {
  let game = stock(richFarm(), { products: { egg: 20, milk: 5 }, crops: { rice: 10 } });
  assert.equal(Farm.startWorkshop(game, "bakery", 1).ok, false, "the second recipe needs level 2");
  const costs: number[] = [];
  for (let level = 2; level <= Farm.WORKSHOP_MAX_LEVEL; level += 1) {
    costs.push(Farm.workshopUpgradeCost(game, "bakery") as number);
    const result = Farm.upgradeWorkshop(game, "bakery");
    assert.ok(result.ok, result.message);
    game = result.game;
  }
  assert.deepEqual(costs, [600, 1600, 4000]);
  assert.equal(Farm.workshopUpgradeCost(game, "bakery"), null);
  assert.equal(Farm.upgradeWorkshop(game, "bakery").ok, false);
  assert.equal(game.coins, 100_000 - 150 - 200 - 280 - 350 - 6200);

  // Level 4: three batches at once, twice as fast.
  const started = Farm.startWorkshop(game, "bakery");
  assert.ok(started.ok);
  assert.equal(started.game.barn.products.egg, 14);
  assert.equal(started.game.barn.crops.rice, 7);
  assert.equal(Farm.workshopSeconds("bakery", started.game.ranch.workshops.bakery), 60);
  game = run(started.game, 61);
  assert.equal(game.ranch.workshops.bakery?.ready, 3);
  // Cakes must be taken out before the oven makes cream cakes.
  assert.equal(Farm.startWorkshop(game, "bakery", 1).ok, false);
  game = Farm.collectWorkshop(game, "bakery").game;
  assert.equal(game.barn.goods.cake, 3);
  const cream = Farm.startWorkshop(game, "bakery", 1);
  assert.ok(cream.ok, cream.message);
  assert.equal(cream.game.barn.goods.cake, 1, "one batch: two cakes and a milk");
  assert.equal(cream.game.barn.products.milk, 4);
  game = Farm.collectWorkshop(run(cream.game, 106), "bakery").game;
  assert.equal(game.barn.goods.creamCake, 1);
  assert.ok(Farm.GOOD_MAP.creamCake.sellPrice > 2 * Farm.GOOD_MAP.cake.sellPrice + Farm.PRODUCT_MAP.milk.sellPrice, "worth more than its parts");
  for (const def of Farm.WORKSHOPS) {
    const extra = Farm.WORKSHOP_EXTRA[def.id];
    assert.ok((extra.inputs.goods?.[def.output] ?? 0) > 0, `${def.id}: the second recipe uses the first one's goods`);
  }
});

test("truck: each new truck carries more, comes back sooner and sells for more", () => {
  let game = stock(richFarm(), { goods: { cheese: 60 } });
  assert.equal(Farm.sendTruck(game, { "good:cheese": 21 }, NOW, "2026-11-11").ok, false, "the first truck takes 20");
  const before = Farm.truckValue(game, { "good:cheese": 20 }, "2026-11-11").value;
  for (let i = 1; i < Farm.TRUCK_LEVELS.length; i += 1) {
    const result = Farm.upgradeTruck(game);
    assert.ok(result.ok, result.message);
    game = result.game;
    assert.ok(Farm.TRUCK_LEVELS[i].cost > Farm.TRUCK_LEVELS[i - 1].cost && Farm.TRUCK_LEVELS[i].capacity > Farm.TRUCK_LEVELS[i - 1].capacity);
  }
  assert.equal(Farm.upgradeTruck(game).ok, false);
  assert.ok(Farm.truckValue(game, { "good:cheese": 20 }, "2026-11-11").value > before);
  const sent = Farm.sendTruck(game, { "good:cheese": 60 }, NOW, "2026-11-11");
  assert.ok(sent.ok, sent.message);
  assert.equal((sent.game.ranch.truck?.returnAt ?? 0) - NOW, 45_000);
  assert.equal(Farm.upgradeTruck(sent.game).ok, false);
});

test("helpers: a cat carries products to the barn by itself, and that is not the player's chore", () => {
  let game = richFarm();
  game = { ...game, ranch: { ...game.ranch, drops: [1, 2, 3].map((i) => ({ id: `d${i}`, product: "egg" as const, x: 0, z: 0 })) } };
  assert.equal(run(game, 60).ranch.drops.length, 3, "no cat: products wait");
  const bought = Farm.buyCat(game);
  assert.ok(bought.ok);
  assert.equal(bought.game.coins, game.coins - 800);
  let next = bought.game;
  for (let t = 1; t <= 60; t += 1) {
    const after = Farm.advance(next, NOW + t * 1000, t);
    assert.deepEqual(choresBetween(next, after).filter((chore) => chore.kind === "collect"), [], "the farmer does not walk over for the cat's work");
    next = after;
  }
  assert.equal(next.ranch.drops.length, 1);
  assert.equal(next.barn.products.egg, 2);
  // Two cats work twice as fast; there is no third.
  const two = Farm.buyCat(bought.game);
  assert.ok(two.ok);
  assert.equal(run(two.game, 26).ranch.drops.length, 1);
  assert.equal(Farm.buyCat(two.game).ok, false);
  // The player's own pick-up is still a chore.
  assert.equal(choresBetween(game, Farm.collectDrop(game, "d1").game).filter((chore) => chore.kind === "collect").length, 1);
});

test("bear: comes only in live play by day, stops production, can be caged for coins, and never costs an animal", () => {
  let game = richFarm();
  const animals = ["chicken", "chicken", "cow"].map((species, i) => ({ id: `a${i}`, species: species as Farm.AnimalId, progress: 0, fed: true, age: 1e9 }));
  game = { ...game, items: { ...game.items, feed: 50 }, ranch: { ...game.ranch, animals } };
  // Away for an hour: no bear.
  assert.ok(!Farm.advance(game, NOW + 3600_000, 1).ranch.bear);
  // Live play: one turns up within a while.
  let live = game;
  let t = 0;
  while (!live.ranch.bear && t < 3600) live = Farm.advance(live, NOW + (t += 1) * 1000, t);
  assert.ok(live.ranch.bear, "a bear comes during an hour of play");
  const at = live.lastTick;
  const progress = live.ranch.animals.map((animal) => animal.progress);
  const scared = Farm.advance(live, at + 4000, 7);
  assert.deepEqual(scared.ranch.animals.map((animal) => animal.progress), progress, "animals stop while it is there");
  assert.equal(scared.ranch.animals.length, 3);
  // Tapping cages it.
  let caged = scared;
  for (let i = 0; i < Farm.BEAR.taps; i += 1) caged = Farm.tapBear(caged).game;
  assert.equal(caged.ranch.bear, null);
  assert.ok(caged.coins > scared.coins);
  assert.equal(Farm.tapBear(caged).ok, false);
  // Left alone it goes by itself, and the animals carry on.
  const gone = Farm.advance(scared, at + (Farm.BEAR.staySeconds + 5) * 1000, 9);
  assert.equal(gone.ranch.bear, null);
  const after = Farm.advance(gone, gone.lastTick + 4000, 11);
  assert.ok(after.ranch.animals.some((animal, i) => animal.progress !== progress[i] || animal.fed !== live.ranch.animals[i].fed));
  // With a dog it stays only a moment.
  let guarded = Farm.buyDog(game).game;
  t = 0;
  while (!guarded.ranch.bear && t < 3600) guarded = Farm.advance(guarded, NOW + (t += 1) * 1000, t);
  assert.ok(guarded.ranch.bear && guarded.ranch.bear.until - guarded.lastTick <= Farm.BEAR.dogSeconds * 1000);
  // A small or new farm is left alone.
  assert.ok(!run(Farm.createGame(NOW), 900).ranch.bear);
});

test("orders: three standing orders for things the farm makes; delivering pays above market and brings a new one", () => {
  let game = Farm.advance(richFarm(), NOW + 1000, 1);
  const orders = game.ranch.orders ?? [];
  assert.equal(orders.length, Farm.ORDER_SLOTS);
  assert.equal(new Set(orders.map((order) => order.id)).size, 3);
  const order = orders[0];
  assert.equal(Farm.canFillOrder(game, order), false);
  assert.equal(Farm.fillOrder(game, order.id).ok, false);
  const value = order.items.reduce((sum, item) => sum + item.qty * Farm.unitPrice(item.kind, item.id, "2026-01-01"), 0);
  assert.ok(order.reward > value * 1.3, `reward ${order.reward} for goods worth about ${value}`);
  for (const item of order.items) {
    const bucket = item.kind === "crop" ? "crops" : item.kind === "product" ? "products" : "goods";
    game = stock(game, { [bucket]: { ...game.barn[bucket], [item.id]: item.qty + 1 } });
  }
  const filled = Farm.fillOrder(game, order.id);
  assert.ok(filled.ok, filled.message);
  assert.equal(filled.game.coins, game.coins + order.reward);
  assert.equal(filled.game.ranch.ordersDone, 1);
  assert.equal(filled.game.ranch.orders?.length, 3);
  assert.ok(!filled.game.ranch.orders?.some((item) => item.id === order.id));
  const swapped = Farm.swapOrder(filled.game, filled.game.ranch.orders?.[1].id ?? "");
  assert.ok(swapped.ok);
  assert.equal(swapped.game.coins, filled.game.coins - Farm.ORDER_SWAP_COST);
  assert.equal(swapped.game.ranch.orders?.length, 3);
  // A brand-new farm gets orders it can grow.
  const fresh = Farm.advance(Farm.createGame(NOW), NOW + 1000, 1);
  assert.ok(fresh.ranch.orders?.every((item) => item.items.every((entry) => entry.kind === "crop" || entry.kind === "product")));
});

test("saves: an older save loads with the new parts at their start, and a new one round-trips", () => {
  const old = JSON.parse(JSON.stringify(richFarm())) as Record<string, unknown>;
  const loaded = Farm.parseSave(JSON.stringify(old), NOW);
  assert.ok(loaded);
  assert.equal(Farm.workshopLevel(loaded.ranch.workshops.bakery), 1);
  assert.deepEqual([loaded.ranch.truckLevel, loaded.ranch.cats, loaded.ranch.dog, loaded.ranch.bear], [0, 0, false, null]);
  let game = Farm.upgradeWorkshop(Farm.buyDog(Farm.buyCat(Farm.upgradeTruck(richFarm()).game).game).game, "loom").game;
  game = Farm.advance(game, NOW + 1000, 1);
  const again = Farm.parseSave(JSON.stringify(game), NOW + 1000);
  assert.ok(again);
  assert.deepEqual([again.ranch.truckLevel, again.ranch.cats, again.ranch.dog, Farm.workshopLevel(again.ranch.workshops.loom)], [1, 1, true, 2]);
  assert.deepEqual(again.ranch.orders, game.ranch.orders);
});
