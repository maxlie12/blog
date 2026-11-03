/**
 * Three.js view of Làng Rêu, a small Tiny Glade-style village builder. Loaded with a dynamic
 * import so three.js only downloads on the village page. It owns the scene, the drawing tools
 * and undo; React owns the HUD, lessons and unlocks and talks to it through VillageController.
 *
 * Performance: every object is built from primitives and "baked" into one vertex-coloured
 * geometry with a shared material, so the whole village is a handful of draw calls. Trees,
 * brushed plants and grass are instanced. If the first seconds run under 40 fps, shadows and
 * pixel ratio step down.
 */
import * as THREE from "three";
import {
  BUILD_R, INSTANCED, ISLAND_R, STEP, TOOL, TOOLS, WORDS, chaikin, clampToIsland, dist, emptyScene, hash2, lineLength, resample, rng, round2, viWho,
  type House, type Placed, type Point, type Prop, type PropKind, type SavedScene, type Stroke, type StrokeTool, type ToolId, type VillageScene, type WordId,
} from "./data";
import { G, M, bake, painter, pick, ribbon, shade, type Mark, type Part } from "./kit";
import { createPeople, personMarks, type Person } from "./people";
import { PROP_GEOMETRIES, PROP_MARKS, PROP_MODELS } from "./props";
import { describe, type ActionId, type PartId, type ResidentId, type VerbId } from "./vocab";
import {
  BODY, GRAVITY, MAX_SPEED, bodyAt, gust, isDynamic, makeBody, makeWorld, pushOut, stepBodies, waterAt,
  type Body, type Box, type Circle, type DynamicKind, type Mover, type World,
} from "./physics";

export type Thumbs = Partial<Record<ToolId, string>>;
/** What the Look tool found: its name, what it is doing (people and animals), and the parts labelled on it. */
export interface InspectInfo {
  /** Which thing this is, stable while it stays selected. */
  id: string;
  title: { word: WordId } | { resident: ResidentId } | { part: PartId };
  sentence: { en: string; vi: string; verb: VerbId; highlight: string } | null;
  parts: PartId[];
}
export interface VillageOptions {
  saved: SavedScene | null;
  time: number;
  onToast: (text: string) => void;
  onUndoChange: (canUndo: boolean) => void;
  onSave: (raw: string) => void;
  onReady: () => void;
  onThumbs: (thumbs: Thumbs) => void;
  /** The Look tool picked something (or nothing). Called again when a person or animal starts doing something else. */
  onInspect?: (info: InspectInfo | null) => void;
}
export interface VillageController {
  setTool(id: ToolId): void;
  setTime(t: number): void;
  undo(): void;
  reset(kind: "empty" | "sample"): void;
  /** Hides the Look tool's labels (the card was closed). */
  clearInspect(): void;
  dispose(): void;
}

const WALL_H = 1.35, WALL_T = 0.55, GATE_DIST = 0.85;
const ROOFS = ["#b65f4a", "#4e7287", "#8a5c47", "#5f6f92", "#9c4a41", "#6c7f55"];
const PLASTER = ["#efe6d3", "#f3e2c3", "#e8ddcb", "#f0d8c3", "#e3e2d4", "#f2ead9"];
const STROKE_KEY: Record<StrokeTool, "paths" | "walls" | "fences" | "hedges" | "streams"> = { path: "paths", wall: "walls", fence: "fences", hedge: "hedges", stream: "streams" };
const LEGACY_TAP = ["tower", "well", "windmill", "lantern", "sheep"] as const;
const MAX_TREES = 700, MAX_INSTANCES = 900, TUFTS = 760;
const SPEED: Partial<Record<ToolId, number>> = { sheep: 0.55, chicken: 0.7, duck: 0.45, cow: 0.35, horse: 0.6, pig: 0.45, dog: 0.9, cat: 0.5, rabbit: 0.8 };

const PREY = new Set<ToolId>(["chicken", "cat", "rabbit", "duck"]);
/** How far each movable piece sits in the water when floating. */
const FLOAT_SINK: Record<DynamicKind, number> = { ball: 0.12, pumpkin: 0.14, barrel: 0.22, crate: 0.22, boat: 0.03 };
/** Colliders for pieces that are not simple round things. Half sizes along local X and Z. */
const PROP_BOX: Partial<Record<PropKind, [number, number]>> = { barn: [1.25, 1.55], chapel: [0.95, 1.55], stall: [0.95, 0.65], tent: [0.95, 1.12] };
const PROP_RADIUS: Partial<Record<PropKind, number>> = {
  blossom: 0.25, bush: 0.4, rock: 0.5, lighthouse: 1.05, fountain: 1.2, gazebo: 1.25, log: 0.45, stump: 0.36, haystack: 0.72, statue: 0.45,
  bench: 0.5, cart: 0.7, flag: 0.12, signpost: 0.1, mailbox: 0.12, scarecrow: 0.12, swing: 0.5, campfire: 0.5, beehive: 0.3, woodpile: 0.55,
};
/** Pieces balls roll over and animals walk through. */
const NO_COLLIDE = new Set<PropKind>(["flower", "mushroom", "sunflower", "garden"]);
const FLOWER_HEIGHT: Partial<Record<PropKind, number>> = { flower: 0.35, sunflower: 1.2, blossom: 1.6, garden: 0.3 };
const MAX_BODIES = 400, MAX_BEES = 80, MAX_BIRDS = 48, PETALS = 160;
const angleDiff = (a: number, b: number) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

type TowerSpot = [number, number, number?];
type Drag =
  | { mode: "orbit" | "pan"; x: number; y: number }
  | { mode: "stroke"; kind: StrokeTool; raw: Point[] }
  | { mode: "house"; start: Point; end: Point; moved: boolean; len: number; r: number; seed: number }
  | { mode: "pond"; start: Point; r: number }
  | { mode: "brush"; kind: ToolId; last: Point | null }
  | { mode: "erase" }
  | { mode: "tap"; kind: ToolId; x: number; y: number; moved: boolean }
  | { mode: "look"; x: number; y: number; moved: boolean }
  | { mode: "hold"; body: Body; target: Point; trail: { t: number; x: number; z: number }[] }
  | { mode: "nudge"; x: number; y: number; moved: boolean };
interface AnimalView {
  id: number;
  kind: ToolId;
  mesh: THREE.Mesh;
  home: THREE.Vector2;
  target: THREE.Vector2;
  threat: THREE.Vector2;
  wait: number;
  hop: number;
  pet: number;
  vx: number;
  vz: number;
  y: number;
  vy: number;
  state: "wander" | "chase" | "flee" | "home" | "sleep";
  stateT: number;
  cool: number;
  chase: AnimalView | Body | null;
}
interface Bee { hive: THREE.Vector3; flowers: THREE.Vector3[]; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; atFlower: boolean; phase: number }
interface Bird { garden: number; pos: THREE.Vector3; vel: THREE.Vector3; spot: THREE.Vector3; state: "arrive" | "peck" | "leave"; t: number; yaw: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const randSeed = () => Math.floor(Math.random() * 1e9);
const isLegacyTap = (id: ToolId): id is (typeof LEGACY_TAP)[number] => (LEGACY_TAP as readonly string[]).includes(id);

/** Grid lookup for "is any stroke point within d of (x, z)", used for gates, bridges and blocked ground. */
function makeIndex(strokes: Stroke[]) {
  const map = new Map<string, Point[]>();
  for (const s of strokes) for (const p of s.pts) {
    const key = `${Math.floor(p[0])},${Math.floor(p[1])}`;
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }
  return {
    near(x: number, z: number, d: number) {
      const cx = Math.floor(x), cz = Math.floor(z), span = Math.ceil(d);
      for (let i = -span; i <= span; i += 1) for (let j = -span; j <= span; j += 1) {
        const list = map.get(`${cx + i},${cz + j}`);
        if (list) for (const p of list) if (Math.hypot(p[0] - x, p[1] - z) < d) return true;
      }
      return false;
    },
  };
}
type Index = ReturnType<typeof makeIndex>;
const NO_INDEX = makeIndex([]);

/** Parts of one prop model drawn at the origin (used for instanced templates, animals and previews). */
function modelParts(kind: PropKind, seed: number, glow?: Part[], halos?: THREE.Vector3[]) {
  const parts: Part[] = [];
  PROP_MODELS[kind](painter(M(), parts, glow, halos), rng(seed));
  return parts;
}

export function createVillageScene(container: HTMLElement, options: VillageOptions): VillageController {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let S: VillageScene = options.saved?.scene ?? emptyScene();
  let idSeq = options.saved?.idSeq ?? 1;
  const newId = () => idSeq++;
  let tool: ToolId = "wall";
  const undoStack: string[] = [];
  const say = options.onToast;
  let disposed = false;
  let timeOfDay = options.time, clock = 0;
  /** Ids placed this moment: they drop in from a little height. */
  const fresh = new Set<number>();
  const wind = { x: 0.5, z: 0.3, strength: 0.6 };

  /* ───────────── renderer, camera, lights ───────────── */
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-roledescription", "khung xây làng 3D");
  canvas.setAttribute(
    "aria-label",
    "Hòn đảo 3D để xây làng. Kéo để vẽ hoặc đặt đồ theo công cụ đang chọn. Bàn phím: mũi tên để xoay, Shift cùng mũi tên để dời khung nhìn, cộng trừ để phóng to thu nhỏ, Enter để đặt đồ vào giữa khung nhìn.",
  );
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const sky = new THREE.Color("#cfe3ea");
  scene.background = sky;
  const fog = new THREE.Fog("#cfe3ea", 48, 95);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 420);

  const hemi = new THREE.HemisphereLight("#fff4e0", "#6c8a5a", 1.7);
  const sun = new THREE.DirectionalLight("#fff3dc", 2.8);
  const SHADOW = ISLAND_R + 4;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW, right: SHADOW, top: SHADOW, bottom: -SHADOW, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  const haloTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
  const glowMat = new THREE.MeshStandardMaterial({ color: "#2f4250", emissive: "#ffc46b", emissiveIntensity: 0, roughness: 0.35 });
  const waterMat = new THREE.MeshStandardMaterial({ color: "#5fb2c0", roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.84 });
  const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, color: "#ffc46b", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const starMat = new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  /** Same look as `surface`, but instanced plants bend with the wind (taller parts move more). */
  const swayUniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() } };
  const swayMat = surface.clone();
  swayMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, swayUniforms);
    shader.vertexShader = `uniform float uTime;\nuniform vec2 uWind;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 swayAt = instanceMatrix[3].xyz;
        float swayPhase = uTime * 1.6 + swayAt.x * 0.35 + swayAt.z * 0.27;
        float swayAmt = 0.65 + sin(swayPhase) * 0.35 + sin(swayPhase * 2.7) * 0.15;
        float swayH = max(position.y, 0.0);
        vec3 swayDir = inverse(mat3(instanceMatrix)) * vec3(uWind.x, 0.0, uWind.y);
        transformed += swayDir * swayAmt * (swayH * swayH * 0.03 + swayH * 0.1);
      #endif`,
    );
  };
  swayMat.customProgramCacheKey = () => "village-sway";
  const petalMat = new THREE.PointsMaterial({ color: "#f7c9d6", size: 0.12, transparent: true, opacity: 0.95, depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });

  /* ───────────── island ───────────── */
  {
    const top = new THREE.RingGeometry(0.01, ISLAND_R, 120, 40);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const a = new THREE.Color("#a3c86d"), b = new THREE.Color("#82b056"), edge = new THREE.Color("#6f9a4a"), c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = (Math.sin(x * 0.42 + 1.3) + Math.cos(z * 0.37) + Math.sin((x - z) * 0.8) * 0.6 + Math.sin(x * 0.13 - z * 0.11) * 0.8) / 6 + 0.5;
      const r = Math.hypot(x, z) / ISLAND_R;
      c.copy(a).lerp(b, clamp(n, 0, 1)).lerp(edge, clamp((r - 0.88) / 0.12, 0, 1));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    top.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const topMesh = new THREE.Mesh(top, surface);
    topMesh.receiveShadow = true;

    const depth = 10;
    const under = new THREE.ConeGeometry(ISLAND_R - 0.25, depth, 56, 6, true);
    under.rotateX(Math.PI);
    const up = under.attributes.position;
    const jitter = rng(11);
    for (let i = 0; i < up.count; i += 1) {
      if (up.getY(i) > depth / 2 - 0.2) continue;
      const k = 1 + (jitter() - 0.5) * 0.16;
      up.setX(i, up.getX(i) * k);
      up.setZ(i, up.getZ(i) * k);
    }
    const rim = new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 0.25, 0.9, 120, 1, true);
    const rocks: Part[] = [
      { g: rim, c: "#7a5c42", m: M(0, -0.45, 0) },
      { g: under, c: "#8b7764", m: M(0, -0.9 - depth / 2, 0) },
    ];
    const r = rng(5);
    for (let i = 0; i < 10; i += 1) {
      const a2 = r() * Math.PI * 2, rad = ISLAND_R * 0.7 + r() * ISLAND_R * 0.55;
      rocks.push({ g: G.dode, c: shade("#8b7764", (r() - 0.5) * 0.06), m: M(Math.cos(a2) * rad, -4 - r() * 7, Math.sin(a2) * rad, 1.4 + r() * 2.2, 1 + r() * 1.4, 1.4 + r() * 2, r() * 3) });
    }
    scene.add(topMesh, new THREE.Mesh(bake(rocks) ?? undefined, surface));
    rim.dispose();
    under.dispose();
  }

  const world = new THREE.Group();
  scene.add(world);
  let pathIndex = NO_INDEX, streamIndex = NO_INDEX, lineIndex = NO_INDEX;

  function nearestPathPoint(x: number, z: number, maxD = 7) {
    let best: Point | null = null, bestD = maxD;
    for (const s of S.paths) for (const p of s.pts) {
      const d = Math.hypot(p[0] - x, p[1] - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  /** Rotation that turns a piece's front (+Z) towards the nearest path, or a random one. */
  const facePath = (x: number, z: number) => {
    const near = nearestPathPoint(x, z);
    return near ? Math.atan2(near[0] - x, near[1] - z) : Math.random() * Math.PI * 2;
  };

  /* ───────────── builders ───────────── */
  /** Set while the Look tool rebuilds one piece to find where its parts are. */
  let markSink: Mark[] | undefined;
  const markAt = (part: PartId, x: number, y: number, z: number) => { markSink?.push({ part, at: new THREE.Vector3(x, y, z) }); };
  function pathParts(stroke: Stroke, index: number, parts: Part[]) {
    const pts = stroke.pts, n = pts.length;
    if (n < 2) return;
    const y = 0.03 + (index % 6) * 0.004;
    const r = rng(stroke.id * 31 + 7);
    parts.push({ g: ribbon(pts, 0.72, y - 0.006, "#b9a47a", 0.05, stroke.id), c: null, m: null });
    parts.push({ g: ribbon(pts, 0.55, y, "#dccaa0", 0.08, stroke.id), c: null, m: null });
    for (let i = 0; i < n; i += 2) {
      const side = r() < 0.5 ? -1 : 1;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const off = side * r() * 0.32;
      parts.push({ g: G.dode, c: shade("#e7decd", (r() - 0.5) * 0.08), m: M(pts[i][0] - Math.sin(ang) * off, y + 0.01, pts[i][1] + Math.cos(ang) * off, 0.3 + r() * 0.15, 0.06, 0.24 + r() * 0.12, r() * 3) });
      markAt("stone", pts[i][0] - Math.sin(ang) * off, y + 0.06, pts[i][1] + Math.cos(ang) * off);
    }
  }

  /** A stream: muddy banks, a dark bed and stones; the water ribbon goes to its own transparent mesh. */
  function streamParts(stroke: Stroke, ground: Part[], water: Part[]) {
    const pts = stroke.pts, n = pts.length;
    if (n < 2) return;
    const r = rng(stroke.id * 17 + 3);
    ground.push({ g: ribbon(pts, 1.12, 0.01, "#8a8a5a", 0.06, stroke.id), c: null, m: null });
    ground.push({ g: ribbon(pts, 0.94, 0.016, "#3f6a68", 0.06, stroke.id), c: null, m: null });
    water.push({ g: ribbon(pts, 0.92, 0.075, "#5fb2c0", 0, stroke.id), c: null, m: null });
    for (let i = 0; i < n; i += 1) {
      if (r() > 0.45) continue;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const side = r() < 0.5 ? -1 : 1, off = side * (1.05 + r() * 0.2);
      const x = pts[i][0] - Math.sin(ang) * off, z = pts[i][1] + Math.cos(ang) * off;
      if (r() < 0.7) {
        ground.push({ g: G.dode, c: shade("#b9b3a2", (r() - 0.5) * 0.1), m: M(x, 0.06, z, 0.34 + r() * 0.2, 0.2, 0.28, r() * 3) });
        markAt("stone", x, 0.16, z);
      } else {
        for (let q = 0; q < 3; q += 1) ground.push({ g: G.cyl6, c: "#5d8240", m: M(x + q * 0.07, 0.35, z, 0.04, 0.65 + q * 0.1, 0.04, 0, 0, (q - 1) * 0.12) });
        markAt("reed", x, 0.75, z);
      }
      if (i % 3 === 0) markAt("bank", pts[i][0] + Math.sin(ang) * off * 0.95, 0.05, pts[i][1] - Math.cos(ang) * off * 0.95);
    }
  }

  /** Wooden bridge wherever a path crosses a stream. */
  function bridgeParts(path: Stroke, parts: Part[]) {
    const pts = path.pts, n = pts.length;
    const wet = pts.map((p) => streamIndex.near(p[0], p[1], 1.15));
    let i = 0;
    while (i < n) {
      if (!wet[i]) { i += 1; continue; }
      let j = i;
      while (j + 1 < n && wet[j + 1]) j += 1;
      const A = pts[Math.max(0, i - 2)], B = pts[Math.min(n - 1, j + 2)];
      const span = Math.max(1.8, dist(A, B)), th = Math.atan2(B[1] - A[1], B[0] - A[0]);
      const { p, mark } = painter(M((A[0] + B[0]) / 2, 0, (A[1] + B[1]) / 2, 1, 1, 1, -th), parts, undefined, undefined, markSink);
      const r = rng(path.id * 7 + i);
      const planks = Math.ceil(span / 0.24), rise = 0.38;
      const yAt = (t: number) => 0.1 + Math.sin(Math.PI * t) * rise;
      mark("bridge", 0, yAt(0.5) + 0.9, 0);
      mark("plank", -span * 0.3, yAt(0.2) + 0.05, 0.3);
      mark("railing", span * 0.25, yAt(0.75) + 0.55, 0.62);
      for (let k = 0; k < planks; k += 1) {
        const t = (k + 0.5) / planks;
        const slope = Math.atan((Math.cos(Math.PI * t) * Math.PI * rise) / span);
        p(G.box, shade("#a0784f", (r() - 0.5) * 0.08), -span / 2 + t * span, yAt(t), 0, span / planks - 0.02, 0.08, 1.3, 0, 0, slope);
      }
      for (const side of [-1, 1]) {
        for (const t of [0.04, 0.5, 0.96]) p(G.box, "#7a5a3e", -span / 2 + t * span, yAt(t) + 0.3, side * 0.62, 0.09, 0.6, 0.09);
        for (const [t0, t1] of [[0.04, 0.5], [0.5, 0.96]]) {
          const x0 = -span / 2 + t0 * span, x1 = -span / 2 + t1 * span, y0 = yAt(t0) + 0.55, y1 = yAt(t1) + 0.55;
          p(G.box, "#9a744d", (x0 + x1) / 2, (y0 + y1) / 2, side * 0.62, Math.hypot(x1 - x0, y1 - y0), 0.07, 0.07, 0, 0, Math.atan2(y1 - y0, x1 - x0));
        }
      }
      i = j + 1;
    }
  }

  /** Walls skip segments that cross a path (those become a gate) and leave tower spots at ends and sharp corners. */
  function wallParts(stroke: Stroke, parts: Part[], towerSpots: TowerSpot[], paths: Index = pathIndex) {
    const pts = stroke.pts, n = pts.length;
    if (n < 2) return;
    const h = WALL_H, T = WALL_T;
    const gated: boolean[] = [];
    for (let i = 0; i < n - 1; i += 1) gated[i] = paths.near((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, GATE_DIST);
    for (let i = 0; i < n - 1; i += 1) {
      if (gated[i]) continue;
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const th = Math.atan2(bz - az, bx - ax);
      const { p, mark } = painter(M((ax + bx) / 2, 0, (az + bz) / 2, 1, 1, 1, -th), parts, undefined, undefined, markSink);
      const r = rng(hash2(ax, az) + 7);
      mark("wall", 0, h * 0.5, T / 2 + 0.02);
      if (i % 2 === 0) mark("battlement", 0, h + 0.44, 0);
      p(G.box, "#a99d88", 0, 0.15, 0, len + 0.08, 0.3, T + 0.18);
      p(G.box, shade("#cfc5b1", (r() - 0.5) * 0.07), 0, h / 2, 0, len + 0.03, h, T);
      p(G.box, "#ddd5c4", 0, h + 0.05, 0, len + 0.08, 0.1, T + 0.12);
      if (i % 2 === 0) p(G.box, shade("#d3c9b6", (r() - 0.5) * 0.05), 0, h + 0.27, 0, len * 0.56, 0.34, T * 0.86);
      if (r() < 0.55) p(G.box, shade("#bfb39d", (r() - 0.5) * 0.1), (r() - 0.5) * len * 0.6, 0.45 + r() * (h - 0.7), (r() < 0.5 ? -1 : 1) * (T / 2 + 0.03), 0.3, 0.17, 0.07);
      if (r() < 0.3) p(G.ico0, "#7ea456", (r() - 0.5) * len * 0.5, 0.28, (r() < 0.5 ? -1 : 1) * (T / 2 + 0.05), 0.4, 0.24, 0.2);
    }
    let i = 0;
    while (i < n - 1) {
      if (!gated[i]) { i += 1; continue; }
      let j = i;
      while (j + 1 < n - 1 && gated[j + 1]) j += 1;
      gateParts(pts[i], pts[j + 1], h, parts);
      i = j + 1;
    }
    const spots: Point[] = [pts[0], pts[n - 1]];
    for (let k = 2; k < n - 2; k += 1) {
      const a = Math.atan2(pts[k][1] - pts[k - 2][1], pts[k][0] - pts[k - 2][0]);
      const b = Math.atan2(pts[k + 2][1] - pts[k][1], pts[k + 2][0] - pts[k][0]);
      let d = Math.abs(b - a);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > 0.95) { spots.push(pts[k]); k += 4; }
    }
    for (const s of spots) {
      if (paths.near(s[0], s[1], 1.0)) continue;
      if (towerSpots.some((t) => Math.hypot(t[0] - s[0], t[1] - s[1]) < 1.15)) continue;
      towerSpots.push([s[0], s[1]]);
    }
  }

  function gateParts(A: Point, B: Point, h: number, parts: Part[]) {
    const span = Math.max(0.9, dist(A, B));
    const th = Math.atan2(B[1] - A[1], B[0] - A[0]);
    const { p, mark } = painter(M((A[0] + B[0]) / 2, 0, (A[1] + B[1]) / 2, 1, 1, 1, -th), parts, undefined, undefined, markSink);
    const T = WALL_T;
    const top = h + 0.35, archTop = h * 0.92;
    mark("gate", span / 2, top + 0.7, 0);
    mark("arch", 0, archTop - 0.05, T / 2 + 0.05);
    for (const side of [-1, 1]) {
      p(G.box, "#c2b7a2", (side * span) / 2, top / 2, 0, 0.6, top, T + 0.18);
      p(G.box, "#ddd5c4", (side * span) / 2, top + 0.06, 0, 0.72, 0.12, T + 0.28);
      p(G.cone6, "#9b8f7a", (side * span) / 2, top + 0.4, 0, 0.5, 0.55, 0.5);
    }
    p(G.box, "#cfc5b1", 0, (archTop + top) / 2, 0, span, top - archTop, T);
    p(G.box, "#ddd5c4", 0, top + 0.05, 0, span + 0.1, 0.1, T + 0.12);
    for (const x of [-0.3, 0.3]) p(G.box, "#d3c9b6", x * span, top + 0.27, 0, span * 0.22, 0.34, T * 0.86);
    const ry = Math.min(span / 2, h * 0.6);
    p(G.arch, "#b9ad97", 0, archTop - ry, 0, span / 2, ry, T / 0.26);
    p(G.box, "#e4dbc9", 0, archTop + 0.02, 0, 0.2, 0.28, T + 0.06);
  }

  function towerParts(x: number, z: number, seed: number, parts: Part[], glow: Part[]) {
    const r = rng(seed);
    const { p, w, mark } = painter(M(x, 0, z, 1, 1, 1, r() * Math.PI * 2), parts, glow, undefined, markSink);
    const R = 0.72 + r() * 0.12, H = WALL_H + 1.05 + r() * 0.35;
    mark("wall", R + 0.02, H * 0.35, 0.3);
    p(G.cyl12, "#a99d88", 0, 0.2, 0, 2 * R + 0.3, 0.4, 2 * R + 0.3);
    p(G.cyl12, shade("#cdc3ae", (r() - 0.5) * 0.06), 0, H / 2, 0, 2 * R, H, 2 * R);
    p(G.cyl12, "#ddd5c4", 0, H + 0.07, 0, 2 * R + 0.24, 0.14, 2 * R + 0.24);
    if (r() < 0.75) {
      p(G.cone8, pick(ROOFS, r), 0, H + 0.14 + 0.85, 0, 2 * R + 0.5, 1.7, 2 * R + 0.5);
      p(G.sphere, "#e3bf55", 0, H + 1.9, 0, 0.16, 0.16, 0.16);
      mark("roof", 0, H + 0.9, R * 0.6);
    } else {
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        p(G.box, "#d3c9b6", Math.cos(a) * (R - 0.04), H + 0.33, Math.sin(a) * (R - 0.04), 0.32, 0.38, 0.3, -a);
      }
      mark("battlement", 0, H + 0.55, R);
    }
    for (const a of [0.5, 0.5 + Math.PI]) w(G.box, Math.cos(a) * (R + 0.01), H * 0.62, Math.sin(a) * (R + 0.01), 0.07, 0.44, 0.15, -a);
    mark("window", Math.cos(0.5) * (R + 0.05), H * 0.62, Math.sin(0.5) * (R + 0.05));
    const a0 = r() * Math.PI * 2;
    p(G.box, "#6b4f3a", Math.cos(a0) * R, 0.45, Math.sin(a0) * R, 0.08, 0.82, 0.44, -a0);
    mark("door", Math.cos(a0) * (R + 0.06), 0.5, Math.sin(a0) * (R + 0.06));
    if (r() < 0.6) p(G.ico0, "#7ea456", Math.cos(a0 + 1.5) * (R + 0.05), 0.25, Math.sin(a0 + 1.5) * (R + 0.05), 0.5, 0.32, 0.4);
  }

  /** A house faces its local +Z; `h.r` turns that front towards the nearest path. Returns the spot in front of its door. */
  function houseParts(h: House, parts: Part[], glow: Part[]): Point {
    const r = rng(h.seed);
    const len = h.len, w = 1.55;
    const floors = len > 2.6 && r() < 0.65 ? 2 : 1;
    const H = floors === 2 ? 2.15 : 1.25;
    const plaster = pick(PLASTER, r), roof = pick(ROOFS, r), beam = "#6b4f3a";
    const { p, w: win, mark } = painter(M(h.x, 0, h.z, 1, 1, 1, h.r), parts, glow, undefined, markSink);
    p(G.box, "#a99e8b", 0, 0.12, 0, len + 0.2, 0.24, w + 0.2);
    p(G.box, plaster, 0, 0.24 + H / 2, 0, len, H, w);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, beam, (sx * len) / 2, 0.24 + H / 2, (sz * w) / 2, 0.13, H, 0.13);
    if (floors === 2) p(G.box, beam, 0, 0.24 + H * 0.5, 0, len + 0.03, 0.1, w + 0.03);
    const eave = 0.24 + H, rh = 0.95 + r() * 0.3, hw = w / 2 + 0.24;
    p(G.prism, shade(plaster, -0.03), 0, eave, 0, w, rh, len, Math.PI / 2);
    const slope = Math.hypot(rh, hw), ang = Math.atan2(rh, hw);
    mark("roof", len * 0.28, eave + rh * 0.55, hw * 0.55);
    mark("wall", len / 2 + 0.02, 0.24 + H * 0.4, -0.35);
    p(G.box, roof, 0, eave + rh / 2, hw / 2, len + 0.4, 0.12, slope + 0.06, 0, ang);
    p(G.box, roof, 0, eave + rh / 2, -hw / 2, len + 0.4, 0.12, slope + 0.06, 0, -ang);
    p(G.box, shade(roof, -0.06), 0, eave + rh + 0.02, 0, len + 0.44, 0.13, 0.2);
    if (r() < 0.6) {
      const cx = (r() < 0.5 ? -1 : 1) * len * 0.26;
      p(G.box, "#a8836a", cx, eave + rh * 0.62 + 0.25, -hw * 0.4, 0.32, 0.85, 0.32);
      mark("chimney", cx, eave + rh * 0.62 + 0.75, -hw * 0.4);
    }
    const doorX = len < 2.2 ? 0 : (r() < 0.5 ? -1 : 1) * len * 0.24;
    mark("door", doorX, 0.7, w / 2 + 0.08);
    p(G.box, "#6b4f3a", doorX, 0.24 + 0.43, w / 2 + 0.03, 0.5, 0.86, 0.07);
    p(G.box, "#b8ad9a", doorX, 0.06, w / 2 + 0.38, 0.72, 0.1, 0.42);
    const count = Math.max(1, Math.floor(len / 0.85));
    for (let f = 0; f < floors; f += 1) {
      const wy = 0.24 + 0.78 + f * 0.95;
      for (let k = 0; k < count; k += 1) {
        const wx = -len / 2 + (k + 0.5) * (len / count);
        for (const side of [1, -1]) {
          if (side === 1 && f === 0 && Math.abs(wx - doorX) < 0.48) continue;
          p(G.box, "#f6f1e6", wx, wy, side * (w / 2 + 0.012), 0.46, 0.52, 0.03);
          if (side === 1 && f === floors - 1 && k === count - 1) mark("window", wx, wy, w / 2 + 0.05);
          win(G.box, wx, wy, side * (w / 2 + 0.03), 0.34, 0.4, 0.04);
          if (side === 1 && f === 0 && r() < 0.55) {
            p(G.box, "#7a5a3f", wx, wy - 0.34, w / 2 + 0.09, 0.46, 0.1, 0.13);
            for (let q = 0; q < 3; q += 1) p(G.ico0, pick(["#f2c94c", "#e57f9e", "#f6f3ea", "#b48ee0"], r), wx - 0.15 + q * 0.15, wy - 0.26, w / 2 + 0.1, 0.13, 0.13, 0.13);
          }
        }
      }
    }
    for (const sx of [-1, 1]) win(G.box, sx * (len / 2 + 0.02), eave + rh * 0.32, 0, 0.04, 0.26, 0.26);
    for (let k = 0; k < 4; k += 1) {
      const bx = (r() - 0.5) * (len + 0.6), side = r() < 0.5 ? 1 : -1;
      if (side === 1 && Math.abs(bx - doorX) < 0.6) continue;
      p(G.ico, shade("#6f9a4f", (r() - 0.5) * 0.06), bx, 0.18, side * (w / 2 + 0.32), 0.48, 0.4, 0.44);
      if (r() < 0.6) p(G.ico0, pick(["#f2c94c", "#e57f9e", "#f6f3ea"], r), bx + 0.1, 0.38, side * (w / 2 + 0.36), 0.12, 0.12, 0.12);
    }
    const c = Math.cos(h.r), s = Math.sin(h.r), dz = w / 2 + 0.7;
    return [h.x + doorX * c + dz * s, h.z - doorX * s + dz * c];
  }

  function fenceParts(stroke: Stroke, parts: Part[]) {
    const pts = stroke.pts, n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const r = rng(hash2(pts[i][0], pts[i][1]));
      parts.push({ g: G.box, c: shade("#9a744d", (r() - 0.5) * 0.06), m: M(pts[i][0], 0.36, pts[i][1], 0.12, 0.72, 0.12, r()) });
      markAt("post", pts[i][0], 0.9, pts[i][1]);
      parts.push({ g: G.cone6, c: "#8a6644", m: M(pts[i][0], 0.78, pts[i][1], 0.17, 0.14, 0.17) });
      if (i === n - 1) continue;
      const a = pts[i], b = pts[i + 1], len = dist(a, b), th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const y of [0.3, 0.56]) parts.push({ g: G.box, c: "#b18a5e", m: M((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, len + 0.06, 0.07, 0.05, -th) });
      markAt("rail", (a[0] + b[0]) / 2, 0.45, (a[1] + b[1]) / 2);
    }
  }

  function hedgeParts(stroke: Stroke, parts: Part[]) {
    const r = rng(stroke.id * 13 + 5);
    for (const [x, z] of stroke.pts) {
      parts.push({ g: G.ico, c: shade("#4f8a3f", (r() - 0.5) * 0.08), m: M(x, 0.46, z, 0.8 + r() * 0.14, 0.92 + r() * 0.16, 0.8 + r() * 0.14, r() * 3) });
      markAt("leaf", x, 0.95, z);
      if (r() < 0.22) parts.push({ g: G.ico0, c: pick(["#f6f3ea", "#e57f9e", "#f2c94c"], r), m: M(x + (r() - 0.5) * 0.5, 0.55 + r() * 0.35, z + (r() - 0.5) * 0.5, 0.1, 0.1, 0.1) });
    }
  }

  function wellParts(o: Placed, parts: Part[]) {
    const r = rng(o.seed);
    const { p, mark } = painter(M(o.x, 0, o.z, 1, 1, 1, r() * Math.PI), parts, undefined, undefined, markSink);
    p(G.cyl12, "#bdb19b", 0, 0.36, 0, 1.3, 0.72, 1.3);
    mark("roof", 0, 2.05, 0.35);
    mark("bucket", 0.12, 1.0, 0.18);
    mark("handle", -0.45, 1.48, 0.08);
    mark("stone", 0.66, 0.4, 0.1);
    p(G.cyl12, "#d6ccb8", 0, 0.75, 0, 1.4, 0.08, 1.4);
    p(G.cyl12, "#284750", 0, 0.73, 0, 1.0, 0.04, 1.0);
    for (const sx of [-1, 1]) p(G.box, "#7a5a3e", sx * 0.58, 1.1, 0, 0.12, 1.5, 0.12);
    p(G.prism, "#8a5c47", 0, 1.8, 0, 1.05, 0.5, 1.5, Math.PI / 2);
    p(G.cyl8, "#6b4f3a", 0, 1.48, 0, 0.09, 1.2, 0.09, 0, 0, Math.PI / 2);
    p(G.cyl8, "#a07c56", 0.12, 1.1, 0, 0.24, 0.24, 0.24);
    p(G.ico, "#6f9a4f", 0.75, 0.2, 0.4, 0.45, 0.35, 0.45);
  }

  function pondParts(o: { x: number; z: number; r: number; seed: number }, parts: Part[]) {
    const r = rng(o.seed);
    parts.push({ g: G.disc, c: "#4b6f63", m: M(o.x, 0.014, o.z, 2 * o.r + 0.3, 0.02, 2 * o.r + 0.3) });
    const count = Math.max(8, Math.floor((Math.PI * 2 * o.r) / 0.42));
    markAt("stone", o.x + o.r + 0.15, 0.2, o.z);
    for (let k = 0; k < count; k += 1) {
      const a = (k / count) * Math.PI * 2 + r() * 0.1, rad = o.r + 0.12 + r() * 0.08;
      parts.push({ g: G.dode, c: shade("#b9b3a2", (r() - 0.5) * 0.1), m: M(o.x + Math.cos(a) * rad, 0.07, o.z + Math.sin(a) * rad, 0.36 + r() * 0.22, 0.2, 0.3, -a) });
    }
    for (let k = 0; k < Math.floor(o.r * 1.6); k += 1) {
      const a = r() * Math.PI * 2, rad = r() * o.r * 0.7;
      const x = o.x + Math.cos(a) * rad, z = o.z + Math.sin(a) * rad;
      parts.push({ g: G.cyl12, c: "#6e9d4a", m: M(x, 0.09, z, 0.42, 0.02, 0.42) });
      if (k === 0) markAt("leaf", x, 0.12, z);
      if (r() < 0.5) parts.push({ g: G.ico0, c: "#f2b5c9", m: M(x + 0.06, 0.13, z, 0.1, 0.08, 0.1) });
    }
    for (let k = 0; k < 3; k += 1) {
      const a = r() * Math.PI * 2;
      for (let q = 0; q < 4; q += 1) parts.push({ g: G.cyl6, c: "#5d8240", m: M(o.x + Math.cos(a) * (o.r - 0.1) + q * 0.07, 0.4, o.z + Math.sin(a) * (o.r - 0.1) + q * 0.05, 0.04, 0.75 + q * 0.1, 0.04, 0, 0, (q - 1.5) * 0.08) });
      if (k === 0) markAt("reed", o.x + Math.cos(a) * (o.r - 0.1), 0.85, o.z + Math.sin(a) * (o.r - 0.1));
    }
  }

  function millParts(o: Placed, parts: Part[], glow: Part[]) {
    const r = rng(o.seed);
    const T = M(o.x, 0, o.z, 1, 1, 1, o.r ?? r() * Math.PI * 2);
    const { p, w, mark } = painter(T, parts, glow, undefined, markSink);
    p(G.cyl12, "#a99d88", 0, 0.18, 0, 1.9, 0.36, 1.9);
    mark("sail", 1.1, 3.8, 0.95);
    mark("roof", 0, 3.75, 0.45);
    mark("window", 0, 2.2, 0.72);
    mark("door", 0, 0.8, 0.86);
    p(G.taper, "#ece4d2", 0, 0.36 + 1.4, 0, 1.6, 2.8, 1.6);
    p(G.cone8, "#8a5c47", 0, 3.6, 0, 1.4, 0.9, 1.4);
    p(G.box, "#6b4f3a", 0, 0.75, 0.78, 0.48, 0.8, 0.08);
    w(G.box, 0, 2.2, 0.66, 0.3, 0.36, 0.06);
    p(G.cyl8, "#6b4f3a", 0, 3.0, 0.6, 0.16, 0.5, 0.16, 0, Math.PI / 2);
    return T;
  }

  function lanternParts(o: Placed, parts: Part[], glow: Part[], halos: THREE.Vector3[]) {
    const r = rng(o.seed);
    const { p, w, halo, mark } = painter(M(o.x, 0, o.z, 1, 1, 1, r() * Math.PI * 2), parts, glow, halos, markSink);
    mark("lamp", 0.46, 1.25, 0.14);
    mark("post", 0, 0.6, 0.07);
    p(G.box, "#4f3f33", 0, 0.82, 0, 0.11, 1.64, 0.11);
    p(G.box, "#4f3f33", 0.24, 1.6, 0, 0.5, 0.07, 0.07);
    p(G.box, "#3a332d", 0.46, 1.48, 0, 0.04, 0.2, 0.04);
    p(G.cone6, "#3a332d", 0.46, 1.42, 0, 0.32, 0.16, 0.32);
    w(G.box, 0.46, 1.23, 0, 0.2, 0.28, 0.2);
    p(G.box, "#3a332d", 0.46, 1.07, 0, 0.26, 0.04, 0.26);
    p(G.dode, "#a99d88", 0, 0.05, 0, 0.36, 0.12, 0.36);
    halo(0.46, 1.23, 0);
  }

  const templates = (() => {
    const at = (parts: Part[]) => (g: THREE.BufferGeometry, c: THREE.ColorRepresentation, ...a: Parameters<typeof M>) => { parts.push({ g, c, m: M(...a) }); };
    const bladeParts: Part[] = [];
    for (let k = 0; k < 4; k += 1) {
      const { p } = painter(M(0, 0, 0, 1, 1, 1, 0, 0, (k / 4) * Math.PI * 2), bladeParts);
      p(G.box, "#6b4f3a", 0, 0.85, 0, 0.07, 1.7, 0.06);
      p(G.box, "#f4ecda", 0.17, 1.05, 0, 0.32, 1.25, 0.03);
      for (let q = 0; q < 4; q += 1) p(G.box, "#8a6644", 0.17, 0.55 + q * 0.33, 0.02, 0.34, 0.03, 0.03);
    }
    at(bladeParts)(G.cyl8, "#5a4433", 0, 0, 0, 0.26, 0.16, 0.26, 0, Math.PI / 2);

    const sheepParts: Part[] = [];
    const sp = at(sheepParts);
    sp(G.ico, "#f5f1e8", 0, 0.58, 0, 0.78, 0.62, 1.0);
    sp(G.ico, "#ede7dc", 0.16, 0.78, -0.18, 0.5, 0.42, 0.5);
    sp(G.ico, "#efe9df", -0.14, 0.74, 0.16, 0.5, 0.4, 0.5);
    sp(G.ico0, "#3b3633", 0, 0.7, 0.54, 0.32, 0.34, 0.38);
    for (const sx of [-1, 1]) {
      sp(G.box, "#3b3633", sx * 0.2, 0.78, 0.52, 0.16, 0.06, 0.08, 0, 0, sx * 0.4);
      sp(G.sphere, "#ffffff", sx * 0.09, 0.76, 0.7, 0.06, 0.06, 0.04);
      for (const sz of [-0.24, 0.22]) sp(G.cyl6, "#3b3633", sx * 0.2, 0.2, sz, 0.1, 0.4, 0.1);
    }

    const leafy: Part[] = [], pine: Part[] = [];
    const lp = at(leafy), pp = at(pine);
    lp(G.cyl8, "#7a5a3e", 0, 0.45, 0, 0.22, 0.9, 0.22);
    lp(G.ico, "#5f9445", 0, 1.3, 0, 1.25, 1.1, 1.25);
    lp(G.ico, "#72a653", 0.34, 1.65, 0.12, 0.85, 0.78, 0.85);
    lp(G.ico, "#568a3f", -0.3, 1.55, -0.2, 0.8, 0.72, 0.8);
    pp(G.cyl8, "#6e513a", 0, 0.35, 0, 0.2, 0.7, 0.2);
    pp(G.cone8, "#3f7a4a", 0, 1.0, 0, 1.3, 1.25, 1.3);
    pp(G.cone8, "#4a8a55", 0, 1.58, 0, 0.98, 1.0, 0.98);
    pp(G.cone8, "#55985f", 0, 2.05, 0, 0.64, 0.82, 0.64);

    const tuft: Part[] = [];
    for (let k = 0; k < 3; k += 1) tuft.push({ g: G.cone6, c: k === 1 ? "#8cbc5c" : "#78a84f", m: M((k - 1) * 0.07, 0.11, (k % 2) * 0.05, 0.07, 0.24, 0.07, 0, 0, (k - 1) * 0.35) });

    const cast = (parts: Part[]) => bake(parts) as THREE.BufferGeometry;
    const animals = new Map<ToolId, THREE.BufferGeometry>([["sheep", cast(sheepParts)]]);
    const plants = new Map<PropKind, THREE.BufferGeometry>();
    for (const t of TOOLS) {
      if (t.animal && t.id !== "sheep") animals.set(t.id, cast(modelParts(t.id as PropKind, 3)));
    }
    for (const kind of INSTANCED) plants.set(kind, cast(modelParts(kind, 7)));
    const bodies = new Map<DynamicKind, THREE.BufferGeometry>();
    for (const kind of Object.keys(BODY) as DynamicKind[]) bodies.set(kind, cast(modelParts(kind, 7)));

    const bee: Part[] = [], bird: Part[] = [];
    const bp = at(bee), dp = at(bird);
    bp(G.sphere, "#f2c94c", 0, 0, 0, 0.13, 0.12, 0.17);
    bp(G.box, "#3a332d", 0, 0, -0.01, 0.132, 0.122, 0.035);
    for (const s of [-1, 1]) bp(G.box, "#ffffff", s * 0.07, 0.06, -0.01, 0.1, 0.01, 0.06, 0, 0, s * 0.3);
    dp(G.ico, "#4a4a52", 0, 0.1, 0, 0.17, 0.14, 0.26);
    dp(G.sphere, "#4a4a52", 0, 0.18, 0.12, 0.12, 0.12, 0.12);
    dp(G.cone6, "#f2a53a", 0, 0.18, 0.2, 0.04, 0.08, 0.04, 0, Math.PI / 2);
    for (const s of [-1, 1]) dp(G.box, "#3a3a42", s * 0.12, 0.13, -0.01, 0.2, 0.02, 0.12, 0, 0, s * 0.25);
    return { blade: cast(bladeParts), trees: [cast(leafy), cast(pine)], tuft: cast(tuft), animals, plants, bodies, bee: cast(bee), bird: cast(bird) };
  })();

  function instancedMesh(geo: THREE.BufferGeometry, max: number, shadows: boolean, material: THREE.Material = swayMat) {
    const mesh = new THREE.InstancedMesh(geo, material, max);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(mesh);
    return mesh;
  }
  const treeMeshes = templates.trees.map((geo) => instancedMesh(geo, MAX_TREES, true));
  const plantMeshes = new Map([...templates.plants].map(([kind, geo]) => [kind, instancedMesh(geo, MAX_INSTANCES, kind !== "flower")]));
  const tuftMesh = instancedMesh(templates.tuft, TUFTS, false);
  const bodyMeshes = new Map([...templates.bodies].map(([kind, geo]) => [kind, instancedMesh(geo, MAX_BODIES, true, surface)]));
  const beeMesh = instancedMesh(templates.bee, MAX_BEES, false, surface);
  const birdMesh = instancedMesh(templates.bird, MAX_BIRDS, true, surface);
  const petalPos = new Float32Array(PETALS * 3);
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
  petalGeo.setDrawRange(0, 0);
  const petals = new THREE.Points(petalGeo, petalMat);
  petals.frustumCulled = false;
  const petalLife = Array.from({ length: PETALS }, () => ({ life: 0, phase: Math.random() * 6 }));
  const ring = new THREE.Mesh(G.torus, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  let ringT = 1;
  scene.add(petals, ring);
  tuftMesh.receiveShadow = false;

  const clouds: THREE.Mesh[] = [];
  {
    const r = rng(21);
    for (let i = 0; i < 7; i += 1) {
      const parts: Part[] = [];
      for (let k = 0; k < 4; k += 1) parts.push({ g: G.ico, c: "#ffffff", m: M(k * 0.9 - 1.3, k === 1 || k === 2 ? 0.35 : 0, (r() - 0.5) * 0.6, 1.4 + r() * 0.6, 1.0 + r() * 0.5, 1.3) });
      const cloud = new THREE.Mesh(bake(parts) ?? undefined, cloudMat);
      cloud.position.set(-45 + i * 14 + r() * 5, 10 + r() * 5, -22 + r() * 40);
      cloud.scale.setScalar(1 + r() * 0.6);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }
  {
    const r = rng(99);
    const pos: number[] = [];
    for (let i = 0; i < 320; i += 1) {
      const a = r() * Math.PI * 2, e = 0.15 + r() * 1.25, R = 200;
      pos.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, starMat));
  }

  /* ───────────── rebuild ───────────── */
  type LayerKey = "ground" | "water" | "structures" | "glow";
  const layer: Record<LayerKey, THREE.Mesh | null> = { ground: null, water: null, structures: null, glow: null };
  const extras = new THREE.Group(), preview = new THREE.Group();
  world.add(extras, preview);
  const animalViews = new Map<number, AnimalView>();
  const mills: THREE.Mesh[] = [];

  function setMesh(key: LayerKey, geo: THREE.BufferGeometry | null, material: THREE.Material, cast: boolean) {
    layer[key]?.geometry.dispose();
    layer[key]?.removeFromParent();
    layer[key] = null;
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    world.add(mesh);
    layer[key] = mesh;
  }

  const houseDoors = new Map<number, Point>();
  let towerSpotsNow: TowerSpot[] = [];
  function rebuildAll() {
    pathIndex = makeIndex(S.paths);
    streamIndex = makeIndex(S.streams);
    lineIndex = makeIndex([...S.paths, ...S.walls, ...S.fences, ...S.hedges]);
    const ground: Part[] = [], water: Part[] = [], parts: Part[] = [], glow: Part[] = [], halos: THREE.Vector3[] = [], towerSpots: TowerSpot[] = [];
    S.paths.forEach((s, i) => pathParts(s, i, ground));
    for (const s of S.streams) streamParts(s, ground, water);
    for (const s of S.paths) bridgeParts(s, parts);
    for (const p of S.ponds) pondParts(p, ground);
    for (const s of S.walls) wallParts(s, parts, towerSpots);
    for (const t of S.towers) towerSpots.push([t.x, t.z, t.seed]);
    for (const t of towerSpots) towerParts(t[0], t[1], t[2] ?? hash2(t[0], t[1]), parts, glow);
    for (const s of S.fences) fenceParts(s, parts);
    for (const s of S.hedges) hedgeParts(s, parts);
    houseDoors.clear();
    for (const h of S.houses) houseDoors.set(h.id, houseParts(h, parts, glow));
    towerSpotsNow = towerSpots;
    for (const o of S.wells) wellParts(o, parts);
    for (const o of S.lanterns) lanternParts(o, parts, glow, halos);
    for (const o of S.props) {
      if (TOOL[o.kind].animal || TOOL[o.kind].person || plantMeshes.has(o.kind) || isDynamic(o.kind) || drops.has(o.id)) continue;
      PROP_MODELS[o.kind](painter(M(o.x, 0, o.z, 1, 1, 1, o.r), parts, glow, halos), rng(o.seed));
    }

    extras.clear();
    mills.length = 0;
    for (const o of S.mills) {
      const T = millParts(o, parts, glow);
      const blades = new THREE.Mesh(templates.blade, surface);
      blades.castShadow = true;
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder.matrix.copy(T).multiply(M(0, 3.0, 0.86));
      holder.add(blades);
      extras.add(holder);
      mills.push(blades);
    }
    for (const o of S.ponds) {
      const pond = new THREE.Mesh(G.disc, waterMat);
      pond.position.set(o.x, 0.06, o.z);
      pond.scale.set(o.r * 2, 0.02, o.r * 2);
      pond.receiveShadow = true;
      extras.add(pond);
    }
    for (const v of halos) {
      const sprite = new THREE.Sprite(haloMat);
      sprite.position.copy(v);
      sprite.scale.setScalar(2.2);
      extras.add(sprite);
    }

    setMesh("ground", bake(ground), surface, false);
    setMesh("water", bake(water), waterMat, false);
    setMesh("structures", bake(parts), surface, true);
    setMesh("glow", bake(glow), glowMat, false);
    rebuildTrees();
    rebuildPlants();
    rebuildTufts();
    rebuildAnimals();
    people.rebuild(reduceMotion ? new Set() : fresh);
    buildWorld(towerSpots);
    syncBodies();
    rebuildBees();
    fresh.clear();
    // A fixed piece's labels were built from the old layout.
    if (selection && !selection.refresh) clearSelection(true);
  }

  function rebuildTrees() {
    const counts = [0, 0];
    const tint = new THREE.Color();
    for (const t of S.trees) {
      const k = t.k;
      if (counts[k] >= MAX_TREES) continue;
      treeMeshes[k].setMatrixAt(counts[k], M(t.x, 0, t.z, t.s, t.s, t.s, t.r));
      const r = rng(hash2(t.x, t.z));
      tint.setRGB(0.86 + r() * 0.16, 0.9 + r() * 0.1, 0.84 + r() * 0.12);
      treeMeshes[k].setColorAt(counts[k], tint);
      counts[k] += 1;
    }
    treeMeshes.forEach((mesh, k) => {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  function rebuildPlants() {
    const counts = new Map<PropKind, number>();
    const tint = new THREE.Color();
    for (const o of S.props) {
      const mesh = plantMeshes.get(o.kind);
      const n = counts.get(o.kind) ?? 0;
      if (!mesh || n >= MAX_INSTANCES) continue;
      const r = rng(o.seed);
      const s = 0.8 + r() * 0.45;
      mesh.setMatrixAt(n, M(o.x, 0, o.z, s, s, s, o.r));
      tint.setRGB(0.88 + r() * 0.12, 0.9 + r() * 0.1, 0.88 + r() * 0.12);
      mesh.setColorAt(n, tint);
      counts.set(o.kind, n + 1);
    }
    for (const [kind, mesh] of plantMeshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function blocked(x: number, z: number, pad = 0.6) {
    if (lineIndex.near(x, z, pad)) return true;
    if (streamIndex.near(x, z, pad + 0.6)) return true;
    for (const h of S.houses) if (Math.hypot(h.x - x, h.z - z) < h.len / 2 + 1 + pad * 0.3) return true;
    for (const p of S.ponds) if (Math.hypot(p.x - x, p.z - z) < p.r + 0.4) return true;
    for (const list of [S.wells, S.mills, S.towers]) for (const o of list) if (Math.hypot(o.x - x, o.z - z) < 1.2) return true;
    for (const o of S.props) {
      const def = TOOL[o.kind];
      if (!def.animal && !def.person && Math.hypot(o.x - x, o.z - z) < def.size + pad * 0.4) return true;
    }
    return false;
  }

  function rebuildTufts() {
    const r = rng(77);
    let n = 0;
    for (let i = 0; i < TUFTS * 2 && n < TUFTS; i += 1) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * (ISLAND_R - 0.6);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad, s = 0.7 + r() * 0.8, rot = r() * 3;
      if (blocked(x, z, 0.75)) continue;
      tuftMesh.setMatrixAt(n, M(x, 0, z, s, s, s, rot));
      n += 1;
    }
    tuftMesh.count = n;
    tuftMesh.instanceMatrix.needsUpdate = true;
  }

  function rebuildAnimals() {
    const list: { id: number; kind: ToolId; x: number; z: number }[] = [
      ...S.sheep.map((s) => ({ id: s.id, kind: "sheep" as ToolId, x: s.x, z: s.z })),
      ...S.props.filter((o) => TOOL[o.kind].animal),
    ];
    const ids = new Set(list.map((a) => a.id));
    for (const [id, v] of animalViews) if (!ids.has(id)) { v.mesh.removeFromParent(); animalViews.delete(id); }
    for (const a of list) {
      const existing = animalViews.get(a.id);
      if (existing) { existing.home.set(a.x, a.z); continue; }
      const geo = templates.animals.get(a.kind);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, surface);
      mesh.castShadow = true;
      const y = fresh.has(a.id) && !reduceMotion ? 1.2 : 0;
      mesh.position.set(a.x, y, a.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      world.add(mesh);
      animalViews.set(a.id, {
        id: a.id, kind: a.kind, mesh, home: new THREE.Vector2(a.x, a.z), target: new THREE.Vector2(a.x, a.z), threat: new THREE.Vector2(),
        wait: Math.random() * 3, hop: 0, pet: 0, vx: 0, vz: 0, y, vy: 0, state: "wander", stateT: 0, cool: 3 + Math.random() * 5, chase: null,
      });
    }
  }

  /** Live preview of the stroke or object being drawn. */
  function rebuildPreview() {
    for (const child of [...preview.children]) { (child as THREE.Mesh).geometry?.dispose(); child.removeFromParent(); }
    if (!drag) return;
    const parts: Part[] = [], glow: Part[] = [];
    if (drag.mode === "stroke" && drag.raw.length >= 2) strokeParts(drag.kind, { id: 0, pts: resample(chaikin(drag.raw, 1), STEP) }, parts, glow, pathIndex);
    else if (drag.mode === "house") houseParts(houseFromDrag(drag), parts, glow);
    else if (drag.mode === "pond") {
      pondParts({ x: drag.start[0], z: drag.start[1], r: drag.r, seed: 3 }, parts);
      parts.push({ g: G.disc, c: "#5fb2c0", m: M(drag.start[0], 0.06, drag.start[1], drag.r * 2, 0.02, drag.r * 2) });
    }
    const g = bake(parts);
    if (g) { const m = new THREE.Mesh(g, surface); m.castShadow = true; preview.add(m); }
    const gg = bake(glow);
    if (gg) preview.add(new THREE.Mesh(gg, glowMat));
  }

  /** Any drawn line as finished geometry; streams show their water as coloured ground here. */
  function strokeParts(kind: StrokeTool, stroke: Stroke, parts: Part[], glow: Part[], paths: Index) {
    if (kind === "path") pathParts(stroke, 5, parts);
    else if (kind === "wall") {
      const spots: TowerSpot[] = [];
      wallParts(stroke, parts, spots, paths);
      for (const t of spots) towerParts(t[0], t[1], hash2(t[0], t[1]), parts, glow);
    } else if (kind === "fence") fenceParts(stroke, parts);
    else if (kind === "hedge") hedgeParts(stroke, parts);
    else streamParts(stroke, parts, parts);
  }

  function sampleVillage() {
    const stroke = (ctrl: Point[]): Stroke => ({ id: newId(), pts: round2(resample(chaikin(ctrl, 3), STEP)) });
    S = emptyScene();
    S.paths.push(stroke([[-12, 4.6], [-8, 3.2], [-4.5, 1.6], [-1, 1.2], [2.5, -0.2], [6, -2.2], [12, -4.8], [16.5, -6]]));
    S.paths.push(stroke([[-0.6, 1.2], [-0.8, -2], [-2.6, -5.2]]));
    S.walls.push(stroke([[-5.2, -8.6], [-7.6, -4.6], [-7.2, 0.6], [-5.8, 5.8], [-2.2, 8.6]]));
    S.walls.push(stroke([[4.2, -8.8], [7.8, -6.8], [9.4, -2.4], [8.6, 2.2]]));
    S.streams.push(stroke([[10.5, -16], [12.6, -9], [11.4, -3], [13.6, 4], [17.5, 10]]));
    const house = (x: number, z: number, len: number) => {
      const near = nearestPathPoint(x, z);
      const r = near ? Math.atan2(near[0] - x, near[1] - z) : 0;
      S.houses.push({ id: newId(), x, z, len, r: Math.round(r * 100) / 100, seed: hash2(x, z) });
    };
    house(-2.6, -1.4, 2.5); house(1.6, -3.0, 1.8); house(-1.2, 4.2, 3.2); house(3.6, 2.4, 2.1); house(-4.6, 4.0, 1.7); house(4.8, -5.0, 2.6);
    const r = rng(404);
    const trees: Point[] = [[6.5, 5.5], [7.6, 6.6], [5.4, 7.6], [-9.6, -6.4], [-10.6, -3.2], [9.8, 3.6], [-8.8, 8.4], [1.8, 8.6], [-3.2, -8.8], [10.4, -7.4], [-11.4, 0.8], [3.2, 6.4], [-14, -9], [-15.5, -6.5], [-4, -15], [2, -16], [-17, 4], [8, 14], [0, 15], [-6, 14.5]];
    for (const [x, z] of trees) S.trees.push({ id: newId(), x, z, s: 0.85 + r() * 0.35, k: r() < 0.45 ? 1 : 0, r: r() * 6 });
    const prop = (kind: PropKind, x: number, z: number, rot?: number) => S.props.push({ id: newId(), kind, x, z, r: rot ?? Math.round(r() * 600) / 100, seed: hash2(x, z) });
    prop("barn", 16, -1.5, -1.9);
    prop("haystack", 18.2, 2);
    prop("cow", 17.5, -5.5);
    prop("chicken", 15, 2.6);
    prop("chicken", 15.8, 3.2);
    prop("lighthouse", -16.5, -9.5);
    prop("tent", -13.5, 9.5, 2.4);
    prop("campfire", -12, 7.4);
    for (const [x, z] of [[-1.5, 6.6], [-0.4, 7], [0.8, 6.4], [5.6, 3.6], [6.4, 3]]) prop("flower", x, z);
    prop("bench", 1.2, 1.7, Math.PI);
    prop("blossom", -14.5, 1.5);
  }

  /* ───────────── camera rig ───────────── */
  const rig = { theta: 0.72, phi: 0.98, radius: 30, tx: 0, tz: 0 };
  const goal = { ...rig };
  const PAN = ISLAND_R - 4;
  /** Distance that frames the village centre; portrait screens look down more steeply. Zoom out to see the whole island. */
  function fitView() {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const portrait = aspect < 0.9;
    const halfWidth = portrait ? 9.5 : 15.5;
    const radius = clamp(halfWidth / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect), 22, 66);
    return { radius, phi: portrait ? 0.82 : 0.98 };
  }
  function applyCamera(dt: number) {
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 9);
    for (const key of ["theta", "phi", "radius", "tx", "tz"] as const) rig[key] += (goal[key] - rig[key]) * k;
    const sp = Math.sin(rig.phi);
    camera.position.set(rig.tx + rig.radius * sp * Math.sin(rig.theta), rig.radius * Math.cos(rig.phi), rig.tz + rig.radius * sp * Math.cos(rig.theta));
    camera.lookAt(rig.tx, 0, rig.tz);
    fog.near = rig.radius * 0.9 + 22;
    fog.far = rig.radius * 1.6 + 70;
  }
  const orbitBy = (dx: number, dy: number) => {
    goal.theta -= dx * 0.0065;
    goal.phi = clamp(goal.phi - dy * 0.0045, 0.42, 1.22);
  };
  const zoomBy = (f: number) => { goal.radius = clamp(goal.radius * f, 11, 110); };
  function panBy(dx: number, dy: number) {
    const s = goal.radius * 0.0016;
    const cx = Math.cos(goal.theta), sx = Math.sin(goal.theta);
    goal.tx = clamp(goal.tx - (dx * cx - dy * sx) * s, -PAN, PAN);
    goal.tz = clamp(goal.tz - (-dx * sx - dy * cx) * s, -PAN, PAN);
  }

  /* ───────────── time of day ───────────── */
  const KEYS = [
    { t: 0.0, sky: "#d3e2e6", hs: "#fff1dc", hg: "#6d8a5c", hi: 1.55, sc: "#ffe0b5", si: 2.3, elev: 0.42, glow: 0 },
    { t: 0.4, sky: "#c3e1ef", hs: "#fff7e8", hg: "#6c8a5a", hi: 1.85, sc: "#fff6e4", si: 3.0, elev: 1.0, glow: 0 },
    { t: 0.72, sky: "#f0c9a6", hs: "#ffd8b0", hg: "#7a6a55", hi: 1.3, sc: "#ffab72", si: 2.4, elev: 0.26, glow: 0.35 },
    { t: 1.0, sky: "#1e2c47", hs: "#8fa4d8", hg: "#1f2a24", hi: 0.6, sc: "#a9bbff", si: 0.75, elev: 0.75, glow: 1 },
  ];
  const _a = new THREE.Color(), _b = new THREE.Color();
  function applyTime(t: number) {
    timeOfDay = t;
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i += 1;
    const A = KEYS[i], B = KEYS[i + 1], k = clamp((t - A.t) / (B.t - A.t), 0, 1);
    const mix = (key: "sky" | "hs" | "hg" | "sc") => _a.set(A[key]).lerp(_b.set(B[key]), k);
    sky.copy(mix("sky"));
    fog.color.copy(sky);
    hemi.color.copy(mix("hs"));
    hemi.groundColor.copy(mix("hg"));
    hemi.intensity = lerp(A.hi, B.hi, k);
    sun.color.copy(mix("sc"));
    sun.intensity = lerp(A.si, B.si, k);
    const elev = lerp(A.elev, B.elev, k), az = -0.9 + t * 2.4, D = 45;
    sun.position.set(Math.cos(az) * Math.cos(elev) * D, Math.sin(elev) * D + 4, Math.sin(az) * Math.cos(elev) * D);
    const glow = lerp(A.glow, B.glow, k);
    glowMat.emissiveIntensity = glow * 2.2;
    glowMat.color.set(glow > 0.5 ? "#4a3a28" : "#2f4250");
    haloMat.opacity = glow * 0.85;
    starMat.opacity = clamp((t - 0.8) / 0.2, 0, 1);
    cloudMat.color.setScalar(lerp(1, 0.55, clamp((t - 0.72) / 0.28, 0, 1)));
    petalMat.color.set("#f7c9d6").multiplyScalar(lerp(1, 0.3, clamp((t - 0.72) / 0.28, 0, 1)));
  }

  /* ───────────── editing ───────────── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(cx: number, cy: number): Point | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
  }

  let drag: Drag | null = null, before: string | null = null, needsRebuild = false, previewDirty = false, plantsDirty = false;
  const serialize = () => JSON.stringify(S);
  let saveTimer = 0;
  const flushSave = () => {
    if (!saveTimer) return;
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    options.onSave(JSON.stringify({ v: 1, scene: S, idSeq }));
  };
  const saveSoon = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushSave, 250);
  };

  function houseFromDrag(d: Extract<Drag, { mode: "house" }>): House {
    const len = d.moved ? clamp(dist(d.start, d.end), 1.4, 4.4) : d.len;
    let r: number;
    if (d.moved) {
      const dx = d.end[0] - d.start[0], dz = d.end[1] - d.start[1];
      r = Math.atan2(-dz, dx);
      const cx = (d.start[0] + d.end[0]) / 2, cz = (d.start[1] + d.end[1]) / 2;
      const near = nearestPathPoint(cx, cz);
      if (near && (near[0] - cx) * Math.sin(r) + (near[1] - cz) * Math.cos(r) < 0) r += Math.PI;
    } else {
      const near = nearestPathPoint(d.start[0], d.start[1]);
      r = near ? Math.atan2(near[0] - d.start[0], near[1] - d.start[1]) : d.r;
    }
    const x = d.moved ? (d.start[0] + d.end[0]) / 2 : d.start[0];
    const z = d.moved ? (d.start[1] + d.end[1]) / 2 : d.start[1];
    return { id: 0, x, z, len, r, seed: d.seed };
  }
  function addHouse(d: Extract<Drag, { mode: "house" }>) {
    const h = houseFromDrag(d);
    S.houses.push({ ...h, id: newId(), x: +h.x.toFixed(2), z: +h.z.toFixed(2), r: +h.r.toFixed(3), len: +h.len.toFixed(2) });
  }

  /** Plants a tree or a brushed plant if the ground is free. */
  function scatterAt(kind: ToolId, g: Point) {
    if (Math.hypot(g[0], g[1]) > BUILD_R) return false;
    if (kind === "tree") {
      if (blocked(g[0], g[1], 0.55) || S.trees.some((t) => Math.hypot(t.x - g[0], t.z - g[1]) < 0.75)) return false;
      S.trees.push({ id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), s: 0.75 + Math.random() * 0.45, k: Math.random() < 0.4 ? 1 : 0, r: Math.random() * 6 });
      rebuildTrees();
      return true;
    }
    if (blocked(g[0], g[1], 0.2) || S.trees.some((t) => Math.hypot(t.x - g[0], t.z - g[1]) < 0.7)) return false;
    const id = newId();
    S.props.push({ id, kind: kind as PropKind, x: +g[0].toFixed(2), z: +g[1].toFixed(2), r: +(Math.random() * Math.PI * 2).toFixed(2), seed: randSeed() });
    if (isDynamic(kind)) { fresh.add(id); needsBodySync = true; } else plantsDirty = true;
    return true;
  }

  /** Removes objects under the brush and splits strokes around it. */
  function eraseAt([x, z]: Point) {
    const R = 0.85;
    let changed = false;
    const keep = <T extends { x: number; z: number }>(list: T[], gone: (o: T) => boolean) => {
      const out = list.filter((o) => !gone(o));
      if (out.length !== list.length) changed = true;
      return out;
    };
    const near = (o: { x: number; z: number }, d: number) => Math.hypot(o.x - x, o.z - z) < d;
    S.houses = keep(S.houses, (h) => near(h, h.len / 2 + 0.55));
    S.towers = keep(S.towers, (o) => near(o, R + 0.4));
    S.wells = keep(S.wells, (o) => near(o, R + 0.4));
    S.mills = keep(S.mills, (o) => near(o, R + 0.5));
    S.lanterns = keep(S.lanterns, (o) => near(o, R));
    // Animals and people are erased where they stand now, not where they were placed.
    const live = (o: { id: number; x: number; z: number }) => animalViews.get(o.id)?.mesh.position ?? people.where(o.id) ?? o;
    S.sheep = keep(S.sheep, (o) => near(live(o), R + 0.2));
    S.trees = keep(S.trees, (o) => near(o, R));
    S.ponds = keep(S.ponds, (o) => near(o, o.r));
    S.props = keep(S.props, (o) => near(live(o), R * 0.6 + TOOL[o.kind].size));
    for (const kind of ["paths", "walls", "fences", "hedges", "streams"] as const) {
      S[kind] = S[kind].flatMap((st) => {
        if (!st.pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < R)) return [st];
        changed = true;
        const runs: Point[][] = [];
        let run: Point[] = [];
        for (const p of st.pts) {
          if (Math.hypot(p[0] - x, p[1] - z) < R) { if (run.length) runs.push(run); run = []; } else run.push(p);
        }
        if (run.length) runs.push(run);
        return runs.filter((r) => r.length >= 2 && lineLength(r) > 0.6).map((pts) => ({ id: newId(), pts }));
      });
    }
    if (changed) needsRebuild = true;
  }

  function petAnimal(g: Point) {
    const at = new THREE.Vector3(g[0], 0, g[1]);
    for (const v of animalViews.values()) {
      if (v.mesh.position.distanceTo(at) < TOOL[v.kind].size + 0.5) {
        v.pet = 1;
        say(`${TOOL[v.kind].sound ?? ""} (${v.kind} ${WORDS[v.kind as keyof typeof WORDS].ipa})`);
        return true;
      }
    }
    return false;
  }

  function placeObject(kind: ToolId, at: Point) {
    if (Math.hypot(at[0], at[1]) > ISLAND_R) { say("Hãy đặt trên đảo cỏ."); return; }
    const g = clampToIsland(at);
    const def = TOOL[kind];
    if (def.animal && petAnimal(g)) return;
    const base = { id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), seed: randSeed() };
    fresh.add(base.id);
    if (isLegacyTap(kind)) {
      if (kind === "tower") S.towers.push(base);
      else if (kind === "well") S.wells.push(base);
      else if (kind === "windmill") S.mills.push({ ...base, r: +(Math.atan2(-g[0], -g[1]) + Math.PI).toFixed(3) });
      else if (kind === "lantern") S.lanterns.push(base);
      else S.sheep.push(base);
      return;
    }
    const r = def.face ? facePath(g[0], g[1]) : Math.random() * Math.PI * 2;
    const prop = { ...base, kind: kind as PropKind, r: +r.toFixed(3) } satisfies Prop;
    S.props.push(prop);
    if (!def.animal && !def.person && !isDynamic(kind) && !INSTANCED.includes(prop.kind)) startDrop(prop);
  }

  function commit() {
    if (before === null) return;
    if (serialize() !== before) {
      undoStack.push(before);
      if (undoStack.length > 40) undoStack.shift();
      options.onUndoChange(true);
      needsRebuild = true;
      saveSoon();
    }
    before = null;
  }

  function startTool(e: PointerEvent) {
    const place = TOOL[tool].place;
    if (place === "orbit" || e.button === 2) { drag = { mode: "orbit", x: e.clientX, y: e.clientY }; return; }
    if (e.button === 1) { drag = { mode: "pan", x: e.clientX, y: e.clientY }; return; }
    // Look: a tap inspects, a drag turns the view.
    if (place === "look") { drag = { mode: "look", x: e.clientX, y: e.clientY, moved: false }; return; }
    const hitAt = groundAt(e.clientX, e.clientY);
    if (!hitAt) return;
    // The grass rim past BUILD_R looks buildable, so a start anywhere on the island is pulled inwards.
    const inside = Math.hypot(hitAt[0], hitAt[1]) <= ISLAND_R;
    const g = clampToIsland(hitAt);
    before = serialize();
    if (place === "stroke") {
      if (!inside) { say("Hãy bắt đầu vẽ trên đảo cỏ."); before = null; return; }
      drag = { mode: "stroke", kind: tool as StrokeTool, raw: [g] };
    } else if (place === "house") {
      if (!inside) { say("Hãy đặt nhà trên đảo cỏ."); before = null; return; }
      drag = { mode: "house", start: g, end: g, moved: false, len: 1.6 + Math.random() * 1.2, r: Math.random() * 6, seed: randSeed() };
    } else if (place === "pond") {
      if (!inside) { before = null; return; }
      drag = { mode: "pond", start: g, r: 1.2 };
    } else if (place === "brush") {
      drag = { mode: "brush", kind: tool, last: scatterAt(tool, g) ? g : null };
    } else if (place === "hand") {
      const b = bodyUnderPointer(e.clientX, e.clientY);
      if (b) {
        b.held = true;
        b.awake = true;
        b.rest = 0;
        drag = { mode: "hold", body: b, target: [b.x, b.z], trail: [{ t: performance.now(), x: b.x, z: b.z }] };
        canvas.style.cursor = "grabbing";
      } else drag = { mode: "nudge", x: e.clientX, y: e.clientY, moved: false };
    } else if (place === "erase") {
      drag = { mode: "erase" };
      eraseAt(g);
    } else {
      drag = { mode: "tap", kind: tool, x: e.clientX, y: e.clientY, moved: false };
    }
    previewDirty = true;
  }

  function moveTool(e: PointerEvent) {
    if (!drag) return;
    if (drag.mode === "orbit" || drag.mode === "pan") {
      (drag.mode === "orbit" ? orbitBy : panBy)(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    if (drag.mode === "tap" || drag.mode === "nudge") { drag.moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12; return; }
    if (drag.mode === "look") {
      drag.moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12;
      if (drag.moved) { orbitBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
      return;
    }
    if (drag.mode === "hold") {
      const g = groundAt(e.clientX, e.clientY);
      if (!g) return;
      const r = Math.hypot(g[0], g[1]), lim = ISLAND_R + 2;
      drag.target = r > lim ? [(g[0] / r) * lim, (g[1] / r) * lim] : g;
      const now = performance.now();
      drag.trail.push({ t: now, x: drag.target[0], z: drag.target[1] });
      while (drag.trail.length > 2 && now - drag.trail[0].t > 120) drag.trail.shift();
      return;
    }
    const g = groundAt(e.clientX, e.clientY);
    if (!g) return;
    if (drag.mode === "stroke") {
      const p = clampToIsland(g);
      if (dist(p, drag.raw[drag.raw.length - 1]) > 0.3) { drag.raw.push(p); previewDirty = true; }
    } else if (drag.mode === "house") {
      drag.end = clampToIsland(g);
      drag.moved = drag.moved || dist(drag.start, drag.end) > 0.45;
      previewDirty = true;
    } else if (drag.mode === "pond") {
      drag.r = clamp(dist(drag.start, g), 0.9, 3.4);
      previewDirty = true;
    } else if (drag.mode === "brush") {
      const spacing = drag.kind === "tree" ? 0.95 : TOOL[drag.kind].size * 1.6 + 0.2;
      if ((!drag.last || dist(drag.last, g) > spacing) && scatterAt(drag.kind, g)) drag.last = g;
    } else if (drag.mode === "erase") {
      eraseAt(g);
    }
  }

  function endTool(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    previewDirty = true;
    if (d.mode === "orbit" || d.mode === "pan") return;
    if (d.mode === "look") { if (!d.moved) inspectAt(e.clientX, e.clientY); return; }
    if (d.mode === "hold") { release(d, true); return; }
    if (d.mode === "nudge") {
      const g = d.moved ? null : groundAt(e.clientX, e.clientY);
      const person = g ? people.pick(ray) : null;
      if (person) { greet(person); before = null; }
      else if (g && !petAnimal(g)) gustAt(g);
      else before = null;
      return;
    }
    if (d.mode === "stroke") {
      if (lineLength(d.raw) < 0.9) {
        say(`Kéo dài hơn một chút để vẽ ${TOOL[d.kind].label.toLowerCase()}.`);
      } else {
        const pts = resample(chaikin(d.raw, 2), STEP);
        if (d.kind === "wall") {
          // Snap to nearby wall ends so drawn walls join up instead of leaving gaps.
          const ends = S.walls.flatMap((w) => [w.pts[0], w.pts[w.pts.length - 1]]);
          for (const idx of [0, pts.length - 1]) {
            const snap = ends.find((q) => dist(q, pts[idx]) < 0.9);
            if (snap) pts[idx] = [snap[0], snap[1]];
          }
        }
        S[STROKE_KEY[d.kind]].push({ id: newId(), pts: round2(pts) });
      }
    } else if (d.mode === "house") {
      addHouse(d);
    } else if (d.mode === "pond") {
      S.ponds.push({ id: newId(), x: +d.start[0].toFixed(2), z: +d.start[1].toFixed(2), r: +d.r.toFixed(2), seed: randSeed() });
    } else if (d.mode === "tap" && !d.moved) {
      const g = groundAt(e.clientX, e.clientY);
      if (g) placeObject(d.kind, g);
    }
    commit();
  }

  function cancelTool() {
    if (!drag) return;
    if (drag.mode === "hold") {
      release(drag, false);
      drag = null;
      previewDirty = true;
      return;
    }
    if (before !== null && (drag.mode === "brush" || drag.mode === "erase")) {
      S = JSON.parse(before) as VillageScene;
      needsRebuild = true;
    }
    drag = null;
    before = null;
    previewDirty = true;
  }

  /** Keyboard building: Enter places the selected object near the centre of the view. */
  function placeByKeyboard() {
    const def = TOOL[tool];
    if (def.place === "stroke") { say(`${def.label} cần kéo bằng chuột hoặc ngón tay. Bàn phím đặt được nhà, cây, ao và các món đồ chạm.`); return; }
    if (def.place === "hand") {
      before = serialize();
      gustAt([goal.tx, goal.tz]);
      return;
    }
    if (def.place === "look") { inspectNext(); return; }
    if (def.place === "orbit" || def.place === "erase") { say("Chọn nhà, cây hoặc một món đồ rồi bấm Enter để đặt vào giữa khung nhìn."); return; }
    const g = clampToIsland([goal.tx + (Math.random() - 0.5) * 3, goal.tz + (Math.random() - 0.5) * 3]);
    before = serialize();
    if (def.place === "house") addHouse({ mode: "house", start: g, end: g, moved: false, len: 1.6 + Math.random() * 1.2, r: Math.random() * 6, seed: randSeed() });
    else if (def.place === "brush") scatterAt(tool, g);
    else if (def.place === "pond") S.ponds.push({ id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), r: 1.4, seed: randSeed() });
    else placeObject(tool, g);
    const changed = serialize() !== before;
    commit();
    say(changed ? `Đã đặt ${def.label.toLowerCase()} giữa khung nhìn.` : "Chỗ này chật quá. Dời khung nhìn bằng Shift + mũi tên rồi thử lại.");
  }

  /* ───────────── tool previews ───────────── */
  /** Each tool drawn on its own, for the small pictures in the tool dock and word book. */
  function previewParts(id: ToolId): Part[] {
    const parts: Part[] = [], glow: Part[] = [];
    const def = TOOL[id];
    if (def.place === "stroke") {
      const ctrl: Point[] = id === "wall" ? [[-2.2, 0.6], [0, -0.6], [2.2, 0.4]] : [[-2.2, 0.8], [-0.6, -0.6], [0.8, 0.5], [2.2, -0.5]];
      strokeParts(id as StrokeTool, { id: 1, pts: resample(chaikin(ctrl, 2), STEP) }, parts, glow, NO_INDEX);
    } else if (id === "house") houseParts({ id: 0, x: 0, z: 0, len: 2.4, r: 0.4, seed: 12 }, parts, glow);
    else if (id === "tree") parts.push({ g: templates.trees[0], c: null, m: null }, { g: templates.trees[1], c: null, m: M(1.3, 0, -0.6, 0.8, 0.8, 0.8) });
    else if (id === "tower") towerParts(0, 0, 2, parts, glow);
    else if (id === "well") wellParts({ id: 0, x: 0, z: 0, seed: 4 }, parts);
    else if (id === "pond") {
      pondParts({ x: 0, z: 0, r: 1.5, seed: 3 }, parts);
      parts.push({ g: G.disc, c: "#5fb2c0", m: M(0, 0.06, 0, 3, 0.02, 3) });
    } else if (id === "windmill") {
      const T = millParts({ id: 0, x: 0, z: 0, seed: 1, r: 0.6 }, parts, glow);
      parts.push({ g: templates.blade, c: null, m: T.clone().multiply(M(0, 3.0, 0.86, 1, 1, 1, 0, 0, 0.4)) });
    } else if (id === "lantern") lanternParts({ id: 0, x: 0, z: 0, seed: 2 }, parts, glow, []);
    else if (templates.animals.has(id)) parts.push({ g: templates.animals.get(id) as THREE.BufferGeometry, c: null, m: null });
    else if (templates.plants.has(id as PropKind)) parts.push({ g: templates.plants.get(id as PropKind) as THREE.BufferGeometry, c: null, m: null });
    else if (isDynamic(id)) parts.push({ g: templates.bodies.get(id) as THREE.BufferGeometry, c: null, m: null });
    else parts.push(...modelParts(id as PropKind, 7, glow));
    for (const part of glow) parts.push({ ...part, c: "#2f4250" });
    return parts;
  }

  let thumbTimer = 0;
  /** Renders every tool's preview into a small transparent image, a few per tick so the page stays responsive. */
  function makeThumbnails() {
    let tr: THREE.WebGLRenderer;
    try {
      tr = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    const size = 112;
    tr.setPixelRatio(1);
    tr.setSize(size, size, false);
    tr.outputColorSpace = THREE.SRGBColorSpace;
    tr.toneMapping = THREE.NeutralToneMapping;
    tr.setClearColor(0x000000, 0);
    const ts = new THREE.Scene();
    const key = new THREE.DirectionalLight("#fff6e4", 2.6);
    key.position.set(4, 9, 6);
    ts.add(new THREE.HemisphereLight("#fff7e8", "#6c8a5a", 2.1), key);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    const dir = new THREE.Vector3(1, 0.9, 1.4).normalize();
    const ids = TOOLS.filter((t) => t.cat !== null).map((t) => t.id);
    const out: Thumbs = {};
    let i = 0;
    const finish = () => { mat.dispose(); tr.dispose(); tr.forceContextLoss(); };
    const step = () => {
      if (disposed) { finish(); return; }
      for (const end = Math.min(ids.length, i + 6); i < end; i += 1) {
        const geo = bake(previewParts(ids[i]));
        if (!geo?.boundingSphere) continue;
        const { center, radius } = geo.boundingSphere;
        const d = (radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.02;
        cam.position.copy(center).addScaledVector(dir, d);
        cam.near = d / 10;
        cam.far = d * 3;
        cam.updateProjectionMatrix();
        cam.lookAt(center);
        const mesh = new THREE.Mesh(geo, mat);
        ts.add(mesh);
        tr.render(ts, cam);
        out[ids[i]] = tr.domElement.toDataURL("image/png");
        ts.remove(mesh);
        geo.dispose();
      }
      if (i < ids.length) thumbTimer = window.setTimeout(step, 16);
      else { finish(); options.onThumbs(out); }
    };
    thumbTimer = window.setTimeout(step, 120);
  }

  /* ───────────── movable pieces (physics.ts does the maths) ───────────── */
  let phys: World = makeWorld({ islandR: ISLAND_R });
  const bodies = new Map<number, Body>();
  const bodyQuat = new Map<number, THREE.Quaternion>();
  let pendingCommit = false, needsBodySync = false, floatSync = 0;
  const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const _bm = new THREE.Matrix4(), _bt = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _hit = new THREE.Vector3();
  const _sphere = new THREE.Sphere(), _eul = new THREE.Euler();
  const bodyList = () => [...bodies.values()];

  /** Static colliders and water for this layout: walls (minus gates), fences, hedges, towers, buildings, trees. */
  function buildWorld(towerSpots: TowerSpot[]) {
    const circles: Circle[] = [], boxes: Box[] = [];
    for (const s of S.walls) for (const [x, z] of s.pts) if (!pathIndex.near(x, z, GATE_DIST + 0.35)) circles.push({ x, z, r: 0.3 });
    for (const s of S.fences) for (const [x, z] of s.pts) circles.push({ x, z, r: 0.16 });
    for (const s of S.hedges) for (const [x, z] of s.pts) circles.push({ x, z, r: 0.42 });
    for (const [x, z] of towerSpots) circles.push({ x, z, r: 0.85 });
    for (const o of S.wells) circles.push({ x: o.x, z: o.z, r: 0.7 });
    for (const o of S.mills) circles.push({ x: o.x, z: o.z, r: 0.95 });
    for (const o of S.lanterns) circles.push({ x: o.x, z: o.z, r: 0.12 });
    for (const t of S.trees) circles.push({ x: t.x, z: t.z, r: 0.18 * t.s + 0.08 });
    for (const h of S.houses) boxes.push({ x: h.x, z: h.z, hx: h.len / 2 + 0.05, hz: 0.83, rot: h.r });
    for (const o of S.props) {
      if (TOOL[o.kind].animal || TOOL[o.kind].person || isDynamic(o.kind) || NO_COLLIDE.has(o.kind)) continue;
      const box = PROP_BOX[o.kind];
      if (box) boxes.push({ x: o.x, z: o.z, hx: box[0], hz: box[1], rot: o.r });
      else circles.push({ x: o.x, z: o.z, r: PROP_RADIUS[o.kind] ?? TOOL[o.kind].size * 0.75 });
    }
    phys = makeWorld({
      islandR: ISLAND_R, circles, boxes,
      ponds: S.ponds.map((p) => ({ x: p.x, z: p.z, r: p.r })),
      streams: S.streams.map((s) => s.pts),
      dry: (x, z) => pathIndex.near(x, z, 0.8), // bridges
    });
  }

  function syncBodies() {
    const ids = new Set<number>();
    for (const o of S.props) {
      if (!isDynamic(o.kind)) continue;
      ids.add(o.id);
      if (bodies.has(o.id)) continue;
      bodies.set(o.id, makeBody({ id: o.id, kind: o.kind, x: o.x, z: o.z, r: o.r }, fresh.has(o.id) && !reduceMotion ? 1.2 : 0));
      bodyQuat.set(o.id, new THREE.Quaternion().setFromAxisAngle(UP, o.r));
    }
    for (const id of [...bodies.keys()]) if (!ids.has(id)) { bodies.delete(id); bodyQuat.delete(id); }
    renderBodies();
  }

  function renderBodies() {
    const counts = new Map<DynamicKind, number>();
    for (const b of bodies.values()) {
      const mesh = bodyMeshes.get(b.kind), n = counts.get(b.kind) ?? 0;
      if (!mesh || b.gone || n >= MAX_BODIES) continue;
      const spec = BODY[b.kind], q = bodyQuat.get(b.id) as THREE.Quaternion;
      const sink = b.floating ? FLOAT_SINK[b.kind] - Math.sin(clock * 2.2 + b.id) * 0.025 : 0;
      if (spec.rolls) {
        _bm.makeTranslation(b.x, b.y - sink + spec.r, b.z).multiply(_bt.makeRotationFromQuaternion(q)).multiply(_bt.makeTranslation(0, -spec.r, 0));
      } else {
        _bq.setFromAxisAngle(UP, b.yaw);
        _bm.compose(_bp.set(b.x, b.y - sink, b.z), _bq, ONE);
      }
      mesh.setMatrixAt(n, _bm);
      counts.set(b.kind, n + 1);
    }
    for (const [kind, mesh] of bodyMeshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Copies a body's resting place into the save. */
  function syncProp(b: Body) {
    const o = S.props.find((p) => p.id === b.id);
    if (!o) return false;
    const x = +b.x.toFixed(2), z = +b.z.toFixed(2), r = +b.yaw.toFixed(3);
    if (o.x === x && o.z === z && o.r === r) return false;
    Object.assign(o, { x, z, r });
    return true;
  }

  function stepPhysics(dt: number) {
    if (needsBodySync) { needsBodySync = false; syncBodies(); fresh.clear(); }
    if (drag?.mode === "hold") {
      const b = drag.body;
      b.vx = clamp((drag.target[0] - b.x) * 14, -MAX_SPEED, MAX_SPEED);
      b.vz = clamp((drag.target[1] - b.z) * 14, -MAX_SPEED, MAX_SPEED);
      b.awake = true;
    }
    const movers: Mover[] = people.movers();
    for (const v of animalViews.values()) {
      if (Math.hypot(v.vx, v.vz) > 0.05) movers.push({ x: v.mesh.position.x, z: v.mesh.position.z, vx: v.vx, vz: v.vz, r: Math.max(0.22, TOOL[v.kind].size * 0.8) });
    }
    const list = bodyList();
    if (!movers.length && !list.some((b) => b.awake)) return;
    const { settled, fell } = stepBodies(phys, list, movers, dt);
    for (const b of list) {
      if (!b.awake || b.gone || b.held) continue;
      const spec = BODY[b.kind], speed = Math.hypot(b.vx, b.vz);
      if (spec.rolls && speed > 0.01 && !b.floating) {
        _bp.set(b.vz / speed, 0, -b.vx / speed);
        (bodyQuat.get(b.id) as THREE.Quaternion).premultiply(_bq.setFromAxisAngle(_bp, (speed * dt) / spec.r));
      } else if (b.kind === "boat" && b.floating && speed > 0.1) b.yaw += angleDiff(Math.atan2(b.vx, b.vz), b.yaw) * Math.min(1, dt * 2);
      else if (!spec.rolls && speed > 0.4) b.yaw += speed * dt * 0.5 * (b.id % 2 ? 1 : -1);
    }
    let changed = false;
    for (const b of settled) changed = syncProp(b) || changed;
    for (const b of fell) {
      S.props = S.props.filter((o) => o.id !== b.id);
      bodies.delete(b.id);
      bodyQuat.delete(b.id);
      changed = true;
      say(`Ối, ${TOOL[b.kind].label.toLowerCase()} rơi khỏi đảo! Bấm Hoàn tác để lấy lại.`);
    }
    floatSync += dt;
    if (floatSync > 3) {
      floatSync = 0;
      for (const b of list) if (b.floating && b.awake) changed = syncProp(b) || changed;
    }
    renderBodies();
    const busy = list.some((b) => b.awake && !b.floating && !b.gone);
    if (pendingCommit && !busy && drag?.mode !== "hold") {
      for (const b of list) if (b.floating) syncProp(b);
      pendingCommit = false;
      commit();
    } else if (changed && !pendingCommit) saveSoon();
  }

  /** The movable piece under the pointer, tested against a sphere around each one. */
  function bodyUnderPointer(cx: number, cy: number) {
    if (!groundAt(cx, cy)) return null;
    let best: Body | null = null, bestD = Infinity;
    for (const b of bodies.values()) {
      if (b.gone) continue;
      const r = BODY[b.kind].r;
      _sphere.set(_bp.set(b.x, b.y + r, b.z), r + 0.3);
      if (!ray.ray.intersectSphere(_sphere, _hit)) continue;
      const d = _hit.distanceTo(ray.ray.origin);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ?? bodyAt(bodyList(), hit.x, hit.z, 0.2);
  }

  /** Lets go of a held piece; a quick flick throws it with the pointer's last velocity. */
  function release(d: Extract<Drag, { mode: "hold" }>, throwIt: boolean) {
    const b = d.body, now = performance.now();
    const first = d.trail[0], last = d.trail[d.trail.length - 1];
    const span = Math.max(16, last.t - first.t) / 1000;
    let vx = 0, vz = 0;
    if (throwIt && now - last.t < 120) { vx = (last.x - first.x) / span; vz = (last.z - first.z) / span; }
    const speed = Math.hypot(vx, vz);
    if (speed > 12) { vx *= 12 / speed; vz *= 12 / speed; }
    Object.assign(b, { held: false, awake: true, rest: 0, vx, vz, vy: throwIt ? Math.min(3.5, 0.6 + Math.hypot(vx, vz) * 0.25) : 0 });
    pendingCommit = true;
    canvas.style.cursor = "";
  }

  /** A small puff of wind from the hand: pushes pieces, startles animals and birds. */
  function gustAt(g: Point) {
    const moved = gust(bodyList(), g[0], g[1]);
    for (const v of animalViews.values()) {
      if (v.state !== "sleep" && Math.hypot(v.mesh.position.x - g[0], v.mesh.position.z - g[1]) < 2.8) startle(v, g[0], g[1], 1.2);
    }
    scareBirds(g[0], g[1], 3.5);
    if (!reduceMotion) { ring.position.set(g[0], 0.08, g[1]); ring.visible = true; ringT = 0; }
    if (moved.length) pendingCommit = true;
    else before = null;
  }

  /** Forgets in-flight motion, used before undo and reset rebuild everything from the save. */
  function clearMotion() {
    bodies.clear();
    bodyQuat.clear();
    pendingCommit = false;
    for (const d of drops.values()) { d.mesh.geometry.dispose(); d.mesh.removeFromParent(); }
    drops.clear();
    birds = [];
  }

  /* ───────────── placing: pieces drop in with a small bounce ───────────── */
  const drops = new Map<number, { mesh: THREE.Mesh; t: number }>();
  function startDrop(o: Prop) {
    if (reduceMotion) return;
    const glow: Part[] = [];
    const parts = modelParts(o.kind, o.seed, glow);
    const geo = bake([...parts, ...glow.map((g) => ({ ...g, c: "#2f4250" }))]);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, surface);
    mesh.castShadow = true;
    mesh.position.set(o.x, 1.4, o.z);
    mesh.rotation.y = o.r;
    world.add(mesh);
    drops.set(o.id, { mesh, t: 0 });
  }
  function updateDrops(dt: number) {
    for (const [id, d] of drops) {
      d.t += dt;
      const fall = 0.38, tb = d.t - fall;
      d.mesh.position.y = d.t < fall ? 1.4 * (1 - (d.t / fall) ** 2) : Math.max(0, 2.2 * tb - 9 * tb * tb);
      const squash = Math.exp(-((tb * 12) ** 2));
      d.mesh.scale.set(1 + 0.1 * squash, 1 - 0.18 * squash, 1 + 0.1 * squash);
      if (d.t > 0.7) {
        d.mesh.geometry.dispose();
        d.mesh.removeFromParent();
        drops.delete(id);
        needsRebuild = true;
      }
    }
  }

  /* ───────────── animals: wander, flock, chase, flee, swim, sleep ───────────── */
  const _avoid = { x: 0, z: 0, vx: 0, vz: 0 };
  function startle(v: AnimalView, x: number, z: number, time: number) {
    v.state = "flee";
    v.stateT = time;
    v.threat.set(x, z);
    v.wait = 0;
    v.chase = null;
  }
  function waterSpot(x: number, z: number, range: number): Point | null {
    let best: Point | null = null, bestD = range;
    for (const p of S.ponds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= bestD) continue;
      const a = Math.random() * Math.PI * 2, r = Math.random() * p.r * 0.6;
      bestD = d;
      best = [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
    }
    for (const s of S.streams) for (let i = 0; i < s.pts.length; i += 3) {
      const [px, pz] = s.pts[i], d = Math.hypot(px - x, pz - z);
      if (d < bestD && !pathIndex.near(px, pz, 1)) { bestD = d; best = [px, pz]; }
    }
    return best;
  }
  function pickTarget(v: AnimalView) {
    if (v.kind === "duck") {
      const spot = waterSpot(v.home.x, v.home.y, 8);
      if (spot) { v.target.set(spot[0], spot[1]); return; }
    }
    let cx = v.home.x, cz = v.home.y;
    if (v.kind === "sheep") {
      // Sheep drift towards the middle of their flock.
      let n = 0, sx = 0, sz = 0;
      for (const o of animalViews.values()) {
        if (o === v || o.kind !== "sheep" || o.mesh.position.distanceTo(v.mesh.position) > 10) continue;
        sx += o.mesh.position.x; sz += o.mesh.position.z; n += 1;
      }
      if (n) { cx = sx / n; cz = sz / n; }
    }
    const roam = v.kind === "dog" ? 3.6 : v.kind === "sheep" ? 1.8 : 2.6;
    for (let tries = 0; tries < 6; tries += 1) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * roam;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.hypot(x, z) < BUILD_R && !blocked(x, z, 0.4) && !waterAt(phys, x, z)) { v.target.set(x, z); return; }
    }
  }
  /** At night animals gather in front of a barn or around a campfire near home. */
  function nightSpot(v: AnimalView): Point | null {
    const prefer: PropKind[] = v.kind === "dog" || v.kind === "cat" ? ["campfire", "barn"] : ["barn", "campfire"];
    for (const kind of prefer) {
      let best: Prop | null = null, bestD = kind === "barn" ? 16 : 12;
      for (const o of S.props) {
        if (o.kind !== kind) continue;
        const d = Math.hypot(o.x - v.home.x, o.z - v.home.y);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (!best) continue;
      const a = v.id * 2.39996;
      if (kind === "barn") {
        const r = 0.35 + (v.id % 4) * 0.32;
        return [best.x + Math.sin(best.r) * 2.4 + Math.cos(a) * r, best.z + Math.cos(best.r) * 2.4 + Math.sin(a) * r];
      }
      const r = 1.35 + (v.id % 2) * 0.45;
      return [best.x + Math.cos(a) * r, best.z + Math.sin(a) * r];
    }
    return null;
  }
  function startChase(v: AnimalView) {
    const p = v.mesh.position;
    let ball: Body | null = null, bd = 9;
    for (const b of bodies.values()) {
      if (b.kind !== "ball" || b.gone || b.held) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) { bd = d; ball = b; }
    }
    let prey: AnimalView | null = null, pd = 6;
    for (const o of animalViews.values()) {
      if (!PREY.has(o.kind) || o.state === "sleep") continue;
      const d = o.mesh.position.distanceTo(p);
      if (d < pd) { pd = d; prey = o; }
    }
    const target = ball && (!prey || Math.random() < 0.6) ? ball : prey;
    if (!target) { v.cool = 3; return; }
    v.state = "chase";
    v.chase = target;
    v.stateT = 4.5;
  }
  function endChase(v: AnimalView, cool: number) {
    v.state = "wander";
    v.chase = null;
    v.cool = cool;
    v.wait = 0.4;
    pickTarget(v);
  }

  function updateAnimals(dt: number, motion: number) {
    const night = timeOfDay > 0.82;
    for (const v of animalViews.values()) {
      const m = v.mesh, p = m.position;
      const swim = v.kind === "duck" && !!waterAt(phys, p.x, p.z);
      const ground = swim ? -0.08 : 0;
      if (v.y > ground || v.vy > 0) { v.vy -= GRAVITY * dt; v.y += v.vy * dt; }
      if (v.y <= ground) { v.y = ground; v.vy = v.vy < -2 ? -v.vy * 0.3 : 0; }
      if (v.pet > 0) { v.pet = Math.max(0, v.pet - dt * 1.6); p.y = v.y + Math.sin(v.pet * Math.PI) * 0.45 * motion; continue; }
      if (!motion) { v.vx = v.vz = 0; p.y = v.y; continue; }
      v.stateT -= dt;
      v.cool -= dt;
      let speed = SPEED[v.kind] ?? 0.5;

      if (night && v.state !== "flee") {
        const spot = nightSpot(v);
        if (spot) {
          v.target.set(spot[0], spot[1]);
          if (v.state !== "sleep") v.state = "home";
        }
      } else if (v.state === "sleep" || v.state === "home") {
        v.state = "wander";
        pickTarget(v);
      }
      if (v.state === "flee") {
        if (v.stateT <= 0) { v.state = "wander"; v.wait = 0.5 + Math.random(); }
        else {
          const dx = p.x - v.threat.x, dz = p.z - v.threat.y, d = Math.hypot(dx, dz) || 1;
          v.target.set(p.x + (dx / d) * 2, p.z + (dz / d) * 2);
          speed *= 2.6;
        }
      } else if (v.state === "chase") {
        const prey = v.chase;
        if (!prey || v.stateT <= 0 || ("gone" in prey && prey.gone)) endChase(v, 4);
        else {
          const isAnimal = "mesh" in prey;
          const tx = isAnimal ? prey.mesh.position.x : prey.x, tz = isAnimal ? prey.mesh.position.z : prey.z;
          v.target.set(tx, tz);
          speed = 2.6;
          const d = Math.hypot(tx - p.x, tz - p.z);
          if (isAnimal) {
            if (d < 3.2) startle(prey, p.x, p.z, 1.4);
            if (d < 0.6) endChase(v, 5 + Math.random() * 5);
          } else if (d < BODY[prey.kind].r + 0.45) endChase(v, 2.5 + Math.random() * 3);
        }
      } else if (v.state === "wander") {
        if (v.kind === "dog" && v.cool <= 0 && !night && Math.random() < dt * 0.3) startChase(v);
        if (v.state === "wander") {
          if (v.wait > 0) { v.wait -= dt; speed = 0; }
          else if (Math.hypot(v.target.x - p.x, v.target.y - p.z) < 0.1) { v.wait = 1.5 + Math.random() * 4; pickTarget(v); speed = 0; }
        }
      }

      let wx = 0, wz = 0;
      const dx = v.target.x - p.x, dz = v.target.y - p.z, d = Math.hypot(dx, dz);
      if (v.state !== "sleep") {
        if (d > 0.08 && speed > 0) { const sp = Math.min(speed, d * 3); wx = (dx / d) * sp; wz = (dz / d) * sp; }
        else if (v.state === "home") v.state = "sleep";
      }
      for (const o of animalViews.values()) {
        if (o === v) continue;
        const ox = p.x - o.mesh.position.x, oz = p.z - o.mesh.position.z, od = Math.hypot(ox, oz);
        const min = TOOL[v.kind].size + TOOL[o.kind].size + 0.1;
        if (od < min && od > 1e-4) { wx += (ox / od) * (min - od) * 4; wz += (oz / od) * (min - od) * 4; }
      }
      if (swim) {
        const f = waterAt(phys, p.x, p.z);
        if (f) { wx += f.fx * 0.5; wz += f.fz * 0.5; }
      }
      const k = Math.min(1, dt * 5);
      v.vx += (wx - v.vx) * k;
      v.vz += (wz - v.vz) * k;
      const px = p.x, pz = p.z;
      Object.assign(_avoid, { x: p.x + v.vx * dt, z: p.z + v.vz * dt, vx: v.vx, vz: v.vz });
      pushOut(phys, _avoid, TOOL[v.kind].size * 0.7, 0);
      p.x = _avoid.x;
      p.z = _avoid.z;
      const rr = Math.hypot(p.x, p.z);
      if (rr > BUILD_R) { p.x *= BUILD_R / rr; p.z *= BUILD_R / rr; }
      if (v.kind !== "duck" && waterAt(phys, p.x, p.z)) {
        p.x = px; p.z = pz; v.vx = v.vz = 0;
        if (v.state === "wander") pickTarget(v);
      }
      const sp = Math.hypot(v.vx, v.vz);
      if (sp > 0.05) m.rotation.y += angleDiff(Math.atan2(v.vx, v.vz), m.rotation.y) * Math.min(1, dt * 8);
      m.scale.y += ((v.state === "sleep" ? 0.86 : 1) - m.scale.y) * Math.min(1, dt * 3);
      let hop = 0;
      if (sp > 0.08 && !swim && v.vy === 0) {
        v.hop += dt * (v.kind === "rabbit" ? 7 : 10) * Math.max(1, sp / (SPEED[v.kind] ?? 0.5));
        hop = Math.abs(Math.sin(v.hop)) * (v.kind === "rabbit" ? 0.16 : 0.06) * Math.min(1, sp * 2);
      }
      p.y = v.y + hop + (swim ? Math.sin(clock * 2 + v.id) * 0.02 : 0);
    }
  }

  /* ───────────── villagers ───────────── */
  const people = createPeople({
    world, scene, material: surface,
    village: () => S,
    phys: () => phys,
    time: () => timeOfDay,
    blocked: (x, z, pad) => blocked(x, z, pad),
    houseDoor: (h) => houseDoors.get(h.id) ?? [h.x + Math.sin(h.r) * 1.5, h.z + Math.cos(h.r) * 1.5],
    animals: () => [...animalViews.values()].map((v) => ({ kind: v.kind, x: v.mesh.position.x, z: v.mesh.position.z })),
    balls: () => [...bodies.values()].filter((b) => b.kind === "ball"),
  });
  /** Hand tool on a person: they wave back, and the toast says so in both languages. */
  function greet(p: Person) {
    people.wave(p);
    const line = describe(people.describe(p).who, "wave");
    say(`${line.en} ${line.vi}`);
  }

  /* ───────────── Look tool: names, what people and animals are doing, part labels ───────────── */
  interface Selection {
    info: InspectInfo;
    /** Label anchors, in the space `frame` maps to the world. */
    marks: Mark[];
    /** The thing's current world matrix; null once it has gone (erased, gone indoors). */
    frame: () => THREE.Matrix4 | null;
    /** Fixed ground centre for things that do not move. */
    center?: THREE.Vector3;
    ring: number;
    /** Re-reads what a person or animal is doing. */
    refresh?: () => InspectInfo | null;
  }
  let selection: Selection | null = null, selectionCheck = 0;
  const IDENTITY = new THREE.Matrix4();
  // Drawn over everything, so a villager behind a house still shows where they stand.
  const selMat = new THREE.MeshBasicMaterial({ color: "#fff7e0", transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 6, 48), selMat);
  selRing.renderOrder = 10;
  selRing.rotation.x = Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);
  const labelLayer = document.createElement("div");
  labelLayer.className = "vg-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  container.appendChild(labelLayer);
  let labelEls: { dot: HTMLElement; line: HTMLElement; chip: HTMLElement; w: number }[] = [];
  const uniqueParts = (marks: { part: PartId }[]) => [...new Set(marks.map((m) => m.part))];
  const anchors = (list: readonly [PartId, number, number, number][] | undefined): Mark[] => (list ?? []).map(([part, x, y, z]) => ({ part, at: new THREE.Vector3(x, y, z) }));
  /** Runs a builder only to collect where its parts are. */
  function collectMarks(build: () => void) {
    const marks: Mark[] = [];
    markSink = marks;
    try { build(); } finally { markSink = undefined; }
    return marks;
  }

  function clearSelection(notify: boolean) {
    selection = null;
    selRing.visible = false;
    labelLayer.replaceChildren();
    labelEls = [];
    if (notify) options.onInspect?.(null);
  }
  /** Shows a selection's labels and card; `focus` (keyboard) also brings it to the middle of the view. */
  function select(sel: Selection, focus = false) {
    selection = sel;
    selectionCheck = 0.4;
    labelLayer.replaceChildren();
    labelEls = sel.marks.map((m) => {
      const dot = document.createElement("i"), line = document.createElement("i"), chip = document.createElement("span");
      dot.className = "vg-label-dot";
      line.className = "vg-label-line";
      chip.className = "vg-label";
      chip.lang = "en";
      chip.textContent = m.part;
      labelLayer.append(line, dot, chip);
      return { dot, line, chip, w: 0 };
    });
    // A thin ring of the right size (scaling one ring would thicken it too).
    selRing.geometry.dispose();
    selRing.geometry = new THREE.TorusGeometry(sel.ring, 0.045, 6, 48);
    // Keyboard steps bring the thing to the middle; on a phone a tap does too, a little low so the card does not cover it.
    const narrow = container.clientWidth < 640;
    if (focus || narrow) {
      const at = sel.center ?? _sel.setFromMatrixPosition(sel.frame() ?? IDENTITY);
      if (focus) goal.radius = Math.min(goal.radius, sel.refresh ? 14 : 22);
      const ahead = narrow ? goal.radius * 0.1 : 0;
      goal.tx = clamp(at.x - Math.sin(goal.theta) * ahead, -PAN, PAN);
      goal.tz = clamp(at.z - Math.cos(goal.theta) * ahead, -PAN, PAN);
    }
    selRing.visible = true;
    options.onInspect?.(sel.info);
  }
  const _sel = new THREE.Vector3();

  function personInfo(p: Person): InspectInfo {
    const { who, action } = people.describe(p);
    return {
      id: `person:${p.id}`,
      title: who.word ? { word: who.word } : { resident: who.resident as ResidentId },
      sentence: describe(who, action),
      parts: uniqueParts(personMarks(p.role).map(([part]) => ({ part }))),
    };
  }
  function personSelection(p: Person): Selection {
    return {
      info: personInfo(p), marks: anchors(personMarks(p.role)), ring: 0.45,
      frame: () => (people.isAlive(p) ? p.mesh.matrixWorld : null),
      refresh: () => (people.isAlive(p) ? personInfo(p) : null),
    };
  }

  /** What an animal is doing, read from its state and how it moves. */
  function animalAction(v: AnimalView): { action: ActionId; target?: { en: string; vi: string } } {
    if (v.state === "sleep") return { action: "sleep" };
    if (v.state === "home") return { action: "goHome" };
    if (v.state === "flee") return { action: "flee" };
    if (v.state === "chase" && v.chase) {
      if (!("mesh" in v.chase)) return { action: "chaseBall" };
      const prey = v.chase.kind as WordId;
      return { action: "chase", target: { en: prey, vi: viWho(prey) } };
    }
    const p = v.mesh.position;
    if (v.kind === "duck" && waterAt(phys, p.x, p.z)) return { action: "swim" };
    if (Math.hypot(v.vx, v.vz) > 0.08) return { action: v.kind === "rabbit" ? "hopAbout" : "roam" };
    if (v.kind === "chicken" || v.kind === "duck") return { action: "peck" };
    if (v.kind === "sheep" || v.kind === "cow" || v.kind === "horse") return { action: "graze" };
    if (v.kind === "dog" || v.kind === "pig") return { action: "sniff" };
    return { action: "restSun" };
  }
  function animalInfo(v: AnimalView): InspectInfo {
    const word = v.kind as WordId, { action, target } = animalAction(v);
    return { id: `animal:${v.id}`, title: { word }, sentence: describe({ en: word, vi: viWho(word) }, action, target), parts: uniqueParts(anchors(PROP_MARKS[v.kind as PropKind])) };
  }
  function animalSelection(v: AnimalView): Selection {
    return {
      info: animalInfo(v), marks: anchors(PROP_MARKS[v.kind as PropKind]), ring: TOOL[v.kind].size + 0.25,
      frame: () => (animalViews.get(v.id) === v ? v.mesh.matrixWorld : null),
      refresh: () => (animalViews.get(v.id) === v ? animalInfo(v) : null),
    };
  }
  function bodySelection(b: Body): Selection {
    const m = new THREE.Matrix4(), marks = anchors(PROP_MARKS[b.kind]);
    return {
      info: { id: `body:${b.id}`, title: { word: b.kind }, sentence: null, parts: uniqueParts(marks) },
      marks, ring: BODY[b.kind].r + 0.3,
      frame: () => {
        if (b.gone || bodies.get(b.id) !== b) return null;
        return BODY[b.kind].rolls ? m.makeTranslation(b.x, b.y, b.z) : m.makeRotationY(b.yaw).setPosition(b.x, b.y, b.z);
      },
    };
  }

  /** The built piece nearest a point: houses, towers, props, trees, ponds and drawn lines. */
  function thingAt(x: number, z: number): Selection | null {
    let best: { score: number; make: () => Selection } | null = null;
    const offer = (score: number, make: () => Selection) => { if (score < 0.5 && (!best || score < best.score)) best = { score, make }; };
    const far = (o: { x: number; z: number }) => Math.hypot(o.x - x, o.z - z);
    const thing = (title: InspectInfo["title"], key: string, marks: Mark[], cx: number, cz: number, ring: number): Selection => ({
      info: { id: key, title, sentence: null, parts: uniqueParts(marks) }, marks, frame: () => IDENTITY, center: new THREE.Vector3(cx, 0, cz), ring,
    });
    for (const o of S.props) {
      const def = TOOL[o.kind];
      if (def.animal || def.person || isDynamic(o.kind)) continue;
      const box = PROP_BOX[o.kind];
      let score = far(o) - def.size * 0.8;
      if (box) {
        const c = Math.cos(o.r), s = Math.sin(o.r), dx = x - o.x, dz = z - o.z;
        score = Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - box[0]), Math.max(0, Math.abs(dx * s + dz * c) - box[1]));
      }
      offer(Math.max(0, score), () => {
        const k = INSTANCED.includes(o.kind) ? 0.8 + rng(o.seed)() * 0.45 : 1, T = M(o.x, 0, o.z, k, k, k, o.r);
        const marks = anchors(PROP_MARKS[o.kind]).map((m) => ({ ...m, at: m.at.applyMatrix4(T) }));
        return thing({ word: o.kind }, `prop:${o.id}`, marks, o.x, o.z, def.size + 0.3);
      });
    }
    for (const h of S.houses) {
      const c = Math.cos(h.r), s = Math.sin(h.r), dx = x - h.x, dz = z - h.z;
      const score = Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - h.len / 2 - 0.1), Math.max(0, Math.abs(dx * s + dz * c) - 0.9));
      offer(score, () => thing({ word: "house" }, `house:${h.id}`, collectMarks(() => houseParts(h, [], [])), h.x, h.z, h.len / 2 + 0.9));
    }
    for (const [tx, tz, seed] of towerSpotsNow) {
      offer(Math.max(0, Math.hypot(tx - x, tz - z) - 0.9), () => thing({ word: "tower" }, `tower:${tx},${tz}`, collectMarks(() => towerParts(tx, tz, seed ?? hash2(tx, tz), [], [])), tx, tz, 1.15));
    }
    for (const o of S.wells) offer(Math.max(0, far(o) - 0.75), () => thing({ word: "well" }, `well:${o.id}`, collectMarks(() => wellParts(o, [])), o.x, o.z, 1));
    for (const o of S.mills) offer(Math.max(0, far(o) - 1), () => thing({ word: "windmill" }, `mill:${o.id}`, collectMarks(() => millParts(o, [], [])), o.x, o.z, 1.25));
    for (const o of S.lanterns) offer(Math.max(0, far(o) - 0.35), () => thing({ word: "lantern" }, `lantern:${o.id}`, collectMarks(() => lanternParts(o, [], [], [])), o.x, o.z, 0.45));
    for (const t of S.trees) {
      offer(Math.max(0, far(t) - 0.65 * t.s), () => {
        const T = M(t.x, 0, t.z, t.s, t.s, t.s, t.r);
        const list: [PartId, number, number, number][] = t.k ? [["trunk", 0.12, 0.3, 0.05], ["leaf", 0.55, 1.25, 0.2]] : [["trunk", 0.13, 0.45, 0], ["leaf", 0.6, 1.6, 0.3]];
        return thing({ word: "tree" }, `tree:${t.id}`, anchors(list).map((m) => ({ ...m, at: m.at.applyMatrix4(T) })), t.x, t.z, 0.9 * t.s);
      });
    }
    for (const o of S.ponds) offer(Math.max(0, far(o) - o.r), () => thing({ word: "pond" }, `pond:${o.id}`, collectMarks(() => pondParts(o, [])), o.x, o.z, o.r + 0.4));
    // Drawn lines: the labels nearest the tap, one of each part.
    const lines: [StrokeTool, number][] = [["wall", 0.45], ["fence", 0.2], ["hedge", 0.5], ["path", 0.7], ["stream", 1.0]];
    for (const [kind, half] of lines) {
      for (const st of S[STROKE_KEY[kind]]) {
        let nd = Infinity, np: Point = st.pts[0];
        for (const q of st.pts) { const dd = Math.hypot(q[0] - x, q[1] - z); if (dd < nd) { nd = dd; np = q; } }
        const bridge = kind === "path" && streamIndex.near(np[0], np[1], 1.15);
        offer(Math.max(0, nd - half), () => {
          const all = collectMarks(() => {
            if (bridge) bridgeParts(st, []);
            else if (kind === "wall") wallParts(st, [], [], pathIndex);
            else if (kind === "fence") fenceParts(st, []);
            else if (kind === "hedge") hedgeParts(st, []);
            else if (kind === "path") pathParts(st, 0, []);
            else streamParts(st, [], []);
          });
          const nearest = new Map<PartId, { m: Mark; d: number }>();
          for (const m of all) {
            const dd = Math.hypot(m.at.x - x, m.at.z - z);
            if (dd < 3 && dd < (nearest.get(m.part)?.d ?? Infinity)) nearest.set(m.part, { m, d: dd });
          }
          const marks = [...nearest.values()].map((e) => e.m);
          return thing(bridge ? { part: "bridge" } : { word: kind }, `${kind}:${st.id}`, marks, np[0], np[1], bridge ? 1.4 : 0.9);
        });
      }
    }
    return (best as { make: () => Selection } | null)?.make() ?? null;
  }

  function inspectAt(cx: number, cy: number) {
    const g = groundAt(cx, cy);
    if (!g) { clearSelection(true); return; }
    const person = people.pick(ray);
    if (person) { select(personSelection(person)); return; }
    const views = [...animalViews.values()];
    const animalHit = ray.intersectObjects(views.map((v) => v.mesh), false)[0];
    const view = animalHit && views.find((v) => v.mesh === animalHit.object);
    if (view) { select(animalSelection(view)); return; }
    const body = bodyUnderPointer(cx, cy);
    if (body) { select(bodySelection(body)); return; }
    groundAt(cx, cy);
    const targets = [layer.structures, layer.water, layer.ground, ...treeMeshes, ...plantMeshes.values()].filter((o): o is THREE.Mesh => !!o);
    const first = ray.intersectObjects(targets, false)[0];
    const found = thingAt(first ? first.point.x : g[0], first ? first.point.z : g[1]);
    if (found) select(found);
    else { clearSelection(true); say("Chạm vào người, con vật, nhà cửa hay cây cối để xem tên tiếng Anh của chúng."); }
  }
  /** Keyboard: Enter steps through the people and animals nearest the middle of the view, then the nearest piece. */
  let cycleFrom: Point | null = null;
  function inspectNext() {
    // The order is fixed from where the round started, so each press moves on to someone new.
    const current = selection?.info.id ?? "";
    if (!cycleFrom || !/^(person|animal):/.test(current)) cycleFrom = [goal.tx, goal.tz];
    const [ox, oz] = cycleFrom;
    const beings: { id: string; d: number; make: () => Selection }[] = [];
    for (const p of people.list()) beings.push({ id: `person:${p.id}`, d: Math.hypot(p.x - ox, p.z - oz), make: () => personSelection(p) });
    for (const v of animalViews.values()) beings.push({ id: `animal:${v.id}`, d: Math.hypot(v.mesh.position.x - ox, v.mesh.position.z - oz), make: () => animalSelection(v) });
    const near = beings.filter((b) => b.d < 12).sort((a, b) => a.d - b.d);
    const next = near[near.findIndex((b) => b.id === current) + 1];
    if (next) { select(next.make(), true); return; }
    cycleFrom = null;
    const found = thingAt(goal.tx, goal.tz);
    if (found) select(found, true);
    else say("Giữa khung nhìn không có gì. Dời khung nhìn bằng Shift + mũi tên rồi bấm Enter lại.");
  }

  const _lv = new THREE.Vector3();
  /** Keeps labels on their parts, spreads them so they do not overlap, and follows moving beings. */
  function updateSelection(dt: number) {
    if (!selection) return;
    const sel = selection;
    if (sel.refresh) {
      selectionCheck -= dt;
      if (selectionCheck <= 0) {
        selectionCheck = 0.4;
        const info = sel.refresh();
        if (!info) { clearSelection(true); return; }
        if (info.sentence?.en !== sel.info.sentence?.en) { sel.info = info; options.onInspect?.(info); }
      }
    }
    const T = sel.frame();
    if (!T) { clearSelection(true); return; }
    const c = sel.center ?? _lv.setFromMatrixPosition(T);
    selRing.position.set(c.x, 0.07, c.z);
    const pulse = 1 + Math.sin(clock * 3) * 0.04 * (reduceMotion ? 0 : 1);
    selRing.scale.set(pulse, pulse, 1);
    const W = container.clientWidth, H = container.clientHeight, CH = 26;
    const placed: [number, number, number, number][] = [];
    sel.marks.forEach((m, i) => {
      const el = labelEls[i];
      if (!el) return;
      _lv.copy(m.at).applyMatrix4(T).project(camera);
      const show = _lv.z < 1 && Math.abs(_lv.x) < 1.05 && Math.abs(_lv.y) < 1.05;
      el.dot.hidden = el.line.hidden = el.chip.hidden = !show;
      if (!show) return;
      const px = (_lv.x * 0.5 + 0.5) * W, py = (-_lv.y * 0.5 + 0.5) * H;
      if (!el.w) el.w = el.chip.offsetWidth || 56;
      const cw = el.w, cx = clamp(px, cw / 2 + 4, W - cw / 2 - 4);
      let cy = py - 30;
      for (const dy of [-30, -58, 28, -86, 56, -114]) {
        cy = clamp(py + dy, CH / 2 + 4, H - CH / 2 - 4);
        if (!placed.some(([x, y, w, h]) => cx - cw / 2 < x + w + 4 && cx + cw / 2 > x - 4 && cy - CH / 2 < y + h + 3 && cy + CH / 2 > y - 3)) break;
      }
      placed.push([cx - cw / 2, cy - CH / 2, cw, CH]);
      el.chip.style.transform = `translate(${cx - cw / 2}px, ${cy - CH / 2}px)`;
      el.dot.style.transform = `translate(${px}px, ${py}px)`;
      const ex = cx, ey = cy + (cy < py ? CH / 2 : -CH / 2);
      el.line.style.width = `${Math.hypot(ex - px, ey - py)}px`;
      el.line.style.transform = `translate(${px}px, ${py}px) rotate(${Math.atan2(ey - py, ex - px)}rad)`;
    });
  }

  /* ───────────── wind, petals, bees, birds ───────────── */
  function updateWind(dt: number, motion: number) {
    const t = clock;
    const a = 0.6 + Math.sin(t * 0.05) * 0.9 + Math.sin(t * 0.013) * 0.6;
    const s = (0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.11)) + 0.25 * Math.max(0, Math.sin(t * 0.53)) * Math.sin(t * 0.29)) * motion;
    wind.x = Math.cos(a) * s;
    wind.z = Math.sin(a) * s;
    wind.strength = s;
    swayUniforms.uTime.value = t;
    swayUniforms.uWind.value.set(wind.x, wind.z);
    if (ringT < 1) {
      ringT += dt;
      const k = Math.min(1, ringT / 0.45);
      ring.scale.set(0.5 + k * 5, 0.5 + k * 5, 1);
      ringMat.opacity = 0.55 * (1 - k);
      ring.visible = k < 1;
    }
  }

  let bees: Bee[] = [];
  function rebuildBees() {
    bees = [];
    const flowers = S.props.filter((o) => o.kind in FLOWER_HEIGHT);
    for (const hive of S.props) {
      if (hive.kind !== "beehive") continue;
      const h = new THREE.Vector3(hive.x, 1.0, hive.z);
      const near = flowers.filter((f) => Math.hypot(f.x - hive.x, f.z - hive.z) < 7).map((f) => new THREE.Vector3(f.x, FLOWER_HEIGHT[f.kind] as number, f.z));
      for (let k = 0; k < (near.length ? 5 : 2) && bees.length < MAX_BEES; k += 1) {
        bees.push({ hive: h, flowers: near, from: h.clone(), to: h.clone(), t: Math.random(), dur: 0.1, atFlower: false, phase: Math.random() * 6 });
      }
    }
  }

  let birds: Bird[] = [];
  const birdTimer = new Map<number, number>();
  let toldScarecrow = false;
  function leave(b: Bird) {
    b.state = "leave";
    b.t = 0;
    const a = Math.random() * Math.PI * 2;
    b.vel.set(Math.cos(a) * 3.2, 2.6, Math.sin(a) * 3.2);
    b.yaw = Math.atan2(b.vel.x, b.vel.z);
    birdTimer.set(b.garden, 12 + Math.random() * 6);
  }
  function scareBirds(x: number, z: number, radius: number) {
    for (const b of birds) if (b.state !== "leave" && Math.hypot(b.pos.x - x, b.pos.z - z) < radius) leave(b);
  }
  /** A random point on a vegetable garden's bed. */
  function spotIn(g: Prop) {
    const lx = (Math.random() - 0.5) * 2, lz = (Math.random() - 0.5) * 1.4, c = Math.cos(g.r), s = Math.sin(g.r);
    return new THREE.Vector3(g.x + lx * c + lz * s, 0.14, g.z - lx * s + lz * c);
  }
  function gardenThreat(g: Prop) {
    for (const o of S.props) if (o.kind === "scarecrow" && Math.hypot(o.x - g.x, o.z - g.z) < 4.5) return "scarecrow";
    for (const v of animalViews.values()) {
      if ((v.kind === "cat" || v.kind === "dog") && Math.hypot(v.mesh.position.x - g.x, v.mesh.position.z - g.z) < 2.4) return "animal";
    }
    return null;
  }

  function updateLife(dt: number, motion: number) {
    const night = timeOfDay > 0.82;
    // Petals blow off blossom trees with the wind.
    const blossoms = motion ? S.props.filter((o) => o.kind === "blossom") : [];
    const live = Math.min(PETALS, blossoms.length * 14);
    petalGeo.setDrawRange(0, live);
    for (let i = 0; i < live; i += 1) {
      const st = petalLife[i], j = i * 3;
      if (st.life <= 0) {
        const o = blossoms[i % blossoms.length], s = 0.8 + rng(o.seed)() * 0.45;
        petalPos[j] = o.x + (Math.random() - 0.5) * 1.4 * s;
        petalPos[j + 1] = (1.2 + Math.random() * 0.8) * s;
        petalPos[j + 2] = o.z + (Math.random() - 0.5) * 1.4 * s;
        st.life = 1 + Math.random();
        continue;
      }
      if (petalPos[j + 1] > 0.03) {
        petalPos[j] += (wind.x * 0.8 + Math.sin(clock * 2 + st.phase) * 0.25) * dt;
        petalPos[j + 1] -= (0.22 + Math.sin(clock * 3 + st.phase) * 0.08) * dt;
        petalPos[j + 2] += (wind.z * 0.8 + Math.cos(clock * 1.7 + st.phase) * 0.2) * dt;
      } else st.life -= dt * 0.6;
    }
    petalGeo.attributes.position.needsUpdate = true;

    // Bees fly between their hive and flowers nearby; at night they stay home.
    let n = 0;
    if (motion && !night) {
      for (const b of bees) {
        b.t += dt / b.dur;
        if (b.t >= 1) {
          b.from.copy(b.to);
          if (b.flowers.length && !b.atFlower) {
            b.to.copy(pick(b.flowers, Math.random)).add(_bs.set((Math.random() - 0.5) * 0.5, 0.15, (Math.random() - 0.5) * 0.5));
            b.atFlower = true;
          } else if (b.flowers.length) { b.to.copy(b.hive); b.atFlower = false; }
          else {
            const a = Math.random() * Math.PI * 2;
            b.to.copy(b.hive).add(_bs.set(Math.cos(a) * 0.9, Math.random() * 0.6 - 0.1, Math.sin(a) * 0.9));
          }
          b.dur = Math.max(0.6, b.from.distanceTo(b.to) / 1.4);
          b.t = 0;
        }
        const t = b.t, e = t * t * (3 - 2 * t);
        _bp.lerpVectors(b.from, b.to, e);
        _bp.x += Math.sin(clock * 9 + b.phase) * 0.06;
        _bp.y += Math.sin(Math.PI * t) * Math.min(1.2, b.from.distanceTo(b.to) * 0.25) + Math.sin(clock * 13 + b.phase) * 0.03;
        _bp.z += Math.cos(clock * 7 + b.phase) * 0.06;
        _bq.setFromAxisAngle(UP, Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z));
        beeMesh.setMatrixAt(n, _bm.compose(_bp, _bq, ONE));
        n += 1;
      }
    }
    beeMesh.count = n;
    beeMesh.instanceMatrix.needsUpdate = true;

    // Birds peck at vegetable gardens unless a scarecrow (or a cat or dog) is close.
    if (!motion) { birds = []; birdMesh.count = 0; return; }
    const gardens = S.props.filter((o) => o.kind === "garden");
    for (const g of gardens) {
      const threat = night ? "night" : gardenThreat(g);
      const mine = birds.filter((b) => b.garden === g.id && b.state !== "leave");
      if (threat) {
        if (threat === "scarecrow" && mine.length && !toldScarecrow) {
          toldScarecrow = true;
          say("Bù nhìn đuổi lũ chim khỏi vườn rau! (scarecrow /ˈsker.kroʊ/)");
        }
        mine.forEach(leave);
        continue;
      }
      const wait = (birdTimer.get(g.id) ?? 2) - dt;
      birdTimer.set(g.id, wait);
      if (wait <= 0 && mine.length < 3 && birds.length < MAX_BIRDS) {
        const a = Math.random() * Math.PI * 2;
        birds.push({ garden: g.id, pos: new THREE.Vector3(g.x + Math.cos(a) * 16, 8, g.z + Math.sin(a) * 16), vel: new THREE.Vector3(), spot: spotIn(g), state: "arrive", t: 0, yaw: 0 });
        birdTimer.set(g.id, 3 + Math.random() * 4);
      }
    }
    const ids = new Set(gardens.map((g) => g.id));
    n = 0;
    birds = birds.filter((b) => {
      b.t += dt;
      if (b.state !== "leave" && !ids.has(b.garden)) leave(b);
      if (b.state === "arrive") {
        _bp.subVectors(b.spot, b.pos);
        const d = _bp.length();
        b.yaw = Math.atan2(_bp.x, _bp.z);
        if (d < 0.1) { b.state = "peck"; b.pos.copy(b.spot); }
        else b.pos.addScaledVector(_bp, Math.min(d, dt * 6) / d);
      } else if (b.state === "peck") {
        _bp.subVectors(b.spot, b.pos).setY(0);
        const d = _bp.length();
        if (d > 0.02) { b.pos.addScaledVector(_bp, Math.min(1, (dt * 1.5) / d)); b.yaw = Math.atan2(_bp.x, _bp.z); }
        else if (Math.random() < dt * 0.6) b.spot.set(b.pos.x + (Math.random() - 0.5) * 0.6, 0.14, b.pos.z + (Math.random() - 0.5) * 0.6);
        b.pos.y = 0.14 + (d > 0.02 ? Math.abs(Math.sin(b.t * 12)) * 0.06 : 0);
      } else {
        b.vel.y += dt * 1.5;
        b.pos.addScaledVector(b.vel, dt);
        if (b.pos.y > 16 || b.t > 7) return false;
      }
      const flying = b.state !== "peck";
      _bq.setFromEuler(_eul.set(flying ? -0.2 : Math.sin(b.t * 5) * 0.3, b.yaw, 0, "YXZ"));
      birdMesh.setMatrixAt(n, _bm.compose(b.pos, _bq, _bs.set(1, flying ? 0.55 + Math.abs(Math.sin(clock * 22 + n)) * 0.6 : 1, 1)));
      n += 1;
      return true;
    });
    birdMesh.count = n;
    birdMesh.instanceMatrix.needsUpdate = true;
  }

  /* ───────────── input ───────────── */
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { d: number; ang: number; mx: number; my: number } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelTool();
      const [a, b] = [...pointers.values()];
      gesture = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.size > 2 || gesture) return;
    startTool(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (gesture.d > 10 && d > 10) zoomBy(gesture.d / d);
      let da = ang - gesture.ang;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      goal.theta -= da;
      panBy(mx - gesture.mx, 0);
      orbitBy(0, my - gesture.my);
      Object.assign(gesture, { d, ang, mx, my });
      return;
    }
    moveTool(e);
  };
  const onRelease = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture) { if (pointers.size < 2) gesture = null; return; }
    if (e.type === "pointercancel") cancelTool();
    else endTool(e);
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.shiftKey) panBy(e.key === "ArrowLeft" ? -60 : 60, 0);
      else goal.theta += e.key === "ArrowLeft" ? 0.15 : -0.15;
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (e.shiftKey) panBy(0, e.key === "ArrowUp" ? -60 : 60);
      else goal.phi = clamp(goal.phi + (e.key === "ArrowUp" ? -0.08 : 0.08), 0.42, 1.22);
    } else if (e.key === "+" || e.key === "=") zoomBy(0.9);
    else if (e.key === "-") zoomBy(1.1);
    else if (e.key === "Enter" || e.key === " ") placeByKeyboard();
    else return;
    e.preventDefault();
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onRelease);
  canvas.addEventListener("pointercancel", onRelease);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  window.addEventListener("pagehide", flushSave);

  /* ───────────── loop ───────────── */
  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  let visible = true;
  const intersection = new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); });
  intersection.observe(container);

  let raf = 0, last = performance.now(), frames = 0, perfStart = 0, downgraded = false, firstFrame = true;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden || !visible) return;
    if (needsRebuild) { needsRebuild = false; plantsDirty = false; rebuildAll(); }
    if (plantsDirty) { plantsDirty = false; rebuildPlants(); }
    if (previewDirty) { previewDirty = false; rebuildPreview(); }
    applyCamera(dt);
    const motion = reduceMotion ? 0 : 1;
    clock += dt;
    updateWind(dt, motion);
    for (const b of mills) b.rotation.z += dt * (0.3 + wind.strength * 1.4) * motion;
    for (const c of clouds) {
      c.position.x += wind.x * dt * 0.8 * motion;
      c.position.z += wind.z * dt * 0.8 * motion;
      if (Math.abs(c.position.x) > 55) c.position.x = -Math.sign(c.position.x) * 54;
      if (Math.abs(c.position.z) > 55) c.position.z = -Math.sign(c.position.z) * 54;
    }
    updateAnimals(dt, motion);
    people.update(dt, motion);
    stepPhysics(dt);
    updateDrops(dt);
    updateLife(dt, motion);
    renderer.render(scene, camera);
    updateSelection(dt);
    if (firstFrame) { firstFrame = false; options.onReady(); makeThumbnails(); }

    frames += 1;
    if (!downgraded && frames === 60) perfStart = now;
    if (!downgraded && frames === 240 && 180 / ((now - perfStart) / 1000) < 40) {
      downgraded = true;
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      dpr = 1;
      renderer.setPixelRatio(dpr);
      resize();
      for (const m of [surface, glowMat, waterMat]) m.needsUpdate = true;
    }
  }

  /* ───────────── start ───────────── */
  if (!options.saved) sampleVillage();
  applyTime(options.time);
  resize();
  const fit = fitView();
  goal.radius = rig.radius = fit.radius;
  goal.phi = rig.phi = fit.phi;
  rebuildAll();
  raf = requestAnimationFrame(frame);

  return {
    setTool(id) {
      cancelTool();
      tool = id;
      canvas.dataset.mode = id;
      if (id !== "look" && selection) clearSelection(true);
    },
    clearInspect: () => clearSelection(false),
    setTime: applyTime,
    undo() {
      const prev = undoStack.pop();
      if (prev === undefined) return;
      cancelTool();
      clearMotion();
      clearSelection(true);
      S = JSON.parse(prev) as VillageScene;
      options.onUndoChange(undoStack.length > 0);
      needsRebuild = true;
      saveSoon();
      say("Đã hoàn tác.");
    },
    reset(kind) {
      cancelTool();
      clearMotion();
      clearSelection(true);
      undoStack.push(serialize());
      options.onUndoChange(true);
      if (kind === "sample") sampleVillage();
      else S = emptyScene();
      needsRebuild = true;
      saveSoon();
      say(kind === "sample" ? "Đã khôi phục làng mẫu." : "Đảo trống rồi. Bấm Hoàn tác nếu đổi ý.");
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(thumbTimer);
      flushSave();
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pagehide", flushSave);
      const geometries = new Set<THREE.BufferGeometry>([
        ...Object.values(G), ...PROP_GEOMETRIES, templates.blade, templates.tuft, ...templates.trees, ...templates.animals.values(), ...templates.plants.values(),
        ...templates.bodies.values(), templates.bee, templates.bird,
      ]);
      scene.traverse((obj) => { const g = (obj as THREE.Mesh).geometry; if (g) geometries.add(g); });
      geometries.forEach((g) => g.dispose());
      people.dispose();
      for (const m of [surface, swayMat, glowMat, waterMat, cloudMat, haloMat, starMat, petalMat, ringMat, selMat]) m.dispose();
      haloTex.dispose();
      labelLayer.remove();
      renderer.dispose();
      canvas.remove();
    },
  };
}
