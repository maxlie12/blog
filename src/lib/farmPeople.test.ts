import assert from "node:assert/strict";
import test from "node:test";
import * as Farm from "./farm/engine.ts";
import { choresBetween } from "./farm/chores.ts";
import type { FishingState } from "./farm/fishing.ts";
import { BODY_SIZE, CATCH_SECONDS, CHORE_ACTS, REST, SITTING, SPEED, STRIDE, chorePose, fishingPose, idlePose, phaseFor, stepLength, walkPose, type Pose } from "./farm/people.ts";
import { penRect, walkable } from "./farm/ranchLayout.ts";
import { DOORSTEP, HOME, IDLE_SPOTS, JETTY_FOOT, blockedAt, clearLine, dropStand, graphEdges, graphNodes, incubatorStand, plotStand, pondStand, route, treeStand, troughStand, type Place, type Point } from "./farm/paths.ts";

const LEVELS = [0, 3];

test("paths: every point of the walking graph is clear and every link can be walked at each ranch level", () => {
  const blocked = graphNodes().filter((item) => item.id !== "home" && blockedAt(...item.at, 0.08));
  assert.deepEqual(blocked.map((item) => item.id), [], "points inside something");
  for (const level of LEVELS) {
    const bad = graphEdges().filter(([a, b, ia, ib]) => ia !== "home" && ib !== "home" && !clearLine(a, b, level, 0.08));
    assert.deepEqual(bad.map(([, , a, b]) => `${a}-${b}`), [], `links blocked at level ${level}`);
  }
});

function walk(from: Point, fromPlace: Place, to: Point, toPlace: Place, level: number, label: string) {
  const points = route(from, fromPlace, to, toPlace, level);
  assert.deepEqual(points[points.length - 1], to, `${label}: ends at the target`);
  let last = from;
  for (const point of points) {
    const throughDoor = (last[0] === HOME[0] && last[1] === HOME[1]) || (point[0] === HOME[0] && point[1] === HOME[1]);
    if (!throughDoor) assert.ok(clearLine(last, point, level, 0.05), `${label}: [${last.map((n) => n.toFixed(2))}] → [${point.map((n) => n.toFixed(2))}] is clear`);
    last = point;
  }
  return points;
}

test("paths: from the house to every place of work, keeping out of plots, fences, buildings and water", () => {
  for (const level of LEVELS) {
    const targets: [string, Point, Place][] = [];
    for (let i = 0; i < 12; i += 1) targets.push([`plot ${i}`, plotStand(i).at, "farm"]);
    for (let i = 0; i < 6; i += 1) targets.push([`tree ${i}`, treeStand(i).at, "orchard"]);
    for (const [u, v] of [[0, -0.8], [0.8, 0], [0, 0.8], [-0.8, 0], [-0.6, 0.6], [-0.6, -0.6], [0.6, 0.6]]) targets.push([`pond ${u},${v}`, pondStand(u, v).at, "pond"]);
    for (const pen of ["poultry", "sheep", "cow"] as const) targets.push([`${pen} trough`, troughStand(pen).at, "ranch"]);
    targets.push(["incubator", incubatorStand().at, "ranch"]);
    targets.push(["jetty", JETTY_FOOT, "river"]);
    // Products lie where animals can stand: a grid of such points in each pen.
    for (const pen of ["poultry", "sheep", "cow"] as const) {
      const box = penRect(pen, level);
      for (let x = box.x0; x <= box.x1; x += 0.7) for (let z = box.z0; z <= box.z1; z += 0.7) if (walkable(pen, level, x, z)) targets.push([`${pen} drop ${x.toFixed(1)},${z.toFixed(1)}`, dropStand(pen, x, z, level).at, pen]);
    }
    for (const [view, spots] of Object.entries(IDLE_SPOTS)) spots.forEach((spot, i) => targets.push([`${view} idle ${i}`, spot.at, spot.place]));
    for (const [label, at, place] of targets) {
      assert.equal(blockedAt(...at, 0.05), null, `${label} stands clear`);
      const points = walk(HOME, "house", at, place, level, `${label} (level ${level})`);
      assert.deepEqual(points[0], DOORSTEP, `${label}: leaves by the door`);
      walk(at, place, HOME, "house", level, `${label} home (level ${level})`);
    }
    // Between areas, both ways.
    for (let a = 0; a < targets.length; a += 7) for (let b = 3; b < targets.length; b += 9) walk(targets[a][1], targets[a][2], targets[b][1], targets[b][2], level, `${targets[a][0]} → ${targets[b][0]}`);
  }
});

test("chores: each player action on the farm is read once, with its place", () => {
  const now = Date.UTC(2026, 10, 7, 2);
  let game = Farm.createGame(now);
  const step = (run: (g: Farm.GameState) => Farm.ActionResult) => {
    const result = run(game);
    assert.ok(result.ok, result.message);
    const chores = choresBetween(game, result.game);
    game = result.game;
    return chores.map((chore) => `${chore.kind}:${chore.view}:${chore.plot ?? chore.spot ?? chore.pond?.join(",") ?? chore.drop?.id ?? chore.species ?? ""}`);
  };
  assert.deepEqual(step((g) => Farm.plant(g, 1, "cabbage")), ["sow:farm:1"]);
  game = { ...game, plots: game.plots.map((plot, i) => (i === 1 ? { ...plot, moisture: 0.2, weeds: 1, bugs: 1 } : plot)) };
  assert.deepEqual(step((g) => Farm.water(g, 1)), ["water:farm:1"]);
  assert.deepEqual(step((g) => Farm.pullWeed(g, 1)), ["weed:farm:1"]);
  assert.deepEqual(step((g) => Farm.catchBug(g, 1)), ["bug:farm:1"]);
  assert.deepEqual(step((g) => Farm.fertilize(g, 1)), ["fertilize:farm:1"]);
  game = { ...game, plots: game.plots.map((plot, i) => (i === 1 ? { ...plot, growth: 1e9 } : plot)) };
  assert.deepEqual(step((g) => Farm.harvest(g, 1)), ["harvest:farm:1"]);
  assert.deepEqual(step((g) => Farm.hoe(g, 1)), ["hoe:farm:1"]);

  assert.deepEqual(step((g) => Farm.digSpot(g, 0)), ["dig:orchard:0"]);
  assert.deepEqual(step((g) => Farm.plantTree(g, 0, "lemon")), ["plantTree:orchard:0"]);
  game = { ...game, orchard: { spots: game.orchard.spots.map((spot, i) => (i === 0 ? { ...spot, moisture: 0.1, growth: 1e9, fruit: 1e9 } : spot)) } };
  assert.deepEqual(step((g) => Farm.waterTree(g, 0)), ["waterTree:orchard:0"]);
  assert.deepEqual(step((g) => Farm.shakeTree(g, 0)), ["shake:orchard:0"]);

  assert.deepEqual(step((g) => Farm.buyFry(g, "tilapia")), ["stockFish:pond:0.35,0.85"]);
  assert.deepEqual(step((g) => Farm.feedFish(g, now + 6 * 3600_000)), ["feedFish:pond:0.1,0.9"]);
  game = { ...game, pond: { ...game.pond, trash: [{ id: "t1", kind: "leaf", x: 0.4, z: -0.3 }] } };
  assert.deepEqual(step((g) => Farm.removeTrash(g, "t1")), ["skim:pond:0.4,-0.3"]);

  assert.deepEqual(step((g) => Farm.buyItem(g, "feed", 2)), ["stackFeed:ranch:", "pour:ranch:chicken"]);
  game = { ...game, ranch: { ...game.ranch, drops: [{ id: "d1", product: "egg", x: 0.2, z: -0.4 }] } };
  assert.deepEqual(step((g) => Farm.collectDrop(g, "d1")), ["collect:ranch:d1"]);
});

test("chores: time passing, a load and a long gap are never read as the player's work", () => {
  const now = Date.UTC(2026, 10, 7, 2);
  const start = Farm.plant(Farm.createGame(now), 0, "cabbage").game;
  // Ten minutes of farm time: soil dries, weeds, bugs, litter and products may appear.
  let later = start;
  for (let t = 1; t <= 600; t += 1) {
    const next = Farm.advance(later, now + t * 1000, t);
    assert.deepEqual(choresBetween(later, next), [], `second ${t}`);
    later = next;
  }
  // A save loaded after a while, or a new farm, even with watered soil.
  const watered = { ...later, lastTick: later.lastTick + 5 * 60_000, plots: later.plots.map((plot, i) => (i === 0 ? { ...plot, moisture: 1 } : plot)) };
  assert.deepEqual(choresBetween(later, watered), []);
  assert.deepEqual(choresBetween(later, { ...Farm.createGame(now + 1), plots: watered.plots }), []);
  assert.deepEqual(choresBetween(null, later), []);
});

test("poses: walking feet stay planted, and every chore and idle starts and ends at rest", () => {
  for (const hurry of [0, 1]) {
    const swing = STRIDE.walk + (STRIDE.hurry - STRIDE.walk) * hurry;
    const speed = hurry ? SPEED.hurry : SPEED.walk;
    // Through one stance (the left leg swinging from front to back), its foot should barely move on the ground.
    const start = Math.PI / 2, end = (3 * Math.PI) / 2;
    const duration = ((end - start) * stepLength(swing)) / Math.PI / speed;
    const feet: number[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const time = (duration * i) / 40;
      const phase = start + phaseFor(speed * time, swing);
      feet.push(speed * time + BODY_SIZE.leg * Math.sin(walkPose(phase, hurry).legL));
    }
    const slide = Math.max(...feet) - Math.min(...feet);
    assert.ok(slide < stepLength(swing) * 0.12, `hurry ${hurry}: the planted foot slides ${slide.toFixed(3)} of a ${stepLength(swing).toFixed(3)} step`);
  }
  const near = (a: Pose, b: Pose) => JSON.stringify(a, (_, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)) === JSON.stringify(b, (_, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v));
  for (const kind of Object.keys(CHORE_ACTS) as (keyof typeof CHORE_ACTS)[]) {
    assert.ok(near(chorePose(kind, 0), REST) && near(chorePose(kind, 1), REST), `${kind} starts and ends at rest`);
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = chorePose(kind, t);
      assert.ok(Math.max(...pose.armL, ...pose.armR) <= 3 && pose.lean <= 1.2 && pose.lean >= -0.3, `${kind} at ${t.toFixed(2)} keeps joints in range`);
    }
  }
  for (const kind of ["tend", "look", "wipe", "stretch"] as const) assert.ok(near(idlePose(kind, 0), REST) && near(idlePose(kind, 1), REST), `${kind} idle`);
});

test("poses: the angler casts from sitting, leans back with the line's tension and settles after a catch", () => {
  const state = (phase: FishingState["phase"], t: number, tension = 0) => ({ phase, t, tension, pull: 0 });
  assert.deepEqual(fishingPose(state("waiting", 0), 0, false), SITTING, "a cast starts from sitting");
  assert.ok(fishingPose(state("waiting", 0.1), 0, false).tool > 0.5, "the rod swings back");
  assert.ok(fishingPose(state("waiting", 0.34), 0, false).tool < 0, "then forward");
  assert.ok(fishingPose(state("reeling", 1, 0.9), 0, false).lean < fishingPose(state("reeling", 1, 0.2), 0, false).lean, "more tension, more lean back");
  assert.ok(fishingPose(state("bite", 0.2), 0, false).lean > SITTING.lean, "leans in at a bite");
  assert.deepEqual(fishingPose(state("caught", CATCH_SECONDS), 0, false), SITTING, "settles after a catch");
  assert.equal(fishingPose(state("spooked", 2), 0, false).turn, 0, "a miss ends looking ahead");
});
