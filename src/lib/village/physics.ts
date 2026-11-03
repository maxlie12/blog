/**
 * Light physics for Làng Rêu. Movable pieces slide or roll on the island plane, bounce off
 * buildings, walls and each other, get nudged by animals, float and drift in water, and fall
 * off the island's edge. Height is only used for drops, bounces and falling.
 *
 * Pure TypeScript with no three.js, so it runs and is tested in Node. Sleeping bodies cost
 * nothing per frame; only moving ones are simulated.
 */
import type { Point } from "./data";

export type DynamicKind = "ball" | "barrel" | "crate" | "pumpkin" | "boat";
/** `drag` slows a body in proportion to its speed; `brake` is a steady slowdown (m/s²) so it comes to a clear stop. */
export interface BodySpec { r: number; m: number; drag: number; brake: number; bounce: number; rolls: boolean }
export const BODY: Record<DynamicKind, BodySpec> = {
  ball: { r: 0.26, m: 0.4, drag: 0.35, brake: 1.1, bounce: 0.72, rolls: true },
  pumpkin: { r: 0.29, m: 2, drag: 0.6, brake: 1.8, bounce: 0.3, rolls: true },
  barrel: { r: 0.33, m: 3, drag: 0.8, brake: 3.2, bounce: 0.25, rolls: false },
  crate: { r: 0.33, m: 2.5, drag: 1.2, brake: 6, bounce: 0.15, rolls: false },
  boat: { r: 0.75, m: 6, drag: 1.5, brake: 7, bounce: 0.2, rolls: false },
};
export const isDynamic = (kind: string): kind is DynamicKind => kind in BODY;
export const GRAVITY = 14, WATER_Y = 0.05, MAX_SPEED = 14, FLOW = 1.1, HOLD_Y = 0.55;

export interface Body {
  id: number;
  kind: DynamicKind;
  x: number; z: number; y: number;
  vx: number; vz: number; vy: number;
  yaw: number;
  awake: boolean;
  rest: number;
  held: boolean;
  floating: boolean;
  gone: boolean;
}
export function makeBody(p: { id: number; kind: DynamicKind; x: number; z: number; r: number }, dropFrom = 0): Body {
  return { id: p.id, kind: p.kind, x: p.x, z: p.z, y: dropFrom, vx: 0, vz: 0, vy: 0, yaw: p.r, awake: dropFrom > 0, rest: 0, held: false, floating: false, gone: false };
}

export interface Circle { x: number; z: number; r: number }
/** Oriented rectangle; `rot` uses the scene's yaw convention (local +Z faces (sin rot, cos rot)). */
export interface Box { x: number; z: number; hx: number; hz: number; rot: number }
/** Something that pushes bodies but is not pushed back (an animal, a held object). */
export interface Mover { x: number; z: number; vx: number; vz: number; r: number }
interface Flow { x: number; z: number; fx: number; fz: number }

const CELL = 2;
const cell = (v: number) => Math.floor(v / CELL);
const cellKey = (i: number, j: number) => `${i},${j}`;
function insert<T>(map: Map<string, T[]>, x: number, z: number, reach: number, item: T) {
  for (let i = cell(x - reach); i <= cell(x + reach); i += 1) for (let j = cell(z - reach); j <= cell(z + reach); j += 1) {
    const k = cellKey(i, j);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
}
function* around<T>(map: Map<string, T[]>, x: number, z: number) {
  const ci = cell(x), cj = cell(z);
  for (let i = ci - 1; i <= ci + 1; i += 1) for (let j = cj - 1; j <= cj + 1; j += 1) {
    const list = map.get(cellKey(i, j));
    if (list) yield* list;
  }
}

export interface World {
  islandR: number;
  circles: Map<string, Circle[]>;
  boxes: Map<string, Box[]>;
  ponds: Circle[];
  flow: Map<string, Flow[]>;
  dry: (x: number, z: number) => boolean;
}

export function makeWorld(input: { islandR: number; circles?: Circle[]; boxes?: Box[]; ponds?: Circle[]; streams?: Point[][]; dry?: (x: number, z: number) => boolean }): World {
  const circles = new Map<string, Circle[]>(), boxes = new Map<string, Box[]>(), flow = new Map<string, Flow[]>();
  for (const c of input.circles ?? []) insert(circles, c.x, c.z, c.r, c);
  for (const b of input.boxes ?? []) insert(boxes, b.x, b.z, Math.hypot(b.hx, b.hz), b);
  for (const pts of input.streams ?? []) {
    const n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      insert(flow, pts[i][0], pts[i][1], 0, { x: pts[i][0], z: pts[i][1], fx: (b[0] - a[0]) / len, fz: (b[1] - a[1]) / len });
    }
  }
  return { islandR: input.islandR, circles, boxes, ponds: input.ponds ?? [], flow, dry: input.dry ?? (() => false) };
}

/** Water velocity at a point, or null on dry land. Ponds swirl gently; streams flow from their first point to their last. */
export function waterAt(world: World, x: number, z: number): { fx: number; fz: number } | null {
  if (world.dry(x, z)) return null;
  for (const p of world.ponds) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < p.r - 0.05) return d > 0.01 ? { fx: (-dz / d) * 0.15, fz: (dx / d) * 0.15 } : { fx: 0, fz: 0 };
  }
  let best: Flow | null = null, bestD = 0.95;
  for (const f of around(world.flow, x, z)) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best ? { fx: best.fx * FLOW, fz: best.fz * FLOW } : null;
}

type Moving = { x: number; z: number; vx: number; vz: number };
function reflect(c: Moving, nx: number, nz: number, bounce: number) {
  const vn = c.vx * nx + c.vz * nz;
  if (vn < 0) { c.vx -= (1 + bounce) * vn * nx; c.vz -= (1 + bounce) * vn * nz; }
}

/** Moves a circle of radius r out of every static collider it overlaps and bounces its velocity. */
export function pushOut(world: World, c: Moving, r: number, bounce: number) {
  let hit = false;
  for (const s of around(world.circles, c.x, c.z)) {
    const dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz), min = r + s.r;
    if (d >= min) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    c.x += nx * (min - d);
    c.z += nz * (min - d);
    reflect(c, nx, nz, bounce);
    hit = true;
  }
  for (const b of around(world.boxes, c.x, c.z)) {
    const cos = Math.cos(b.rot), sin = Math.sin(b.rot);
    const dx = c.x - b.x, dz = c.z - b.z;
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
    let nlx: number, nlz: number, depth: number;
    if (qx === lx && qz === lz) {
      // Centre inside the box: leave through the nearest side.
      const ox = b.hx - Math.abs(lx), oz = b.hz - Math.abs(lz);
      if (ox < oz) { nlx = Math.sign(lx) || 1; nlz = 0; depth = ox + r; } else { nlx = 0; nlz = Math.sign(lz) || 1; depth = oz + r; }
    } else {
      const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
      if (d >= r) continue;
      nlx = ex / d; nlz = ez / d; depth = r - d;
    }
    const nx = nlx * cos + nlz * sin, nz = -nlx * sin + nlz * cos;
    c.x += nx * depth;
    c.z += nz * depth;
    reflect(c, nx, nz, bounce);
    hit = true;
  }
  return hit;
}

/** Pushes every body near (x, z) outwards, like a small gust. Returns the bodies it moved. */
export function gust(bodies: Body[], x: number, z: number, radius = 2.6, power = 4.5) {
  const moved: Body[] = [];
  for (const b of bodies) {
    if (b.gone || b.held) continue;
    const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
    if (d > radius) continue;
    const k = (1 - d / radius) * power / Math.sqrt(BODY[b.kind].m);
    const nx = d > 0.01 ? dx / d : 1, nz = d > 0.01 ? dz / d : 0;
    b.vx += nx * k;
    b.vz += nz * k;
    b.vy = Math.max(b.vy, Math.min(2.2, k * 0.4));
    b.awake = true;
    b.rest = 0;
    moved.push(b);
  }
  return moved;
}

const speedOf = (b: Body) => Math.hypot(b.vx, b.vz);

/**
 * Advances every awake body by dt seconds. Held bodies follow the velocity the caller set.
 * Returns the bodies that came to rest this step and those that fell off the island.
 */
export function stepBodies(world: World, bodies: Body[], movers: Mover[], dt: number) {
  const settled: Body[] = [], fell: Body[] = [];
  const grid = new Map<string, Body[]>();
  for (const b of bodies) if (!b.gone) insert(grid, b.x, b.z, 0, b);

  // Animals and other movers nudge any body they walk into, awake or asleep.
  for (const m of movers) {
    for (const b of around(grid, m.x, m.z)) {
      if (b.held || b.gone) continue;
      const spec = BODY[b.kind];
      const dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz), min = m.r + spec.r;
      if (d >= min || b.y > 0.6) continue;
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      b.x += nx * (min - d);
      b.z += nz * (min - d);
      const vrel = (b.vx - m.vx) * nx + (b.vz - m.vz) * nz;
      if (vrel < 0.4) { b.vx += (0.4 - vrel) * (1 + spec.bounce) * nx; b.vz += (0.4 - vrel) * (1 + spec.bounce) * nz; }
      b.awake = true;
      b.rest = 0;
    }
  }

  const active = bodies.filter((b) => b.awake && !b.gone);
  if (!active.length) return { settled, fell };
  const inStep = new Set(active);
  const fastest = Math.max(...active.map(speedOf));
  const steps = Math.min(8, Math.max(1, Math.ceil((fastest * dt) / 0.12)));
  const h = dt / steps;

  for (let s = 0; s < steps; s += 1) {
    for (const b of active) {
      const spec = BODY[b.kind];
      if (b.held) {
        b.x += b.vx * h;
        b.z += b.vz * h;
        b.y += (HOLD_Y - b.y) * Math.min(1, h * 12);
        b.vy = 0;
        pushOut(world, b, spec.r, 0);
        continue;
      }
      const onIsland = Math.hypot(b.x, b.z) <= world.islandR;
      const water = onIsland ? waterAt(world, b.x, b.z) : null;
      b.floating = !!water;
      const ground = !onIsland ? -Infinity : water ? WATER_Y : 0;
      if (b.y > ground || b.vy > 0) {
        b.vy -= GRAVITY * h;
        b.y += b.vy * h;
      }
      if (b.y <= ground) {
        b.y = ground;
        b.vy = b.vy < -1.5 && !water ? -b.vy * spec.bounce * 0.6 : 0;
      }
      const grounded = b.y <= ground + 1e-3;
      if (water) {
        const k = 1 - Math.exp(-h * 1.6);
        b.vx += (water.fx - b.vx) * k;
        b.vz += (water.fz - b.vz) * k;
      } else if (grounded) {
        const speed = speedOf(b) * Math.exp(-h * spec.drag), slow = h * spec.brake;
        const scale = speed > slow ? (speed - slow) / speedOf(b) : 0;
        b.vx *= scale;
        b.vz *= scale;
      }
      b.x += b.vx * h;
      b.z += b.vz * h;
      if (onIsland && b.y > -0.3) pushOut(world, b, spec.r, spec.bounce);
    }

    for (const b of active) {
      for (const o of around(grid, b.x, b.z)) {
        if (o === b || o.gone || (inStep.has(o) && o.id < b.id)) continue; // each awake pair once
        const ra = BODY[b.kind].r, rb = BODY[o.kind].r;
        const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz);
        if (d >= ra + rb || Math.abs(o.y - b.y) > ra + rb) continue;
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        const ia = b.held ? 0 : 1 / BODY[b.kind].m, ib = o.held ? 0 : 1 / BODY[o.kind].m;
        if (ia + ib === 0) continue;
        const overlap = ra + rb - d;
        b.x -= nx * overlap * (ia / (ia + ib));
        b.z -= nz * overlap * (ia / (ia + ib));
        o.x += nx * overlap * (ib / (ia + ib));
        o.z += nz * overlap * (ib / (ia + ib));
        const vrel = (o.vx - b.vx) * nx + (o.vz - b.vz) * nz;
        if (vrel < 0) {
          const e = Math.min(BODY[b.kind].bounce, BODY[o.kind].bounce);
          const j = (-(1 + e) * vrel) / (ia + ib);
          b.vx -= j * ia * nx; b.vz -= j * ia * nz;
          o.vx += j * ib * nx; o.vz += j * ib * nz;
        }
        o.awake = true;
        o.rest = 0;
      }
    }
  }

  for (const b of active) {
    const speed = speedOf(b);
    if (speed > MAX_SPEED) { b.vx *= MAX_SPEED / speed; b.vz *= MAX_SPEED / speed; }
    if (b.y < -30) {
      b.gone = true;
      b.awake = false;
      fell.push(b);
      continue;
    }
    const resting = !b.held && !b.floating && b.y <= 1e-3 && speed < 0.06 && Math.abs(b.vy) < 0.01;
    b.rest = resting ? b.rest + dt : 0;
    if (b.rest > 0.35) {
      b.awake = false;
      b.vx = b.vz = b.vy = 0;
      settled.push(b);
    }
  }
  return { settled, fell };
}

/** The movable body under a point, if any (used by the hand tool). */
export function bodyAt(bodies: Body[], x: number, z: number, pad = 0.45) {
  let best: Body | null = null, bestD = Infinity;
  for (const b of bodies) {
    if (b.gone) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < BODY[b.kind].r + pad && d < bestD) { best = b; bestD = d; }
  }
  return best;
}
