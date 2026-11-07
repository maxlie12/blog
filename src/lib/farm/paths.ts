/**
 * Where the farm's people walk (world units, x to the east, z to the south). The fields, orchard
 * and pond layouts live here so the scene and the paths share them. People walk on a graph of
 * points (the house door, the lane north of the fields, the lanes between the plots, the gates,
 * the road, the pond bank, the river bank, the ranch lane and pens) and cut corners wherever a
 * straight line stays clear of plots, fences, buildings and water.
 *
 * The obstacles mirror what the scene builds; small props in the ranch lane are listed so the
 * paths thread between them at the ranch's top level, where the lane is fullest.
 */
import { PLOT_COLUMNS } from "./engine.ts";
import type { ChoreView } from "./chores.ts";
import { DUCK_POND, FIXTURES, LANE, TROUGH_OF, penRect, type PenId } from "./ranchLayout.ts";

export type Point = [number, number];
/** Where a point is: an area of the farm, a pen, or the paths between them. */
export type Place = "house" | "outside" | "farm" | "orchard" | "pond" | "river" | "ranch" | PenId;

/* ───────────── layout ───────────── */
export const FIELD = { x: -4.6, z: 0.7, pitch: 2.05, size: 1.74 };
export const ORCHARD = { x: -7.5, z: 8.55, pitch: 2.3 };
export const POND = { x: 6.1, z: 0.9, rx: 3.7, rz: 2.8 };
export const ROAD_Z = 5.4;
/** River centre line, from a spring at the foot of the mountain to the cliff edge. */
export const RIVER_POINTS: Point[] = [[9.3, -10.6], [10.6, -7.5], [12.2, -4.2], [12.6, -0.8], [12.1, 2.6], [12.5, 5.4], [12.5, 8.4], [11.55, 11.1]];
export const RIVER_HALF = 1.15;

export function plotPosition(index: number): Point {
  const col = index % PLOT_COLUMNS;
  const row = Math.floor(index / PLOT_COLUMNS);
  return [FIELD.x + (col - (PLOT_COLUMNS - 1) / 2) * FIELD.pitch, FIELD.z + (1 - row) * FIELD.pitch];
}

export function spotPosition(index: number): Point {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return [ORCHARD.x + (col - 1) * ORCHARD.pitch, ORCHARD.z + (row - 0.5) * ORCHARD.pitch];
}

/** A point of the pond from coordinates in its ellipse (±1 is the water's edge). */
export function pondPoint(x: number, z: number): Point {
  return [POND.x + x * POND.rx, POND.z + z * POND.rz];
}

/* ───────────── obstacles ───────────── */
type Shape =
  | { kind: "rect"; x0: number; x1: number; z0: number; z1: number }
  | { kind: "ellipse"; x: number; z: number; rx: number; rz: number }
  | { kind: "river" };
type Fence = [number, number, number, number];

/** How far a person keeps from things (about half their shoulders). */
export const BODY = 0.13;

const rect = (x: number, z: number, hx: number, hz: number): Shape => ({ kind: "rect", x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
const round = (x: number, z: number, r: number): Shape => ({ kind: "ellipse", x, z, rx: r, rz: r });

const FIELD_FENCE = { x0: FIELD.x - 4.75, x1: FIELD.x + 4.75, z0: FIELD.z - 3.65, z1: FIELD.z + 3.65 };
const ORCHARD_FENCE = { x0: ORCHARD.x - 3.7, x1: ORCHARD.x + 3.7, z0: ORCHARD.z - 2.45, z1: ORCHARD.z + 2.45 };

/** The fields' fence and trellis (the gates are the gaps), and the orchard's. */
const FENCES: Fence[] = [
  [FIELD_FENCE.x0, FIELD_FENCE.z0, FIELD_FENCE.x1, FIELD_FENCE.z0],
  [FIELD_FENCE.x0, FIELD_FENCE.z0, FIELD_FENCE.x0, FIELD_FENCE.z1],
  [FIELD_FENCE.x0, FIELD_FENCE.z1, FIELD.x - 0.9, FIELD_FENCE.z1],
  [FIELD.x + 0.9, FIELD_FENCE.z1, FIELD_FENCE.x1, FIELD_FENCE.z1],
  [FIELD_FENCE.x1, FIELD_FENCE.z0, FIELD_FENCE.x1, FIELD.z - 0.9],
  [FIELD_FENCE.x1, FIELD.z + 0.9, FIELD_FENCE.x1, FIELD_FENCE.z1],
  [ORCHARD_FENCE.x0, ORCHARD_FENCE.z0, ORCHARD.x - 0.7, ORCHARD_FENCE.z0],
  [ORCHARD.x + 0.7, ORCHARD_FENCE.z0, ORCHARD_FENCE.x1, ORCHARD_FENCE.z0],
  [ORCHARD_FENCE.x0, ORCHARD_FENCE.z1, ORCHARD_FENCE.x1, ORCHARD_FENCE.z1],
  [ORCHARD_FENCE.x0, ORCHARD_FENCE.z0, ORCHARD_FENCE.x0, ORCHARD_FENCE.z1],
  [ORCHARD_FENCE.x1, ORCHARD_FENCE.z0, ORCHARD_FENCE.x1, ORCHARD_FENCE.z1],
];

/** Where each pen's gate opens onto the lane (along the lane's side), shared with the scene. */
export const GATE_SPANS: Record<PenId, [number, number]> = { chicken: [7.25, 7.8], duck: [8.15, 8.75], sheep: [11.05, 11.75], cow: [9.45, 10.25] };

/** The pens' fences at a ranch level, with their gates onto the lane left open. */
function penFences(level: number): Fence[] {
  const h = penRect("chicken", level), d = penRect("duck", level), s = penRect("sheep", level), c = penRect("cow", level);
  const [hg0, hg1] = GATE_SPANS.chicken, [dg0, dg1] = GATE_SPANS.duck, [sg0, sg1] = GATE_SPANS.sheep, [cg0, cg1] = GATE_SPANS.cow;
  return [
    // The chicken yard, the fence it shares with the duck yard, then the duck yard's other sides.
    [h.x0, h.z0, h.x1, h.z0], [h.x0, h.z0, h.x0, h.z1], [h.x0, h.z1, h.x1, h.z1], [h.x1, h.z0, h.x1, hg0], [h.x1, hg1, h.x1, h.z1],
    [d.x0, d.z0, d.x0, d.z1], [d.x0, d.z1, d.x1, d.z1], [d.x1, d.z0, d.x1, dg0], [d.x1, dg1, d.x1, d.z1],
    [s.x0, s.z0, s.x1, s.z0], [s.x0, s.z0, s.x0, s.z1], [s.x0, s.z1, s.x1, s.z1], [s.x1, s.z0, s.x1, sg0], [s.x1, sg1, s.x1, s.z1],
    [c.x0, c.z0, c.x1, c.z0], [c.x1, c.z0, c.x1, c.z1], [c.x0, c.z1, c.x1, c.z1], [c.x0, c.z0, c.x0, cg0], [c.x0, cg1, c.x0, c.z1],
  ];
}

/** Gates onto the lane, as [x outside, x inside, z]. */
export const PEN_GATES: Record<PenId, [number, number, number]> = {
  chicken: [LANE.x0 + 0.3, LANE.x0 - 0.3, 7.52],
  duck: [LANE.x0 + 0.3, LANE.x0 - 0.3, 8.45],
  sheep: [LANE.x0 + 0.3, LANE.x0 - 0.3, 11.4],
  cow: [LANE.x1 - 0.15, LANE.x1 + 0.3, 9.62],
};

const fixture = (name: keyof typeof FIXTURES): Shape => rect(FIXTURES[name].x, FIXTURES[name].z, FIXTURES[name].hx, FIXTURES[name].hz);

/** Buildings, water and the plots: never walked through. */
const SOLID: Shape[] = [
  rect(-7.1, -4.9, 1.08, 0.88), // house
  rect(-2.1, -4.75, 1.4, 1.1), // barn
  rect(1.6, -3.3, 1.0, 0.72), // market stall
  round(-9.9, -2.4, 0.85), // windmill
  round(1.35, -1.05, 0.72), // picnic rug and basket
  // The pond with its rim of stones, the duck pond, and the pond's dock (three circles along it).
  { kind: "ellipse", x: POND.x, z: POND.z, rx: POND.rx * 1.17, rz: POND.rz * 1.17 },
  { kind: "ellipse", x: DUCK_POND.x, z: DUCK_POND.z, rx: DUCK_POND.rx + 0.08, rz: DUCK_POND.rz + 0.08 },
  ...[0, 0.5, 1].map((t) => round(1.475 + 1.41 * t, 2.44 + 0.77 * t, 0.62)),
  { kind: "river" },
  ...Array.from({ length: 12 }, (_, i) => {
    const [x, z] = plotPosition(i);
    return rect(x, z, FIELD.size / 2 - 0.04, FIELD.size / 2 - 0.04);
  }),
  ...Array.from({ length: 6 }, (_, i) => round(...spotPosition(i), 0.32)),
  ...(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]).map(fixture),
];

/** Small things in the ranch lane at its top level (bales, barrow, bench, cans, barrel, flower boxes, posts). */
const lane = (LANE.x0 + LANE.x1) / 2;
const LANE_PROPS: Shape[] = [
  rect(lane + 0.25, 10.0, 0.24, 0.27), rect(lane - 0.22, 10.05, 0.24, 0.27),
  rect(lane + 0.4, 10.95, 0.26, 0.26),
  rect(lane + 0.5, 11.75, 0.11, 0.33),
  round(lane + 0.62, 9.05, 0.1), round(lane + 0.55, 9.3, 0.1), round(lane - 0.6, 9.3, 0.17),
  rect(LANE.x0 + 0.12, 9.85, 0.08, 0.21), rect(LANE.x0 + 0.12, 12.6, 0.08, 0.21), rect(LANE.x1 - 0.12, 7.6, 0.08, 0.21), rect(LANE.x1 - 0.12, 11.3, 0.08, 0.21),
  round(LANE.x0 + 0.06, 7.05, 0.05), round(LANE.x1 - 0.06, 7.05, 0.05), round(LANE.x0 + 0.06, 11.95, 0.05), round(LANE.x1 - 0.06, 11.95, 0.05),
  round(LANE.x0 + 0.2, 6.4, 0.06), round(LANE.x1 - 0.2, 6.4, 0.06),
];

function distanceToRiver(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER_POINTS.length - 1; i += 1) {
    const [ax, az] = RIVER_POINTS[i];
    const [bx, bz] = RIVER_POINTS[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

function inShape(shape: Shape, x: number, z: number, margin: number): boolean {
  if (shape.kind === "rect") return x > shape.x0 - margin && x < shape.x1 + margin && z > shape.z0 - margin && z < shape.z1 + margin;
  if (shape.kind === "ellipse") {
    const dx = (x - shape.x) / (shape.rx + margin), dz = (z - shape.z) / (shape.rz + margin);
    return dx * dx + dz * dz < 1;
  }
  return distanceToRiver(x, z) < RIVER_HALF + margin;
}

function crosses([ax, az]: Point, [bx, bz]: Point, [cx, cz, dx, dz]: Fence): boolean {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** What blocks a point: a solid thing or a lane prop, within the body's reach (none when clear). */
export function blockedAt(x: number, z: number, margin = BODY): Shape | null {
  for (const shape of SOLID) if (inShape(shape, x, z, margin)) return shape;
  for (const shape of LANE_PROPS) if (inShape(shape, x, z, margin * 0.6)) return shape;
  return null;
}

/** Whether a person can walk straight from a to b at this ranch level. */
export function clearLine(a: Point, b: Point, level: number, margin = BODY): boolean {
  for (const fence of FENCES) if (crosses(a, b, fence)) return false;
  for (const fence of penFences(level)) if (crosses(a, b, fence)) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (blockedAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, margin)) return false;
  }
  return true;
}

/* ───────────── the walking graph ───────────── */
interface Node {
  at: Point;
  place: Place;
}

const NODES: Record<string, Node> = {};
const EDGES: [string, string][] = [];
const node = (id: string, x: number, z: number, place: Place) => (NODES[id] = { at: [x, z], place });
const link = (...ids: string[]) => {
  for (let i = 0; i < ids.length - 1; i += 1) EDGES.push([ids[i], ids[i + 1]]);
};

/** The fields: lanes round the plots and the gaps between them. */
const plotLeft = FIELD.x - 1.5 * FIELD.pitch - FIELD.size / 2;
const plotRight = FIELD.x + 1.5 * FIELD.pitch + FIELD.size / 2;
const plotTop = FIELD.z - FIELD.pitch - FIELD.size / 2;
const plotBottom = FIELD.z + FIELD.pitch + FIELD.size / 2;
export const FIELD_LANES_X = [(FIELD_FENCE.x0 + plotLeft) / 2, ...[-1, 0, 1].map((k) => FIELD.x + k * FIELD.pitch), (plotRight + FIELD_FENCE.x1) / 2];
export const FIELD_LANES_Z = [(FIELD_FENCE.z0 + plotTop) / 2, FIELD.z - FIELD.pitch / 2, FIELD.z + FIELD.pitch / 2, (plotBottom + FIELD_FENCE.z1) / 2];
FIELD_LANES_X.forEach((x, i) => FIELD_LANES_Z.forEach((z, j) => node(`f${i}${j}`, x, z, "farm")));
FIELD_LANES_X.forEach((_, i) => FIELD_LANES_Z.forEach((_, j) => {
  if (i + 1 < FIELD_LANES_X.length) link(`f${i}${j}`, `f${i + 1}${j}`);
  if (j + 1 < FIELD_LANES_Z.length) link(`f${i}${j}`, `f${i}${j + 1}`);
}));

// The house: a point just inside the door (hidden by the walls), the doorstep and the yard.
node("home", -6.66, -4.5, "house");
node("door", -6.58, -3.72, "outside");
node("yard", -5.8, -3.42, "outside");
node("north", -4.2, -3.4, "outside");
node("barnFront", -2.1, -3.42, "outside");
node("northEast", 0.42, -3.1, "outside");
node("eastPath", 0.45, -1.0, "outside");
node("eastGate", 0.62, FIELD.z, "outside");
node("eastLow", 0.62, 4.72, "outside");
link("home", "door", "yard", "north", "barnFront", "northEast", "eastPath", "eastGate", "eastLow");
link("eastGate", `f${FIELD_LANES_X.length - 1}1`, `f${FIELD_LANES_X.length - 1}2`);
// The fields' south gate, the stepping stones to the orchard gate, and the road east.
node("southGate", FIELD.x, FIELD_FENCE.z1 + 0.42, "outside");
link(`f2${FIELD_LANES_Z.length - 1}`, "southGate");
node("roadWest", -2.2, 4.75, "outside");
node("orchardGate", ORCHARD.x, ORCHARD_FENCE.z0 - 0.45, "outside");
link("orchardGate", "southGate", "roadWest", "eastLow");
node("roadLane", (LANE.x0 + LANE.x1) / 2, 4.7, "outside");
node("roadMid", 3.4, 4.62, "outside");
node("roadPond", 6.1, 4.58, "outside");
node("roadEast", 9.2, 4.55, "outside");
link("eastLow", "roadLane", "roadMid", "roadPond", "roadEast");

// The orchard: in at the north gate, then lanes round and between the trees.
node("orchardIn", ORCHARD.x, ORCHARD_FENCE.z0 + 0.5, "orchard");
link("orchardGate", "orchardIn");
const ORCHARD_LANES_X = [ORCHARD_FENCE.x0 + 0.5, ORCHARD.x - ORCHARD.pitch / 2, ORCHARD.x + ORCHARD.pitch / 2, ORCHARD_FENCE.x1 - 0.5];
const ORCHARD_LANES_Z = [ORCHARD_FENCE.z0 + 0.5, ORCHARD.z, ORCHARD_FENCE.z1 - 0.5];
ORCHARD_LANES_X.forEach((x, i) => ORCHARD_LANES_Z.forEach((z, j) => node(`o${i}${j}`, x, z, "orchard")));
ORCHARD_LANES_X.forEach((_, i) => ORCHARD_LANES_Z.forEach((_, j) => {
  if (i + 1 < ORCHARD_LANES_X.length) link(`o${i}${j}`, `o${i + 1}${j}`);
  if (j + 1 < ORCHARD_LANES_Z.length) link(`o${i}${j}`, `o${i}${j + 1}`);
}));
link("orchardIn", "o10", "orchardIn", "o20");

// The pond bank: a ring round the water, broken where the dock is.
const POND_RING = 1.36;
const POND_ANGLES = [-135, -110, -90, -60, -30, 30, 60, 90, 120, 180];
POND_ANGLES.forEach((a) => {
  const [x, z] = pondPoint(Math.cos((a * Math.PI) / 180) * POND_RING, Math.sin((a * Math.PI) / 180) * POND_RING);
  node(`p${a}`, x, z, "pond");
});
// The east bank is too close to the river for a ring point: that side goes by the river path.
for (let i = 0; i < POND_ANGLES.length - 2; i += 1) if (POND_ANGLES[i] !== -30) link(`p${POND_ANGLES[i]}`, `p${POND_ANGLES[i + 1]}`);
link("p90", "roadPond");
link("p120", "roadMid");
link("p180", "eastGate");
node("pondNorthWest", 0.62, -2.2, "outside");
link("eastPath", "pondNorthWest", "p-135");

// The river: up the west bank to the foot of the jetty.
node("riverLow", 10.5, 3.6, "outside");
node("riverMid", 10.95, 0.9, "outside");
node("jetty", 10.9, -1.2, "river");
link("roadEast", "riverLow", "riverMid", "jetty");
link("p-30", "riverMid", "p30");
link("p30", "riverLow");

// The ranch lane, threading past the feed store, pump, bales, barrow and bench, and the pens.
node("laneMouth", lane, 6.0, "ranch");
node("laneTop", lane, 6.33, "ranch");
node("laneCorner", 1.64, 6.36, "ranch");
node("laneStoreLow", 1.66, 7.3, "ranch");
node("laneChicken", 1.0, 7.5, "ranch");
node("lanePump", 0.98, 8.35, "ranch");
node("laneCans", 1.18, 8.85, "ranch");
node("laneBales", 1.25, 9.56, "ranch");
node("laneBalesLow", 1.82, 10.35, "ranch");
node("laneSheep", 1.0, 10.55, "ranch");
node("laneLow", 0.9, 11.3, "ranch");
node("laneEnd", 1.15, 11.88, "ranch");
link("roadLane", "laneMouth", "laneTop", "laneCorner", "laneStoreLow", "laneChicken", "lanePump", "laneCans", "laneBales", "cowOut", "laneBalesLow", "laneSheep", "laneLow", "laneEnd");
for (const pen of ["chicken", "duck", "sheep", "cow"] as PenId[]) {
  const [outside, inside, z] = PEN_GATES[pen];
  node(`${pen}Out`, outside, z, "ranch");
  node(`${pen}In`, inside, z, pen);
}
link("laneChicken", "chickenOut", "chickenIn");
link("lanePump", "duckOut", "duckIn");
link("laneLow", "sheepOut", "sheepIn");
link("cowOut", "cowIn");
// Inside the pens (all within the first, smallest pens): past the hen house, round the duck pond.
node("chickenMiddle", -1.0, 7.5, "chicken");
node("chickenWest", -2.3, 7.55, "chicken");
link("chickenIn", "chickenMiddle", "chickenWest");
node("duckEast", -0.55, 8.6, "duck");
node("duckNorthEast", -0.75, 8.1, "duck");
node("duckNorth", -1.45, 8.08, "duck");
node("duckSouthEast", -0.75, 9.15, "duck");
node("duckSouth", -1.45, 9.18, "duck");
link("duckIn", "duckEast", "duckNorthEast", "duckNorth");
link("duckEast", "duckSouthEast", "duckSouth");
node("sheepMiddle", -1.1, 11.4, "sheep");
link("sheepIn", "sheepMiddle");
node("cowMiddle", 3.1, 9.4, "cow");
link("cowIn", "cowMiddle");

/* ───────────── routes ───────────── */
const NEIGHBOURS = new Map<string, string[]>();
for (const [a, b] of EDGES) {
  NEIGHBOURS.set(a, [...(NEIGHBOURS.get(a) ?? []), b]);
  NEIGHBOURS.set(b, [...(NEIGHBOURS.get(b) ?? []), a]);
}

export function graphNodes(): { id: string; at: Point; place: Place }[] {
  return Object.entries(NODES).map(([id, item]) => ({ id, ...item }));
}

export function graphEdges(): [Point, Point, string, string][] {
  return EDGES.map(([a, b]) => [NODES[a].at, NODES[b].at, a, b]);
}

const length = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The node a point in `place` walks to first: the nearest one in the same place it can reach in a straight line. */
function entryNode(point: Point, place: Place | "any", level: number): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [id, item] of Object.entries(NODES)) {
    if (place !== "any" && item.place !== place) continue;
    const distance = length(point, item.at);
    if (distance < 1e-6) return id;
    if (distance < bestDistance && clearLine(point, item.at, level, 0.04)) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

function shortest(from: string, to: string): string[] | null {
  const distance = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    let current = "";
    let best = Infinity;
    for (const id of open) if ((distance.get(id) ?? Infinity) < best) [current, best] = [id, distance.get(id) ?? Infinity];
    open.delete(current);
    if (current === to) break;
    for (const next of NEIGHBOURS.get(current) ?? []) {
      const through = best + length(NODES[current].at, NODES[next].at);
      if (through < (distance.get(next) ?? Infinity)) {
        distance.set(next, through);
        previous.set(next, current);
        open.add(next);
      }
    }
  }
  if (!distance.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0]) as string);
  return path;
}

/**
 * The points to walk through from `from` (in `fromPlace`, or "any" for a point between places)
 * to `to` (in `toPlace`), ending at `to`.
 * Corners are cut wherever the straight line is clear; the house door is always walked through.
 * Falls back to a straight line when either end cannot reach the paths.
 */
export function route(from: Point, fromPlace: Place | "any", to: Point, toPlace: Place, level = 0): Point[] {
  if (fromPlace === toPlace && clearLine(from, to, level)) return [to];
  const start = entryNode(from, fromPlace, level);
  const end = entryNode(to, toPlace, level);
  const ids = start && end ? shortest(start, end) : null;
  if (!ids) return [to];
  const pinned = new Set(["home", "door"]);
  const stops = [{ at: from, pin: false }, ...ids.map((id) => ({ at: NODES[id].at, pin: pinned.has(id) })), { at: to, pin: false }]
    .filter((stop, i, all) => i === 0 || length(stop.at, all[i - 1].at) > 1e-6);
  const points = stops.map((stop) => stop.at);
  const keep = stops.map((stop) => stop.pin);
  // String-pull: from each kept point, jump to the furthest later point in clear view.
  const result: Point[] = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && (keep.slice(i + 1, j).some((k) => k === true) || !clearLine(points[i], points[j], level))) j -= 1;
    result.push(points[j]);
    i = j;
  }
  return result;
}

/** How long a route is, from `from`. */
export function routeLength(from: Point, points: Point[]): number {
  let total = 0;
  let last = from;
  for (const point of points) {
    total += length(last, point);
    last = point;
  }
  return total;
}

/* ───────────── where people stand to work ───────────── */
export interface Stand {
  at: Point;
  place: Place;
  /** The direction the person faces (radians about y; 0 looks to +z). */
  facing: number;
}

const facingTo = (from: Point, to: Point) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/** On the lane west of a plot, facing it: the camera (from the south-east) sees the farmer's front. */
export function plotStand(index: number): Stand {
  const [x, z] = plotPosition(index);
  const laneX = [...FIELD_LANES_X].reverse().find((lx) => lx < x) ?? x - FIELD.pitch / 2;
  const at: Point = [laneX, z + 0.25];
  return { at, place: "farm", facing: facingTo(at, [x, z]) };
}

/** South-west of a tree, facing its trunk, so its crown stays behind the person. */
export function treeStand(index: number): Stand {
  const [x, z] = spotPosition(index);
  const at: Point = [x - 0.52, z + 0.55];
  return { at, place: "orchard", facing: facingTo(at, [x, z]) };
}

/** On the bank, facing a point of the pond given in its ellipse. */
export function pondStand(u: number, v: number): Stand {
  const angle = Math.atan2(v, u);
  // The dock and the picnic rug take the west and south-west bank: stand beside them instead.
  const degrees = (angle * 180) / Math.PI;
  const usable = degrees > 125 && degrees < 175 ? 120 : degrees >= 175 || degrees < -165 ? 180 : degrees;
  const a = (usable * Math.PI) / 180;
  const at = pondPoint(Math.cos(a) * 1.3, Math.sin(a) * 1.3);
  return { at, place: "pond", facing: facingTo(at, pondPoint(u * 0.6, v * 0.6)) };
}

/** In the lane by a pen's trough, facing it over the fence (just north of the duck trough, clear of the water barrel). */
export function troughStand(pen: PenId): Stand {
  const item = FIXTURES[TROUGH_OF[pen]];
  const at: Point = pen === "cow" ? [LANE.x1 - 0.28, item.z] : pen === "duck" ? [LANE.x0 + 0.27, item.z - 0.18] : [LANE.x0 + 0.3, item.z];
  return { at, place: "ranch", facing: facingTo(at, [item.x, item.z]) };
}

/** In front of the incubator hut. */
export function incubatorStand(): Stand {
  const at: Point = [FIXTURES.incubator.x, FIXTURES.incubator.z - FIXTURES.incubator.hz - 0.32];
  return { at, place: "ranch", facing: 0 };
}

/** Beside a product lying in a pen (on its first clear side), facing it. */
export function dropStand(pen: PenId, x: number, z: number, level = 0): Stand {
  const pen_ = penRect(pen, level);
  const sides: Point[] = [[0.32, 0.08], [-0.32, 0.08], [0.05, 0.32], [0.05, -0.32]];
  const fits = (room: number) => ([dx, dz]: Point) => {
    const sx = x + dx, sz = z + dz;
    return sx > pen_.x0 + BODY && sx < pen_.x1 - BODY && sz > pen_.z0 + BODY && sz < pen_.z1 - BODY && !blockedAt(sx, sz, room);
  };
  const side = sides.find(fits(0.12)) ?? sides.find(fits(0.05));
  const at: Point = side ? [x + side[0], z + side[1]] : [x, z];
  return { at, place: pen, facing: facingTo(at, [x, z]) };
}

/** Spots the farmer wanders between in each area when there is nothing to do. */
export const IDLE_SPOTS: Record<ChoreView, { at: Point; place: Place }[]> = {
  farm: [[FIELD_LANES_X[2], FIELD_LANES_Z[3]], [FIELD_LANES_X[4], FIELD_LANES_Z[2]], [FIELD_LANES_X[1], FIELD_LANES_Z[3]], [FIELD_LANES_X[3], FIELD_LANES_Z[1]]].map((at) => ({ at: at as Point, place: "farm" as Place })),
  orchard: [[ORCHARD_LANES_X[1], ORCHARD.z], [ORCHARD_LANES_X[2], ORCHARD.z], [ORCHARD.x, ORCHARD_FENCE.z0 + 0.5]].map((at) => ({ at: at as Point, place: "orchard" as Place })),
  pond: [90, 60, 120].map((a) => ({ at: NODES[`p${a}`].at, place: "pond" as Place })),
  ranch: ["laneTop", "lanePump", "laneSheep"].map((id) => ({ at: NODES[id].at, place: "ranch" as Place })),
};

/** The foot of the jetty, where the farmer steps onto it to fish. */
export const JETTY_FOOT: Point = NODES.jetty.at;
export const HOME: Point = NODES.home.at;
export const DOORSTEP: Point = NODES.door.at;
