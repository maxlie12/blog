/**
 * Low-poly models for the pieces stored in `props` (buildings, plants, water pieces, decor,
 * animals). Each model draws itself around the origin with its front facing +Z, using the
 * shared primitives in kit.ts; the scene places, rotates and bakes it. `r` is a seeded random
 * source so the same saved piece always looks the same.
 */
import * as THREE from "three";
import type { PropKind } from "./data";
import { G, pick, shade, type Draw } from "./kit";
import { PERSON_MODELS } from "./people";
import type { PartId } from "./vocab";

type Model = (d: Draw, r: () => number) => void;

const WOOD = "#7a5a3e", WOOD_MID = "#9a744d", WOOD_LIGHT = "#b18a5e", DARK = "#3a332d", STONE = "#cfc5b1", STONE_DARK = "#a99d88";
const PLASTER = "#efe6d3", TRIM = "#f2ead9", RED = "#c94f4f", BLUE = "#4e7287", GOLD = "#e3bf55", LEAF = "#6e9d4a";
const FLOWERS = ["#f2c94c", "#e57f9e", "#f6f3ea", "#b48ee0", "#e8664f"];
const band = new THREE.CylinderGeometry(0.46, 0.5, 1, 12);
/** Four-sided roof whose edges line up with the axes. */
const pyramid = new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4);
const HALF = Math.PI / 2;

/** Extra geometries owned by this module, disposed with the scene. */
export const PROP_GEOMETRIES = [band, pyramid];

const eyes = (d: Draw, x: number, y: number, z: number, s = 0.035) => {
  for (const side of [-1, 1]) d.p(G.sphere, "#222222", side * x, y, z, s, s, s);
};

export const PROP_MODELS: Record<PropKind, Model> = {
  ...PERSON_MODELS,
  /* ───── buildings ───── */
  barn({ p, w }) {
    const red = "#a8443a", roof = "#5a3b30";
    p(G.box, "#a99e8b", 0, 0.12, 0, 2.6, 0.24, 3.2);
    p(G.box, red, 0, 1.04, 0, 2.4, 1.6, 3.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, TRIM, sx * 1.2, 1.04, sz * 1.5, 0.1, 1.6, 0.1);
    // Gambrel roof: steep lower slopes, shallow upper slopes, ridge along Z.
    p(G.box, red, 0, 2.195, 0, 1.9, 0.72, 2.96);
    p(G.prism, red, 0, 2.55, 0, 1.4, 0.4, 2.96);
    for (const s of [-1, 1]) {
      p(G.box, roof, s * 0.975, 2.195, 0, 0.95, 0.1, 3.3, 0, 0, -s * 0.91);
      p(G.box, roof, s * 0.35, 2.75, 0, 0.86, 0.1, 3.3, 0, 0, -s * 0.52);
    }
    p(G.box, "#5b3a2e", 0, 0.84, 1.52, 1.2, 1.2, 0.06);
    for (const s of [-1, 1]) {
      p(G.box, TRIM, 0, 0.84, 1.56, 1.6, 0.08, 0.04, 0, 0, s * 0.785);
      p(G.box, TRIM, s * 0.62, 0.84, 1.55, 0.08, 1.28, 0.05);
    }
    p(G.box, TRIM, 0, 1.47, 1.55, 1.32, 0.08, 0.05);
    p(G.box, TRIM, 0, 2.2, 1.5, 0.55, 0.46, 0.04);
    w(G.box, 0, 2.2, 1.53, 0.4, 0.32, 0.03);
    for (const s of [-1, 1]) w(G.box, s * 1.22, 1.3, -0.6, 0.03, 0.34, 0.4);
    p(G.box, TRIM, 0, 3.08, 0, 0.42, 0.3, 0.42);
    p(G.cone6, roof, 0, 3.4, 0, 0.62, 0.36, 0.62);
    p(G.box, "#e3c76a", 0.85, 0.32, 1.85, 0.6, 0.4, 0.5, 0.3);
  },
  chapel({ p, w, halo }) {
    const roof = "#5f6f92", eave = 1.94;
    p(G.box, STONE_DARK, 0, 0.12, 0, 2.0, 0.24, 3.2);
    p(G.box, PLASTER, 0, 0.24 + 0.85, 0, 1.8, 1.7, 3.0);
    p(G.prism, PLASTER, 0, eave, 0, 1.8, 1.3, 3.0);
    for (const s of [-1, 1]) p(G.box, roof, s * 0.55, eave + 0.65, 0, 1.78, 0.12, 3.3, 0, 0, -s * 0.87);
    p(G.box, PLASTER, 0, eave + 1.0, 1.15, 0.75, 1.5, 0.75);
    p(G.box, DARK, 0, eave + 1.4, 1.15, 0.45, 0.42, 0.78);
    p(G.box, DARK, 0, eave + 1.4, 1.15, 0.78, 0.42, 0.45);
    p(G.sphere, GOLD, 0, eave + 1.35, 1.15, 0.2, 0.2, 0.2);
    p(G.cone8, roof, 0, eave + 2.45, 1.15, 0.95, 1.4, 0.95);
    p(G.box, GOLD, 0, eave + 3.3, 1.15, 0.05, 0.36, 0.05);
    p(G.box, GOLD, 0, eave + 3.36, 1.15, 0.22, 0.05, 0.05);
    p(G.box, "#6b4f3a", 0, 0.74, 1.51, 0.6, 1.0, 0.06);
    p(G.cyl12, "#6b4f3a", 0, 1.24, 1.51, 0.6, 0.06, 0.6, 0, HALF);
    p(G.box, "#b8ad9a", 0, 0.08, 1.75, 1.0, 0.16, 0.4);
    w(G.cyl12, 0, eave + 0.45, 1.53, 0.46, 0.04, 0.46, 0, HALF);
    p(G.torus, STONE, 0, eave + 0.45, 1.53, 0.55, 0.55, 0.7);
    for (const s of [-1, 1]) for (const z of [-0.9, 0, 0.9]) {
      p(G.box, STONE, s * 0.91, 1.15, z, 0.03, 0.82, 0.38);
      w(G.box, s * 0.93, 1.15, z, 0.03, 0.66, 0.26);
    }
    halo(0, eave + 0.45, 1.7);
  },
  stall({ p }, r) {
    p(G.box, WOOD_MID, 0, 0.45, 0.35, 1.8, 0.9, 0.6);
    p(G.box, WOOD_LIGHT, 0, 0.92, 0.38, 1.9, 0.06, 0.7);
    for (const sx of [-1, 1]) {
      p(G.box, WOOD, sx * 0.88, 0.9, -0.45, 0.1, 1.8, 0.1);
      p(G.box, WOOD, sx * 0.88, 0.7, 0.68, 0.1, 1.4, 0.1);
    }
    p(G.box, WOOD_LIGHT, 0, 0.5, -0.45, 1.7, 0.06, 0.4);
    const stripes = 7, accent = pick([RED, BLUE, "#6c7f55"], r);
    for (let k = 0; k < stripes; k += 1) p(G.box, k % 2 ? TRIM : accent, -0.95 + ((k + 0.5) * 1.9) / stripes, 1.62, 0.12, 1.9 / stripes, 0.05, 1.45, 0, 0.32);
    const fruits = ["#d9453b", "#f0a03c", "#8cbc5c", "#e3bf55"];
    for (const x of [-0.55, 0, 0.55]) {
      p(G.box, WOOD_LIGHT, x, 1.02, 0.4, 0.48, 0.14, 0.44);
      const c = pick(fruits, r);
      for (let i = 0; i < 4; i += 1) p(G.ico0, c, x - 0.12 + (i % 2) * 0.24, 1.15, 0.3 + Math.floor(i / 2) * 0.2, 0.15, 0.15, 0.15);
    }
  },
  tent({ p }, r) {
    const cloth = pick(["#e8d8b4", "#d9c3a0", "#c9d3c0"], r);
    p(G.prism, cloth, 0, 0, 0, 1.9, 1.4, 2.2);
    p(G.prism, "#6b4f3a", 0, 0, 1.11, 0.7, 0.9, 0.02);
    p(G.box, RED, 0, 1.4, 0, 0.12, 0.06, 2.3);
    for (const s of [-1, 1]) p(G.cyl8, WOOD, 0, 0.78, s * 1.16, 0.06, 1.56, 0.06);
    p(G.box, GOLD, 0.16, 1.48, 1.16, 0.3, 0.18, 0.02);
    for (const s of [-1, 1]) p(G.box, "#e8dcc0", s * 1.05, 0.35, 0, 0.02, 0.02, 2.1);
  },
  lighthouse({ p, w, halo }) {
    p(G.cyl12, STONE_DARK, 0, 0.2, 0, 2.3, 0.4, 2.3);
    let radius = 0.92;
    for (let k = 0; k < 4; k += 1) {
      p(band, k % 2 ? RED : "#f4efe6", 0, 0.4 + k * 0.9 + 0.45, 0, radius * 2, 0.9, radius * 2);
      radius *= 0.92;
    }
    p(G.cyl12, DARK, 0, 4.05, 0, 1.6, 0.1, 1.6);
    p(G.torus, DARK, 0, 4.38, 0, 1.56, 1.56, 0.8, 0, HALF);
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      p(G.box, DARK, Math.sin(a) * 0.76, 4.22, Math.cos(a) * 0.76, 0.04, 0.32, 0.04);
    }
    w(G.cyl8, 0, 4.5, 0, 0.9, 0.7, 0.9);
    p(G.cone8, RED, 0, 5.15, 0, 1.2, 0.6, 1.2);
    p(G.sphere, DARK, 0, 5.5, 0, 0.16, 0.16, 0.16);
    p(G.box, "#6b4f3a", 0, 0.78, 0.9, 0.42, 0.75, 0.08);
    for (const y of [2.2, 3.1]) p(G.box, "#3a4a55", 0, y, 0.74, 0.2, 0.3, 0.06);
    halo(0, 4.5, 0);
  },
  gazebo({ p }) {
    p(G.cyl6, STONE, 0, 0.1, 0, 2.7, 0.2, 2.7);
    p(G.cyl6, WOOD_LIGHT, 0, 0.22, 0, 2.45, 0.04, 2.45);
    const corner = (k: number): [number, number] => [Math.sin((k * Math.PI) / 3) * 1.08, Math.cos((k * Math.PI) / 3) * 1.08];
    for (let k = 0; k < 6; k += 1) {
      const [x, z] = corner(k);
      p(G.box, TRIM, x, 1.12, z, 0.12, 1.8, 0.12);
      if (k === 0 || k === 5) continue; // leave the front open
      const [x2, z2] = corner(k + 1);
      const len = Math.hypot(x2 - x, z2 - z);
      p(G.box, TRIM, (x + x2) / 2, 0.62, (z + z2) / 2, len, 0.06, 0.06, Math.atan2(-(z2 - z), x2 - x));
    }
    p(G.cyl6, TRIM, 0, 2.04, 0, 2.5, 0.1, 2.5);
    p(G.cone6, BLUE, 0, 2.62, 0, 3.0, 1.1, 3.0);
    p(G.sphere, GOLD, 0, 3.22, 0, 0.18, 0.18, 0.18);
    p(G.box, WOOD_MID, 0, 0.45, -0.55, 1.0, 0.08, 0.32);
  },

  /* ───── plants ───── */
  bush({ p }) {
    p(G.ico, "#5f9445", 0, 0.32, 0, 0.82, 0.62, 0.78);
    p(G.ico, "#6fa552", 0.24, 0.44, 0.1, 0.52, 0.46, 0.5);
    p(G.ico, "#558a3e", -0.22, 0.38, -0.12, 0.54, 0.46, 0.5);
    for (const [x, z] of [[0.3, 0.26], [-0.2, 0.3], [0.05, -0.32]]) p(G.ico0, "#d9453b", x, 0.46, z, 0.08, 0.08, 0.08);
  },
  flower({ p }, r) {
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2 + r() * 0.6, rad = 0.08 + r() * 0.22, h = 0.22 + r() * 0.16;
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
      p(G.cyl6, "#5d8240", x, h / 2, z, 0.03, h, 0.03);
      p(G.ico0, pick(FLOWERS, r), x, h + 0.02, z, 0.13, 0.08, 0.13);
      p(G.ico0, "#f2c94c", x, h + 0.06, z, 0.04, 0.03, 0.04);
      p(G.ico0, LEAF, x + 0.04, 0.05, z, 0.14, 0.05, 0.12);
    }
  },
  blossom({ p }) {
    p(G.cyl8, "#6b4a3a", 0, 0.55, 0, 0.22, 1.1, 0.22);
    p(G.box, "#6b4a3a", 0.18, 1.1, 0.05, 0.08, 0.5, 0.08, 0, 0, -0.6);
    p(G.ico, "#f3b6c8", 0, 1.55, 0, 1.4, 1.05, 1.4);
    p(G.ico, "#f7c9d6", 0.42, 1.85, 0.15, 0.9, 0.75, 0.9);
    p(G.ico, "#eaa2b8", -0.36, 1.75, -0.2, 0.86, 0.7, 0.86);
    p(G.cyl12, "#f7d3de", 0, 0.012, 0, 1.7, 0.01, 1.7);
  },
  sunflower({ p }) {
    for (const [x, z, h] of [[0, 0, 1.35], [0.28, -0.12, 1.05], [-0.24, 0.1, 1.18]]) {
      p(G.cyl6, "#5d8240", x, h / 2, z, 0.05, h, 0.05);
      p(G.ico0, LEAF, x + 0.1, h * 0.45, z, 0.24, 0.05, 0.14, 0, 0, 0.4);
      p(G.ico0, LEAF, x - 0.1, h * 0.65, z, 0.22, 0.05, 0.13, 0, 0, -0.4);
      p(G.cyl12, "#f2c94c", x, h, z + 0.05, 0.42, 0.05, 0.42, 0, HALF - 0.35);
      p(G.cyl12, "#6b4a2a", x, h + 0.01, z + 0.08, 0.2, 0.06, 0.2, 0, HALF - 0.35);
    }
  },
  mushroom({ p }) {
    for (const [x, z, s] of [[0, 0, 1], [0.3, 0.16, 0.62], [-0.22, 0.22, 0.45]]) {
      p(G.cyl8, "#f3ecdc", x, 0.18 * s, z, 0.14 * s, 0.36 * s, 0.14 * s);
      p(G.dome, "#d9453b", x, 0.32 * s, z, 0.52 * s, 0.5 * s, 0.52 * s);
      for (const [dx, dy, dz] of [[0.1, 0.5, 0.06], [-0.12, 0.46, -0.05], [0.04, 0.44, -0.16], [-0.06, 0.45, 0.15]]) {
        p(G.sphere, "#ffffff", x + dx * s, dy * s + 0.02, z + dz * s, 0.07 * s, 0.035 * s, 0.07 * s);
      }
    }
  },
  rock({ p }) {
    p(G.dode, "#9a9488", 0, 0.26, 0, 1.0, 0.62, 0.82, 0.4);
    p(G.dode, "#a8a296", 0.42, 0.15, 0.26, 0.5, 0.36, 0.46, 1.2);
    p(G.ico0, "#7ea456", -0.1, 0.5, 0.05, 0.42, 0.1, 0.36);
  },
  log({ p }) {
    p(G.cyl12, WOOD, 0, 0.22, 0, 0.44, 1.4, 0.44, 0, 0, HALF);
    for (const s of [-1, 1]) p(G.cyl12, "#d8b98c", s * 0.705, 0.22, 0, 0.38, 0.02, 0.38, 0, 0, HALF);
    p(G.ico0, "#7ea456", 0.2, 0.42, 0.05, 0.36, 0.1, 0.26);
    p(G.dome, "#e88a2a", -0.3, 0.38, 0.14, 0.16, 0.12, 0.16);
  },
  stump({ p }) {
    p(G.cyl12, WOOD, 0, 0.2, 0, 0.72, 0.4, 0.72);
    p(G.cyl12, "#d8b98c", 0, 0.41, 0, 0.62, 0.02, 0.62);
    p(G.cyl12, "#c4a175", 0, 0.42, 0, 0.32, 0.02, 0.32);
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2;
      p(G.box, WOOD, Math.sin(a) * 0.38, 0.06, Math.cos(a) * 0.38, 0.14, 0.12, 0.34, a, 0.3);
    }
  },
  garden({ p }, r) {
    p(G.box, "#6b4a32", 0, 0.06, 0, 2.4, 0.12, 1.8);
    for (const s of [-1, 1]) {
      p(G.box, WOOD_MID, 0, 0.1, s * 0.92, 2.5, 0.2, 0.08);
      p(G.box, WOOD_MID, s * 1.22, 0.1, 0, 0.08, 0.2, 1.84);
    }
    for (const z of [-0.55, 0, 0.55]) {
      const crop = Math.floor(r() * 3);
      for (let k = 0; k < 5; k += 1) {
        const x = -0.9 + k * 0.45;
        if (crop === 0) p(G.ico, "#8cbc5c", x, 0.2, z, 0.3, 0.22, 0.3);
        else if (crop === 1) {
          p(G.cone6, "#e88a2a", x, 0.14, z, 0.1, 0.08, 0.1, 0, Math.PI);
          for (const dx of [-0.04, 0.04]) p(G.cone6, "#6e9d4a", x + dx, 0.27, z, 0.05, 0.22, 0.05, 0, 0, dx * 6);
        } else p(G.ico0, "#a3c86d", x, 0.2, z, 0.28, 0.22, 0.28);
      }
    }
  },
  // Movable pieces (ball, pumpkin, barrel, crate, boat) are single objects centred on the
  // origin so they can roll and slide; rolling ones turn about their centre at y = radius.
  pumpkin({ p }) {
    p(G.sphere, "#e88a2a", 0, 0.27, 0, 0.6, 0.54, 0.6);
    for (let k = 0; k < 4; k += 1) p(G.sphere, "#d9781f", 0, 0.27, 0, 0.18, 0.55, 0.61, (k * Math.PI) / 4);
    p(G.cyl6, "#5d6b2f", 0, 0.56, 0, 0.06, 0.12, 0.06);
    p(G.ico0, LEAF, 0.1, 0.55, 0.05, 0.22, 0.04, 0.14);
  },
  haystack({ p }) {
    p(G.cyl12, "#d9bb5c", 0, 0.3, 0, 1.45, 0.6, 1.45);
    p(G.dome, "#e3c76a", 0, 0.6, 0, 1.45, 1.2, 1.45);
    p(G.cyl6, WOOD_MID, 0.62, 0.62, 0.3, 0.04, 1.3, 0.04, 0, 0, 0.3);
  },

  /* ───── water ───── */
  fountain({ p }) {
    p(G.cyl12, STONE, 0, 0.25, 0, 2.4, 0.5, 2.4);
    p(G.cyl12, "#ddd5c4", 0, 0.52, 0, 2.5, 0.06, 2.5);
    p(G.cyl12, "#7cc6d6", 0, 0.47, 0, 2.15, 0.04, 2.15);
    p(G.cyl8, STONE, 0, 0.9, 0, 0.3, 0.9, 0.3);
    p(G.cyl12, "#ddd5c4", 0, 1.32, 0, 1.0, 0.14, 1.0);
    p(G.cyl12, "#9ad6e2", 0, 1.4, 0, 0.84, 0.03, 0.84);
    p(G.cone6, "#bfe8f0", 0, 1.62, 0, 0.18, 0.45, 0.18);
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      p(G.ico0, "#bfe8f0", Math.sin(a) * 0.55, 0.95, Math.cos(a) * 0.55, 0.08, 0.14, 0.08);
    }
  },
  boat({ p }, r) {
    const hull = pick(["#8a5c3e", BLUE, "#a8443a"], r);
    p(G.dome, hull, 0, 0.32, 0, 0.92, 0.6, 2.0, 0, Math.PI);
    p(G.cyl12, WOOD_LIGHT, 0, 0.31, 0, 0.86, 0.02, 1.9);
    for (const z of [-0.4, 0.35]) p(G.box, WOOD_MID, 0, 0.36, z, 0.8, 0.05, 0.2);
    for (const s of [-1, 1]) p(G.box, "#c9a77a", s * 0.62, 0.38, 0, 0.06, 0.04, 1.3, 0.15 * s, 0, s * 0.3);
  },

  /* ───── decor ───── */
  bench({ p }) {
    p(G.box, WOOD_MID, 0, 0.42, 0, 1.3, 0.06, 0.4);
    for (const y of [0.64, 0.82]) p(G.box, WOOD_MID, 0, y, -0.2, 1.3, 0.1, 0.05);
    for (const s of [-1, 1]) {
      p(G.box, DARK, s * 0.55, 0.21, 0, 0.06, 0.42, 0.4);
      p(G.box, DARK, s * 0.55, 0.62, -0.22, 0.06, 0.44, 0.05);
      p(G.box, DARK, s * 0.62, 0.56, 0, 0.05, 0.05, 0.42);
    }
  },
  signpost({ p }) {
    p(G.box, WOOD, 0, 0.8, 0, 0.1, 1.6, 0.1);
    p(G.cone6, WOOD, 0, 1.66, 0, 0.16, 0.14, 0.16);
    p(G.box, WOOD_LIGHT, 0.36, 1.32, 0, 0.72, 0.2, 0.04);
    p(G.prism, WOOD_LIGHT, 0.72, 1.32, 0, 0.2, 0.14, 0.04, 0, 0, -HALF);
    p(G.box, "#c9a77a", -0.32, 1.04, 0, 0.64, 0.18, 0.04);
    p(G.prism, "#c9a77a", -0.64, 1.04, 0, 0.18, 0.12, 0.04, 0, 0, HALF);
  },
  cart({ p }, r) {
    p(G.box, WOOD_MID, 0, 0.55, 0, 1.0, 0.1, 1.4);
    for (const s of [-1, 1]) {
      p(G.box, WOOD_LIGHT, s * 0.5, 0.72, 0, 0.06, 0.3, 1.4);
      p(G.box, WOOD_LIGHT, 0, 0.72, s * 0.7, 1.0, 0.3, 0.06);
      p(G.cyl12, "#6b4f3a", s * 0.58, 0.38, -0.15, 0.76, 0.08, 0.76, 0, 0, HALF);
      p(G.cyl8, DARK, s * 0.63, 0.38, -0.15, 0.16, 0.06, 0.16, 0, 0, HALF);
      p(G.box, WOOD, s * 0.32, 0.46, 1.15, 0.06, 0.06, 0.95, 0, 0.25);
    }
    for (let k = 0; k < 12; k += 1) p(G.ico0, r() < 0.7 ? "#d9453b" : "#8cbc5c", -0.32 + (k % 3) * 0.32, 0.86 + (r() * 0.06), -0.5 + Math.floor(k / 3) * 0.33, 0.24, 0.22, 0.24);
  },
  barrel({ p }) {
    p(G.cyl12, "#8a6644", 0, 0.36, 0, 0.6, 0.72, 0.6);
    p(G.cyl12, "#9a744d", 0, 0.36, 0, 0.66, 0.36, 0.66);
    for (const y of [0.1, 0.62]) p(G.cyl12, DARK, 0, y, 0, 0.64, 0.05, 0.64);
    p(G.cyl12, WOOD_LIGHT, 0, 0.725, 0, 0.52, 0.02, 0.52);
  },
  crate({ p }) {
    const s = 0.6;
    p(G.box, "#c49a66", 0, s / 2, 0, s, s, s);
    for (const y of [0.05, s - 0.05]) p(G.box, "#8a6644", 0, y, 0, s + 0.03, 0.08, s + 0.03);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, "#8a6644", (sx * s) / 2, s / 2, (sz * s) / 2, 0.07, s, 0.07);
    for (const sz of [-1, 1]) p(G.box, "#8a6644", 0, s / 2, (sz * s) / 2, 0.75, 0.07, 0.03, 0, 0, 0.78);
  },
  ball({ p }) {
    p(G.sphere, "#f6f1e6", 0, 0.26, 0, 0.52, 0.52, 0.52);
    p(G.torus, RED, 0, 0.26, 0, 0.52, 0.52, 0.55);
    p(G.torus, BLUE, 0, 0.26, 0, 0.52, 0.52, 0.55, HALF);
  },
  flag({ p }, r) {
    const c = pick([RED, BLUE, GOLD, "#6c7f55", "#8a5c9e"], r);
    p(G.cyl8, STONE_DARK, 0, 0.1, 0, 0.42, 0.2, 0.42);
    p(G.cyl8, "#e8e2d4", 0, 1.3, 0, 0.07, 2.6, 0.07);
    p(G.box, c, 0.44, 2.26, 0, 0.82, 0.52, 0.03);
    p(G.box, shade(c, 0.18), 0.44, 2.26, 0, 0.84, 0.12, 0.035);
    p(G.sphere, GOLD, 0, 2.64, 0, 0.12, 0.12, 0.12);
  },
  statue({ p }) {
    const stone = "#d9d3c7";
    p(G.box, "#bdb5a6", 0, 0.4, 0, 0.8, 0.8, 0.8);
    p(G.box, "#cfc8ba", 0, 0.83, 0, 0.92, 0.06, 0.92);
    p(G.taper, stone, 0, 1.31, 0, 0.56, 0.9, 0.46);
    p(G.box, stone, 0, 1.92, 0, 0.42, 0.42, 0.3);
    p(G.sphere, stone, 0, 2.27, 0, 0.27, 0.3, 0.27);
    p(G.box, stone, 0.25, 2.05, 0.08, 0.1, 0.42, 0.1, 0, -0.5);
    p(G.box, stone, 0.3, 2.3, 0.2, 0.22, 0.26, 0.05);
    p(G.box, "#8a7a5a", 0, 0.46, 0.41, 0.42, 0.2, 0.02);
  },
  scarecrow({ p }) {
    const shirt = "#5f6f92";
    p(G.box, WOOD, 0, 0.9, 0, 0.1, 1.8, 0.1);
    p(G.box, WOOD, 0, 1.36, 0, 1.3, 0.08, 0.08);
    p(G.box, shirt, 0, 1.18, 0, 0.5, 0.56, 0.26);
    for (const s of [-1, 1]) {
      p(G.box, shirt, s * 0.42, 1.36, 0, 0.36, 0.17, 0.19);
      p(G.cone6, "#e3c76a", s * 0.68, 1.36, 0, 0.13, 0.2, 0.13, 0, 0, -s * HALF);
      p(G.box, DARK, s * 0.07, 1.71, 0.15, 0.05, 0.05, 0.01);
    }
    p(G.box, RED, 0.12, 1.1, 0.14, 0.13, 0.13, 0.01);
    p(G.sphere, "#e8d39a", 0, 1.69, 0, 0.34, 0.34, 0.3);
    p(G.cyl12, "#8a5c3e", 0, 1.86, 0, 0.64, 0.04, 0.64);
    p(G.cone8, "#8a5c3e", 0, 1.99, 0, 0.34, 0.3, 0.34);
  },
  swing({ p }) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, WOOD, sx * 0.88, 0.9, sz * 0.22, 0.1, 1.9, 0.1, 0, -sz * 0.24);
    p(G.cyl8, WOOD_MID, 0, 1.82, 0, 0.12, 1.95, 0.12, 0, 0, HALF);
    for (const s of [-1, 1]) p(G.box, "#e8dcc0", s * 0.26, 1.2, 0, 0.03, 1.2, 0.03);
    p(G.box, WOOD_LIGHT, 0, 0.6, 0, 0.72, 0.06, 0.3);
  },
  campfire({ p, w, halo }, r) {
    for (let k = 0; k < 9; k += 1) {
      const a = (k / 9) * Math.PI * 2;
      p(G.dode, shade("#9a9488", (r() - 0.5) * 0.1), Math.sin(a) * 0.48, 0.07, Math.cos(a) * 0.48, 0.24, 0.16, 0.22, a);
    }
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      p(G.cyl6, "#6b4a32", -Math.sin(a) * 0.12, 0.22, -Math.cos(a) * 0.12, 0.09, 0.6, 0.09, a, 0.55);
    }
    p(G.cone6, "#f2a53a", 0, 0.42, 0, 0.34, 0.6, 0.34);
    p(G.cone6, "#ffd86b", 0, 0.38, 0, 0.18, 0.4, 0.18);
    w(G.ico0, 0, 0.3, 0, 0.2, 0.2, 0.2);
    p(G.cyl8, WOOD, 0, 0.15, 1.0, 0.3, 1.0, 0.3, 0, 0, HALF);
    halo(0, 0.5, 0);
  },
  beehive({ p }) {
    p(G.box, WOOD, 0, 0.3, 0, 0.7, 0.06, 0.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, WOOD, sx * 0.28, 0.14, sz * 0.28, 0.06, 0.28, 0.06);
    for (let k = 0; k < 5; k += 1) p(G.cyl12, k % 2 ? "#c9a24a" : "#d9b45a", 0, 0.4 + k * 0.13, 0, 0.72 - k * 0.11, 0.14, 0.72 - k * 0.11);
    p(G.sphere, "#d9b45a", 0, 1.02, 0, 0.22, 0.14, 0.22);
    p(G.box, DARK, 0, 0.42, 0.34, 0.14, 0.08, 0.04);
    for (const [x, y, z] of [[0.38, 0.95, 0.22], [-0.3, 1.1, 0.3], [0.12, 1.25, -0.28]]) {
      p(G.sphere, "#f2c94c", x, y, z, 0.07, 0.06, 0.09);
      p(G.box, DARK, x, y, z, 0.075, 0.02, 0.02);
    }
  },
  woodpile({ p }) {
    const rows: [number, number[]][] = [[0.11, [-0.33, -0.11, 0.11, 0.33]], [0.3, [-0.22, 0, 0.22]], [0.49, [-0.11, 0.11]]];
    for (const [y, zs] of rows) for (const z of zs) {
      p(G.cyl8, "#8a6644", 0, y, z, 0.22, 0.92, 0.22, 0, 0, HALF);
      for (const s of [-1, 1]) p(G.cyl8, "#d8b98c", s * 0.465, y, z, 0.2, 0.02, 0.2, 0, 0, HALF);
    }
    p(G.cyl8, WOOD, 0.8, 0.15, 0.3, 0.36, 0.3, 0.36);
    p(G.box, WOOD_MID, 0.78, 0.45, 0.3, 0.04, 0.42, 0.04, 0, 0, 0.3);
    p(G.box, "#9aa3a8", 0.72, 0.62, 0.3, 0.16, 0.1, 0.02, 0, 0, 0.3);
  },
  mailbox({ p }, r) {
    const c = pick([BLUE, RED, "#6c7f55"], r);
    p(G.box, WOOD, 0, 0.5, 0, 0.08, 1.0, 0.08);
    p(G.box, c, 0, 1.06, 0, 0.3, 0.24, 0.46);
    p(G.cyl12, c, 0, 1.18, 0, 0.3, 0.46, 0.3, 0, HALF);
    p(G.box, shade(c, -0.08), 0, 1.1, 0.235, 0.26, 0.26, 0.02);
    p(G.box, RED, 0.17, 1.24, -0.05, 0.02, 0.24, 0.07);
  },

  /* ───── animals (built once as templates; +Z is forward) ───── */
  chicken(d) {
    const { p } = d, white = "#f5f1e8";
    p(G.ico, white, 0, 0.3, 0, 0.38, 0.32, 0.45);
    p(G.cone6, "#ede7dc", 0, 0.42, -0.22, 0.16, 0.25, 0.16, 0, -0.6);
    p(G.sphere, white, 0, 0.5, 0.18, 0.2, 0.2, 0.2);
    p(G.box, "#d9453b", 0, 0.62, 0.18, 0.04, 0.1, 0.14);
    p(G.ico0, "#d9453b", 0, 0.43, 0.27, 0.05, 0.07, 0.05);
    p(G.cone6, "#f2a53a", 0, 0.5, 0.3, 0.06, 0.1, 0.06, 0, HALF);
    for (const s of [-1, 1]) p(G.cyl6, "#f2a53a", s * 0.07, 0.08, 0, 0.03, 0.16, 0.03);
    eyes(d, 0.07, 0.53, 0.25, 0.03);
  },
  duck({ p }) {
    const white = "#f5f1e8";
    p(G.ico, white, 0, 0.22, 0, 0.38, 0.26, 0.52);
    p(G.cone6, white, 0, 0.3, -0.27, 0.14, 0.2, 0.14, 0, -0.9);
    p(G.sphere, white, 0, 0.45, 0.2, 0.22, 0.22, 0.22);
    p(G.box, "#f2a53a", 0, 0.42, 0.34, 0.1, 0.04, 0.14);
    for (const s of [-1, 1]) {
      p(G.box, "#f2a53a", s * 0.07, 0.02, 0.05, 0.08, 0.02, 0.1);
      p(G.sphere, "#222222", s * 0.08, 0.48, 0.28, 0.03, 0.03, 0.03);
    }
  },
  cow({ p }) {
    const hide = "#f3efe6", spot = DARK;
    p(G.ico, hide, 0, 0.72, 0, 0.75, 0.6, 1.25);
    p(G.ico0, spot, 0.27, 0.82, 0.15, 0.3, 0.3, 0.4);
    p(G.ico0, spot, -0.3, 0.72, -0.3, 0.26, 0.3, 0.36);
    p(G.ico0, spot, 0.08, 0.97, -0.35, 0.3, 0.14, 0.3);
    p(G.box, hide, 0, 0.88, 0.7, 0.38, 0.38, 0.42);
    p(G.box, "#e8a9a0", 0, 0.78, 0.93, 0.32, 0.2, 0.12);
    for (const s of [-1, 1]) {
      p(G.cone6, "#e8dcc0", s * 0.15, 1.11, 0.66, 0.06, 0.16, 0.06, 0, 0, -s * 0.4);
      p(G.box, hide, s * 0.25, 0.98, 0.66, 0.16, 0.06, 0.1);
      p(G.sphere, "#222222", s * 0.13, 0.95, 0.9, 0.04, 0.04, 0.03);
      for (const z of [-0.36, 0.36]) {
        p(G.cyl6, hide, s * 0.22, 0.24, z, 0.14, 0.44, 0.14);
        p(G.cyl6, spot, s * 0.22, 0.04, z, 0.15, 0.08, 0.15);
      }
    }
    p(G.sphere, "#e8a9a0", 0, 0.42, -0.15, 0.22, 0.14, 0.22);
    p(G.box, spot, 0, 0.75, -0.64, 0.04, 0.45, 0.04, 0, 0.2);
  },
  horse({ p }, r) {
    const coat = pick(["#8a5c3e", "#6b4630", "#c9a27a"], r), mane = "#3a2a20";
    p(G.ico, coat, 0, 0.88, 0, 0.6, 0.55, 1.25);
    p(G.box, coat, 0, 1.24, 0.55, 0.28, 0.66, 0.32, 0, 0.55);
    p(G.box, coat, 0, 1.52, 0.86, 0.26, 0.26, 0.56, 0, 0.4);
    p(G.box, shade(coat, -0.08), 0, 1.4, 1.1, 0.22, 0.2, 0.18, 0, 0.4);
    p(G.box, mane, 0, 1.38, 0.5, 0.08, 0.72, 0.2, 0, 0.55);
    for (const s of [-1, 1]) {
      p(G.cone6, coat, s * 0.08, 1.72, 0.76, 0.06, 0.15, 0.06);
      p(G.sphere, "#222222", s * 0.13, 1.58, 0.95, 0.04, 0.04, 0.03);
      for (const z of [-0.42, 0.42]) {
        p(G.cyl6, coat, s * 0.2, 0.32, z, 0.13, 0.62, 0.13);
        p(G.cyl6, mane, s * 0.2, 0.04, z, 0.14, 0.08, 0.14);
      }
    }
    p(G.box, mane, 0, 0.86, -0.68, 0.1, 0.56, 0.1, 0, -0.35);
  },
  pig({ p }) {
    const skin = "#f0b4b0", snout = "#e8958f";
    p(G.sphere, skin, 0, 0.38, 0, 0.62, 0.52, 0.85);
    p(G.sphere, skin, 0, 0.45, 0.42, 0.42, 0.4, 0.38);
    p(G.cyl12, snout, 0, 0.42, 0.62, 0.2, 0.08, 0.16, 0, HALF);
    p(G.torus, snout, 0, 0.45, -0.44, 0.14, 0.14, 0.14, HALF);
    for (const s of [-1, 1]) {
      p(G.cone6, snout, s * 0.13, 0.66, 0.42, 0.1, 0.14, 0.08, 0, 0.3);
      p(G.sphere, "#222222", s * 0.1, 0.52, 0.58, 0.035, 0.035, 0.03);
      for (const z of [-0.22, 0.22]) p(G.cyl6, skin, s * 0.16, 0.1, z, 0.12, 0.2, 0.12);
    }
  },
  dog({ p }, r) {
    const coat = pick(["#c89058", "#8a5c3e", "#e8dcc0"], r);
    p(G.ico, coat, 0, 0.42, 0, 0.4, 0.36, 0.8);
    p(G.sphere, coat, 0, 0.66, 0.38, 0.32, 0.3, 0.32);
    p(G.box, "#e8c9a0", 0, 0.6, 0.55, 0.16, 0.14, 0.16);
    p(G.sphere, "#222222", 0, 0.63, 0.63, 0.06, 0.05, 0.05);
    p(G.cyl12, RED, 0, 0.55, 0.3, 0.3, 0.05, 0.3, 0, 0.4);
    for (const s of [-1, 1]) {
      p(G.box, "#6b4630", s * 0.15, 0.66, 0.35, 0.06, 0.2, 0.12, 0, 0, s * 0.3);
      p(G.sphere, "#222222", s * 0.08, 0.7, 0.52, 0.035, 0.035, 0.03);
      for (const z of [-0.22, 0.22]) p(G.cyl6, coat, s * 0.12, 0.14, z, 0.09, 0.28, 0.09);
    }
    p(G.cyl6, coat, 0, 0.6, -0.42, 0.06, 0.3, 0.06, 0, -0.6);
  },
  cat({ p }, r) {
    const fur = pick(["#e09a4a", "#8a8580", "#3a332d"], r);
    p(G.ico, fur, 0, 0.25, 0, 0.3, 0.28, 0.55);
    p(G.sphere, fur, 0, 0.45, 0.26, 0.26, 0.24, 0.24);
    p(G.sphere, "#f6f1e6", 0, 0.3, 0.22, 0.16, 0.16, 0.1);
    p(G.cyl6, fur, 0, 0.45, -0.3, 0.05, 0.45, 0.05, 0, -0.3);
    for (const s of [-1, 1]) {
      p(G.cone6, fur, s * 0.08, 0.6, 0.26, 0.08, 0.12, 0.06);
      p(G.sphere, "#5c9e5a", s * 0.06, 0.47, 0.37, 0.04, 0.04, 0.02);
      for (const z of [-0.15, 0.15]) p(G.cyl6, fur, s * 0.08, 0.06, z, 0.06, 0.14, 0.06);
    }
  },
  rabbit({ p }, r) {
    const fur = pick(["#f0ebe2", "#b8a48c", "#8a8580"], r);
    p(G.sphere, fur, 0, 0.2, 0, 0.34, 0.32, 0.42);
    p(G.sphere, fur, 0, 0.36, 0.2, 0.24, 0.24, 0.24);
    p(G.sphere, "#ffffff", 0, 0.24, -0.22, 0.12, 0.12, 0.12);
    p(G.sphere, "#e8958f", 0, 0.36, 0.33, 0.04, 0.03, 0.03);
    for (const s of [-1, 1]) {
      p(G.sphere, fur, s * 0.06, 0.58, 0.16, 0.07, 0.26, 0.05, 0, -0.15);
      p(G.sphere, "#f0b4b0", s * 0.06, 0.58, 0.185, 0.035, 0.2, 0.01, 0, -0.15);
      p(G.sphere, "#222222", s * 0.08, 0.4, 0.29, 0.03, 0.03, 0.02);
      p(G.sphere, fur, s * 0.1, 0.05, 0.12, 0.08, 0.06, 0.14);
    }
  },
  /* ───── countryside pieces (GAME-004) ───── */
  bakery({ p, w }) {
    const wall = "#f0d8c3", roof = "#9c4a41", eave = 1.84, rh = 0.75, hw = 1.14, ang = Math.atan2(rh, hw);
    p(G.box, STONE_DARK, 0, 0.12, 0, 2.6, 0.24, 2.0);
    p(G.box, wall, 0, 0.24 + 0.8, 0, 2.4, 1.6, 1.8);
    p(G.prism, shade(wall, -0.03), 0, eave, 0, 1.8, rh, 2.4, HALF);
    for (const s of [-1, 1]) p(G.box, roof, 0, eave + rh / 2, (s * hw) / 2, 2.8, 0.12, Math.hypot(rh, hw) + 0.06, 0, s * ang);
    p(G.box, "#a8836a", 0.7, 2.45, -0.35, 0.34, 0.95, 0.34);
    p(G.box, "#6b4f3a", -0.6, 0.69, 0.91, 0.55, 0.9, 0.06);
    p(G.box, WOOD_LIGHT, -0.6, 1.36, 0.94, 0.7, 0.24, 0.04);
    p(G.ico0, "#d9a45a", -0.6, 1.36, 0.97, 0.32, 0.12, 0.06);
    p(G.box, TRIM, 0.45, 1.0, 0.905, 0.95, 0.7, 0.04);
    w(G.box, 0.45, 1.0, 0.93, 0.8, 0.55, 0.03);
    for (let k = 0; k < 5; k += 1) p(G.box, k % 2 ? TRIM : RED, 0.05 + k * 0.2, 1.5, 1.12, 0.2, 0.04, 0.5, 0, 0.5);
    p(G.box, WOOD_MID, 0.45, 0.6, 1.02, 1.0, 0.06, 0.22);
    for (const x of [0.15, 0.45, 0.75]) p(G.ico0, "#d9a45a", x, 0.67, 1.02, 0.24, 0.1, 0.13);
  },
  pagoda({ p }) {
    const red = "#a8443a", wall = "#efdcae", roof = "#5f5650";
    p(G.box, STONE, 0, 0.15, 0, 2.6, 0.3, 2.6);
    p(G.box, STONE_DARK, 0, 0.08, 1.45, 1.0, 0.16, 0.4);
    p(G.box, wall, 0, 0.9, 0, 1.7, 1.2, 1.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.cyl8, red, sx * 1.0, 0.9, sz * 1.0, 0.14, 1.2, 0.14);
    p(G.box, red, 0, 0.75, 0.86, 0.6, 0.9, 0.04);
    p(pyramid, roof, 0, 1.85, 0, 3.4, 0.7, 3.4);
    p(G.box, wall, 0, 2.2, 0, 1.0, 0.6, 1.0);
    p(pyramid, roof, 0, 2.8, 0, 2.2, 0.6, 2.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(G.cone6, roof, sx * 1.18, 1.62, sz * 1.18, 0.1, 0.32, 0.1);
      p(G.cone6, roof, sx * 0.76, 2.6, sz * 0.76, 0.08, 0.26, 0.08);
    }
    p(G.sphere, GOLD, 0, 3.15, 0, 0.16, 0.16, 0.16);
    p(G.cyl6, GOLD, 0, 3.3, 0, 0.06, 0.4, 0.06);
    p(G.box, WOOD, 0.8, 1.42, 1.05, 0.03, 0.2, 0.03);
    p(G.taper, "#b08a3a", 0.8, 1.2, 1.05, 0.22, 0.26, 0.22);
  },
  hut({ p }) {
    p(G.cyl12, "#bfa47a", 0, 0.55, 0, 1.6, 1.1, 1.6);
    p(G.cone8, "#d9bb5c", 0, 1.65, 0, 2.3, 1.1, 2.3);
    p(G.cone8, "#c9a24a", 0, 2.1, 0, 0.6, 0.35, 0.6);
    p(G.box, "#6b4f3a", 0, 0.5, 0.79, 0.5, 0.85, 0.06);
    p(G.box, "#3a4a55", Math.sin(-0.75) * 0.79, 0.75, Math.cos(-0.75) * 0.79, 0.3, 0.28, 0.04, -0.75);
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2;
      p(G.box, "#c9a24a", Math.sin(a) * 1.08, 1.1, Math.cos(a) * 1.08, 0.08, 0.16, 0.03, a);
    }
  },
  treehouse({ p }) {
    p(G.cyl8, "#7a5a3e", 0, 1.3, 0, 0.45, 2.6, 0.45);
    p(G.ico, "#5f9445", 0, 3.4, -0.1, 2.4, 1.6, 2.4);
    p(G.ico, "#72a653", 0.6, 3.8, 0.2, 1.4, 1.1, 1.4);
    p(G.box, WOOD_MID, 0, 1.75, 0, 1.6, 0.1, 1.6);
    p(G.box, WOOD_LIGHT, 0, 2.25, 0, 1.1, 0.9, 1.0);
    p(G.prism, "#9c4a41", 0, 2.7, 0, 1.3, 0.5, 1.3, HALF);
    p(G.box, "#3a4a55", 0, 2.3, 0.51, 0.35, 0.3, 0.03);
    for (const x of [-0.7, 0, 0.7]) p(G.box, WOOD, x, 1.95, 0.78, 0.05, 0.3, 0.05);
    p(G.box, WOOD_MID, 0, 2.08, 0.78, 1.5, 0.05, 0.05);
    for (const x of [0.45, 0.75]) p(G.box, WOOD, x, 0.88, 1.0, 0.05, 1.8, 0.05, 0, -0.25);
    for (let k = 0; k < 6; k += 1) {
      const t = (k + 0.5) / 6;
      p(G.box, WOOD_LIGHT, 0.6, 0.88 + (t - 0.5) * 1.744, 1.0 - (t - 0.5) * 0.446, 0.34, 0.04, 0.05);
    }
  },
  castle({ p, w }) {
    // Walls round a courtyard, four corner turrets, a keep at the back, a gatehouse at the front (+Z).
    const stone = "#d3c9b6", cap = "#ddd5c4", roof = "#5f6f92", B = 0.2, H = 1.7, T = 0.45, E = 2.0;
    p(G.box, STONE_DARK, 0, B / 2, 0, 4.9, B, 4.9);
    p(G.box, "#b9a47a", 0, B + 0.01, 0, 3.6, 0.02, 3.6);
    const wall = (x: number, z: number, lx: number, lz: number) => {
      p(G.box, stone, x, B + H / 2, z, lx, H, lz);
      p(G.box, cap, x, B + H + 0.05, z, lx + 0.08, 0.1, lz + 0.08);
      const along = lx > lz, len = Math.max(lx, lz), n = Math.max(1, Math.round(len));
      for (let k = 0; k < n; k += 1) {
        const o = -len / 2 + (len / n) * (k + 0.5);
        p(G.box, cap, along ? x + o : x, B + H + 0.27, along ? z : z + o, along ? 0.32 : T * 0.85, 0.34, along ? T * 0.85 : 0.32);
      }
    };
    wall(0, -E, 2 * E, T);
    for (const s of [-1, 1]) {
      wall(s * E, 0, T, 2 * E);
      wall(s * 1.4, E, 1.2, T);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(G.cyl12, stone, sx * E, B + 1.35, sz * E, 1.2, 2.7, 1.2);
      p(G.cyl12, cap, sx * E, B + 2.75, sz * E, 1.4, 0.12, 1.4);
      p(G.cone8, roof, sx * E, B + 3.35, sz * E, 1.5, 1.1, 1.5);
      p(G.sphere, GOLD, sx * E, B + 3.95, sz * E, 0.14, 0.14, 0.14);
      w(G.box, sx * E, B + 1.9, sz * E + 0.61, 0.16, 0.34, 0.04);
    }
    // Gatehouse with an arch, a portcullis and the drawbridge let down.
    for (const s of [-1, 1]) {
      p(G.box, stone, s * 0.75, B + 1.15, E, 0.5, 2.3, 0.75);
      for (const z of [-0.18, 0.18]) p(G.box, cap, s * 0.75, B + 2.45, E + z, 0.5, 0.3, 0.26);
    }
    p(G.box, stone, 0, B + 1.85, E, 1.0, 0.9, 0.7);
    p(G.arch, "#b9ad97", 0, B + 1.0, E + 0.05, 0.5, 0.42, 2.9);
    p(G.box, "#4f3f33", 0, B + 0.55, E + 0.02, 0.9, 1.05, 0.05);
    for (let k = 0; k < 4; k += 1) p(G.box, "#3a332d", -0.33 + k * 0.22, B + 0.55, E + 0.06, 0.04, 1.05, 0.03);
    p(G.box, "#8a6644", 0, 0.1, E + 0.95, 1.0, 0.08, 1.3);
    for (const s of [-1, 1]) p(G.box, DARK, s * 0.48, B + 0.65, E + 0.55, 0.02, 1.1, 0.02, 0, 0.7);
    // The keep: a tall square tower with its own battlements and a banner.
    p(G.box, stone, 0, B + 1.7, -0.7, 1.8, 3.4, 1.6);
    p(G.box, cap, 0, B + 3.45, -0.7, 1.9, 0.1, 1.7);
    for (let k = 0; k < 4; k += 1) for (const s of [-1, 1]) {
      p(G.box, cap, -0.68 + k * 0.45, B + 3.67, -0.7 + s * 0.72, 0.28, 0.34, 0.2);
      p(G.box, cap, s * 0.82, B + 3.67, -1.38 + k * 0.45, 0.2, 0.34, 0.28);
    }
    p(G.box, "#6b4f3a", 0, B + 0.45, 0.11, 0.5, 0.9, 0.04);
    for (const x of [-0.45, 0.45]) w(G.box, x, B + 2.4, 0.12, 0.22, 0.42, 0.04);
    w(G.box, 0, B + 2.9, 0.12, 0.22, 0.42, 0.04);
    p(G.cyl6, "#e8e2d4", 0, B + 4.4, -0.7, 0.05, 1.5, 0.05);
    p(G.box, RED, 0.32, B + 4.85, -0.7, 0.6, 0.38, 0.03);
    p(G.box, GOLD, 0.32, B + 4.85, -0.69, 0.18, 0.18, 0.035, 0, 0, Math.PI / 4);
  },
  bamboo({ p }, r) {
    for (let k = 0; k < 6; k += 1) {
      const a = k * 1.1 + r() * 0.5, d = 0.08 + r() * 0.22, h = 1.7 + r() * 1.0, x = Math.sin(a) * d, z = Math.cos(a) * d;
      p(G.cyl6, k % 2 ? "#7ea456" : "#8cbc5c", x, h / 2, z, 0.08, h, 0.08);
      for (let j = 1; j < 4; j += 1) p(G.cyl6, "#5d8240", x, (j * h) / 4, z, 0.1, 0.03, 0.1);
      p(G.ico0, LEAF, x + 0.14, h * 0.86, z, 0.4, 0.07, 0.15, a, 0, 0.3);
      p(G.ico0, "#5f9445", x - 0.12, h * 0.7, z, 0.34, 0.06, 0.14, a + 1.2, 0, -0.3);
    }
  },
  palm({ p }) {
    for (let k = 0; k < 6; k += 1) p(G.cyl8, k % 2 ? "#9a7a55" : "#8a6a48", k * 0.05, 0.27 + k * 0.5, 0, 0.27 - k * 0.015, 0.54, 0.27 - k * 0.015, 0, 0, -0.08);
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2;
      p(G.box, k % 2 ? "#5f9445" : "#6fa552", 0.3 + Math.sin(a) * 0.65, 3.0, Math.cos(a) * 0.65, 0.24, 0.04, 1.4, a, 0.35);
    }
    for (let k = 0; k < 3; k += 1) p(G.sphere, "#6b4a2a", 0.3 + Math.sin(k * 2.1) * 0.13, 2.86, Math.cos(k * 2.1) * 0.13, 0.18, 0.2, 0.18);
  },
  fern({ p }) {
    p(G.ico0, "#3f7a4a", 0, 0.1, 0, 0.3, 0.2, 0.3);
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      p(G.box, k % 2 ? "#4f8a3f" : "#5f9445", Math.sin(a) * 0.28, 0.22, Math.cos(a) * 0.28, 0.15, 0.03, 0.62, a, -0.55);
    }
  },
  cactus({ p }) {
    const c = "#5d8a4a";
    p(G.cyl12, "#d9bb8a", 0, 0.03, 0, 0.7, 0.06, 0.7);
    p(G.cyl8, c, 0, 0.55, 0, 0.36, 1.1, 0.36);
    p(G.sphere, c, 0, 1.1, 0, 0.36, 0.3, 0.36);
    for (const [s, y, h] of [[1, 0.5, 0.45], [-1, 0.38, 0.32]]) {
      p(G.cyl8, c, s * 0.24, y, 0, 0.16, 0.3, 0.16, 0, 0, HALF);
      p(G.cyl8, c, s * 0.38, y + h / 2, 0, 0.16, h, 0.16);
      p(G.sphere, c, s * 0.38, y + h, 0, 0.16, 0.14, 0.16);
    }
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      p(G.box, "#f6f1e6", Math.sin(a) * 0.185, 0.3 + (k % 4) * 0.2, Math.cos(a) * 0.185, 0.02, 0.02, 0.06, a);
    }
    p(G.ico0, "#e57f9e", 0, 1.27, 0, 0.16, 0.1, 0.16);
  },
  pier({ p }) {
    // A walkway from the bank (z ≈ 0) out over the water (+Z).
    for (let k = 0; k < 9; k += 1) p(G.box, shade(WOOD_LIGHT, ((k % 3) - 1) * 0.04), 0, 0.22, -0.4 + k * 0.32, 0.9, 0.06, 0.28);
    for (const z of [-0.3, 0.9, 2.1]) for (const s of [-1, 1]) p(G.cyl8, WOOD, s * 0.42, 0.05, z, 0.12, 0.6, 0.12);
    p(G.torus, "#c9a77a", 0.42, 0.3, 2.1, 0.16, 0.16, 0.4, 0, HALF);
    p(G.box, "#c9a77a", 0.48, 0.18, 2.2, 0.02, 0.24, 0.02, 0, 0.4);
  },
  lotus({ p }) {
    for (const [x, z, s] of [[0, 0, 1], [0.32, 0.18, 0.7], [-0.28, 0.22, 0.6], [0.05, -0.34, 0.55]]) p(G.cyl12, "#6e9d4a", x, 0.09, z, 0.5 * s, 0.02, 0.5 * s);
    p(G.cone8, "#f2b5c9", 0, 0.2, 0, 0.28, 0.2, 0.28, 0, Math.PI);
    p(G.ico0, "#f7d3de", 0, 0.24, 0, 0.18, 0.14, 0.18);
    p(G.cyl8, "#f2c94c", 0, 0.29, 0, 0.08, 0.03, 0.08);
    p(G.cyl6, "#5d8240", -0.28, 0.2, 0.22, 0.03, 0.22, 0.03);
    p(G.ico0, "#e88aa8", -0.28, 0.34, 0.22, 0.09, 0.14, 0.09);
  },
  raft({ p }) {
    for (let k = 0; k < 6; k += 1) p(G.cyl8, k % 2 ? "#c9b06a" : "#b89a55", -0.5 + k * 0.2, 0.1, 0, 0.19, 1.3, 0.19, 0, HALF);
    for (const z of [-0.45, 0.45]) p(G.box, "#8a6644", 0, 0.2, z, 1.25, 0.04, 0.08);
    p(G.cyl6, WOOD, 0.35, 0.8, -0.2, 0.05, 1.4, 0.05, 0, 0.2);
  },
  kite({ p }, r) {
    const c = pick([RED, BLUE, GOLD, "#8a5c9e"], r);
    p(G.box, WOOD, 0, 0.25, 0, 0.06, 0.5, 0.06);
    p(G.box, "#f6f1e6", 0, 2.25, 0.6, 0.015, 3.7, 0.015, 0, 0.33);
    p(G.box, c, 0, 4.1, 1.25, 0.6, 0.6, 0.03, 0, 0, Math.PI / 4);
    p(G.box, WOOD_LIGHT, 0, 4.1, 1.27, 0.02, 0.85, 0.02);
    p(G.box, WOOD_LIGHT, 0, 4.1, 1.27, 0.85, 0.02, 0.02);
    p(G.box, "#f6f1e6", 0, 3.33, 1.22, 0.01, 0.7, 0.01);
    for (let k = 0; k < 4; k += 1) p(G.box, k % 2 ? GOLD : RED, 0, 3.55 - k * 0.2, 1.22, 0.12, 0.06, 0.03, 0, 0, k * 0.5);
  },
  bicycle({ p }) {
    for (const z of [-0.42, 0.42]) {
      p(G.torus, DARK, 0, 0.3, z, 0.56, 0.56, 0.5, HALF);
      p(G.cyl8, "#9aa3a8", 0, 0.3, z, 0.06, 0.1, 0.06, 0, 0, HALF);
    }
    p(G.box, RED, 0, 0.55, 0.05, 0.04, 0.04, 0.62);
    p(G.box, RED, 0, 0.44, -0.18, 0.04, 0.4, 0.04, 0, -0.45);
    p(G.box, RED, 0, 0.44, 0.38, 0.04, 0.34, 0.04, 0, -0.2);
    p(G.box, RED, 0, 0.32, -0.21, 0.04, 0.04, 0.42);
    p(G.box, DARK, 0, 0.66, -0.24, 0.1, 0.04, 0.2);
    p(G.box, RED, 0, 0.66, 0.36, 0.03, 0.18, 0.03);
    p(G.box, DARK, 0, 0.75, 0.36, 0.46, 0.04, 0.04);
    p(G.box, "#c9a77a", 0, 0.66, 0.52, 0.26, 0.16, 0.2);
    p(G.ico0, "#e57f9e", 0.05, 0.76, 0.52, 0.12, 0.08, 0.12);
    for (const s of [-1, 1]) p(G.box, DARK, s * 0.08, 0.3 + s * 0.06, 0.02, 0.06, 0.02, 0.1);
  },
  umbrella({ p }, r) {
    const c = pick([RED, BLUE, "#e3bf55", "#6c7f55"], r);
    p(G.cyl8, STONE_DARK, 0, 0.06, 0, 0.36, 0.12, 0.36);
    p(G.cyl6, "#e8e2d4", 0, 1.0, 0, 0.05, 2.0, 0.05);
    p(G.cone8, c, 0, 1.95, 0, 1.9, 0.4, 1.9);
    p(G.torus, TRIM, 0, 1.76, 0, 1.9, 1.9, 0.5, 0, HALF);
    p(G.sphere, TRIM, 0, 2.18, 0, 0.1, 0.1, 0.1);
  },
  table({ p }) {
    p(G.box, WOOD_LIGHT, 0, 0.72, 0, 1.4, 0.07, 0.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, WOOD, sx * 0.6, 0.36, sz * 0.32, 0.07, 0.72, 0.07);
    for (const s of [-1, 1]) {
      p(G.box, WOOD_MID, 0, 0.42, s * 0.68, 1.4, 0.06, 0.28);
      for (const sx of [-1, 1]) p(G.box, WOOD, sx * 0.6, 0.21, s * 0.68, 0.06, 0.42, 0.06);
      p(G.cyl8, "#f6f1e6", s * 0.35, 0.82, s * 0.2, 0.1, 0.12, 0.1);
    }
    p(G.cyl12, "#f6f1e6", 0, 0.765, 0, 0.32, 0.02, 0.32);
    p(G.ico0, "#d9a45a", 0, 0.8, 0, 0.22, 0.08, 0.12);
  },
  ladder({ p }) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, WOOD_MID, sx * 0.22, 0.8, sz * 0.22, 0.05, 1.65, 0.05, 0, -sz * 0.27);
    for (let k = 0; k < 5; k += 1) {
      const y = 0.25 + k * 0.3;
      p(G.box, WOOD_LIGHT, 0, y, 0.44 - (y / 1.6) * 0.44, 0.44, 0.04, 0.05);
    }
    p(G.box, WOOD, 0, 1.62, 0, 0.5, 0.06, 0.16);
  },
  wheelbarrow({ p }) {
    p(G.box, "#7a8f5a", 0, 0.45, 0, 0.6, 0.28, 0.8);
    p(G.box, "#4f5f3f", 0, 0.585, 0, 0.5, 0.02, 0.7);
    p(G.cyl12, DARK, 0, 0.18, 0.55, 0.36, 0.08, 0.36, 0, 0, HALF);
    for (const s of [-1, 1]) {
      p(G.box, WOOD, s * 0.22, 0.42, -0.6, 0.05, 0.05, 0.9, 0, 0.18);
      p(G.box, WOOD, s * 0.2, 0.15, -0.35, 0.04, 0.3, 0.04);
    }
    p(G.sphere, "#e88a2a", 0.1, 0.68, 0.05, 0.3, 0.26, 0.3);
    p(G.sphere, "#e88a2a", -0.12, 0.66, -0.18, 0.26, 0.22, 0.26);
  },
  seesaw({ p }) {
    p(G.box, BLUE, 0, 0.2, 0, 0.3, 0.4, 0.3);
    p(G.box, WOOD_LIGHT, 0, 0.42, 0, 0.3, 0.06, 2.4, 0, 0.18);
    for (const s of [-1, 1]) {
      const z = s * 1.0, y = 0.42 - s * 0.18;
      p(G.box, RED, 0, y + 0.05, z, 0.32, 0.04, 0.3, 0, 0.18);
      for (const sx of [-1, 1]) p(G.box, DARK, sx * 0.13, y + 0.14, z - s * 0.17, 0.03, 0.22, 0.03);
      p(G.box, DARK, 0, y + 0.25, z - s * 0.17, 0.3, 0.03, 0.03);
    }
  },
  slide({ p }) {
    p(G.box, BLUE, 0, 1.2, -0.5, 0.6, 0.08, 0.5);
    for (const sx of [-1, 1]) for (const z of [-0.74, -0.26]) p(G.box, "#9aa3a8", sx * 0.27, 0.6, z, 0.05, 1.2, 0.05);
    for (let k = 0; k < 4; k += 1) p(G.box, "#9aa3a8", 0, 0.25 + k * 0.27, -0.76, 0.5, 0.04, 0.04);
    p(G.box, "#e3bf55", 0, 0.68, 0.45, 0.5, 0.04, 1.75, 0, 0.64);
    for (const s of [-1, 1]) {
      p(G.box, "#d9a441", s * 0.26, 0.74, 0.45, 0.04, 0.14, 1.75, 0, 0.64);
      p(G.box, "#9aa3a8", s * 0.28, 1.48, -0.5, 0.04, 0.04, 0.5);
    }
  },
  snowman({ p }) {
    const snow = "#f6f8fb";
    p(G.cyl12, "#eef2f6", 0, 0.01, 0, 1.2, 0.02, 1.2);
    p(G.sphere, snow, 0, 0.38, 0, 0.8, 0.72, 0.8);
    p(G.sphere, snow, 0, 0.98, 0, 0.58, 0.54, 0.58);
    p(G.sphere, snow, 0, 1.45, 0, 0.42, 0.42, 0.42);
    for (const s of [-1, 1]) {
      p(G.sphere, DARK, s * 0.08, 1.5, 0.19, 0.05, 0.05, 0.03);
      p(G.box, "#6b4f3a", s * 0.42, 1.08, 0, 0.42, 0.03, 0.03, 0, 0, -s * 0.5);
    }
    p(G.cone6, "#e88a2a", 0, 1.45, 0.3, 0.07, 0.22, 0.07, 0, HALF);
    p(G.cyl12, DARK, 0, 1.68, 0, 0.42, 0.04, 0.42);
    p(G.cyl12, DARK, 0, 1.82, 0, 0.28, 0.26, 0.28);
    p(G.torus, RED, 0, 1.24, 0, 0.5, 0.5, 0.9, 0, HALF);
    p(G.box, RED, 0.12, 1.08, 0.2, 0.08, 0.28, 0.03);
    for (const [y, z] of [[0.86, 0.26], [0.98, 0.29], [1.1, 0.26]]) p(G.sphere, DARK, 0, y, z, 0.05, 0.05, 0.03);
  },
  birdhouse({ p }) {
    p(G.box, WOOD, 0, 0.7, 0, 0.08, 1.4, 0.08);
    p(G.box, "#c9a77a", 0, 1.55, 0, 0.32, 0.34, 0.3);
    p(G.prism, RED, 0, 1.72, 0, 0.42, 0.2, 0.38);
    p(G.cyl12, DARK, 0, 1.58, 0.151, 0.1, 0.01, 0.1, 0, HALF);
    p(G.cyl6, WOOD, 0, 1.47, 0.2, 0.02, 0.1, 0.02, 0, HALF);
    p(G.sphere, "#4a7fb0", 0.05, 1.88, 0.03, 0.12, 0.1, 0.14);
    p(G.sphere, "#4a7fb0", 0.05, 1.95, 0.1, 0.08, 0.08, 0.08);
    p(G.cone6, "#f2a53a", 0.05, 1.95, 0.16, 0.03, 0.05, 0.03, 0, HALF);
  },
  lamppost({ p, w, halo }) {
    const iron = "#3f4a52";
    p(G.cyl8, DARK, 0, 0.1, 0, 0.3, 0.2, 0.3);
    p(G.cyl8, iron, 0, 1.2, 0, 0.09, 2.2, 0.09);
    p(G.box, iron, 0, 2.32, 0, 0.32, 0.04, 0.32);
    w(G.box, 0, 2.48, 0, 0.24, 0.28, 0.24);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(G.box, iron, sx * 0.13, 2.48, sz * 0.13, 0.03, 0.3, 0.03);
    p(G.cone6, iron, 0, 2.72, 0, 0.42, 0.22, 0.42);
    p(G.sphere, iron, 0, 2.86, 0, 0.08, 0.08, 0.08);
    halo(0, 2.48, 0);
  },
  buffalo({ p }) {
    const hide = "#4a4a50", horn = "#d8d0bc";
    p(G.ico, hide, 0, 0.75, 0, 0.8, 0.62, 1.3);
    p(G.box, hide, 0, 0.85, 0.72, 0.4, 0.38, 0.42);
    p(G.box, "#3a3a40", 0, 0.76, 0.95, 0.32, 0.22, 0.12);
    for (const s of [-1, 1]) {
      p(G.box, horn, s * 0.32, 1.04, 0.66, 0.36, 0.06, 0.08, 0, 0, s * 0.25);
      p(G.box, horn, s * 0.5, 1.15, 0.6, 0.06, 0.2, 0.06, 0, 0, -s * 0.3);
      p(G.box, hide, s * 0.25, 0.92, 0.68, 0.14, 0.05, 0.08);
      p(G.sphere, "#222222", s * 0.15, 0.92, 0.92, 0.04, 0.04, 0.03);
      for (const z of [-0.38, 0.38]) {
        p(G.cyl6, hide, s * 0.24, 0.24, z, 0.15, 0.46, 0.15);
        p(G.cyl6, "#2a2a2e", s * 0.24, 0.03, z, 0.16, 0.06, 0.16);
      }
    }
    p(G.box, hide, 0, 0.72, -0.68, 0.04, 0.45, 0.04, 0, 0.2);
  },
  goat({ p }, r) {
    const coat = pick(["#f0ebe2", "#c9a27a", "#8a8580"], r);
    p(G.ico, coat, 0, 0.55, 0, 0.42, 0.4, 0.75);
    p(G.box, coat, 0, 0.72, 0.38, 0.2, 0.26, 0.3, 0, -0.3);
    p(G.cone6, "#d8d0bc", 0, 0.52, 0.52, 0.06, 0.14, 0.06, 0, Math.PI);
    for (const s of [-1, 1]) {
      p(G.cone6, "#8a7a5a", s * 0.06, 0.92, 0.32, 0.05, 0.22, 0.05, 0, -0.5);
      p(G.box, coat, s * 0.14, 0.78, 0.35, 0.12, 0.04, 0.06, 0, 0, s * 0.4);
      p(G.sphere, "#222222", s * 0.08, 0.8, 0.5, 0.03, 0.03, 0.02);
      for (const z of [-0.2, 0.2]) {
        p(G.cyl6, coat, s * 0.12, 0.18, z, 0.07, 0.36, 0.07);
        p(G.cyl6, DARK, s * 0.12, 0.02, z, 0.08, 0.04, 0.08);
      }
    }
    p(G.cone6, coat, 0, 0.66, -0.38, 0.06, 0.14, 0.06, 0, -0.8);
  },
  goose({ p }) {
    const white = "#f7f4ee", orange = "#f2a53a";
    p(G.ico, white, 0, 0.3, 0, 0.42, 0.34, 0.6);
    p(G.cyl6, white, 0, 0.55, 0.22, 0.1, 0.42, 0.1, 0, 0.3);
    p(G.sphere, white, 0, 0.78, 0.3, 0.16, 0.15, 0.2);
    p(G.cone6, orange, 0, 0.76, 0.44, 0.06, 0.14, 0.06, 0, HALF);
    p(G.cone6, white, 0, 0.36, -0.32, 0.12, 0.2, 0.12, 0, -1.0);
    for (const s of [-1, 1]) {
      p(G.sphere, "#222222", s * 0.06, 0.81, 0.35, 0.03, 0.03, 0.02);
      p(G.ico0, "#ece8e0", s * 0.18, 0.34, -0.03, 0.12, 0.2, 0.42);
      p(G.cyl6, orange, s * 0.07, 0.08, 0, 0.03, 0.14, 0.03);
      p(G.box, orange, s * 0.07, 0.01, 0.05, 0.08, 0.02, 0.1);
    }
  },
  fish({ p }, r) {
    const c = pick(["#e8823a", "#d9a441", "#8aa7b8", "#c9534a"], r), k = 1.6;
    const q = (g: THREE.BufferGeometry, col: THREE.ColorRepresentation, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
      p(g, col, x * k, y * k, z * k, sx * k, sy * k, sz * k, ry, rx, rz);
    q(G.sphere, c, 0, 0.06, 0, 0.12, 0.12, 0.3);
    q(G.sphere, "#f6efe2", 0, 0.045, 0.01, 0.1, 0.07, 0.24);
    q(G.cone6, shade(c, -0.06), 0, 0.06, -0.2, 0.03, 0.14, 0.16, 0, HALF);
    q(G.box, shade(c, -0.1), 0, 0.125, -0.02, 0.015, 0.06, 0.1, 0, -0.4);
    for (const s of [-1, 1]) {
      q(G.sphere, "#222222", s * 0.045, 0.08, 0.1, 0.025, 0.025, 0.02);
      q(G.box, shade(c, -0.06), s * 0.06, 0.04, 0.03, 0.06, 0.012, 0.05, 0, 0, s * 0.5);
    }
  },
  frog({ p }, r) {
    const skin = pick(["#6aa84f", "#5d8a3a", "#7cbc5c"], r);
    p(G.sphere, skin, 0, 0.12, 0, 0.3, 0.2, 0.34);
    p(G.sphere, "#cfe3a8", 0, 0.08, 0.06, 0.24, 0.12, 0.26);
    p(G.box, "#3f6a3a", 0, 0.12, 0.165, 0.14, 0.01, 0.01);
    for (const s of [-1, 1]) {
      p(G.sphere, skin, s * 0.08, 0.22, 0.1, 0.1, 0.1, 0.1);
      p(G.sphere, "#222222", s * 0.09, 0.24, 0.14, 0.05, 0.05, 0.03);
      p(G.sphere, skin, s * 0.14, 0.07, -0.08, 0.12, 0.1, 0.2);
      p(G.box, skin, s * 0.15, 0.01, 0.02, 0.1, 0.02, 0.08);
      p(G.cyl6, skin, s * 0.09, 0.05, 0.12, 0.04, 0.1, 0.04);
    }
  },
};

type Anchor = [PartId, number, number, number];
/**
 * Where the Look tool puts part labels on each piece, in the model's own frame (front +Z).
 * Animals and people are labelled in their mesh frame, so labels follow them as they move.
 */
export const PROP_MARKS: Partial<Record<PropKind | "sheep", Anchor[]>> = {
  barn: [["roof", 0.9, 2.7, 0.4], ["door", 0, 0.9, 1.6], ["window", 0, 2.2, 1.56], ["straw", 0.85, 0.6, 1.9]],
  chapel: [["roof", -0.75, 2.6, -0.6], ["bell", 0, 3.3, 1.6], ["spire", 0, 4.6, 1.15], ["door", 0, 0.8, 1.55], ["window", 0.95, 1.15, -0.9]],
  stall: [["awning", 0, 1.75, 0.2], ["counter", -0.7, 0.92, 0.75], ["apple", 0.55, 1.2, 0.45], ["pole", 0.88, 0.55, 0.68]],
  tent: [["door", 0, 0.45, 1.13], ["pole", 0, 1.55, 1.16], ["rope", 1.05, 0.35, 0.6]],
  lighthouse: [["lamp", 0, 4.5, 0.5], ["roof", 0, 5.3, 0], ["railing", 0.78, 4.25, 0.1], ["window", 0, 2.2, 0.8], ["door", 0, 0.8, 0.95]],
  gazebo: [["roof", 0.8, 2.6, 0.4], ["pillar", 0.94, 1.2, -0.54], ["seat", 0, 0.5, -0.55], ["railing", -0.94, 0.65, -0.1]],
  bush: [["leaf", -0.2, 0.62, -0.1], ["berry", 0.3, 0.5, 0.28]],
  flower: [["petal", 0, 0.38, 0], ["stem", 0.12, 0.15, 0.05], ["leaf", 0.05, 0.06, 0.15]],
  blossom: [["petal", 0, 2.1, 0.3], ["branch", 0.2, 1.2, 0.08], ["trunk", 0, 0.45, 0.12]],
  sunflower: [["petal", 0, 1.45, 0.1], ["stem", 0, 0.6, 0.03], ["leaf", 0.15, 0.6, 0]],
  mushroom: [["cap", 0, 0.55, 0], ["stem", 0.06, 0.15, 0.07]],
  rock: [["stone", 0.3, 0.35, 0.2], ["moss", -0.1, 0.56, 0.05]],
  log: [["trunk", 0.4, 0.3, 0.2], ["moss", 0.2, 0.47, 0.05], ["cap", -0.3, 0.45, 0.14]],
  stump: [["trunk", 0, 0.42, 0], ["root", 0, 0.08, 0.4]],
  garden: [["soil", 1.0, 0.13, 0.3], ["leaf", -0.45, 0.32, 0], ["post", 1.22, 0.2, 0.9]],
  pumpkin: [["stem", 0, 0.62, 0], ["leaf", 0.12, 0.57, 0.06]],
  haystack: [["straw", 0, 1.1, 0], ["pole", 0.75, 1.15, 0.3]],
  fountain: [["basin", 0, 0.55, 1.15], ["spout", 0, 1.8, 0], ["pillar", 0, 0.9, 0.18]],
  boat: [["oar", 0.62, 0.42, 0.3], ["seat", 0, 0.4, -0.4]],
  bench: [["seat", 0.3, 0.46, 0.12], ["backrest", -0.3, 0.84, -0.2]],
  signpost: [["sign", 0.4, 1.34, 0.03], ["post", 0, 0.5, 0.05]],
  cart: [["wheel", 0.62, 0.4, -0.15], ["handle", 0.32, 0.55, 1.5], ["apple", 0, 1.0, 0]],
  barrel: [["lid", 0, 0.74, 0]],
  crate: [["plank", 0, 0.3, 0.32]],
  flag: [["pole", 0, 1.2, 0.04]],
  statue: [["pedestal", 0, 0.5, 0.42], ["book", 0.3, 2.32, 0.24]],
  scarecrow: [["hat", 0, 2.05, 0], ["straw", 0.7, 1.36, 0], ["post", 0, 0.45, 0.06]],
  swing: [["seat", 0, 0.62, 0.15], ["rope", 0.26, 1.25, 0], ["post", -0.88, 1.0, 0.22]],
  campfire: [["flame", 0, 0.7, 0], ["stone", 0.48, 0.12, 0], ["seat", 0, 0.3, 1.0]],
  beehive: [["bee", 0.38, 0.95, 0.22], ["door", 0, 0.42, 0.36]],
  woodpile: [["axe", 0.72, 0.68, 0.32]],
  mailbox: [["door", 0, 1.1, 0.25], ["post", 0, 0.5, 0.05]],
  sheep: [["wool", 0, 0.98, -0.1], ["ear", 0.26, 0.8, 0.52], ["hoof", 0.2, 0.02, 0.22]],
  chicken: [["beak", 0, 0.5, 0.33], ["wing", 0.19, 0.3, 0], ["tail", 0, 0.5, -0.28]],
  duck: [["beak", 0, 0.42, 0.4], ["wing", 0.19, 0.25, 0], ["tail", 0, 0.34, -0.32]],
  cow: [["horn", 0.15, 1.18, 0.66], ["ear", 0.33, 0.98, 0.66], ["tail", 0, 0.62, -0.68], ["hoof", 0.22, 0.04, 0.36]],
  horse: [["mane", 0, 1.45, 0.48], ["ear", 0.08, 1.8, 0.76], ["tail", 0, 0.8, -0.72], ["hoof", 0.2, 0.04, 0.42]],
  pig: [["snout", 0, 0.42, 0.68], ["ear", 0.13, 0.72, 0.42], ["tail", 0, 0.47, -0.48]],
  dog: [["snout", 0, 0.6, 0.62], ["ear", 0.18, 0.66, 0.35], ["collar", 0, 0.52, 0.32], ["tail", 0, 0.66, -0.48]],
  cat: [["ear", 0.08, 0.66, 0.26], ["whisker", 0.1, 0.42, 0.37], ["tail", 0, 0.6, -0.36]],
  rabbit: [["ear", 0.06, 0.74, 0.16], ["tail", 0, 0.24, -0.27]],
  bakery: [["roof", -0.8, 2.3, 0.55], ["chimney", 0.7, 3.0, -0.35], ["door", -0.6, 0.7, 0.96], ["window", 0.45, 0.85, 0.96], ["awning", 0.45, 1.62, 1.25], ["sign", -0.6, 1.4, 1.0]],
  pagoda: [["roof", 1.05, 1.85, 0.8], ["bell", 0.8, 1.15, 1.18], ["pillar", -1.0, 0.9, 1.08], ["step", 0, 0.18, 1.62], ["spire", 0, 3.4, 0]],
  hut: [["roof", 0.6, 1.55, 0.6], ["door", 0, 0.55, 0.84], ["window", -0.56, 0.78, 0.62], ["wall", 0.8, 0.45, 0.2], ["straw", 0, 2.15, 0.15]],
  treehouse: [["roof", 0, 2.85, 0.45], ["window", 0, 2.3, 0.55], ["trunk", 0.24, 0.8, 0.12], ["leaf", 1.0, 3.8, 0.5], ["rung", 0.6, 0.6, 1.15], ["railing", -0.7, 2.1, 0.8]],
  bamboo: [["stem", 0.12, 1.0, 0.1], ["leaf", 0.25, 1.9, 0.1]],
  palm: [["leaf", 1.0, 3.0, 0.3], ["coconut", 0.42, 2.85, 0.14], ["trunk", 0.12, 1.2, 0.13]],
  fern: [["leaf", 0.36, 0.42, 0.22], ["stem", 0, 0.12, 0.12]],
  cactus: [["thorn", 0.19, 0.7, 0.06], ["petal", 0, 1.34, 0], ["stem", -0.4, 0.6, 0]],
  pier: [["plank", 0, 0.3, 1.0], ["post", -0.42, 0.42, 2.1], ["rope", 0.5, 0.36, 2.15]],
  lotus: [["petal", 0, 0.32, 0], ["leaf", 0.38, 0.12, 0.2]],
  raft: [["rope", 0.5, 0.24, 0.45], ["pole", 0.38, 1.35, -0.08]],
  kite: [["string", 0.02, 1.6, 0.4], ["tail", 0.1, 3.3, 1.22]],
  bicycle: [["wheel", 0.04, 0.3, -0.72], ["seat", 0, 0.72, -0.26], ["handle", 0.24, 0.78, 0.36], ["pedal", 0.1, 0.24, 0.05], ["basket", 0, 0.8, 0.56]],
  umbrella: [["pole", 0.05, 0.9, 0.04]],
  table: [["leg", 0.6, 0.3, 0.36], ["cup", 0.35, 0.92, 0.2], ["seat", 0, 0.47, 0.76]],
  ladder: [["rung", 0.24, 0.85, 0.22]],
  wheelbarrow: [["wheel", 0.1, 0.2, 0.62], ["handle", 0.24, 0.5, -0.98]],
  seesaw: [["seat", 0, 0.32, 1.05], ["handle", 0.17, 0.88, -0.84], ["plank", 0.18, 0.45, 0.45]],
  slide: [["step", 0.27, 0.8, -0.8], ["railing", 0.3, 1.55, -0.5]],
  snowman: [["hat", 0, 1.92, 0], ["carrot", 0, 1.46, 0.42], ["scarf", 0.26, 1.24, 0.1], ["button", 0, 0.98, 0.31]],
  birdhouse: [["roof", 0.18, 1.74, 0.1], ["door", 0, 1.58, 0.17], ["post", 0, 0.6, 0.05], ["beak", 0.05, 1.96, 0.2]],
  lamppost: [["lamp", 0, 2.5, 0.16], ["post", 0, 1.0, 0.06]],
  buffalo: [["horn", 0.5, 1.22, 0.6], ["ear", 0.33, 0.95, 0.68], ["tail", 0, 0.58, -0.72], ["hoof", 0.24, 0.04, 0.38]],
  goat: [["horn", 0.08, 1.02, 0.28], ["beard", 0, 0.44, 0.54], ["hoof", 0.12, 0.02, 0.2], ["tail", 0, 0.72, -0.42]],
  goose: [["beak", 0, 0.78, 0.52], ["wing", 0.25, 0.36, 0], ["tail", 0, 0.42, -0.4]],
  frog: [["eye", 0.1, 0.3, 0.15], ["leg", 0.19, 0.08, -0.08]],
  fish: [["fin", 0, 0.27, -0.03], ["tail", 0, 0.13, -0.43], ["scale", 0.11, 0.11, 0]],
  castle: [["keep", 0.92, 2.6, -0.4], ["turret", 2.0, 3.3, 2.0], ["battlement", -1.2, 2.15, 2.1], ["gate", 0, 0.9, 2.12], ["drawbridge", 0, 0.32, 3.1], ["window", 0.45, 2.6, 0.18]],
};
