/**
 * Three.js view of Làng Rêu, a small Tiny Glade-style village builder. Loaded with a dynamic
 * import so three.js only downloads on the village page. It owns the scene, the drawing tools
 * and undo; React owns the HUD, lessons and unlocks and talks to it through VillageController.
 *
 * Performance: every object is built from primitives and "baked" into one vertex-coloured
 * geometry with a shared material, so the whole village is a handful of draw calls. Trees and
 * grass are instanced. If the first seconds run under 40 fps, shadows and pixel ratio step down.
 */
import * as THREE from "three";
import {
  BUILD_R, ISLAND_R, STEP, TOOL, chaikin, clampToIsland, dist, emptyScene, hash2, lineLength, resample, rng, round2,
  type House, type Placed, type Point, type SavedScene, type Stroke, type ToolId, type VillageScene,
} from "./data";

export interface VillageOptions {
  saved: SavedScene | null;
  time: number;
  onToast: (text: string) => void;
  onUndoChange: (canUndo: boolean) => void;
  onSave: (raw: string) => void;
  onReady: () => void;
}
export interface VillageController {
  setTool(id: ToolId): void;
  setTime(t: number): void;
  undo(): void;
  reset(kind: "empty" | "sample"): void;
  dispose(): void;
}

const WALL_H = 1.35, WALL_T = 0.55, GATE_DIST = 0.85;
const ROOFS = ["#b65f4a", "#4e7287", "#8a5c47", "#5f6f92", "#9c4a41", "#6c7f55"];
const PLASTER = ["#efe6d3", "#f3e2c3", "#e8ddcb", "#f0d8c3", "#e3e2d4", "#f2ead9"];
const TAP_TOOLS: ToolId[] = ["tower", "well", "windmill", "lantern", "sheep"];
const MAX_TREES = 700, TUFTS = 320;

type Args = [x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number, ry?: number, rx?: number, rz?: number];
interface Part { g: THREE.BufferGeometry; c: THREE.ColorRepresentation | null; m: THREE.Matrix4 | null }
type TowerSpot = [number, number, number?];
type Drag =
  | { mode: "orbit" | "pan"; x: number; y: number }
  | { mode: "stroke"; kind: "path" | "wall" | "fence"; raw: Point[] }
  | { mode: "house"; start: Point; end: Point; moved: boolean; len: number; r: number; seed: number }
  | { mode: "pond"; start: Point; r: number }
  | { mode: "brush"; last: Point | null }
  | { mode: "erase" }
  | { mode: "tap"; kind: ToolId; x: number; y: number; moved: boolean };
interface SheepView { mesh: THREE.Mesh; home: THREE.Vector2; target: THREE.Vector2; wait: number; hop: number; pet: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pick = <T>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length) % arr.length];
const randSeed = () => Math.floor(Math.random() * 1e9);

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function M(x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, "YXZ");
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const shade = (hex: string, amount: number) => new THREE.Color(hex).offsetHSL(0, 0, amount);

/** Adds parts in an object's local frame T: `p` for solid parts, `w` for windows that glow at night. */
function painter(T: THREE.Matrix4, parts: Part[], glow?: Part[]) {
  return {
    p: (g: THREE.BufferGeometry, c: THREE.ColorRepresentation, ...a: Args) => { parts.push({ g, c, m: T.clone().multiply(M(...a)) }); },
    w: (g: THREE.BufferGeometry, ...a: Args) => { glow?.push({ g, c: "#ffffff", m: T.clone().multiply(M(...a)) }); },
  };
}

/** Merges coloured parts into one vertex-coloured geometry: one draw call however many parts. */
function bake(parts: Part[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  let total = 0;
  const prepared: [THREE.BufferGeometry, THREE.ColorRepresentation | null][] = [];
  for (const part of parts) {
    const g = part.g.index ? part.g.toNonIndexed() : part.g.clone();
    if (part.m) g.applyMatrix4(part.m);
    prepared.push([g, part.c]);
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const [g, c] of prepared) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (c === null && g.attributes.color) col.set(g.attributes.color.array as Float32Array, o * 3);
    else {
      _c.set(c ?? "#ffffff");
      for (let i = 0; i < n; i += 1) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Grid lookup for "is any stroke point within d of (x, z)", used for gates and blocked ground. */
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

export function createVillageScene(container: HTMLElement, options: VillageOptions): VillageController {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let S: VillageScene = options.saved?.scene ?? emptyScene();
  let idSeq = options.saved?.idSeq ?? 1;
  const newId = () => idSeq++;
  let tool: ToolId = "wall";
  const undoStack: string[] = [];
  const say = options.onToast;

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
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 220);

  const hemi = new THREE.HemisphereLight("#fff4e0", "#6c8a5a", 1.7);
  const sun = new THREE.DirectionalLight("#fff3dc", 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
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

  const prism = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    return g;
  })();
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
    cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
    taper: new THREE.CylinderGeometry(0.34, 0.5, 1, 8),
    cone6: new THREE.ConeGeometry(0.5, 1, 6),
    cone8: new THREE.ConeGeometry(0.5, 1, 8),
    ico: new THREE.IcosahedronGeometry(0.5, 1),
    ico0: new THREE.IcosahedronGeometry(0.5, 0),
    dode: new THREE.DodecahedronGeometry(0.5, 0),
    sphere: new THREE.SphereGeometry(0.5, 10, 7),
    prism,
    arch: new THREE.TorusGeometry(1, 0.13, 5, 14, Math.PI),
  };

  /* ───────────── island ───────────── */
  {
    const top = new THREE.RingGeometry(0.01, ISLAND_R, 84, 26);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const a = new THREE.Color("#a3c86d"), b = new THREE.Color("#82b056"), edge = new THREE.Color("#6f9a4a");
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = (Math.sin(x * 0.42 + 1.3) + Math.cos(z * 0.37) + Math.sin((x - z) * 0.8) * 0.6) / 5.2 + 0.5;
      const r = Math.hypot(x, z) / ISLAND_R;
      _c.copy(a).lerp(b, clamp(n, 0, 1)).lerp(edge, clamp((r - 0.84) / 0.16, 0, 1));
      cols[i * 3] = _c.r; cols[i * 3 + 1] = _c.g; cols[i * 3 + 2] = _c.b;
    }
    top.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const topMesh = new THREE.Mesh(top, surface);
    topMesh.receiveShadow = true;

    const under = new THREE.ConeGeometry(ISLAND_R - 0.25, 7.5, 42, 6, true);
    under.rotateX(Math.PI);
    const up = under.attributes.position;
    const jitter = rng(11);
    for (let i = 0; i < up.count; i += 1) {
      if (up.getY(i) > 3.6) continue;
      const k = 1 + (jitter() - 0.5) * 0.16;
      up.setX(i, up.getX(i) * k);
      up.setZ(i, up.getZ(i) * k);
    }
    const rim = new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 0.25, 0.9, 84, 1, true);
    const rocks: Part[] = [
      { g: rim, c: "#7a5c42", m: M(0, -0.45, 0) },
      { g: under, c: "#8b7764", m: M(0, -0.9 - 3.75, 0) },
    ];
    const r = rng(5);
    for (let i = 0; i < 7; i += 1) {
      const a2 = r() * Math.PI * 2, rad = 10 + r() * 7;
      rocks.push({ g: G.dode, c: shade("#8b7764", (r() - 0.5) * 0.06), m: M(Math.cos(a2) * rad, -3 - r() * 5, Math.sin(a2) * rad, 1 + r() * 1.6, 0.8 + r(), 1 + r() * 1.4, r() * 3) });
    }
    scene.add(topMesh, new THREE.Mesh(bake(rocks) ?? undefined, surface));
    rim.dispose();
    under.dispose();
  }

  const world = new THREE.Group();
  scene.add(world);
  let pathIndex = makeIndex([]);
  let lineIndex = makeIndex([]);

  function nearestPathPoint(x: number, z: number, maxD = 7) {
    let best: Point | null = null, bestD = maxD;
    for (const s of S.paths) for (const p of s.pts) {
      const d = Math.hypot(p[0] - x, p[1] - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /* ───────────── builders ───────────── */
  function pathParts(stroke: Stroke, index: number, parts: Part[]) {
    const pts = stroke.pts, n = pts.length;
    if (n < 2) return;
    const y = 0.03 + (index % 6) * 0.004;
    const r = rng(stroke.id * 31 + 7);
    const strip = (width: number, color: string, dy: number, noise: number) => {
      const pos: number[] = [], col: number[] = [];
      const base = new THREE.Color(color);
      const L: Point[] = [], R: Point[] = [];
      for (let i = 0; i < n; i += 1) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const l = Math.hypot(tx, tz) || 1;
        tx /= l; tz /= l;
        const w = width * (1 + Math.sin(i * 1.7 + stroke.id) * 0.08);
        L.push([pts[i][0] - tz * w, pts[i][1] + tx * w]);
        R.push([pts[i][0] + tz * w, pts[i][1] - tx * w]);
      }
      const push = (p: Point) => {
        pos.push(p[0], y + dy, p[1]);
        const k = 1 + Math.sin(p[0] * 3.1) * Math.cos(p[1] * 2.7) * noise;
        col.push(base.r * k, base.g * k, base.b * k);
      };
      const tri = (a: Point, b: Point, c: Point) => {
        const cross = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
        if (cross > 0) { push(a); push(b); push(c); } else { push(a); push(c); push(b); }
      };
      for (let i = 0; i < n - 1; i += 1) { tri(L[i], R[i], L[i + 1]); tri(R[i], R[i + 1], L[i + 1]); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const nor = new Float32Array(pos.length);
      for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      parts.push({ g, c: null, m: null });
    };
    strip(0.72, "#b9a47a", -0.006, 0.05);
    strip(0.55, "#dccaa0", 0, 0.08);
    for (let i = 0; i < n; i += 2) {
      const side = r() < 0.5 ? -1 : 1;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const off = side * r() * 0.32;
      parts.push({ g: G.dode, c: shade("#e7decd", (r() - 0.5) * 0.08), m: M(pts[i][0] - Math.sin(ang) * off, y + 0.01, pts[i][1] + Math.cos(ang) * off, 0.3 + r() * 0.15, 0.06, 0.24 + r() * 0.12, r() * 3) });
    }
  }

  /** Walls skip segments that cross a path (those become a gate) and leave tower spots at ends and sharp corners. */
  function wallParts(stroke: Stroke, parts: Part[], towerSpots: TowerSpot[]) {
    const pts = stroke.pts, n = pts.length;
    if (n < 2) return;
    const h = WALL_H, T = WALL_T;
    const gated: boolean[] = [];
    for (let i = 0; i < n - 1; i += 1) gated[i] = pathIndex.near((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, GATE_DIST);
    for (let i = 0; i < n - 1; i += 1) {
      if (gated[i]) continue;
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const th = Math.atan2(bz - az, bx - ax);
      const { p } = painter(M((ax + bx) / 2, 0, (az + bz) / 2, 1, 1, 1, -th), parts);
      const r = rng(hash2(ax, az) + 7);
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
      if (pathIndex.near(s[0], s[1], 1.0)) continue;
      if (towerSpots.some((t) => Math.hypot(t[0] - s[0], t[1] - s[1]) < 1.15)) continue;
      towerSpots.push([s[0], s[1]]);
    }
  }

  function gateParts(A: Point, B: Point, h: number, parts: Part[]) {
    const span = Math.max(0.9, dist(A, B));
    const th = Math.atan2(B[1] - A[1], B[0] - A[0]);
    const { p } = painter(M((A[0] + B[0]) / 2, 0, (A[1] + B[1]) / 2, 1, 1, 1, -th), parts);
    const T = WALL_T;
    const top = h + 0.35, archTop = h * 0.92;
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
    const { p, w } = painter(M(x, 0, z, 1, 1, 1, r() * Math.PI * 2), parts, glow);
    const R = 0.72 + r() * 0.12, H = WALL_H + 1.05 + r() * 0.35;
    p(G.cyl12, "#a99d88", 0, 0.2, 0, 2 * R + 0.3, 0.4, 2 * R + 0.3);
    p(G.cyl12, shade("#cdc3ae", (r() - 0.5) * 0.06), 0, H / 2, 0, 2 * R, H, 2 * R);
    p(G.cyl12, "#ddd5c4", 0, H + 0.07, 0, 2 * R + 0.24, 0.14, 2 * R + 0.24);
    if (r() < 0.75) {
      p(G.cone8, pick(ROOFS, r), 0, H + 0.14 + 0.85, 0, 2 * R + 0.5, 1.7, 2 * R + 0.5);
      p(G.sphere, "#e3bf55", 0, H + 1.9, 0, 0.16, 0.16, 0.16);
    } else {
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        p(G.box, "#d3c9b6", Math.cos(a) * (R - 0.04), H + 0.33, Math.sin(a) * (R - 0.04), 0.32, 0.38, 0.3, -a);
      }
    }
    for (const a of [0.5, 0.5 + Math.PI]) w(G.box, Math.cos(a) * (R + 0.01), H * 0.62, Math.sin(a) * (R + 0.01), 0.07, 0.44, 0.15, -a);
    const a0 = r() * Math.PI * 2;
    p(G.box, "#6b4f3a", Math.cos(a0) * R, 0.45, Math.sin(a0) * R, 0.08, 0.82, 0.44, -a0);
    if (r() < 0.6) p(G.ico0, "#7ea456", Math.cos(a0 + 1.5) * (R + 0.05), 0.25, Math.sin(a0 + 1.5) * (R + 0.05), 0.5, 0.32, 0.4);
  }

  /** A house faces its local +Z; `h.r` turns that front towards the nearest path. */
  function houseParts(h: House, parts: Part[], glow: Part[]) {
    const r = rng(h.seed);
    const len = h.len, w = 1.55;
    const floors = len > 2.6 && r() < 0.65 ? 2 : 1;
    const H = floors === 2 ? 2.15 : 1.25;
    const plaster = pick(PLASTER, r), roof = pick(ROOFS, r), beam = "#6b4f3a";
    const { p, w: win } = painter(M(h.x, 0, h.z, 1, 1, 1, h.r), parts, glow);
    p(G.box, "#a99e8b", 0, 0.12, 0, len + 0.2, 0.24, w + 0.2);
    p(G.box, plaster, 0, 0.24 + H / 2, 0, len, H, w);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, beam, (sx * len) / 2, 0.24 + H / 2, (sz * w) / 2, 0.13, H, 0.13);
    if (floors === 2) p(G.box, beam, 0, 0.24 + H * 0.5, 0, len + 0.03, 0.1, w + 0.03);
    const eave = 0.24 + H, rh = 0.95 + r() * 0.3, hw = w / 2 + 0.24;
    p(G.prism, shade(plaster, -0.03), 0, eave, 0, w, rh, len, Math.PI / 2);
    const slope = Math.hypot(rh, hw), ang = Math.atan2(rh, hw);
    p(G.box, roof, 0, eave + rh / 2, hw / 2, len + 0.4, 0.12, slope + 0.06, 0, ang);
    p(G.box, roof, 0, eave + rh / 2, -hw / 2, len + 0.4, 0.12, slope + 0.06, 0, -ang);
    p(G.box, shade(roof, -0.06), 0, eave + rh + 0.02, 0, len + 0.44, 0.13, 0.2);
    if (r() < 0.6) p(G.box, "#a8836a", (r() < 0.5 ? -1 : 1) * len * 0.26, eave + rh * 0.62 + 0.25, -hw * 0.4, 0.32, 0.85, 0.32);
    const doorX = len < 2.2 ? 0 : (r() < 0.5 ? -1 : 1) * len * 0.24;
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
  }

  function fenceParts(stroke: Stroke, parts: Part[]) {
    const pts = stroke.pts, n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const r = rng(hash2(pts[i][0], pts[i][1]));
      parts.push({ g: G.box, c: shade("#9a744d", (r() - 0.5) * 0.06), m: M(pts[i][0], 0.36, pts[i][1], 0.12, 0.72, 0.12, r()) });
      parts.push({ g: G.cone6, c: "#8a6644", m: M(pts[i][0], 0.78, pts[i][1], 0.17, 0.14, 0.17) });
      if (i === n - 1) continue;
      const a = pts[i], b = pts[i + 1], len = dist(a, b), th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const y of [0.3, 0.56]) parts.push({ g: G.box, c: "#b18a5e", m: M((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, len + 0.06, 0.07, 0.05, -th) });
    }
  }

  function wellParts(o: Placed, parts: Part[]) {
    const r = rng(o.seed);
    const { p } = painter(M(o.x, 0, o.z, 1, 1, 1, r() * Math.PI), parts);
    p(G.cyl12, "#bdb19b", 0, 0.36, 0, 1.3, 0.72, 1.3);
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
    for (let k = 0; k < count; k += 1) {
      const a = (k / count) * Math.PI * 2 + r() * 0.1, rad = o.r + 0.12 + r() * 0.08;
      parts.push({ g: G.dode, c: shade("#b9b3a2", (r() - 0.5) * 0.1), m: M(o.x + Math.cos(a) * rad, 0.07, o.z + Math.sin(a) * rad, 0.36 + r() * 0.22, 0.2, 0.3, -a) });
    }
    for (let k = 0; k < Math.floor(o.r * 1.6); k += 1) {
      const a = r() * Math.PI * 2, rad = r() * o.r * 0.7;
      const x = o.x + Math.cos(a) * rad, z = o.z + Math.sin(a) * rad;
      parts.push({ g: G.cyl12, c: "#6e9d4a", m: M(x, 0.09, z, 0.42, 0.02, 0.42) });
      if (r() < 0.5) parts.push({ g: G.ico0, c: "#f2b5c9", m: M(x + 0.06, 0.13, z, 0.1, 0.08, 0.1) });
    }
    for (let k = 0; k < 3; k += 1) {
      const a = r() * Math.PI * 2;
      for (let q = 0; q < 4; q += 1) parts.push({ g: G.cyl6, c: "#5d8240", m: M(o.x + Math.cos(a) * (o.r - 0.1) + q * 0.07, 0.4, o.z + Math.sin(a) * (o.r - 0.1) + q * 0.05, 0.04, 0.75 + q * 0.1, 0.04, 0, 0, (q - 1.5) * 0.08) });
    }
  }

  function millParts(o: Placed, parts: Part[], glow: Part[]) {
    const r = rng(o.seed);
    const T = M(o.x, 0, o.z, 1, 1, 1, o.r ?? r() * Math.PI * 2);
    const { p, w } = painter(T, parts, glow);
    p(G.cyl12, "#a99d88", 0, 0.18, 0, 1.9, 0.36, 1.9);
    p(G.taper, "#ece4d2", 0, 0.36 + 1.4, 0, 1.6, 2.8, 1.6);
    p(G.cone8, "#8a5c47", 0, 3.6, 0, 1.4, 0.9, 1.4);
    p(G.box, "#6b4f3a", 0, 0.75, 0.78, 0.48, 0.8, 0.08);
    w(G.box, 0, 2.2, 0.66, 0.3, 0.36, 0.06);
    p(G.cyl8, "#6b4f3a", 0, 3.0, 0.6, 0.16, 0.5, 0.16, 0, Math.PI / 2);
    return T;
  }

  function lanternParts(o: Placed, parts: Part[], glow: Part[], halos: THREE.Vector3[]) {
    const r = rng(o.seed);
    const T = M(o.x, 0, o.z, 1, 1, 1, r() * Math.PI * 2);
    const { p, w } = painter(T, parts, glow);
    p(G.box, "#4f3f33", 0, 0.82, 0, 0.11, 1.64, 0.11);
    p(G.box, "#4f3f33", 0.24, 1.6, 0, 0.5, 0.07, 0.07);
    p(G.box, "#3a332d", 0.46, 1.48, 0, 0.04, 0.2, 0.04);
    p(G.cone6, "#3a332d", 0.46, 1.42, 0, 0.32, 0.16, 0.32);
    w(G.box, 0.46, 1.23, 0, 0.2, 0.28, 0.2);
    p(G.box, "#3a332d", 0.46, 1.07, 0, 0.26, 0.04, 0.26);
    p(G.dode, "#a99d88", 0, 0.05, 0, 0.36, 0.12, 0.36);
    halos.push(new THREE.Vector3(0.46, 1.23, 0).applyMatrix4(T));
  }

  const templates = (() => {
    const at = (parts: Part[]) => (g: THREE.BufferGeometry, c: THREE.ColorRepresentation, ...a: Args) => { parts.push({ g, c, m: M(...a) }); };
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
    return { blade: cast(bladeParts), sheep: cast(sheepParts), trees: [cast(leafy), cast(pine)], tuft: cast(tuft) };
  })();

  const treeMeshes = templates.trees.map((geo) => {
    const mesh = new THREE.InstancedMesh(geo, surface, MAX_TREES);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(mesh);
    return mesh;
  });
  const tuftMesh = new THREE.InstancedMesh(templates.tuft, surface, TUFTS);
  tuftMesh.frustumCulled = false;
  scene.add(tuftMesh);

  const clouds: THREE.Mesh[] = [];
  {
    const r = rng(21);
    for (let i = 0; i < 5; i += 1) {
      const parts: Part[] = [];
      for (let k = 0; k < 4; k += 1) parts.push({ g: G.ico, c: "#ffffff", m: M(k * 0.9 - 1.3, k === 1 || k === 2 ? 0.35 : 0, (r() - 0.5) * 0.6, 1.4 + r() * 0.6, 1.0 + r() * 0.5, 1.3) });
      const cloud = new THREE.Mesh(bake(parts) ?? undefined, cloudMat);
      cloud.position.set(-26 + i * 13 + r() * 4, 9 + r() * 4, -14 + r() * 26);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }
  {
    const r = rng(99);
    const pos: number[] = [];
    for (let i = 0; i < 260; i += 1) {
      const a = r() * Math.PI * 2, e = 0.15 + r() * 1.25, R = 120;
      pos.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, starMat));
  }

  /* ───────────── rebuild ───────────── */
  const layer: { ground: THREE.Mesh | null; structures: THREE.Mesh | null; glow: THREE.Mesh | null } = { ground: null, structures: null, glow: null };
  const extras = new THREE.Group(), preview = new THREE.Group();
  world.add(extras, preview);
  const sheepViews = new Map<number, SheepView>();
  const mills: THREE.Mesh[] = [];

  function setMesh(key: keyof typeof layer, geo: THREE.BufferGeometry | null, material: THREE.Material, cast: boolean) {
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

  function rebuildAll() {
    pathIndex = makeIndex(S.paths);
    lineIndex = makeIndex([...S.paths, ...S.walls, ...S.fences]);
    const ground: Part[] = [], parts: Part[] = [], glow: Part[] = [], halos: THREE.Vector3[] = [], towerSpots: TowerSpot[] = [];
    S.paths.forEach((s, i) => pathParts(s, i, ground));
    for (const p of S.ponds) pondParts(p, ground);
    for (const s of S.walls) wallParts(s, parts, towerSpots);
    for (const t of S.towers) towerSpots.push([t.x, t.z, t.seed]);
    for (const t of towerSpots) towerParts(t[0], t[1], t[2] ?? hash2(t[0], t[1]), parts, glow);
    for (const s of S.fences) fenceParts(s, parts);
    for (const h of S.houses) houseParts(h, parts, glow);
    for (const o of S.wells) wellParts(o, parts);
    for (const o of S.lanterns) lanternParts(o, parts, glow, halos);

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
      const water = new THREE.Mesh(G.disc, waterMat);
      water.position.set(o.x, 0.06, o.z);
      water.scale.set(o.r * 2, 0.02, o.r * 2);
      water.receiveShadow = true;
      extras.add(water);
    }
    for (const v of halos) {
      const sprite = new THREE.Sprite(haloMat);
      sprite.position.copy(v);
      sprite.scale.setScalar(2.2);
      extras.add(sprite);
    }

    setMesh("ground", bake(ground), surface, false);
    setMesh("structures", bake(parts), surface, true);
    setMesh("glow", bake(glow), glowMat, false);
    for (const part of ground) if (part.c === null) part.g.dispose();
    rebuildTrees();
    rebuildTufts();
    rebuildSheep();
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

  function blocked(x: number, z: number, pad = 0.6) {
    if (lineIndex.near(x, z, pad)) return true;
    for (const h of S.houses) if (Math.hypot(h.x - x, h.z - z) < h.len / 2 + 1 + pad * 0.3) return true;
    for (const p of S.ponds) if (Math.hypot(p.x - x, p.z - z) < p.r + 0.4) return true;
    for (const list of [S.wells, S.mills, S.towers]) for (const o of list) if (Math.hypot(o.x - x, o.z - z) < 1.2) return true;
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

  function rebuildSheep() {
    const ids = new Set(S.sheep.map((s) => s.id));
    for (const [id, v] of sheepViews) if (!ids.has(id)) { v.mesh.removeFromParent(); sheepViews.delete(id); }
    for (const s of S.sheep) {
      const existing = sheepViews.get(s.id);
      if (existing) { existing.home.set(s.x, s.z); continue; }
      const mesh = new THREE.Mesh(templates.sheep, surface);
      mesh.castShadow = true;
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      world.add(mesh);
      sheepViews.set(s.id, { mesh, home: new THREE.Vector2(s.x, s.z), target: new THREE.Vector2(s.x, s.z), wait: Math.random() * 3, hop: 0, pet: 0 });
    }
  }

  /** Live preview of the stroke or object being drawn. */
  function rebuildPreview() {
    for (const child of [...preview.children]) { (child as THREE.Mesh).geometry?.dispose(); child.removeFromParent(); }
    if (!drag) return;
    const parts: Part[] = [], glow: Part[] = [];
    if (drag.mode === "stroke" && drag.raw.length >= 2) {
      const stroke = { id: 0, pts: resample(chaikin(drag.raw, 1), STEP) };
      if (drag.kind === "path") pathParts(stroke, 5, parts);
      if (drag.kind === "wall") {
        const spots: TowerSpot[] = [];
        wallParts(stroke, parts, spots);
        for (const t of spots) towerParts(t[0], t[1], hash2(t[0], t[1]), parts, glow);
      }
      if (drag.kind === "fence") fenceParts(stroke, parts);
    } else if (drag.mode === "house") {
      houseParts(houseFromDrag(drag), parts, glow);
    } else if (drag.mode === "pond") {
      pondParts({ x: drag.start[0], z: drag.start[1], r: drag.r, seed: 3 }, parts);
      const water = new THREE.Mesh(G.disc.clone(), waterMat);
      water.position.set(drag.start[0], 0.06, drag.start[1]);
      water.scale.set(drag.r * 2, 0.02, drag.r * 2);
      preview.add(water);
    }
    const g = bake(parts);
    if (g) { const m = new THREE.Mesh(g, surface); m.castShadow = true; preview.add(m); }
    const gg = bake(glow);
    if (gg) preview.add(new THREE.Mesh(gg, glowMat));
    for (const part of parts) if (part.c === null) part.g.dispose();
  }

  function sampleVillage() {
    const stroke = (ctrl: Point[]): Stroke => ({ id: newId(), pts: round2(resample(chaikin(ctrl, 3), STEP)) });
    S = emptyScene();
    S.paths.push(stroke([[-12, 4.6], [-8, 3.2], [-4.5, 1.6], [-1, 1.2], [2.5, -0.2], [6, -2.2], [12, -4.8]]));
    S.paths.push(stroke([[-0.6, 1.2], [-0.8, -2], [-2.6, -5.2]]));
    S.walls.push(stroke([[-5.2, -8.6], [-7.6, -4.6], [-7.2, 0.6], [-5.8, 5.8], [-2.2, 8.6]]));
    S.walls.push(stroke([[4.2, -8.8], [7.8, -6.8], [9.4, -2.4], [8.6, 2.2]]));
    const house = (x: number, z: number, len: number) => {
      const near = nearestPathPoint(x, z);
      const r = near ? Math.atan2(near[0] - x, near[1] - z) : 0;
      S.houses.push({ id: newId(), x, z, len, r: Math.round(r * 100) / 100, seed: hash2(x, z) });
    };
    house(-2.6, -1.4, 2.5); house(1.6, -3.0, 1.8); house(-1.2, 4.2, 3.2); house(3.6, 2.4, 2.1); house(-4.6, 4.0, 1.7); house(4.8, -5.0, 2.6);
    const r = rng(404);
    const trees: Point[] = [[6.5, 5.5], [7.6, 6.6], [5.4, 7.6], [-9.6, -6.4], [-10.6, -3.2], [9.8, 3.6], [-8.8, 8.4], [1.8, 8.6], [-3.2, -8.8], [10.4, -7.4], [11.2, 1.2], [-11.4, 0.8], [3.2, 6.4]];
    for (const [x, z] of trees) S.trees.push({ id: newId(), x, z, s: 0.85 + r() * 0.35, k: r() < 0.45 ? 1 : 0, r: r() * 6 });
  }

  /* ───────────── camera rig ───────────── */
  const rig = { theta: 0.72, phi: 0.98, radius: 30, tx: 0, tz: 0 };
  const goal = { ...rig };
  /** Distance that fits the island's width; portrait screens crop the rim a little and look down more steeply. */
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
  }
  const orbitBy = (dx: number, dy: number) => {
    goal.theta -= dx * 0.0065;
    goal.phi = clamp(goal.phi - dy * 0.0045, 0.42, 1.22);
  };
  const zoomBy = (f: number) => { goal.radius = clamp(goal.radius * f, 11, 70); };
  function panBy(dx: number, dy: number) {
    const s = goal.radius * 0.0016;
    const cx = Math.cos(goal.theta), sx = Math.sin(goal.theta);
    goal.tx = clamp(goal.tx - (dx * cx - dy * sx) * s, -10, 10);
    goal.tz = clamp(goal.tz - (-dx * sx - dy * cx) * s, -10, 10);
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
    const elev = lerp(A.elev, B.elev, k), az = -0.9 + t * 2.4;
    sun.position.set(Math.cos(az) * Math.cos(elev) * 30, Math.sin(elev) * 30 + 4, Math.sin(az) * Math.cos(elev) * 30);
    const glow = lerp(A.glow, B.glow, k);
    glowMat.emissiveIntensity = glow * 2.2;
    glowMat.color.set(glow > 0.5 ? "#4a3a28" : "#2f4250");
    haloMat.opacity = glow * 0.85;
    starMat.opacity = clamp((t - 0.8) / 0.2, 0, 1);
    cloudMat.color.setScalar(lerp(1, 0.55, clamp((t - 0.72) / 0.28, 0, 1)));
  }

  /* ───────────── editing ───────────── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(cx: number, cy: number): Point | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
  }

  let drag: Drag | null = null, before: string | null = null, needsRebuild = false, previewDirty = false;
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

  function plantAt(g: Point) {
    if (Math.hypot(g[0], g[1]) > BUILD_R || blocked(g[0], g[1], 0.55)) return false;
    if (S.trees.some((t) => Math.hypot(t.x - g[0], t.z - g[1]) < 0.75)) return false;
    S.trees.push({ id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), s: 0.75 + Math.random() * 0.45, k: Math.random() < 0.4 ? 1 : 0, r: Math.random() * 6 });
    rebuildTrees();
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
    S.sheep = keep(S.sheep, (o) => near(o, R + 0.2));
    S.trees = keep(S.trees, (o) => near(o, R));
    S.ponds = keep(S.ponds, (o) => near(o, o.r));
    for (const kind of ["paths", "walls", "fences"] as const) {
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

  function petSheep(g: Point) {
    const at = new THREE.Vector3(g[0], 0, g[1]);
    for (const v of sheepViews.values()) {
      if (v.mesh.position.distanceTo(at) < 0.9) {
        v.pet = 1;
        say("Be-e-e! Con cừu thích được vuốt ve. (sheep /ʃiːp/)");
        return true;
      }
    }
    return false;
  }

  function placeObject(kind: ToolId, at: Point) {
    if (Math.hypot(at[0], at[1]) > ISLAND_R) { say("Hãy đặt trên đảo cỏ."); return; }
    const g = clampToIsland(at);
    const o: Placed = { id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), seed: randSeed() };
    if (kind === "tower") S.towers.push(o);
    else if (kind === "well") S.wells.push(o);
    else if (kind === "windmill") S.mills.push({ ...o, r: +(Math.atan2(-g[0], -g[1]) + Math.PI).toFixed(3) });
    else if (kind === "lantern") S.lanterns.push(o);
    else if (kind === "sheep" && !petSheep(g)) S.sheep.push(o);
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
    if (tool === "orbit" || e.button === 2) { drag = { mode: "orbit", x: e.clientX, y: e.clientY }; return; }
    if (e.button === 1) { drag = { mode: "pan", x: e.clientX, y: e.clientY }; return; }
    const hitAt = groundAt(e.clientX, e.clientY);
    if (!hitAt) return;
    // The grass rim past BUILD_R looks buildable, so a start anywhere on the island is pulled inwards.
    const inside = Math.hypot(hitAt[0], hitAt[1]) <= ISLAND_R;
    const g = clampToIsland(hitAt);
    before = serialize();
    if (tool === "path" || tool === "wall" || tool === "fence") {
      if (!inside) { say("Hãy bắt đầu vẽ trên đảo cỏ."); before = null; return; }
      drag = { mode: "stroke", kind: tool, raw: [g] };
    } else if (tool === "house") {
      if (!inside) { say("Hãy đặt nhà trên đảo cỏ."); before = null; return; }
      drag = { mode: "house", start: g, end: g, moved: false, len: 1.6 + Math.random() * 1.2, r: Math.random() * 6, seed: randSeed() };
    } else if (tool === "pond") {
      if (!inside) { before = null; return; }
      drag = { mode: "pond", start: g, r: 1.2 };
    } else if (tool === "tree") {
      drag = { mode: "brush", last: plantAt(g) ? g : null };
    } else if (tool === "erase") {
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
    if (drag.mode === "tap") { drag.moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12; return; }
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
      if ((!drag.last || dist(drag.last, g) > 0.95) && plantAt(g)) drag.last = g;
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
    if (d.mode === "stroke") {
      if (lineLength(d.raw) < 0.9) {
        say(d.kind === "wall" ? "Kéo dài hơn một chút để xây tường." : d.kind === "fence" ? "Kéo dài hơn một chút để dựng rào." : "Kéo dài hơn một chút để vẽ đường.");
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
        const key = d.kind === "path" ? "paths" : d.kind === "wall" ? "walls" : "fences";
        S[key].push({ id: newId(), pts: round2(pts) });
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
    if (tool === "path" || tool === "wall" || tool === "fence") { say(`${TOOL[tool].label} cần kéo bằng chuột hoặc ngón tay. Bàn phím đặt được nhà, cây, ao và các món đồ chạm.`); return; }
    if (tool === "orbit" || tool === "erase") { say("Chọn nhà, cây hoặc một món đồ rồi bấm Enter để đặt vào giữa khung nhìn."); return; }
    const g = clampToIsland([goal.tx + (Math.random() - 0.5) * 3, goal.tz + (Math.random() - 0.5) * 3]);
    before = serialize();
    if (tool === "house") addHouse({ mode: "house", start: g, end: g, moved: false, len: 1.6 + Math.random() * 1.2, r: Math.random() * 6, seed: randSeed() });
    else if (tool === "tree") plantAt(g);
    else if (tool === "pond") S.ponds.push({ id: newId(), x: +g[0].toFixed(2), z: +g[1].toFixed(2), r: 1.4, seed: randSeed() });
    else if (TAP_TOOLS.includes(tool)) placeObject(tool, g);
    const changed = serialize() !== before;
    commit();
    say(changed ? `Đã đặt ${TOOL[tool].label.toLowerCase()} giữa khung nhìn.` : "Chỗ này chật quá. Dời khung nhìn bằng Shift + mũi tên rồi thử lại.");
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
  const tmpV = new THREE.Vector3();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden || !visible) return;
    if (needsRebuild) { needsRebuild = false; rebuildAll(); }
    if (previewDirty) { previewDirty = false; rebuildPreview(); }
    applyCamera(dt);
    const motion = reduceMotion ? 0 : 1;
    for (const b of mills) b.rotation.z += dt * 0.9 * motion;
    for (const c of clouds) { c.position.x += dt * 0.35 * motion; if (c.position.x > 34) c.position.x = -34; }
    for (const v of sheepViews.values()) {
      const m = v.mesh;
      if (v.pet > 0) { v.pet = Math.max(0, v.pet - dt * 1.6); m.position.y = Math.sin(v.pet * Math.PI) * 0.45 * motion; continue; }
      if (!motion) continue;
      if (v.wait > 0) { v.wait -= dt; m.position.y = 0; continue; }
      tmpV.set(v.target.x - m.position.x, 0, v.target.y - m.position.z);
      const d = tmpV.length();
      if (d < 0.08) {
        v.wait = 1.5 + Math.random() * 4;
        for (let tries = 0; tries < 6; tries += 1) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 2.6;
          const x = v.home.x + Math.cos(a) * r, z = v.home.y + Math.sin(a) * r;
          if (Math.hypot(x, z) < BUILD_R && !blocked(x, z, 0.4)) { v.target.set(x, z); break; }
        }
        continue;
      }
      const step = Math.min(d, dt * 0.55);
      m.position.x += (tmpV.x / d) * step;
      m.position.z += (tmpV.z / d) * step;
      m.rotation.y = Math.atan2(tmpV.x, tmpV.z);
      v.hop += dt * 10;
      m.position.y = Math.abs(Math.sin(v.hop)) * 0.06;
    }
    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; options.onReady(); }

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
    },
    setTime: applyTime,
    undo() {
      const prev = undoStack.pop();
      if (prev === undefined) return;
      cancelTool();
      S = JSON.parse(prev) as VillageScene;
      options.onUndoChange(undoStack.length > 0);
      needsRebuild = true;
      saveSoon();
      say("Đã hoàn tác.");
    },
    reset(kind) {
      cancelTool();
      undoStack.push(serialize());
      options.onUndoChange(true);
      if (kind === "sample") sampleVillage();
      else S = emptyScene();
      needsRebuild = true;
      saveSoon();
      say(kind === "sample" ? "Đã khôi phục làng mẫu." : "Đảo trống rồi. Bấm Hoàn tác nếu đổi ý.");
    },
    dispose() {
      cancelAnimationFrame(raf);
      flushSave();
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pagehide", flushSave);
      const geometries = new Set<THREE.BufferGeometry>([...Object.values(G), templates.blade, templates.sheep, templates.tuft, ...templates.trees]);
      scene.traverse((obj) => { const g = (obj as THREE.Mesh).geometry; if (g) geometries.add(g); });
      geometries.forEach((g) => g.dispose());
      for (const m of [surface, glowMat, waterMat, cloudMat, haloMat, starMat]) m.dispose();
      haloTex.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
