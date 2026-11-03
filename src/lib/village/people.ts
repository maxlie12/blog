/**
 * Villagers of Làng Rêu. Every house has one or two residents, and eight professions can be
 * invited by learning their word. People pick small jobs that fit their role and what is built
 * nearby (watering a garden, fishing at a pond, chopping wood, playing football), walk there,
 * do it for a while, and go home at night.
 *
 * Bodies are baked meshes (one draw call each); legs are one shared instanced mesh so they can
 * swing while walking. The scene gives this module read access to the village through a small
 * context and asks it for movers (to push balls) and for what a tapped person is doing.
 */
import * as THREE from "three";
import { BUILD_R, TOOL, rng, type House, type Point, type Prop, type PropKind, type VillageScene, type WordId } from "./data";
import { G, M, bake, painter, pick, shade, type Draw, type Part } from "./kit";
import { pushOut, waterAt, type Body, type Mover, type World } from "./physics";
import { RESIDENTS, type ActionId, type PartId, type ResidentId } from "./vocab";

const PROFESSIONS = ["farmer", "baker", "fisherman", "shepherd", "woodcutter", "postman", "musician", "child"] as const;
type Profession = (typeof PROFESSIONS)[number];
type Role = Profession | ResidentId;
const isProfession = (kind: string): kind is Profession => (PROFESSIONS as readonly string[]).includes(kind);

const SKIN = ["#f1c9a5", "#e0ac7f", "#c68a5e", "#8d5a3b"];
const SHIRTS = ["#c94f4f", "#4e7287", "#6c7f55", "#d9a441", "#8a5c9e", "#e8e2d4", "#3f7a6a"];
const PANTS = ["#3f4a5c", "#5b4636", "#2f3b33", "#6b5b4b"];
const HAIR = ["#2b2220", "#5a3b22", "#8a5a2b", "#c9a05a"];
const GRAY = "#d8d4cc";
const HIP = 0.3;
const WALK = 0.7, RUN = 1.35;

interface Look { skin: string; shirt: string; pants: string; hair: string; scale: number }
function lookFor(role: Role, seed: number): Look {
  const r = rng(seed);
  const young = role === "child" || role === "boy" || role === "girl";
  const old = role === "grandpa" || role === "grandma" || role === "fisherman";
  return { skin: pick(SKIN, r), shirt: pick(SHIRTS, r), pants: pick(PANTS, r), hair: old ? GRAY : pick(HAIR, r), scale: young ? 0.72 : 1 };
}

/** A small person with feet at the origin facing +Z. Legs are optional (the scene animates them separately). */
function drawPerson({ p }: Draw, role: Role, look: Look, legs: boolean) {
  const long = role === "woman" || role === "girl" || role === "grandma";
  if (legs) for (const s of [-1, 1]) p(G.box, look.pants, s * 0.055, HIP / 2, 0, 0.085, HIP, 0.1);
  p(G.box, look.shirt, 0, HIP + 0.14, 0, 0.24, 0.28, 0.15);
  if (long) p(G.taper, shade(look.shirt, -0.08), 0, 0.25, 0, 0.34, 0.24, 0.26);
  for (const s of [-1, 1]) {
    p(G.box, look.shirt, s * 0.155, HIP + 0.15, 0, 0.065, 0.26, 0.07, 0, 0, s * 0.12);
    p(G.sphere, look.skin, s * 0.17, HIP + 0.01, 0, 0.07, 0.07, 0.07);
    p(G.sphere, "#2b2220", s * 0.045, 0.71, 0.1, 0.03, 0.03, 0.02);
  }
  p(G.sphere, look.skin, 0, 0.7, 0, 0.22, 0.22, 0.21);
  p(G.dome, look.hair, 0, 0.735, -0.015, 0.235, 0.2, 0.235);
  if (long) p(G.box, look.hair, 0, 0.62, -0.08, 0.2, 0.2, 0.07);
  if (role === "grandma") p(G.sphere, GRAY, 0, 0.8, -0.1, 0.1, 0.1, 0.1);
  if (role === "girl") p(G.box, "#e57f9e", 0.08, 0.82, -0.02, 0.08, 0.05, 0.04);
  if (role === "grandpa") p(G.cyl6, "#6b4f3a", 0.2, 0.2, 0.06, 0.025, 0.4, 0.025);
  if (role === "farmer") {
    p(G.cone8, "#e3c76a", 0, 0.86, 0, 0.52, 0.17, 0.52);
    p(G.cyl8, "#7a9aa8", 0.2, 0.28, 0.08, 0.12, 0.12, 0.12);
    p(G.box, "#7a9aa8", 0.2, 0.3, 0.17, 0.03, 0.03, 0.12, 0, -0.5);
  } else if (role === "baker") {
    p(G.cyl12, "#ffffff", 0, 0.86, 0, 0.18, 0.12, 0.18);
    p(G.sphere, "#ffffff", 0, 0.94, 0, 0.22, 0.1, 0.22);
    p(G.box, "#ffffff", 0, HIP + 0.08, 0.08, 0.2, 0.3, 0.01);
    p(G.box, "#b18a5e", -0.2, 0.3, 0.1, 0.16, 0.08, 0.12);
    p(G.ico0, "#d9a45a", -0.2, 0.36, 0.1, 0.12, 0.06, 0.08);
  } else if (role === "fisherman") {
    p(G.cyl12, "#6c7f55", 0, 0.84, 0, 0.3, 0.03, 0.3);
    p(G.cyl12, "#6c7f55", 0, 0.88, 0, 0.2, 0.08, 0.2);
    p(G.cyl6, "#8a6644", 0.22, 0.6, 0.35, 0.02, 1.0, 0.02, 0, 0.9);
  } else if (role === "shepherd") {
    p(G.cyl12, "#8a5c3e", 0, 0.84, 0, 0.36, 0.03, 0.36);
    p(G.cyl12, "#8a5c3e", 0, 0.88, 0, 0.2, 0.08, 0.2);
    p(G.cyl6, "#7a5a3e", 0.2, 0.45, 0.05, 0.03, 0.95, 0.03);
    p(G.torus, "#7a5a3e", 0.2, 0.95, 0.1, 0.12, 0.12, 0.12, Math.PI / 2);
  } else if (role === "woodcutter") {
    p(G.dome, "#c94f4f", 0, 0.76, 0, 0.24, 0.22, 0.24);
    p(G.box, "#8a6644", 0.2, 0.32, 0.08, 0.03, 0.34, 0.03);
    p(G.box, "#9aa3a8", 0.2, 0.47, 0.13, 0.03, 0.08, 0.1);
  } else if (role === "postman") {
    p(G.cyl12, "#4e7287", 0, 0.82, 0, 0.24, 0.07, 0.24);
    p(G.box, "#2f4250", 0, 0.8, 0.12, 0.14, 0.02, 0.08);
    p(G.box, "#8a5c3e", -0.17, HIP + 0.02, 0.06, 0.1, 0.12, 0.16);
    p(G.box, "#ffffff", -0.17, HIP + 0.1, 0.1, 0.07, 0.05, 0.01);
  } else if (role === "musician") {
    p(G.sphere, "#b06a35", 0.04, HIP + 0.06, 0.12, 0.2, 0.24, 0.07, 0, 0, -0.5);
    p(G.box, "#6b4630", -0.08, HIP + 0.22, 0.13, 0.03, 0.3, 0.02, 0, 0, -0.9);
  } else if (role === "child") {
    p(G.cyl12, "#d9453b", 0, 0.82, 0, 0.24, 0.05, 0.24);
    p(G.box, "#d9453b", 0, 0.81, 0.12, 0.14, 0.02, 0.08);
  }
}

/** Thumbnail / placement models for the eight professions (with legs). */
export const PERSON_MODELS = Object.fromEntries(
  PROFESSIONS.map((role) => [role, (d: Draw, r: () => number) => {
    drawPerson(d, role, lookFor(role, Math.floor(r() * 1e6) + PROFESSIONS.indexOf(role) * 7919), true);
  }]),
) as Record<Profession, (d: Draw, r: () => number) => void>;

const TRAVEL: ActionId[] = ["walk", "goHome", "carryBread", "deliver", "runAround"];
const HATS: Role[] = ["farmer", "baker", "fisherman", "shepherd", "woodcutter", "postman", "child"];
/** Part labels on a person, in the body mesh's frame (feet at the origin, front +Z). */
export function personMarks(role: Role): [PartId, number, number, number][] {
  const out: [PartId, number, number, number][] = [
    HATS.includes(role) ? ["hat", 0, 0.95, 0] : ["hair", 0, 0.86, -0.06],
    ["arm", 0.2, 0.5, 0], ["hand", -0.2, 0.3, 0.04], ["leg", 0.07, 0.12, 0.06],
  ];
  if (role === "fisherman") out.push(["pole", 0.22, 0.95, 0.75]);
  if (role === "shepherd" || role === "grandpa") out.push(["pole", 0.2, 0.62, 0.06]);
  if (role === "woodcutter") out.push(["axe", 0.2, 0.5, 0.16]);
  return out;
}

interface Task {
  action: ActionId;
  to: Point;
  /** Where to look once there. */
  face?: Point;
  pose: "stand" | "sit";
  anim?: "chop" | "water" | "sweep" | "strum" | "talk" | "fish" | "bob";
  dur: number;
  t: number;
  arrived: boolean;
  /** Re-aims at a moving target (a ball, the sheep). */
  follow?: () => Point | null;
  /** Once there, moves along a fixed route over time (up a ladder, down a slide): x, z, height. */
  ride?: (t: number) => [number, number, number];
  speed: number;
  night?: boolean;
  giveUp: number;
}
export interface Person {
  id: number;
  role: Role;
  look: Look;
  mesh: THREE.Mesh;
  x: number; z: number; y: number; vy: number;
  vx: number; vz: number; yaw: number;
  home: Point;
  task: Task | null;
  wait: number;
  phase: number;
  hidden: boolean;
  waveT: number;
  mailIdx: number;
}

export interface PeopleContext {
  world: THREE.Group;
  scene: THREE.Scene;
  material: THREE.Material;
  village: () => VillageScene;
  phys: () => World;
  time: () => number;
  blocked: (x: number, z: number, pad: number) => boolean;
  houseDoor: (h: House) => Point;
  animals: () => { kind: string; x: number; z: number }[];
  balls: () => Body[];
}

const dist2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const angleTo = (from: { x: number; z: number }, to: Point) => Math.atan2(to[0] - from.x, to[1] - from.z);
const turn = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
/** A point in a piece's own frame (front +Z), turned and moved to where the piece stands. */
const local = (o: { x: number; z: number; r: number }, lx: number, lz: number): Point => {
  const c = Math.cos(o.r), s = Math.sin(o.r);
  return [o.x + lx * c + lz * s, o.z - lx * s + lz * c];
};
/** A point `d` in front of a piece, the side people use. */
const front = (o: { x: number; z: number; r: number }, d: number): Point => local(o, 0, d);
const mix = (a: Point, b: Point, k: number): Point => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const around = (x: number, z: number, d: number, a = Math.random() * Math.PI * 2): Point => [x + Math.cos(a) * d, z + Math.sin(a) * d];

export function createPeople(ctx: PeopleContext) {
  const people = new Map<number, Person>();
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const legGeo = new THREE.BoxGeometry(0.085, HIP, 0.1).translate(0, -HIP / 2, 0);
  const legs = new THREE.InstancedMesh(legGeo, ctx.material, 400);
  legs.castShadow = true;
  legs.frustumCulled = false;
  legs.count = 0;
  legs.setColorAt(0, new THREE.Color(1, 1, 1));
  ctx.scene.add(legs);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const _push = { x: 0, z: 0, vx: 0, vz: 0 };

  function bodyGeometry(role: Role, look: Look) {
    const key = `${role}|${look.skin}|${look.shirt}|${look.hair}`;
    let geo = geoCache.get(key);
    if (!geo) {
      const parts: Part[] = [];
      drawPerson(painter(M(), parts), role, look, false);
      geo = bake(parts) as THREE.BufferGeometry;
      geoCache.set(key, geo);
    }
    return geo;
  }

  function spawn(id: number, role: Role, seed: number, at: Point, home: Point, drop: boolean) {
    const look = lookFor(role, seed);
    const mesh = new THREE.Mesh(bodyGeometry(role, look), ctx.material);
    mesh.castShadow = true;
    mesh.scale.setScalar(look.scale);
    mesh.userData.personId = id;
    ctx.world.add(mesh);
    people.set(id, {
      id, role, look, mesh, x: at[0], z: at[1], y: drop ? 1.2 : 0, vy: 0, vx: 0, vz: 0, yaw: Math.random() * Math.PI * 2,
      home, task: null, wait: Math.random() * 2, phase: Math.random() * 6, hidden: false, waveT: 0, mailIdx: 0,
    });
  }

  /** Residents follow the houses; professionals follow their saved pieces. */
  function rebuild(fresh: Set<number>) {
    const S = ctx.village();
    const want = new Set<number>();
    for (const h of S.houses) {
      const door = ctx.houseDoor(h);
      const count = h.len > 2.6 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const id = -(h.id * 4 + k + 1);
        want.add(id);
        const existing = people.get(id);
        if (existing) { existing.home = door; continue; }
        const r = rng(h.seed + k * 7919);
        const role = pick(["man", "woman", "woman", "man", "grandpa", "grandma", "boy", "girl"] as ResidentId[], r);
        spawn(id, role, h.seed + k, around(door[0], door[1], 0.4), door, false);
      }
    }
    for (const o of S.props) {
      if (!isProfession(o.kind)) continue;
      want.add(o.id);
      const existing = people.get(o.id);
      if (existing) { existing.home = [o.x, o.z]; continue; }
      spawn(o.id, o.kind, o.seed, [o.x, o.z], [o.x, o.z], fresh.has(o.id));
    }
    for (const [id, person] of people) {
      if (want.has(id)) continue;
      person.mesh.removeFromParent();
      people.delete(id);
    }
  }

  /* ───────────── choosing what to do ───────────── */
  const nearest = (kinds: PropKind[], x: number, z: number, range: number) => {
    let best: Prop | null = null, bestD = range;
    for (const o of ctx.village().props) {
      if (!kinds.includes(o.kind)) continue;
      const d = dist2(o.x, o.z, x, z);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  };
  const task = (action: ActionId, to: Point, extra: Partial<Task> = {}): Task => ({
    action, to, pose: "stand", dur: 6 + Math.random() * 6, t: 0, arrived: false, speed: WALK, giveUp: 18, ...extra,
  });
  function wanderTask(p: Person, action: ActionId = "walk", range = 7): Task {
    const S = ctx.village();
    // Prefer a point on a path near home, otherwise any free grass.
    const pts: Point[] = [];
    for (const s of S.paths) for (let i = 0; i < s.pts.length; i += 2) if (dist2(s.pts[i][0], s.pts[i][1], p.home[0], p.home[1]) < range) pts.push(s.pts[i]);
    if (pts.length) return task(action, pick(pts, Math.random), { dur: 0.5 + Math.random() * 2 });
    for (let tries = 0; tries < 8; tries += 1) {
      const to = around(p.home[0], p.home[1], 1 + Math.random() * (range * 0.5));
      if (Math.hypot(to[0], to[1]) < BUILD_R && !ctx.blocked(to[0], to[1], 0.3) && !waterAt(ctx.phys(), to[0], to[1])) return task(action, to, { dur: 1 + Math.random() * 2 });
    }
    return task(action, p.home, { dur: 2 });
  }
  function waterEdge(x: number, z: number): { at: Point; face: Point } | null {
    const S = ctx.village();
    const pier = nearest(["pier"], x, z, 22);
    if (pier) return { at: local(pier, 0, 1.9), face: local(pier, 0, 4) };
    let best: { at: Point; face: Point } | null = null, bestD = 22;
    for (const pond of S.ponds) {
      const d = dist2(pond.x, pond.z, x, z);
      if (d >= bestD) continue;
      const a = Math.atan2(z - pond.z, x - pond.x);
      bestD = d;
      best = { at: around(pond.x, pond.z, pond.r + 0.55, a), face: [pond.x, pond.z] };
    }
    for (const s of S.streams) for (let i = 2; i < s.pts.length - 2; i += 4) {
      const [px, pz] = s.pts[i], d = dist2(px, pz, x, z);
      if (d >= bestD) continue;
      const [ax, az] = s.pts[i - 1], [bx, bz] = s.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / len, nz = (bx - ax) / len;
      const side = (x - px) * nx + (z - pz) * nz >= 0 ? 1 : -1;
      bestD = d;
      best = { at: [px + nx * side * 1.45, pz + nz * side * 1.45], face: [px, pz] };
    }
    return best;
  }
  const idle = (o: Person) => !o.hidden && (!o.task || o.task.action === "walk");

  function nextTask(p: Person): Task {
    const S = ctx.village();
    const roll = Math.random();
    switch (p.role) {
      case "farmer": {
        const garden = nearest(["garden"], p.x, p.z, 16);
        if (garden && roll < 0.7) return task("waterGarden", front(garden, 1.3), { face: [garden.x, garden.z], anim: "water", dur: 8 + Math.random() * 6 });
        const pumpkin = nearest(["pumpkin"], p.x, p.z, 16);
        if (pumpkin) return task("pickPumpkins", around(pumpkin.x, pumpkin.z, 0.8), { face: [pumpkin.x, pumpkin.z], anim: "water", dur: 6 });
        break;
      }
      case "baker": {
        const bakery = nearest(["bakery"], p.x, p.z, 20);
        if (bakery && roll < 0.55) return task("bakeBread", local(bakery, 0.45, 1.45), { face: local(bakery, 0.45, 0), anim: "water", dur: 12 + Math.random() * 8 });
        const stall = nearest(["stall"], p.x, p.z, 18);
        // Behind the stall (its counter is solid), facing the customers.
        if (stall && roll < 0.6) return task("sellBread", front(stall, -0.95), { face: front(stall, 3), dur: 10 + Math.random() * 8 });
        if (S.houses.length) {
          const h = pick(S.houses, Math.random);
          return task("carryBread", ctx.houseDoor(h), { dur: 1.5 });
        }
        break;
      }
      case "fisherman": {
        const edge = waterEdge(p.x, p.z);
        if (edge) return task("fish", edge.at, { face: edge.face, anim: "fish", dur: 14 + Math.random() * 10 });
        break;
      }
      case "shepherd": {
        const sheep = ctx.animals().filter((a) => a.kind === "sheep");
        if (sheep.length) {
          const spot = (): Point | null => {
            let cx = 0, cz = 0;
            for (const s of sheep) { cx += s.x; cz += s.z; }
            return [cx / sheep.length + 1.4, cz / sheep.length + 1.2];
          };
          return task("watchSheep", spot() as Point, { follow: spot, face: [sheep[0].x, sheep[0].z], dur: 10 + Math.random() * 8 });
        }
        break;
      }
      case "woodcutter": {
        const wood = nearest(["woodpile", "log", "stump"], p.x, p.z, 18);
        if (wood) return task("chopWood", around(wood.x, wood.z, 0.95), { face: [wood.x, wood.z], anim: "chop", dur: 8 + Math.random() * 8 });
        break;
      }
      case "postman": {
        const boxes = S.props.filter((o) => o.kind === "mailbox");
        if (boxes.length) {
          const box = boxes[p.mailIdx++ % boxes.length];
          return task("deliver", front(box, 0.55), { face: [box.x, box.z], dur: 2 });
        }
        break;
      }
      case "musician": {
        const spot = nearest(["campfire", "fountain", "gazebo"], p.x, p.z, 18);
        if (spot) return task("playGuitar", around(spot.x, spot.z, 1.65), { face: [spot.x, spot.z], anim: "strum", dur: 14 + Math.random() * 10 });
        const bench = nearest(["bench"], p.x, p.z, 14);
        if (bench) return task("playGuitar", [bench.x, bench.z], { face: front(bench, 2), pose: "sit", anim: "strum", dur: 14 });
        break;
      }
      case "child":
      case "boy":
      case "girl": {
        const balls = ctx.balls().filter((b) => !b.gone && !b.held && dist2(b.x, b.z, p.x, p.z) < 14);
        if (balls.length && roll < 0.6) {
          const ball = balls[0];
          return task("kickBall", [ball.x, ball.z], { follow: () => [ball.x - 0.2, ball.z - 0.2], speed: RUN, dur: 6 + Math.random() * 4 });
        }
        const near = (kind: PropKind) => nearest([kind], p.x, p.z, 14);
        const play: (() => Task | null)[] = [
          () => { const o = near("swing"); return o && task("playSwing", [o.x, o.z], { face: front(o, 2), pose: "sit", dur: 8 + Math.random() * 6 }); },
          () => { const o = near("kite"); return o && task("flyKite", local(o, 0, 0.3), { face: local(o, 0, 3), anim: "strum", dur: 10 + Math.random() * 6 }); },
          () => {
            const o = near("seesaw"), end = Math.random() < 0.5 ? 1 : -1;
            return o && task("playSeesaw", local(o, 0, end * 1.05), { face: [o.x, o.z], pose: "sit", anim: "bob", dur: 8 + Math.random() * 6 });
          },
          () => {
            const o = near("slide");
            if (!o) return null;
            // Up the ladder, a moment on top, down the chute, walk round again.
            const base = local(o, 0, -1.0), top = local(o, 0, -0.5), end = local(o, 0, 1.3);
            const ride = (t: number): [number, number, number] => {
              const f = (t % 5) / 5;
              if (f < 0.4) return [...mix(base, top, f / 0.4), 1.24 * (f / 0.4)];
              if (f < 0.5) return [...top, 1.24];
              if (f < 0.7) { const k = (f - 0.5) / 0.2; return [...mix(top, end, k), 1.24 - 1.12 * k]; }
              return [...mix(end, base, (f - 0.7) / 0.3), 0];
            };
            return task("playSlide", base, { ride, dur: 15 });
          },
          () => {
            const o = near("treehouse");
            if (!o) return null;
            const base = local(o, 0.6, 1.3), top = local(o, 0.3, 0.45), dur = 9 + Math.random() * 6;
            const ride = (t: number): [number, number, number] => {
              const k = Math.max(0, Math.min(1, Math.min(t, dur - t) * 0.6));
              return [...mix(base, top, k), 1.8 * k];
            };
            return task("climbTreehouse", base, { ride, dur });
          },
          () => { const o = near("snowman"); return o && task("buildSnowman", local(o, 0.45, 0.45), { face: [o.x, o.z], anim: "chop", dur: 8 }); },
        ];
        if (roll < 0.85) {
          for (let tries = 0; tries < 4; tries += 1) {
            const t = pick(play, Math.random)();
            if (t) return t;
          }
        }
        return wanderTask(p, "runAround", 6);
      }
      default:
        break;
    }
    // Residents (and anyone with nothing to do): small village routines.
    const well = S.wells.find((o) => dist2(o.x, o.z, p.home[0], p.home[1]) < 12);
    const bench = nearest(["bench"], p.home[0], p.home[1], 12);
    const stall = nearest(["stall"], p.home[0], p.home[1], 14);
    const table = nearest(["table"], p.home[0], p.home[1], 14);
    const umbrella = nearest(["umbrella"], p.home[0], p.home[1], 14);
    const pagoda = nearest(["pagoda"], p.home[0], p.home[1], 18);
    const bike = nearest(["bicycle"], p.home[0], p.home[1], 12);
    const options: (() => Task | null)[] = [
      () => (table ? task("eatTable", local(table, 0, Math.random() < 0.5 ? 0.68 : -0.68), { face: [table.x, table.z], pose: "sit", dur: 12 + Math.random() * 8 }) : null),
      () => (umbrella ? task("restUmbrella", local(umbrella, 0.45, 0.1), { face: local(umbrella, 3, 0.1), dur: 10 + Math.random() * 6 }) : null),
      () => (pagoda ? task("visitPagoda", local(pagoda, (Math.random() - 0.5) * 0.8, 1.95), { face: [pagoda.x, pagoda.z], anim: "water", dur: 8 }) : null),
      () => (bike ? task("fixBike", local(bike, 0.55, 0), { face: [bike.x, bike.z], anim: "chop", dur: 8 }) : null),
      () => wanderTask(p),
      () => (well ? task("fillBucket", around(well.x, well.z, 1.0), { face: [well.x, well.z], dur: 4 }) : null),
      () => (bench ? task(Math.random() < 0.5 ? "sitBench" : "readBench", [bench.x, bench.z], { face: front(bench, 2), pose: "sit", dur: 10 + Math.random() * 8 }) : null),
      () => (stall ? task("buyFruit", front(stall, 1.15), { face: [stall.x, stall.z], dur: 5 }) : null),
      () => task("sweep", around(p.home[0], p.home[1], 0.6), { anim: "sweep", dur: 6 }),
      () => {
        const partner = [...people.values()].find((o) => o !== p && idle(o) && dist2(o.x, o.z, p.x, p.z) < 7);
        if (!partner) return null;
        const mx = (p.x + partner.x) / 2, mz = (p.z + partner.z) / 2;
        partner.task = task("talk", [mx + 0.35, mz], { face: [mx - 1, mz], anim: "talk", dur: 7 });
        return task("talk", [mx - 0.35, mz], { face: [mx + 1, mz], anim: "talk", dur: 7 });
      },
    ];
    for (let tries = 0; tries < 6; tries += 1) {
      const t = pick(options, Math.random)();
      if (t) return t;
    }
    return wanderTask(p);
  }

  function nightTask(p: Person): Task {
    const S = ctx.village();
    let door: Point = p.home;
    if (p.id > 0) {
      // Professionals sleep in the nearest house, or rest by a campfire.
      let best: Point | null = null, bestD = 25;
      for (const h of S.houses) {
        const d = ctx.houseDoor(h), dd = dist2(d[0], d[1], p.x, p.z);
        if (dd < bestD) { bestD = dd; best = d; }
      }
      const fire = nearest(["campfire"], p.x, p.z, 16);
      if (fire && (!best || p.role === "musician")) {
        return task(p.role === "musician" ? "playGuitar" : "restFire", around(fire.x, fire.z, 1.7), { face: [fire.x, fire.z], anim: p.role === "musician" ? "strum" : undefined, night: true, dur: 1e9 });
      }
      if (best) door = best;
    }
    return task("goHome", door, { night: true, dur: 1e9 });
  }

  /* ───────────── moving and animating ───────────── */
  function update(dt: number, motion: number) {
    const night = ctx.time() > 0.82;
    const phys = ctx.phys();
    const others = [...people.values()];
    const animals = ctx.animals();
    let legCount = 0;
    for (const p of others) {
      if (p.y > 0 || p.vy > 0) { p.vy -= 14 * dt; p.y += p.vy * dt; }
      if (p.y < 0) { p.y = 0; p.vy = 0; }
      p.waveT = Math.max(0, p.waveT - dt);
      if (!motion) { p.hidden = night; p.task = null; }
      else {
        if (night && !p.task?.night) p.task = nightTask(p);
        if (!night && (p.task?.night || p.hidden)) { p.task = null; p.hidden = false; }
        if (!p.task && !p.hidden) {
          if (p.wait > 0) p.wait -= dt;
          else p.task = nextTask(p);
        }
      }
      const t = p.task;
      let wx = 0, wz = 0;
      if (t && motion && !p.hidden) {
        if (t.follow) { const f = t.follow(); if (f) t.to = f; }
        const d = dist2(t.to[0], t.to[1], p.x, p.z);
        t.giveUp -= dt;
        // Seats are solid, so sitting starts beside them and slides on.
        if (!t.arrived && (d < (t.pose === "sit" || t.ride ? 0.9 : 0.15) || t.giveUp <= 0) && !t.follow) t.arrived = true;
        if (t.follow && t.action === "kickBall") t.arrived = false;
        if (!t.arrived && d > 0.05) { const s = Math.min(t.speed, d * 3); wx = ((t.to[0] - p.x) / d) * s; wz = ((t.to[1] - p.z) / d) * s; }
        if (t.arrived || t.follow) {
          t.t += dt;
          if (t.face && t.arrived) p.yaw += turn(p.yaw, angleTo(p, t.face)) * Math.min(1, dt * 6);
          if (t.night && t.action === "goHome" && t.arrived) p.hidden = true;
          if (t.t > t.dur) { p.task = null; p.wait = 0.5 + Math.random() * 2; }
        }
      }
      if (!p.hidden && !(t?.arrived && t.pose === "sit")) {
        for (const o of others) {
          if (o === p || o.hidden) continue;
          const ox = p.x - o.x, oz = p.z - o.z, od = Math.hypot(ox, oz);
          if (od < 0.42 && od > 1e-4) { wx += (ox / od) * (0.42 - od) * 5; wz += (oz / od) * (0.42 - od) * 5; }
        }
        for (const a of animals) {
          const ox = p.x - a.x, oz = p.z - a.z, od = Math.hypot(ox, oz);
          if (od < 0.6 && od > 1e-4) { wx += (ox / od) * (0.6 - od) * 4; wz += (oz / od) * (0.6 - od) * 4; }
        }
      }
      const k = Math.min(1, dt * 6);
      p.vx += (wx - p.vx) * k;
      p.vz += (wz - p.vz) * k;
      if (t?.arrived && t.ride && motion) {
        // Following a route (ladder, slide): placed directly, facing the way they move.
        const [rx, rz, ry] = t.ride(t.t);
        if (Math.hypot(rx - p.x, rz - p.z) > 1e-3) p.yaw = Math.atan2(rx - p.x, rz - p.z);
        p.x = rx; p.z = rz; p.y = ry; p.vy = 0; p.vx = p.vz = 0;
      } else if (!(t?.arrived && t.pose === "sit")) {
        Object.assign(_push, { x: p.x + p.vx * dt, z: p.z + p.vz * dt, vx: p.vx, vz: p.vz });
        pushOut(phys, _push, 0.18, 0);
        if (!waterAt(phys, _push.x, _push.z)) { p.x = _push.x; p.z = _push.z; }
        const r = Math.hypot(p.x, p.z);
        if (r > BUILD_R) { p.x *= BUILD_R / r; p.z *= BUILD_R / r; }
      } else if (t) { p.x += (t.to[0] - p.x) * k; p.z += (t.to[1] - p.z) * k; }
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 0.05) p.yaw += turn(p.yaw, Math.atan2(p.vx, p.vz)) * Math.min(1, dt * 8);

      // Pose.
      const sitting = !!(t?.arrived && t.pose === "sit");
      const swinging = sitting && t?.action === "playSwing";
      p.phase += dt * (speed > 0.05 ? 3 + speed * 6 : 0);
      const stride = speed > 0.05 ? Math.sin(p.phase) * Math.min(0.6, speed * 0.6) : 0;
      let pitch = 0, roll = 0, yawWiggle = 0, lift = sitting ? 0.13 : Math.abs(Math.sin(p.phase)) * 0.03 * Math.min(1, speed);
      const clock = performance.now() / 1000 + p.id;
      if (t?.arrived && motion) {
        if (t.anim === "chop") pitch = Math.max(0, Math.sin(clock * 5)) * 0.35;
        else if (t.anim === "water") pitch = 0.22 + Math.sin(clock * 1.5) * 0.04;
        else if (t.anim === "sweep") yawWiggle = Math.sin(clock * 4) * 0.35;
        else if (t.anim === "strum") roll = Math.sin(clock * 3) * 0.08;
        else if (t.anim === "talk") { roll = Math.sin(clock * 2) * 0.05; lift += Math.max(0, Math.sin(clock * 3.3)) * 0.015; }
        else if (t.anim === "bob") lift += (0.5 + Math.sin(clock * 2.2) * 0.5) * 0.3;
      }
      if (p.waveT > 0 && motion) { roll = Math.sin(p.waveT * 14) * 0.2; lift += Math.max(0, Math.sin(p.waveT * 7)) * 0.12; }
      let sx = 0;
      if (swinging) sx = Math.sin(clock * 2) * 0.35;
      const s = p.look.scale;
      p.mesh.visible = !p.hidden;
      p.mesh.position.set(p.x + Math.sin(p.yaw) * sx, p.y + lift * s, p.z + Math.cos(p.yaw) * sx);
      p.mesh.rotation.set(pitch, p.yaw + yawWiggle, roll, "YXZ");
      if (!p.hidden && legCount < 398) {
        for (const side of [-1, 1]) {
          const swing = sitting ? -1.35 : stride * side;
          _q.setFromEuler(_e.set(swing, p.yaw + yawWiggle, 0, "YXZ"));
          _p.set(p.mesh.position.x + Math.cos(p.yaw) * side * 0.055 * s, p.mesh.position.y + HIP * s, p.mesh.position.z - Math.sin(p.yaw) * side * 0.055 * s);
          legs.setMatrixAt(legCount, _m.compose(_p, _q, _s.setScalar(s)));
          legs.setColorAt(legCount, _c.set(p.look.pants));
          legCount += 1;
        }
      }
    }
    legs.count = legCount;
    legs.instanceMatrix.needsUpdate = true;
    if (legs.instanceColor) legs.instanceColor.needsUpdate = true;
  }

  return {
    rebuild,
    update,
    /** People who are walking push balls and loose pieces (children kick balls this way). */
    movers(): Mover[] {
      const out: Mover[] = [];
      for (const p of people.values()) if (!p.hidden && Math.hypot(p.vx, p.vz) > 0.05) out.push({ x: p.x, z: p.z, vx: p.vx * 1.4, vz: p.vz * 1.4, r: 0.2 });
      return out;
    },
    /** Everyone outdoors right now. */
    list: () => [...people.values()].filter((p) => !p.hidden),
    /** The person under a ray, nearest first. */
    pick(raycaster: THREE.Raycaster) {
      const meshes = [...people.values()].filter((p) => !p.hidden).map((p) => p.mesh);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? people.get(hit.object.userData.personId as number) ?? null : null;
    },
    /** Who this is and what they are doing, for the Look card. */
    describe(p: Person): { who: { en: string; vi: string; word?: WordId; resident?: ResidentId }; action: ActionId } {
      const who = isProfession(p.role)
        ? { en: p.role, vi: TOOL[p.role].viWho ?? p.role, word: p.role as WordId }
        : { en: RESIDENTS[p.role].en, vi: RESIDENTS[p.role].vi, resident: p.role };
      const t = p.task;
      // On the way somewhere most jobs read as walking; a few describe the trip itself.
      const action: ActionId = p.waveT > 0 ? "wave"
        : !t ? "lookAround"
        : t.arrived || t.follow || TRAVEL.includes(t.action) ? t.action
        : t.speed > WALK ? "runAround" : "walk";
      return { who, action };
    },
    isAlive: (p: Person) => people.get(p.id) === p && !p.hidden,
    /** Where a saved professional is standing now (erasing uses it). */
    where: (id: number) => people.get(id) ?? null,
    wave(p: Person) { p.waveT = 2.2; },
    dispose() {
      for (const p of people.values()) p.mesh.removeFromParent();
      people.clear();
      geoCache.forEach((g) => g.dispose());
      legGeo.dispose();
      legs.removeFromParent();
    },
  };
}
