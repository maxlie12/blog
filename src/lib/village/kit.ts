/**
 * Shared three.js building blocks for Làng Rêu: primitive geometries, a transform helper, a
 * "painter" that collects coloured parts in an object's local frame, and `bake`, which merges
 * those parts into one vertex-coloured geometry (one draw call per layer).
 */
import * as THREE from "three";
import type { Point } from "./data";
import type { PartId } from "./vocab";

export type Args = [x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number, ry?: number, rx?: number, rz?: number];
export interface Part { g: THREE.BufferGeometry; c: THREE.ColorRepresentation | null; m: THREE.Matrix4 | null }
/** Where a named part sits, for the Look tool's labels. */
export interface Mark { part: PartId; at: THREE.Vector3 }
/** Draws in one object's frame: `p` solid parts, `w` parts that glow at night, `halo` a light glow, `mark` a part label. */
export interface Draw {
  p: (g: THREE.BufferGeometry, c: THREE.ColorRepresentation, ...a: Args) => void;
  w: (g: THREE.BufferGeometry, ...a: Args) => void;
  halo: (x: number, y: number, z: number) => void;
  mark: (part: PartId, x: number, y: number, z: number) => void;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function M(x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, "YXZ");
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
export const shade = (hex: THREE.ColorRepresentation, amount: number) => new THREE.Color(hex).offsetHSL(0, 0, amount);
export const pick = <T>(arr: readonly T[], r: () => number) => arr[Math.floor(r() * arr.length) % arr.length];

export function painter(T: THREE.Matrix4, parts: Part[], glow?: Part[], halos?: THREE.Vector3[], marks?: Mark[]): Draw {
  return {
    p: (g, c, ...a) => { parts.push({ g, c, m: T.clone().multiply(M(...a)) }); },
    w: (g, ...a) => { glow?.push({ g, c: "#ffffff", m: T.clone().multiply(M(...a)) }); },
    halo: (x, y, z) => { halos?.push(new THREE.Vector3(x, y, z).applyMatrix4(T)); },
    mark: (part, x, y, z) => { marks?.push({ part, at: new THREE.Vector3(x, y, z).applyMatrix4(T) }); },
  };
}

/** Merges coloured parts into one vertex-coloured geometry: one draw call however many parts. */
export function bake(parts: Part[]): THREE.BufferGeometry | null {
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

/** Flat ribbon along a line, `half` wide on each side, with gentle colour noise. Used for paths and streams. */
export function ribbon(pts: Point[], half: number, y: number, color: THREE.ColorRepresentation, noise: number, wobble = 0): THREE.BufferGeometry {
  const n = pts.length;
  const pos: number[] = [], col: number[] = [];
  const base = new THREE.Color(color);
  const L: Point[] = [], R: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const w = half * (1 + Math.sin(i * 1.7 + wobble) * 0.08);
    L.push([pts[i][0] - tz * w, pts[i][1] + tx * w]);
    R.push([pts[i][0] + tz * w, pts[i][1] - tx * w]);
  }
  const push = (p: Point) => {
    pos.push(p[0], y, p[1]);
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
  return g;
}

function makePrism() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

/** Unit primitives every model is scaled from. Created once per page; disposing them is safe (three re-uploads on reuse). */
export const G = {
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
  dome: new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(0.5, 0.08, 5, 14),
  prism: makePrism(),
  arch: new THREE.TorusGeometry(1, 0.13, 5, 14, Math.PI),
};
