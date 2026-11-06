/**
 * Three.js view of the Learning Farm. It owns no game rules: it renders a GameState handed to
 * it, animates idle motion, and reports taps as SceneHit values. Loaded with a dynamic import
 * so three.js only downloads when the player enters the farm.
 *
 * Performance notes (see docs/LEARNING-FARM.md):
 * - Everything is built from small primitives, then "baked": all parts of an object are merged
 *   into one geometry with per-vertex colours and drawn with one shared material. The whole
 *   static island is two draw calls; each plot, animal, workshop or fish is one or two.
 * - A quality preset (quality.ts) sets pixel ratio, shadows, shading model and frame-rate cap.
 *   In automatic mode the scene measures real frame rates and steps down on slow devices.
 * - Optional GLB models (e.g. generated with Meshy, listed in /models/manifest.json) replace
 *   the built-in animals and truck when present; the game never depends on them.
 *
 * Hands-on work: in the fields and the orchard a press on a plot or tree starts a drag; every
 * plot or tree the pointer passes is reported (`drag: true` after the first), while the tool
 * follows the pointer. Effects (dirt, seeds, water, falling fruit…) come from comparing each new
 * GameState with the last, so buttons and drags look the same. At the river the scene reads the
 * fishing state every frame and writes the player's presses into the shared fishing input.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pondGeometry, waterMaterial as villageWater, waterUniforms } from "../village/graphics";
import { addWind, flowerGeometry, makePost, skyTexture, tuftGeometry, wind, type FarmPost } from "./look";
import {
  ANIMAL_MAP,
  FISH_MAP,
  MAX_DROPS,
  PLOT_COLUMNS,
  TREE_MAP,
  WILD_FISH_MAP,
  WORKSHOPS,
  WORKSHOP_MAP,
  cropStage,
  hashString,
  isFishMature,
  isRipe,
  isTreeRipe,
  levelFromXp,
  mulberry32,
  treeStage,
  type AnimalId,
  type CropId,
  type FishId,
  type FruitId,
  type GameState,
  type Plot,
  type PondFish,
  type PondTrash,
  type ProductId,
  type RanchAnimal,
  type RanchDrop,
  type TreeSpot,
  type WildCatch,
  type WorkshopId,
} from "./engine";
import { isNibbling, type FishingInput, type FishingState } from "./fishing";
import { QUALITY_PRESETS, type Quality } from "./quality";

export type FarmView = "farm" | "orchard" | "pond" | "river" | "ranch";
/** The tool in the player's hand; it decides the model that follows a drag. */
export type SceneTool = "hand" | "seed" | "water" | "weed" | "bug" | "fertilize" | "hoe" | "shovel" | "sapling";
/** Shared with the fishing panel: the scene draws `state` and writes presses into `input`. */
export interface FishingLink {
  state: { current: FishingState };
  input: { current: FishingInput & { castAt: [number, number] | null } };
}
export type SceneHit =
  | { kind: "plot"; index: number; drag?: boolean }
  | { kind: "tree"; index: number; drag?: boolean }
  | { kind: "river" }
  | { kind: "fish"; id: string }
  | { kind: "trash"; id: string }
  | { kind: "pond" }
  | { kind: "barn" }
  | { kind: "shop" }
  | { kind: "animal"; id: string }
  | { kind: "drop"; id: string }
  | { kind: "workshop"; id: WorkshopId }
  | { kind: "trough" }
  | { kind: "truck" };

export interface SceneOptions {
  quality: Quality;
  /** Measure frame rate and step quality down on slow devices. */
  adaptive: boolean;
  onHit: (hit: SceneHit) => void;
  onDowngrade?: (note: string) => void;
  fishing?: FishingLink;
}

export interface FarmSceneController {
  update(game: GameState): void;
  setView(view: FarmView): void;
  setSelectedPlot(index: number | null): void;
  setTool(tool: SceneTool): void;
  dispose(): void;
}

type ModelKey = AnimalId | "truck";
interface ModelEntry { url: string; height?: number; rotationY?: number }

const FARM_CENTER = new THREE.Vector3(-4.6, 0, 0.7);
const POND_CENTER = new THREE.Vector3(6.1, 0, 0.9);
const POND_RX = 3.7;
const POND_RZ = 2.8;
const WATER_Y = 0.27;
const PASTURE = { x: 0.8, z: 8.9, hx: 4, hz: 2.3 };
const ROAD_Z = 5.4;
const TRUCK_PARK_X = 3.1;
const ROAD_END_X = 15.2;
const TROUGH: [number, number] = [-2.2, 7.35];
const WORKSHOP_SPOTS: Record<WorkshopId, [number, number]> = {
  saltery: [6.9, 7.35],
  bakery: [9.25, 8.15],
  loom: [6.9, 9.95],
  dairy: [9.25, 10.75],
};
const PLOT_PITCH = 2.05;
const PLOT_SIZE = 1.74;
const CAMERA_OFFSET = new THREE.Vector3(1, 1.08, 1.3).normalize().multiplyScalar(40);
const VIEWS: Record<FarmView, { target: THREE.Vector3; width: number; height: number }> = {
  farm: { target: new THREE.Vector3(-4.1, 0, 0.3), width: 11.2, height: 10 },
  orchard: { target: new THREE.Vector3(-7.4, 0, 8.3), width: 9.4, height: 8.6 },
  pond: { target: new THREE.Vector3(5.9, 0, 0.7), width: 9.6, height: 8.4 },
  river: { target: new THREE.Vector3(12, 0, -0.9), width: 7.8, height: 7.6 },
  ranch: { target: new THREE.Vector3(2.4, 0, 9.1), width: 11.8, height: 9.4 },
};
const ORCHARD = { x: -7.5, z: 8.55, pitch: 2.3 };
/** River centre line, from a spring at the foot of the mountain to the cliff edge. */
const RIVER_POINTS: [number, number][] = [[9.3, -10.6], [10.6, -7.5], [12.2, -4.2], [12.6, -0.8], [12.1, 2.6], [12.5, 5.4], [12.5, 8.4], [11.55, 11.1]];
const RIVER_HALF = 1.15;
const RIVER_Y = 0.07;
const JETTY_Z = -1.2;
/** Fishing spot coordinates: `along` the river ±1 is this far either side of the jetty. */
const CAST_ALONG = 1.6;
const CROP_COLORS: Record<CropId, string> = {
  cabbage: "#7fc35a", carrot: "#f08a2c", tomato: "#e2533d", corn: "#f2c94c", rice: "#e9d48a",
  strawberry: "#e23d5a", pumpkin: "#f28d34", sunflower: "#f6c443", watermelon: "#4f9a3d",
};
const ANIMAL_HEIGHT: Record<AnimalId, number> = { chicken: 0.6, duck: 0.6, sheep: 0.85, cow: 1.15 };

export function plotPosition(index: number): [number, number] {
  const col = index % PLOT_COLUMNS;
  const row = Math.floor(index / PLOT_COLUMNS);
  return [FARM_CENTER.x + (col - (PLOT_COLUMNS - 1) / 2) * PLOT_PITCH, FARM_CENTER.z + (1 - row) * PLOT_PITCH];
}

export function spotPosition(index: number): [number, number] {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return [ORCHARD.x + (col - 1) * ORCHARD.pitch, ORCHARD.z + (row - 0.5) * ORCHARD.pitch];
}

const tint = (color: string, lightness: number) => `#${new THREE.Color(color).offsetHSL(0, 0, lightness).getHexString()}`;

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in 0..1, for painting the ground and roughening the cliff. */
function noise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** 1 inside the rectangle, fading to 0 over `soft` outside it. */
function rectMask(x: number, z: number, cx: number, cz: number, hx: number, hz: number, soft: number): number {
  const outside = Math.max(Math.abs(x - cx) - hx, Math.abs(z - cz) - hz);
  return 1 - smooth(-soft * 0.5, soft, outside);
}

/** Distance from (x, z) to the segment a–b. */
function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / Math.max(1e-6, dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

function pondPoint(x: number, z: number): [number, number] {
  return [POND_CENTER.x + x * POND_RX, POND_CENTER.z + z * POND_RZ];
}

function pasturePoint(x: number, z: number): [number, number] {
  return [PASTURE.x + x * (PASTURE.hx - 0.55), PASTURE.z + z * (PASTURE.hz - 0.5)];
}

/** Fry start clearly visible and grow to about twice their size. */
function fishSize(ratio: number): number {
  return 0.58 + 0.6 * Math.min(1, Math.max(0, ratio));
}

type IconName = "star" | "drop" | "bug" | "lock" | "bowl" | "build" | "alert";

export function createFarmScene(container: HTMLElement, options: SceneOptions): FarmSceneController {
  const preset = QUALITY_PRESETS[options.quality];
  const deviceDpr = window.devicePixelRatio || 1;
  let dpr = Math.min(deviceDpr, preset.dprCap);
  let fpsCap: number = preset.fps;
  let shadowsOn = preset.shadows;

  /* ───────────── renderer, camera, lights ───────────── */
  const renderer = new THREE.WebGLRenderer({
    antialias: preset.antialias && dpr < 2,
    powerPreference: options.quality === "low" ? "default" : "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = shadowsOn;
  renderer.shadowMap.type = options.quality === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Soft highlight roll-off without washing out the hand-picked colours.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "Nông trại 3D với ruộng, vườn cây, ao cá, sông câu cá và trang trại vật nuôi. Chạm hoặc kéo công cụ qua ô ruộng, cây; chạm cá, vật nuôi, sản phẩm để thao tác; các nút bên dưới làm được mọi việc tương tự.",
  );
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  // Haze the far islands and the underside of the cliff into the pale horizon.
  scene.fog = new THREE.Fog("#dcebe6", 48, 112);

  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 140);
  const cameraTarget = VIEWS.farm.target.clone();
  let viewName: FarmView = "farm";
  let viewHeight = VIEWS.farm.height;
  let aspect = 1;

  // Cool sky light in the shade, warm afternoon sun: the contrast reads as cosy.
  scene.add(new THREE.HemisphereLight("#d9ecff", "#6f8f4f", preset.pbr ? 1.55 : 1.45));
  const sun = new THREE.DirectionalLight("#ffe4b0", preset.pbr ? 3.6 : 2.75);
  sun.position.set(-10, 18, 9);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 18, bottom: -17, near: 1, far: 70 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  /* ───────────── shared resources ───────────── */
  // One material for every baked object: colours live in the geometry, so the GPU switches
  // state once for the whole island.
  // Smooth shading: rounded parts read soft and hand-made; boxes, rocks and few-sided roofs keep
  // their facets (see `flat` below).
  const makeSurface = (): THREE.Material => preset.pbr
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 })
    : new THREE.MeshLambertMaterial({ vertexColors: true });
  const surface = makeSurface();
  // Static leaves, vines and bushes: the same look, swaying in the wind.
  const foliageMaterial = makeSurface();
  addWind(foliageMaterial, "baked", 0.05);
  // Lantern and string-light bulbs: unlit and brighter than white, so the High preset's bloom
  // picks them up; elsewhere they simply look lit.
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  glowMaterial.color.setScalar(preset.post ? 2.6 : 1.25);
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const carrier = new THREE.MeshBasicMaterial();
  const primitives = new Map<string, THREE.BufferGeometry>();
  const owned = new Set<THREE.BufferGeometry>();
  const textures: THREE.Texture[] = [sky];
  const extraMaterials: THREE.Material[] = [hiddenMaterial, carrier, foliageMaterial, glowMaterial];
  const tmpColor = new THREE.Color();

  function primitive<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let value = primitives.get(key);
    if (!value) {
      value = make();
      primitives.set(key, value);
    }
    return value as T;
  }
  /** Few-sided cones and cylinders (roofs, posts, reeds) keep crisp facets under smooth shading. */
  const faceted = <T extends THREE.BufferGeometry>(geometry: T, sides: number): T => {
    if (sides <= 6) geometry.userData.flat = true;
    return geometry;
  };
  const box = (w: number, h: number, d: number) => primitive(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  /** A box with softly rounded edges: planks, beds, furniture. */
  const rbox = (w: number, h: number, d: number, r = 0.035, s = 1) =>
    primitive(`rbox:${w}:${h}:${d}:${r}:${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2.1, h / 2.1, d / 2.1)));
  // Low trades a little roundness for far fewer triangles on weak GPUs.
  const coarse = options.quality === "low" ? 0.65 : 1;
  const sphere = (r: number, w = 10, h = 8) => primitive(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, Math.max(6, Math.round(w * coarse)), Math.max(4, Math.round(h * coarse))));
  const cone = (r: number, h: number, s = 7) => primitive(`cone:${r}:${h}:${s}`, () => faceted(new THREE.ConeGeometry(r, h, s), s));
  const cylinder = (rt: number, rb: number, h: number, s = 8) =>
    primitive(`cyl:${rt}:${rb}:${h}:${s}`, () => faceted(new THREE.CylinderGeometry(rt, rb, h, s), s));
  const ico = (r: number, d = 0) => primitive(`ico:${r}:${d}`, () => new THREE.IcosahedronGeometry(r, d));
  const dodeca = (r: number) => primitive(`dodeca:${r}`, () => new THREE.DodecahedronGeometry(r, 0));
  const circle = (s: number) => primitive(`circle:${s}`, () => new THREE.CircleGeometry(1, s));
  /**
   * A leaf blade one unit long down +z from its stalk: tapered at both ends, cupped, its tip
   * curling down by `curl`, with a back face so it reads from below too. Scale x for width.
   */
  const leaf = (curl = 0.25) => primitive(`leaf:${curl}`, () => {
    const front = new THREE.PlaneGeometry(1, 1, 2, 4);
    const position = front.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const u = position.getX(i);
      const v = position.getY(i) + 0.5;
      const width = Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.04)), 0.75);
      position.setXYZ(i, u * width, Math.abs(u) * width * 0.28 - curl * v * v, v);
    }
    front.computeVertexNormals();
    const back = front.clone();
    const index = back.index as THREE.BufferAttribute;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
    const normals = back.attributes.normal;
    for (let i = 0; i < normals.count; i += 1) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    const both = mergeGeometries([front, back], false) ?? front;
    if (both !== front) {
      front.dispose();
      back.dispose();
    }
    return both;
  });

  /** A coloured building block. Never drawn itself: it only feeds `bake`. */
  function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
    const item = new THREE.Mesh(geometry, carrier);
    item.userData.color = color;
    item.position.set(x, y, z);
    return item;
  }

  /** A part for the swaying foliage mesh: `sway` 0 (still) … 1 (moves the most). */
  function leafy(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sway = 1): THREE.Mesh {
    const item = part(geometry, color, x, y, z);
    item.userData.sway = sway;
    return item;
  }

  /** A leaf on a stalk at (x, y, z), pointing along `yaw`, tilted up or down by `pitch`. */
  function leafAt(root: THREE.Object3D, color: string, x: number, y: number, z: number, yaw: number, pitch: number, length: number, width: number, curl = 0.25, sway = 0) {
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.set(0, yaw, 0);
    const blade = part(leaf(curl), color);
    blade.rotation.x = -pitch;
    blade.scale.set(width, length, length);
    if (sway) blade.userData.sway = sway;
    holder.add(blade);
    root.add(holder);
  }

  function turn(mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
    mesh.rotation.set(x, y, z);
    return mesh;
  }

  /**
   * Merges every coloured part under `root` into one vertex-coloured geometry. Parts whose
   * `userData.color` is "vertex" bring their own colours. With `shade`, sides close to the
   * ground darken a little (baked contact shadow, free at run time; y = 0 is the ground in the
   * root's space). With `sway`, each vertex gets its part's `userData.sway` for the wind.
   */
  function bakeGeometry(root: THREE.Object3D, shade = true, sway = false): THREE.BufferGeometry | null {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const matrix = new THREE.Matrix4();
    const pieces: THREE.BufferGeometry[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || typeof object.userData.color !== "string") return;
      const source = object.geometry as THREE.BufferGeometry;
      const own = object.userData.color === "vertex";
      const geometry = source.index ? source.toNonIndexed() : source.clone();
      for (const name of Object.keys(geometry.attributes)) if (name !== "position" && name !== "normal" && !(own && name === "color")) geometry.deleteAttribute(name);
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      geometry.applyMatrix4(matrix);
      if (source.userData.flat) geometry.computeVertexNormals();
      const count = geometry.attributes.position.count;
      let colors: Float32Array;
      if (own) {
        colors = (geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
      } else {
        tmpColor.set(object.userData.color as string);
        colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          colors[i * 3] = tmpColor.r;
          colors[i * 3 + 1] = tmpColor.g;
          colors[i * 3 + 2] = tmpColor.b;
        }
      }
      if (shade) {
        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        for (let i = 0; i < count; i += 1) {
          const y = position.getY(i);
          if (y > 0.5) continue;
          const t = Math.max(0, y) / 0.5;
          const near = 1 - t * t * (3 - 2 * t);
          // Upward faces (rugs, soil, deck tops) stay bright; sides and undersides darken.
          const side = 1 - Math.max(0, normal.getY(i)) * 0.85;
          const factor = 1 - near * side * 0.34;
          colors[i * 3] *= factor;
          colors[i * 3 + 1] *= factor;
          colors[i * 3 + 2] *= factor * 1.02;
        }
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      if (sway) geometry.setAttribute("aSway", new THREE.BufferAttribute(new Float32Array(count).fill(Number(object.userData.sway ?? 0)), 1));
      pieces.push(geometry);
    });
    if (pieces.length === 0) return null;
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((item) => item.dispose());
    if (merged) owned.add(merged);
    return merged;
  }

  function bake(root: THREE.Object3D, cast = true, receive = true, shade = true): THREE.Mesh {
    const geometry = bakeGeometry(root, shade) ?? new THREE.BufferGeometry();
    owned.add(geometry);
    const item = new THREE.Mesh(geometry, surface);
    item.castShadow = cast && shadowsOn;
    item.receiveShadow = receive;
    return item;
  }

  function releaseGeometry(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && owned.has(child.geometry as THREE.BufferGeometry) && child.userData.ownsGeometry) {
        owned.delete(child.geometry as THREE.BufferGeometry);
        (child.geometry as THREE.BufferGeometry).dispose();
      }
    });
    object.removeFromParent();
  }

  function hitBox(geometry: THREE.BufferGeometry, hit: SceneHit, y = 0): THREE.Mesh {
    const item = new THREE.Mesh(geometry, hiddenMaterial);
    item.position.y = y;
    item.userData.hit = hit;
    return item;
  }

  const iconMaterials = new Map<IconName, THREE.SpriteMaterial>();
  function icon(name: IconName, scale = 0.82): THREE.Sprite {
    let material = iconMaterials.get(name);
    if (!material) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) drawIcon(ctx, name);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
      iconMaterials.set(name, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 10;
    sprite.userData.icon = true;
    return sprite;
  }

  /* ───────────── static world (a few baked draw calls) ───────────── */
  const world = new THREE.Group();
  scene.add(world);
  // Ground and river bed; buildings, fences and furniture; leaves that sway; glowing bulbs;
  // far islands in the haze. Each is baked into one mesh at the end of this section.
  const groundRoot = new THREE.Group();
  const propsRoot = new THREE.Group();
  const foliageRoot = new THREE.Group();
  const glowRoot = new THREE.Group();
  const farRoot = new THREE.Group();
  /** Soft darkening painted into the ground under things: x, z, radius, strength. */
  const groundShade: [number, number, number, number][] = [];
  /** Places grass and flowers must avoid: x, z, radius. */
  const keepClear: [number, number, number][] = [];
  const decorRandom = mulberry32(2026);

  for (let i = 0; i < 6; i += 1) {
    const stone = part(cylinder(0.32, 0.36, 0.08, 7), "#d8d0b8", 0.55 + i * 0.62, -0.01, FARM_CENTER.z + 0.15 + Math.sin(i * 1.3) * 0.25);
    stone.rotation.y = i;
    groundRoot.add(stone);
  }
  const pondBed = part(circle(28), "#2b6764", POND_CENTER.x, -0.035, POND_CENTER.z);
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.scale.set(POND_RX + 0.2, POND_RZ + 0.2, 1);
  groundRoot.add(pondBed);

  /** A rail fence with rounded posts and rails. */
  function addFence(root: THREE.Object3D, cx: number, cz: number, segments: [number, number, number, number][], color: string) {
    for (const [x1, z1, x2, z2] of segments) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const posts = Math.max(2, Math.round(length / 1.15) + 1);
      for (let i = 0; i < posts; i += 1) {
        const t = i / (posts - 1);
        const px = cx + x1 + (x2 - x1) * t, pz = cz + z1 + (z2 - z1) * t;
        root.add(part(rbox(0.15, 0.66, 0.15, 0.04), tint(color, (decorRandom() - 0.5) * 0.05), px, 0.29, pz));
        root.add(part(rbox(0.17, 0.05, 0.17, 0.02), tint(color, -0.06), px, 0.63, pz));
      }
      const yaw = -Math.atan2(z2 - z1, x2 - x1);
      for (const y of [0.22, 0.45]) root.add(turn(part(rbox(length, 0.075, 0.065, 0.025), tint(color, 0.03), cx + (x1 + x2) / 2, y, cz + (z1 + z2) / 2), 0, yaw, 0));
    }
  }

  /**
   * A tall garden trellis with a vine climbing it: posts, a top beam and a lattice of slats,
   * leaves and grape bunches (in the swaying foliage) and a string of lights along the top.
   */
  function addTrellis(x1: number, z1: number, x2: number, z2: number, height: number) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const yaw = -Math.atan2(z2 - z1, x2 - x1);
    const ux = (x2 - x1) / length, uz = (z2 - z1) / length;
    const at = (t: number) => [x1 + ux * t, z1 + uz * t] as const;
    const wood = "#8f5d3a";
    const posts = Math.max(2, Math.round(length / 1.6) + 1);
    const postAt: number[] = [];
    for (let i = 0; i < posts; i += 1) {
      const t = (i / (posts - 1)) * length;
      postAt.push(t);
      const [px, pz] = at(t);
      propsRoot.add(part(rbox(0.15, height, 0.15, 0.04), wood, px, height / 2 - 0.04, pz));
      propsRoot.add(part(rbox(0.19, 0.06, 0.19, 0.02), tint(wood, -0.05), px, height - 0.02, pz));
    }
    const [mx, mz] = at(length / 2);
    propsRoot.add(turn(part(rbox(length + 0.26, 0.11, 0.12, 0.035), wood, mx, height - 0.12, mz), 0, yaw, 0));
    for (const y of [0.32, 0.66, 1.0].filter((y) => y < height - 0.2)) propsRoot.add(turn(part(box(length, 0.035, 0.03), "#a06d45", mx, y, mz), 0, yaw, 0));
    for (let t = 0.2; t < length - 0.1; t += 0.3) {
      const [sx, sz] = at(t);
      propsRoot.add(turn(part(box(0.035, height - 0.2, 0.03), "#a06d45", sx, (height - 0.2) / 2, sz), 0, yaw, 0));
    }
    // Leaves face both ways out of the lattice, thicker near the top and the foot.
    const greens = ["#4f8f3b", "#5fa043", "#6fb04c", "#457f35"];
    for (let t = 0.05; t < length; t += 0.11) {
      const [lx, lz] = at(t);
      const count = 2 + Math.floor(decorRandom() * 2);
      for (let k = 0; k < count; k += 1) {
        const r = decorRandom();
        const y = r < 0.45 ? height - 0.2 - decorRandom() * 0.35 : r < 0.75 ? 0.1 + decorRandom() * 0.35 : 0.3 + decorRandom() * (height - 0.5);
        const out = decorRandom() < 0.5 ? 1 : -1;
        const yawLeaf = yaw + Math.PI / 2 + (out < 0 ? Math.PI : 0) + (decorRandom() - 0.5) * 1.6;
        leafAt(foliageRoot, greens[Math.floor(decorRandom() * greens.length)], lx + (decorRandom() - 0.5) * 0.06, y, lz + (decorRandom() - 0.5) * 0.06, yawLeaf, -0.2 + decorRandom() * 0.7, 0.17 + decorRandom() * 0.08, 0.15 + decorRandom() * 0.05, 0.2, 0.5 + y / height * 0.5);
      }
    }
    // Grape bunches hanging under the top beam.
    for (let t = 0.5; t < length - 0.3; t += 0.85 + decorRandom() * 0.4) {
      const [gx, gz] = at(t);
      const side = decorRandom() < 0.5 ? 1 : -1;
      const ox = -uz * 0.09 * side, oz = ux * 0.09 * side;
      const grape = ["#6b3fa0", "#7d4fb8", "#5a3388"];
      for (let k = 0; k < 9; k += 1) {
        const layer = k < 4 ? 0 : k < 7 ? 1 : 2;
        const spread = [0.06, 0.04, 0.0][layer];
        const a = k * 2.3;
        foliageRoot.add(leafy(sphere(0.038, 6, 5), grape[k % 3], gx + ox + Math.cos(a) * spread, height - 0.32 - layer * 0.07, gz + oz + Math.sin(a) * spread, 0.6));
      }
    }
    // Fairy lights sagging between the posts.
    for (let i = 0; i < postAt.length - 1; i += 1) {
      const [ax, az] = at(postAt[i]);
      const [bx, bz] = at(postAt[i + 1]);
      addStringLights(ax, az, bx, bz, height + 0.02, 0.18);
    }
  }

  /** Warm bulbs on a wire between two points, sagging in the middle. */
  function addStringLights(ax: number, az: number, bx: number, bz: number, y: number, sag: number) {
    const length = Math.hypot(bx - ax, bz - az);
    const bulbs = Math.max(3, Math.round(length / 0.28));
    const colors = ["#ffd27a", "#ffb35c", "#fff1b8", "#ff9e7a"];
    let previous: THREE.Vector3 | null = null;
    for (let i = 0; i <= bulbs; i += 1) {
      const t = i / bulbs;
      const point = new THREE.Vector3(ax + (bx - ax) * t, y - sag * 4 * t * (1 - t), az + (bz - az) * t);
      if (previous) {
        const span = point.distanceTo(previous);
        const wire = part(cylinder(0.008, 0.008, span, 4), "#3d3a33", (point.x + previous.x) / 2, (point.y + previous.y) / 2, (point.z + previous.z) / 2);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), point.clone().sub(previous).normalize());
        propsRoot.add(wire);
      }
      if (i > 0 && i < bulbs) glowRoot.add(part(ico(0.05, 1), colors[i % colors.length], point.x, point.y - 0.055, point.z));
      previous = point;
    }
  }

  /** A post lantern with a glowing core. */
  function addLantern(x: number, z: number, height = 1.25) {
    propsRoot.add(part(rbox(0.09, height, 0.09, 0.025), "#4a3a2c", x, height / 2, z));
    propsRoot.add(part(rbox(0.28, 0.06, 0.06, 0.02), "#4a3a2c", x + 0.1, height - 0.04, z));
    propsRoot.add(part(rbox(0.17, 0.2, 0.17, 0.03), "#3b3530", x + 0.22, height - 0.22, z));
    propsRoot.add(part(cone(0.15, 0.1, 4), "#3b3530", x + 0.22, height - 0.07, z));
    glowRoot.add(part(box(0.12, 0.15, 0.185), "#ffcf7a", x + 0.22, height - 0.22, z), part(box(0.185, 0.15, 0.12), "#ffcf7a", x + 0.22, height - 0.22, z));
    propsRoot.add(part(cylinder(0.11, 0.13, 0.05, 10), "#9a8f7c", x, 0.0, z));
    keepClear.push([x, z, 0.3]);
  }

  // The fields: tall trellis with vines at the back (north and west, so it never hides a plot),
  // low rail fence in front.
  addFence(propsRoot, FARM_CENTER.x, FARM_CENTER.z, [
    [-4.75, 3.65, -0.9, 3.65],
    [0.9, 3.65, 4.75, 3.65],
    [4.75, -3.65, 4.75, -0.9],
    [4.75, 0.9, 4.75, 3.65],
  ], "#b98a55");
  addTrellis(FARM_CENTER.x - 4.75, FARM_CENTER.z - 3.65, FARM_CENTER.x + 4.75, FARM_CENTER.z - 3.65, 1.35);
  addTrellis(FARM_CENTER.x - 4.75, FARM_CENTER.z - 3.65, FARM_CENTER.x - 4.75, FARM_CENTER.z + 3.65, 1.35);
  addLantern(FARM_CENTER.x - 1.15, FARM_CENTER.z + 3.95);
  addLantern(FARM_CENTER.x + 5.05, FARM_CENTER.z + 1.15);
  const hx = PASTURE.hx;
  const hz = PASTURE.hz;
  addFence(propsRoot, PASTURE.x, PASTURE.z, [
    [-hx, -hz, 1.6, -hz],
    [2.8, -hz, hx, -hz],
    [-hx, hz, hx, hz],
    [-hx, -hz, -hx, hz],
    [hx, -hz, hx, hz],
  ], "#f1e4c8");
  for (const [x, z] of [[-3.4, 10.7], [-2.7, 10.85], [4.3, 10.6]]) {
    const bale = part(cylinder(0.32, 0.32, 0.5, 14), "#e2c25f", x, 0.3, z);
    bale.rotation.z = Math.PI / 2;
    propsRoot.add(bale);
    for (const side of [-1, 1]) propsRoot.add(turn(part(cylinder(0.325, 0.325, 0.03, 14), "#c9a443", x + side * 0.13, 0.3, z), 0, 0, Math.PI / 2));
    groundShade.push([x, z, 0.6, 0.2]);
  }

  /**
   * A gable roof of overlapping rounded shingles, its ridge along x, sitting on walls `depth`
   * deep at y = 0, rising `rise` to the ridge.
   */
  function shingleRoof(length: number, depth: number, rise: number, color: string, random: () => number): THREE.Group {
    const roof = new THREE.Group();
    const angle = Math.atan2(rise, depth / 2);
    const slope = Math.hypot(depth / 2, rise) + 0.16;
    const rows = Math.max(3, Math.round(slope / 0.2));
    const rowDepth = slope / rows;
    const cols = Math.max(3, Math.round((length + 0.2) / 0.3));
    const tileWidth = (length + 0.2) / cols;
    for (const side of [-1, 1]) {
      const face = new THREE.Group();
      face.position.y = rise;
      face.rotation.x = side * angle;
      face.add(part(box(length + 0.2, 0.03, slope), tint(color, -0.12), 0, 0, (side * slope) / 2));
      for (let r = 0; r < rows; r += 1) {
        const stagger = r % 2 ? tileWidth / 2 : 0;
        for (let c = 0; c < cols + (r % 2 ? 1 : 0); c += 1) {
          const x = -(length + 0.2) / 2 + tileWidth / 2 + c * tileWidth - stagger;
          const width = Math.min(tileWidth, (length + 0.2) / 2 - Math.abs(x) + tileWidth / 2) * 0.94;
          if (width < 0.05) continue;
          const tile = part(box(width, 0.045, rowDepth * 1.3), tint(color, (random() - 0.5) * 0.09), x, 0.035, side * (r + 0.62) * rowDepth);
          tile.rotation.x = -side * 0.07;
          face.add(tile);
        }
      }
      roof.add(face);
    }
    roof.add(part(rbox(length + 0.26, 0.09, 0.17, 0.035), tint(color, -0.08), 0, rise + 0.035, 0));
    return roof;
  }

  /** The triangular gable wall under a roof: ridge along x. */
  const gable = (length: number, depth: number, rise: number) => primitive(`gable:${length}:${depth}:${rise}`, () => {
    const shape = new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, rise)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geometry.translate(0, 0, -length / 2);
    geometry.rotateY(Math.PI / 2);
    geometry.userData.flat = true;
    return geometry;
  });

  /** A window with a white frame, cross bars and a flower box under it; faces +z. */
  function addWindow(root: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, flowers: THREE.Object3D | null) {
    root.add(part(box(width, height, 0.04), "#b9dfe6", x, y, z));
    root.add(part(rbox(width + 0.1, 0.06, 0.07, 0.02), "#fbf5e8", x, y + height / 2, z + 0.01), part(rbox(width + 0.12, 0.06, 0.09, 0.02), "#fbf5e8", x, y - height / 2, z + 0.02));
    for (const side of [-1, 1]) root.add(part(rbox(0.06, height, 0.07, 0.02), "#fbf5e8", x + side * (width / 2 + 0.01), y, z + 0.01));
    root.add(part(box(0.03, height, 0.05), "#fbf5e8", x, y, z + 0.01), part(box(width, 0.03, 0.05), "#fbf5e8", x, y, z + 0.01));
    if (!flowers) return;
    root.add(part(rbox(width + 0.08, 0.12, 0.14, 0.03), "#8f5d3a", x, y - height / 2 - 0.09, z + 0.08));
    const petals = ["#f28fb1", "#ffd166", "#ffffff", "#ef6f6c"];
    for (let i = 0; i < 6; i += 1) {
      const fx = x - width / 2 + 0.05 + (i / 5) * (width - 0.1);
      flowers.add(leafy(sphere(0.055, 8, 6), i % 2 ? "#5fa043" : "#4f8f3b", fx, y - height / 2 - 0.01, z + 0.08, 0.3));
      flowers.add(leafy(sphere(0.035, 7, 5), petals[i % petals.length], fx + 0.02, y - height / 2 + 0.04, z + 0.11, 0.35));
    }
  }

  const house = new THREE.Group();
  {
    const random = mulberry32(17);
    house.add(part(rbox(2, 1.35, 1.6, 0.05), "#f3d99a", 0, 0.68, 0));
    // Timber frame on the plaster.
    for (const side of [-1, 1]) {
      house.add(part(rbox(0.1, 1.38, 0.1, 0.02), "#8f5d3a", side * 0.99, 0.69, 0.8), part(rbox(0.1, 1.38, 0.1, 0.02), "#8f5d3a", side * 0.99, 0.69, -0.8));
    }
    house.add(part(rbox(2.04, 0.09, 1.64, 0.02), "#8f5d3a", 0, 1.33, 0), part(rbox(2.06, 0.12, 1.66, 0.03), "#b8a789", 0, 0.05, 0));
    house.add(part(gable(2, 1.6, 0.85), "#f3d99a", 0, 1.37, 0));
    const roof = shingleRoof(2.25, 1.75, 0.92, "#7a5aa6", random);
    roof.position.y = 1.36;
    house.add(roof);
    // Chimney with a stone cap.
    house.add(part(rbox(0.3, 0.7, 0.3, 0.04), "#b0705a", -0.55, 2.05, -0.3), part(rbox(0.36, 0.08, 0.36, 0.03), "#8e8a80", -0.55, 2.42, -0.3));
    // Door with a step and a lamp.
    house.add(part(rbox(0.46, 0.82, 0.07, 0.03), "#7a4e32", 0.38, 0.47, 0.81), part(rbox(0.54, 0.06, 0.1, 0.02), "#fbf5e8", 0.38, 0.9, 0.82));
    house.add(part(sphere(0.03, 6, 5), "#e9c46a", 0.54, 0.47, 0.86), part(rbox(0.7, 0.08, 0.32, 0.03), "#b8a789", 0.38, 0.04, 0.96));
    addWindow(house, -0.42, 0.84, 0.81, 0.44, 0.38, house);
    addWindow(house, 0.0, 1.62, 0.66, 0.28, 0.24, null);
  }
  house.position.set(-7.1, 0, -4.9);
  house.rotation.y = 0.12;
  propsRoot.add(house);
  groundShade.push([-7.1, -4.9, 1.8, 0.3]);
  keepClear.push([-7.1, -4.9, 1.6]);
  // Porch light by the house door (on the house's front wall, in world space).
  glowRoot.add(part(sphere(0.06, 8, 6), "#ffd99a", -7.1 + Math.cos(0.12) * 0.78 + Math.sin(0.12) * 0.86, 0.98, -4.9 - Math.sin(0.12) * 0.78 + Math.cos(0.12) * 0.86));

  const tower = new THREE.Group();
  tower.add(part(cylinder(0.32, 0.55, 2.6, 12), "#efe6d2", 0, 1.3, 0), part(cone(0.5, 0.6, 12), "#c4553f", 0, 2.88, 0));
  tower.add(part(cylinder(0.56, 0.6, 0.12, 12), "#b8a789", 0, 0.06, 0), part(cylinder(0.36, 0.36, 0.08, 12), "#a9573f", 0, 2.6, 0));
  tower.add(part(rbox(0.26, 0.48, 0.05, 0.02), "#7a4e32", 0.02, 0.28, 0.5), part(rbox(0.16, 0.2, 0.04, 0.02), "#b9dfe6", 0.0, 1.55, 0.4));
  tower.position.set(-9.9, 0, -2.4);
  propsRoot.add(tower);
  groundShade.push([-9.9, -2.4, 1.0, 0.25]);
  keepClear.push([-9.9, -2.4, 0.8]);

  // Pond decoration.
  const rimRandom = mulberry32(7);
  for (let i = 0; i < 34; i += 1) {
    const angle = (i / 34) * Math.PI * 2;
    const size = 0.22 + rimRandom() * 0.22;
    const [x, z] = pondPoint(Math.cos(angle) * 1.08, Math.sin(angle) * 1.08);
    const stone = part(dodeca(1), i % 3 ? "#a9ab9b" : "#c3c2b0", x, 0.12, z);
    stone.scale.set(size * 1.3, size * 0.7, size);
    stone.rotation.set(rimRandom(), rimRandom() * 3, rimRandom());
    propsRoot.add(stone);
  }
  for (const [px, pz] of [[-0.95, -0.35], [-0.9, -0.55], [0.85, -0.6], [0.95, -0.4], [0.7, 0.75]]) {
    const [x, z] = pondPoint(px + 0.05, pz + 0.04);
    addReeds(x, z, 6);
  }
  groundShade.push([POND_CENTER.x, POND_CENTER.z, POND_RX + 1.0, 0.12]);
  for (const [px, pz, s] of [[0.45, -0.55, 1], [0.6, -0.35, 0.7], [-0.55, 0.5, 0.85]]) {
    const [x, z] = pondPoint(px, pz);
    propsRoot.add(part(cylinder(0.32 * s, 0.32 * s, 0.03, 9), "#5c9d48", x, WATER_Y + 0.02, z));
  }
  const [fx, fz] = pondPoint(0.45, -0.55);
  propsRoot.add(part(sphere(0.09, 6, 5), "#f6b6c8", fx + 0.05, WATER_Y + 0.09, fz));
  const dock = new THREE.Group();
  for (let i = 0; i < 5; i += 1) dock.add(part(rbox(0.33, 0.08, 1.25, 0.03), i % 2 ? "#a77a4c" : "#b98a55", i * 0.36, 0.36, 0));
  for (const [x, z] of [[0, -0.55], [0, 0.55], [1.45, -0.55], [1.45, 0.55]]) dock.add(part(cylinder(0.065, 0.065, 0.7, 10), "#7a5638", x, 0.05, z));
  const [dx, dz] = pondPoint(-1.25, 0.55);
  dock.position.set(dx, 0, dz);
  dock.rotation.y = -0.5;
  propsRoot.add(dock);

  // Road sign towards town, at the island edge.
  const sign = new THREE.Group();
  sign.add(part(box(0.1, 1.1, 0.1), "#7a5638", 0, 0.55, 0), part(box(1.1, 0.42, 0.08), "#f2c94c", 0.2, 1.05, 0), part(cone(0.24, 0.3, 3), "#24583e", 0.62, 1.05, 0.05));
  (sign.children[2] as THREE.Mesh).rotation.z = -Math.PI / 2;
  sign.position.set(ROAD_END_X - 0.8, 0, ROAD_Z - 0.9);
  propsRoot.add(sign);

  // Trees: a trunk in the props, a clumpy crown (or a stack of drooping tiers) in the foliage.
  function addTree(x: number, z: number, scale: number, round: boolean) {
    const trunk = new THREE.Group();
    const crown = new THREE.Group();
    const random = mulberry32(Math.round(x * 100 + z * 7));
    trunk.add(part(cylinder(0.11, 0.19, 1.05, 8), "#7a5638", 0, 0.5, 0));
    if (round) {
      for (const side of [-1, 1]) trunk.add(turn(part(cylinder(0.04, 0.07, 0.5, 6), "#7a5638", side * 0.16, 0.95, 0.03), 0, 0, -side * 0.7));
      const base = ["#5e9e4a", "#6aa84f", "#579645"][Math.floor(random() * 3)];
      const clumps: [number, number, number, number][] = [[0, 1.55, 0, 0.62], [0, 2.02, 0.02, 0.46]];
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + random() * 0.5;
        clumps.push([Math.cos(a) * 0.5, 1.38 + random() * 0.3, Math.sin(a) * 0.5, 0.38 + random() * 0.12]);
      }
      clumps.forEach(([cx, cy, cz, r]) => crown.add(leafy(sphere(r, 10, 8), tint(base, (cy - 1.6) * 0.12 + (random() - 0.5) * 0.03), cx, cy, cz, Math.min(1, (cy - 1.1) * 0.9))));
    } else {
      const tiers: [number, number, number][] = [[0.86, 0.85, 0.85], [0.7, 0.75, 1.3], [0.52, 0.68, 1.72], [0.32, 0.55, 2.1]];
      tiers.forEach(([r, h, y], i) => crown.add(turn(leafy(cone(r, h, 12), tint("#2f6e48", i * 0.035), 0, y, 0, 0.15 + i * 0.25), (random() - 0.5) * 0.08, random() * 3, (random() - 0.5) * 0.08)));
    }
    for (const root of [trunk, crown]) {
      root.position.set(x, 0, z);
      root.scale.setScalar(scale);
      root.rotation.y = x * 1.7;
    }
    propsRoot.add(trunk);
    foliageRoot.add(crown);
    groundShade.push([x + 0.35 * scale, z - 0.25 * scale, 1.45 * scale, 0.32]);
    keepClear.push([x, z, 0.35 * scale]);
  }
  const treeSpots: [number, number, number, boolean][] = [
    [-11.5, -5.5, 1.1, false], [-12.6, -2.6, 0.95, true], [-12.2, 1.8, 1.05, false], [-11.6, 5.4, 0.9, true],
    [-4.2, -7.6, 1.15, false], [-0.6, -7.2, 0.95, true], [2.6, -6.6, 1.1, false],
    [5.5, -5.6, 0.9, true], [9.2, -5.2, 1.15, false], [14.6, -2.8, 1, true], [14.7, 1.9, 0.9, false],
    [-1.4, 13.2, 0.95, true], [3.8, 12.9, 1.1, false], [-12.6, 7.6, 0.95, false],
    [-14.1, -0.4, 0.85, true], [7.2, -8.1, 1.0, true], [-8.6, -8.4, 1.05, true],
  ];
  treeSpots.forEach(([x, z, s, round]) => addTree(x, z, s, round));
  for (const [x, z, s] of [[-6, -12, 3.4], [-1, -13, 4.4], [4.5, -12.5, 3.6], [9.5, -11.5, 2.8]]) {
    propsRoot.add(part(cone(s, s * 1.6, 6), "#7f9a78", x, s * 0.7 - 0.6, z), part(cone(s * 0.32, s * 0.5, 6), "#f5f1e3", x, s * 0.7 - 0.6 + s * 0.56, z));
    keepClear.push([x, z, s * 1.02]);
    groundShade.push([x, z, s * 1.35, 0.25]);
  }

  /** A round bush of soft clumps, sometimes in flower. */
  function addBush(x: number, z: number, size: number, flowers?: string) {
    const random = mulberry32(Math.round(x * 31 + z * 17));
    const base = ["#4f8f3b", "#5fa043", "#4a8a45"][Math.floor(random() * 3)];
    const count = 3 + Math.floor(random() * 3);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + random();
      const r = (0.2 + random() * 0.12) * size;
      const off = i === 0 ? 0 : 0.2 * size;
      foliageRoot.add(leafy(sphere(r, 10, 8), tint(base, (random() - 0.5) * 0.06), x + Math.cos(a) * off, r * 0.75, z + Math.sin(a) * off, 0.25));
      if (flowers) {
        for (let k = 0; k < 3; k += 1) {
          const b = random() * Math.PI * 2;
          foliageRoot.add(leafy(sphere(0.035 * size + 0.01, 6, 5), flowers, x + Math.cos(a) * off + Math.cos(b) * r * 0.8, r * (0.95 + random() * 0.5), z + Math.sin(a) * off + Math.sin(b) * r * 0.8, 0.3));
        }
      }
    }
    groundShade.push([x, z, 0.55 * size, 0.22]);
    keepClear.push([x, z, 0.35 * size]);
  }

  /** A big decorative banana plant with arching leaves. */
  function addBanana(x: number, z: number, size: number) {
    const random = mulberry32(Math.round(x * 13 + z * 29));
    propsRoot.add(part(cylinder(0.08 * size, 0.13 * size, 0.85 * size, 8), "#8aa04e", x, 0.42 * size, z));
    for (let i = 0; i < 7; i += 1) {
      const yaw = (i / 7) * Math.PI * 2 + random() * 0.4;
      leafAt(foliageRoot, i % 2 ? "#5fa847" : "#4e9640", x, 0.8 * size, z, yaw, 0.35 + random() * 0.45, (0.95 + random() * 0.3) * size, 0.42 * size, 0.55, 0.8);
    }
    groundShade.push([x, z, 1.1 * size, 0.25]);
    keepClear.push([x, z, 0.3 * size]);
  }

  /* River: bed, sandy banks, stones, a bridge for the road and a jetty with someone fishing. */
  const riverCurve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const RIVER_SAMPLES = 90;
  const riverPoints = riverCurve.getSpacedPoints(RIVER_SAMPLES);
  const riverTangents = riverPoints.map((_, i) => riverCurve.getTangentAt(i / RIVER_SAMPLES));
  /** Unit vector across the river, towards its east bank. */
  const across = (tangent: THREE.Vector3) => new THREE.Vector3(tangent.z, 0, -tangent.x);
  const nearestSample = (z: number) => riverPoints.reduce((best, point, i) => (Math.abs(point.z - z) < Math.abs(riverPoints[best].z - z) ? i : best), 0);

  /** A flat strip following the river, between two offsets across it. */
  function riverRibbon(from: number, to: number, y: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const corner = (j: number, offset: number) => {
      const point = riverPoints[j];
      const normal = across(riverTangents[j]);
      return [point.x + normal.x * offset, y, point.z + normal.z * offset];
    };
    for (let i = 0; i < riverPoints.length - 1; i += 1) {
      const a = corner(i, from), b = corner(i, to), c = corner(i + 1, from), d = corner(i + 1, to);
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    owned.add(geometry);
    return geometry;
  }
  groundRoot.add(
    part(riverRibbon(-RIVER_HALF, RIVER_HALF, -0.035), "#2f6f6a"),
    part(riverRibbon(-RIVER_HALF - 0.42, -RIVER_HALF + 0.06, -0.012), "#cdbd8f"),
    part(riverRibbon(RIVER_HALF - 0.06, RIVER_HALF + 0.42, -0.012), "#cdbd8f"),
  );
  const bridgeIndex = nearestSample(ROAD_Z);
  const bridgeX = riverPoints[bridgeIndex].x;
  const jettyIndex = nearestSample(JETTY_Z);
  const jettyPoint = riverPoints[jettyIndex].clone();
  const jettyTangent = riverTangents[jettyIndex].clone();
  const jettyAcross = across(jettyTangent);
  const stoneRandom = mulberry32(31);
  for (let i = 1; i < riverPoints.length - 1; i += 2) {
    const point = riverPoints[i];
    if (Math.abs(point.z - JETTY_Z) < 1.1 || Math.abs(point.z - ROAD_Z) < 1.1) continue;
    const normal = across(riverTangents[i]);
    for (const side of [-1, 1]) {
      if (stoneRandom() < 0.35) continue;
      const offset = side * (RIVER_HALF + 0.08 + stoneRandom() * 0.22);
      const size = 0.12 + stoneRandom() * 0.16;
      const stone = part(dodeca(1), stoneRandom() < 0.5 ? "#a9ab9b" : "#c3c2b0", point.x + normal.x * offset, 0.05, point.z + normal.z * offset);
      stone.scale.set(size * 1.3, size * 0.7, size);
      stone.rotation.set(stoneRandom(), stoneRandom() * 3, stoneRandom());
      propsRoot.add(stone);
    }
  }
  // Spring rocks where the river leaves the mountain.
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const size = 0.35 + stoneRandom() * 0.3;
    const rock = part(dodeca(1), "#9a9c8d", riverPoints[0].x + Math.cos(angle) * 1.2, 0.15, riverPoints[0].z + Math.sin(angle) * 0.9 - 0.5);
    rock.scale.set(size * 1.2, size * 0.8, size);
    propsRoot.add(rock);
  }
  /** A clump of reeds: narrow swaying blades and a few brown cattails. */
  function addReeds(x: number, z: number, count: number) {
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.4 + x;
      const height = 0.55 + ((i * 37) % 5) * 0.08;
      leafAt(foliageRoot, i % 2 ? "#4f8a3f" : "#5f9a48", x + Math.cos(a) * 0.06, 0, z + Math.sin(a) * 0.06, a, 1.25 + (i % 3) * 0.08, height, 0.06, 0.12, 0.9);
      if (i % 3 === 0) {
        foliageRoot.add(leafy(cylinder(0.008, 0.008, height + 0.1, 4), "#5f8a3f", x + Math.cos(a) * 0.03, (height + 0.1) / 2, z + Math.sin(a) * 0.03, 0.6));
        foliageRoot.add(leafy(cylinder(0.028, 0.028, 0.13, 8), "#7a4e2d", x + Math.cos(a) * 0.03, height + 0.12, z + Math.sin(a) * 0.03, 1));
      }
    }
    keepClear.push([x, z, 0.25]);
  }
  // Reeds by the banks.
  for (const [index, side] of [[14, -1], [34, 1], [62, -1], [72, 1]] as const) {
    const point = riverPoints[index];
    const normal = across(riverTangents[index]);
    const offset = side * (RIVER_HALF + 0.02);
    addReeds(point.x + normal.x * offset, point.z + normal.z * offset, 7);
  }
  // Bridge where the road crosses: rounded deck planks across, rails on posts.
  const bridgeLength = RIVER_HALF * 2 + 1.3;
  const planks = Math.round(bridgeLength / 0.21);
  for (let i = 0; i < planks; i += 1) {
    const x = bridgeX - bridgeLength / 2 + (i + 0.5) * (bridgeLength / planks);
    propsRoot.add(part(rbox(bridgeLength / planks - 0.02, 0.08, 1.25, 0.025), tint("#b98a55", (decorRandom() - 0.5) * 0.07), x, 0.1, ROAD_Z));
  }
  for (const side of [-1, 1]) {
    propsRoot.add(part(rbox(bridgeLength, 0.075, 0.075, 0.025), "#8b5a35", bridgeX, 0.5, ROAD_Z + side * 0.6));
    for (let i = 0; i < 4; i += 1) propsRoot.add(part(rbox(0.09, 0.46, 0.09, 0.025), "#7a5638", bridgeX - bridgeLength / 2 + 0.15 + i * ((bridgeLength - 0.3) / 3), 0.3, ROAD_Z + side * 0.6));
  }
  // Jetty from the west bank, and the angler sitting at its end in a conical hat.
  const jettyRoot = new THREE.Group();
  const jettyLength = RIVER_HALF + 0.3;
  for (let i = 0; i < 6; i += 1) jettyRoot.add(part(box(0.22, 0.06, 0.92), i % 2 ? "#a77a4c" : "#b98a55", -jettyLength + 0.14 + i * (jettyLength / 5.6), 0.2, 0));
  for (const [x, z] of [[-jettyLength + 0.1, -0.42], [-jettyLength + 0.1, 0.42], [-0.12, -0.42], [-0.12, 0.42]]) jettyRoot.add(part(cylinder(0.05, 0.05, 0.5, 5), "#7a5638", x, 0.0, z));
  const angler = new THREE.Group();
  angler.position.set(-0.3, 0.2, 0);
  angler.add(
    part(cylinder(0.15, 0.19, 0.46, 8), "#3d6fa8", -0.05, 0.25, 0),
    part(sphere(0.13, 10, 8), "#e8c39e", -0.04, 0.62, 0),
    part(cone(0.34, 0.17, 14), "#e6d39c", -0.04, 0.78, 0),
    part(cylinder(0.13, 0.1, 0.2, 8), "#b98a55", -0.18, 0.1, 0.34),
  );
  for (const side of [-1, 1]) {
    angler.add(part(box(0.3, 0.1, 0.1), "#33405a", 0.12, 0.05, side * 0.08), part(box(0.1, 0.32, 0.1), "#33405a", 0.27, -0.1, side * 0.08));
    angler.add(part(box(0.3, 0.08, 0.08), "#3d6fa8", 0.12, 0.38, side * 0.1));
  }
  jettyRoot.add(angler);
  jettyRoot.position.set(jettyPoint.x - jettyAcross.x * 0.15, 0, jettyPoint.z - jettyAcross.z * 0.15);
  jettyRoot.rotation.y = -Math.atan2(jettyAcross.z, jettyAcross.x);
  propsRoot.add(jettyRoot);

  /* Orchard: a fenced garden south-west of the fields. */
  addFence(propsRoot, ORCHARD.x, ORCHARD.z, [
    [-3.7, -2.45, -0.7, -2.45],
    [0.7, -2.45, 3.7, -2.45],
    [-3.7, 2.45, 3.7, 2.45],
    [-3.7, -2.45, -3.7, 2.45],
    [3.7, -2.45, 3.7, 2.45],
  ], "#b98a55");
  for (let i = 0; i < 4; i += 1) {
    const stone = part(cylinder(0.3, 0.34, 0.08, 7), "#d8d0b8", -4.9 - i * 0.75, -0.01, 4.85 + i * 0.32);
    stone.rotation.y = i;
    groundRoot.add(stone);
  }
  // Lanterns at the orchard gate with lights strung between them.
  addLantern(ORCHARD.x - 1.0, ORCHARD.z - 2.75, 1.3);
  addLantern(ORCHARD.x + 0.75, ORCHARD.z - 2.75, 1.3);
  addStringLights(ORCHARD.x - 1.0, ORCHARD.z - 2.75, ORCHARD.x + 0.97, ORCHARD.z - 2.75, 1.12, 0.12);

  /* Cosy corner between the fields and the pond: a patchwork rug, bean bags, a tea table, an
     umbrella, an easel and a lantern. */
  const COZY = { x: 1.35, z: -1.05, yaw: 0.35 };
  {
    const corner = new THREE.Group();
    const patches = ["#e07a5f", "#f2cc8f", "#81b29a", "#e9c46a", "#9c89b8", "#f4a261", "#6d9dc5", "#f7b2c4", "#a3c47a"];
    corner.add(part(rbox(1.42, 0.02, 1.04, 0.008), "#f6ead2", 0, 0.012, 0));
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 3; j += 1) corner.add(part(box(0.31, 0.014, 0.29), patches[(i * 3 + j * 2) % patches.length], -0.5 + i * 0.333, 0.026, -0.32 + j * 0.32));
    }
    // A slouchy bean bag: a wide squashed body, a backrest behind and a dent where you sit.
    const beanBag = (x: number, z: number, color: string, yaw: number) => {
      const bag = new THREE.Group();
      const body = part(sphere(0.3, 16, 12), color, 0, 0.14, 0);
      body.scale.set(1.05, 0.5, 1);
      const back = part(sphere(0.26, 14, 10), tint(color, 0.03), 0, 0.26, -0.16);
      back.scale.set(1.05, 0.85, 0.55);
      const seat = part(sphere(0.2, 12, 8), tint(color, -0.06), 0, 0.23, 0.07);
      seat.scale.set(1, 0.3, 0.9);
      bag.add(body, back, seat);
      bag.position.set(x, 0, z);
      bag.rotation.y = yaw;
      corner.add(bag);
    };
    beanBag(-0.36, 0.18, "#7a6fd6", 0.4);
    beanBag(0.42, -0.2, "#4fb3c8", -2.4);
    corner.add(part(cylinder(0.2, 0.2, 0.04, 18), "#d9b27a", 0.05, 0.3, 0.32), part(cylinder(0.03, 0.05, 0.28, 8), "#8f5d3a", 0.05, 0.15, 0.32));
    corner.add(part(sphere(0.055, 10, 8), "#f6f1e6", 0.02, 0.37, 0.3), part(cylinder(0.025, 0.02, 0.04, 8), "#e07a5f", 0.13, 0.34, 0.38), part(cylinder(0.025, 0.02, 0.04, 8), "#81b29a", -0.07, 0.34, 0.4));
    // Umbrella: a pole and eight alternating panels.
    corner.add(part(cylinder(0.022, 0.022, 1.55, 8), "#e9e3d6", 0.62, 0.77, 0.45));
    const panels = ["#7a6fd6", "#ffd166", "#4fb3c8", "#ef6f6c"];
    for (let i = 0; i < 8; i += 1) {
      const panel = new THREE.Mesh(primitive(`umbrella:${i}`, () => new THREE.ConeGeometry(0.78, 0.3, 3, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4)), carrier);
      panel.userData.color = panels[i % panels.length];
      panel.position.set(0.62, 1.48, 0.45);
      corner.add(panel);
    }
    corner.add(part(sphere(0.04, 8, 6), "#e9e3d6", 0.62, 1.64, 0.45));
    // Easel with a small painting.
    for (const [lx, lz, tilt] of [[-0.12, 0, -0.18], [0.12, 0, 0.18], [0, -0.16, 0]] as const) {
      corner.add(turn(part(rbox(0.035, 0.9, 0.035, 0.012), "#9c6a3c", -0.62 + lx, 0.44, -0.52 + lz), tilt === 0 ? 0.35 : -0.08, 0, tilt));
    }
    corner.add(turn(part(rbox(0.4, 0.46, 0.03, 0.01), "#fbf6ea", -0.62, 0.72, -0.49), -0.12, 0, 0));
    for (const [px, py, color] of [[-0.08, 0.06, "#f28fb1"], [0.07, -0.05, "#6d9dc5"], [0.05, 0.1, "#ffd166"], [-0.06, -0.09, "#81b29a"]] as const) {
      corner.add(turn(part(sphere(0.06, 8, 6), color, -0.62 + px, 0.72 + py, -0.47), -0.12, 0, 0));
    }
    corner.children.slice(-4).forEach((dot) => dot.scale.set(1, 1, 0.2));
    corner.position.set(COZY.x, 0, COZY.z);
    corner.rotation.y = COZY.yaw;
    propsRoot.add(corner);
    keepClear.push([COZY.x, COZY.z, 1.05]);
    groundShade.push([COZY.x, COZY.z, 1.1, 0.1]);
  }
  addLantern(COZY.x + 0.95, COZY.z + 0.65, 1.2);

  // Flower pots, crates of produce, sunflowers.
  function addPot(x: number, z: number, size: number, bloom: string) {
    propsRoot.add(part(cylinder(0.14 * size, 0.1 * size, 0.22 * size, 14), "#c8734a", x, 0.11 * size, z), part(cylinder(0.15 * size, 0.15 * size, 0.04 * size, 14), "#b5643e", x, 0.22 * size, z));
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      leafAt(foliageRoot, i % 2 ? "#5fa043" : "#4f8f3b", x, 0.22 * size, z, a, 0.55, 0.2 * size, 0.12 * size, 0.3, 0.5);
    }
    foliageRoot.add(leafy(sphere(0.06 * size, 8, 6), bloom, x, 0.36 * size, z, 0.6), leafy(sphere(0.045 * size, 7, 5), bloom, x + 0.07 * size, 0.31 * size, z - 0.04 * size, 0.6));
    keepClear.push([x, z, 0.2 * size]);
  }
  function addCrate(x: number, z: number, yaw: number, produce: string) {
    const crate = new THREE.Group();
    crate.add(part(rbox(0.42, 0.3, 0.36, 0.03), "#c8935a", 0, 0.15, 0));
    for (const y of [0.08, 0.2]) crate.add(part(box(0.43, 0.015, 0.37), "#a77a4c", 0, y, 0));
    for (let i = 0; i < 6; i += 1) crate.add(part(sphere(0.075, 10, 8), tint(produce, (i % 3) * 0.03), -0.12 + (i % 3) * 0.12, 0.33, -0.07 + Math.floor(i / 3) * 0.14));
    crate.position.set(x, 0, z);
    crate.rotation.y = yaw;
    propsRoot.add(crate);
    keepClear.push([x, z, 0.35]);
    groundShade.push([x, z, 0.5, 0.18]);
  }
  function addSunflower(x: number, z: number, height: number) {
    foliageRoot.add(leafy(cylinder(0.025, 0.035, height, 6), "#5d9a3f", x, height / 2, z, 0.2));
    for (const [side, y] of [[1, 0.35], [-1, 0.6]] as const) leafAt(foliageRoot, "#6aa84f", x, height * y, z, side > 0 ? 0.8 : 3.9, 0.2, 0.26, 0.18, 0.35, 0.4);
    const head = new THREE.Group();
    head.position.set(x, height, z);
    head.rotation.set(-0.5, 0.6, 0);
    for (let i = 0; i < 12; i += 1) {
      const petal = new THREE.Group();
      petal.rotation.z = (i / 12) * Math.PI * 2;
      const blade = leafy(leaf(0), "#f6c629", 0, 0.05, 0, 0.9);
      blade.rotation.x = -Math.PI / 2;
      blade.scale.set(0.07, 0.12, 0.12);
      petal.add(blade);
      head.add(petal);
    }
    head.add(turn(leafy(cylinder(0.07, 0.07, 0.04, 12), "#6b3f22", 0, 0, 0.01, 0.9), Math.PI / 2, 0, 0));
    foliageRoot.add(head);
    keepClear.push([x, z, 0.15]);
  }
  addPot(-6.0, -3.72, 1.1, "#ffd166");
  addPot(-7.25, -3.82, 0.9, "#f28fb1");
  addPot(-1.55, -3.45, 1.0, "#ef6f6c");
  addCrate(-0.75, -3.55, 0.2, "#e2483a");
  addCrate(2.62, -2.55, -0.5, "#7fc35a");
  addCrate(2.95, -2.15, -0.2, "#f08a2c");
  addSunflower(-5.7, -4.55, 1.05);
  addSunflower(-5.5, -5.15, 1.2);
  addSunflower(-5.85, -5.55, 0.95);

  for (const [x, z, s, bloom] of [
    [-3.65, -3.7, 0.9, "#f28fb1"], [-8.35, -4.0, 0.85, "#ffd166"], [10.0, -1.6, 1.0, ""], [10.4, -2.7, 0.8, "#ffffff"],
    [3.3, 3.2, 0.8, ""], [6.0, 4.45, 0.85, "#f28fb1"], [-1.6, 6.3, 0.9, "#ffd166"], [-14.6, -4.5, 1.1, ""],
    [-15.0, 3.0, 1.0, "#f28fb1"], [13.9, -5.8, 1.0, ""], [-6.2, 14.6, 1.1, "#ffffff"], [8.9, 12.4, 1.0, "#ffd166"],
    [-11.6, 6.35, 0.9, ""], [-3.5, 11.4, 0.7, "#ffffff"], [5.25, 11.5, 0.8, ""], [-10.6, -1.6, 0.8, "#ffffff"],
    [-13.2, -7.8, 1.0, "#f28fb1"], [12.1, -8.6, 0.9, ""], [0.9, 14.9, 0.9, "#ffd166"], [-9.5, 12.3, 1.0, ""],
    [10.6, 9.1, 0.85, "#ffffff"], [-0.3, -5.6, 0.9, ""], [4.2, -4.8, 0.8, "#f28fb1"],
  ] as const) addBush(x, z, s, bloom || undefined);
  for (const [x, z, s] of [[-9.3, -6.4, 1.1], [8.6, -3.6, 1.0], [-12.0, 9.4, 1.1], [6.2, 12.8, 1.0], [-14.0, 4.2, 1.0]] as const) addBanana(x, z, s);

  /* Far islands drifting in the haze around the farm, placed by where they show on screen:
     (right, up) in view units and how far behind the farm. */
  {
    const back = CAMERA_OFFSET.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(back, -back.y).normalize();
    const right = new THREE.Vector3().crossVectors(up, back);
    // A loose ring just outside the farm's outline on screen (about 16 wide, 9.5 tall).
    const islands: [number, number, number, number][] = [];
    for (let i = 0; i < 14; i += 1) {
      const random = mulberry32(i * 13 + 3);
      const angle = (i / 14) * Math.PI * 2 + random() * 0.25;
      const gap = 1.2 + random() * 3.2;
      islands.push([Math.cos(angle) * (16.2 + gap), Math.sin(angle) * (9.7 + gap * 0.7), 26 + random() * 24, 0.9 + random() * 1.8]);
    }
    islands.forEach(([sx, sy, depth, size], index) => {
      const random = mulberry32(index * 71 + 5);
      const island = new THREE.Group();
      island.position.copy(right.clone().multiplyScalar(sx).addScaledVector(up, sy).addScaledVector(back, -depth));
      const under = part(cone(size, size * 1.7, 9), "#8a7966", 0, -size * 0.85 - 0.15, 0);
      under.rotation.x = Math.PI;
      island.add(under, part(cylinder(size * 1.02, size * 0.98, size * 0.3, 16), "#7a5d43", 0, -0.1, 0), part(cylinder(size * 1.04, size * 1.02, 0.12, 16), "#8fbf62", 0, 0.06, 0));
      const trees = 1 + Math.floor(random() * 3);
      for (let i = 0; i < trees; i += 1) {
        const a = random() * Math.PI * 2;
        const d = random() * size * 0.55;
        const s = size * (0.22 + random() * 0.12);
        const tx = Math.cos(a) * d, tz = Math.sin(a) * d;
        island.add(part(cylinder(0.12 * s, 0.18 * s, s, 6), "#7a5638", tx, s * 0.5, tz));
        if (random() < 0.5) island.add(part(cone(s * 0.75, s * 2, 10), "#3f7a52", tx, s * 1.6, tz));
        else for (let k = 0; k < 3; k += 1) island.add(part(sphere(s * (0.6 - k * 0.1), 10, 8), "#5e9e4a", tx + (k - 1) * s * 0.3, s * (1.4 + (k % 2) * 0.25), tz));
      }
      if (index % 3 === 0) {
        // A little wind turbine.
        const tx = size * 0.45;
        island.add(part(cylinder(0.025 * size, 0.045 * size, size * 1.3, 6), "#f4f1ea", tx, size * 0.65, 0), part(sphere(0.05 * size, 8, 6), "#f4f1ea", tx, size * 1.3, 0.04 * size));
        for (let k = 0; k < 3; k += 1) {
          const blade = part(box(0.05 * size, size * 0.6, 0.015 * size), "#f4f1ea", 0, size * 0.3, 0);
          const hub = new THREE.Group();
          hub.position.set(tx, size * 1.3, 0.06 * size);
          hub.rotation.z = (k / 3) * Math.PI * 2 + index;
          hub.add(blade);
          island.add(hub);
        }
      }
      island.rotation.y = random() * 3;
      farRoot.add(island);
    });
  }

  /* The island itself: painted ground (grass with patches, dirt yard, sandy road, worn paths,
     soft shade under trees and buildings), a grassy lip and a rocky cliff tapering underneath. */
  const footpaths: [number, number, number, number, number][] = [
    [0.3, FARM_CENTER.z + 0.1, 3.9, FARM_CENTER.z + 0.3, 0.32],
    [FARM_CENTER.x, FARM_CENTER.z + 3.7, -2.6, ROAD_Z, 0.36],
    [-2.4, ROAD_Z + 0.1, ORCHARD.x, ORCHARD.z - 2.45, 0.36],
    [0.6, ROAD_Z, 0.9, PASTURE.z - PASTURE.hz, 0.4],
    [ROAD_END_X - 7, ROAD_Z, 8.1, 8.2, 0.34],
  ];
  {
    const R = 16;
    const step = 0.3;
    const n = Math.ceil((2 * R) / step);
    const grassA = new THREE.Color("#8cbf5e"), grassB = new THREE.Color("#a6cf69"), grassDark = new THREE.Color("#73a64e");
    const dirt = new THREE.Color("#b48e5f"), dirtDark = new THREE.Color("#9c7a50"), sand = new THREE.Color("#d9c592"), rut = new THREE.Color("#c4ab79");
    const pastureColor = new THREE.Color("#a9d47a"), orchardColor = new THREE.Color("#9ccd6f"), lip = new THREE.Color("#6e9e48");
    const c = new THREE.Color();
    const groundColor = (x: number, z: number) => {
      const n1 = noise2(x * 0.2 + 3, z * 0.2 + 1);
      const n2 = noise2(x * 0.85 + 7, z * 0.85 + 3);
      c.copy(grassA).lerp(grassB, n1).lerp(grassDark, smooth(0.55, 0.9, n2) * 0.45);
      c.lerp(pastureColor, rectMask(x, z, PASTURE.x, PASTURE.z, PASTURE.hx - 0.1, PASTURE.hz - 0.1, 0.5) * 0.55);
      c.lerp(orchardColor, rectMask(x, z, ORCHARD.x, ORCHARD.z, 3.5, 2.3, 0.5) * 0.5);
      for (const [ax, az, bx, bz, width] of footpaths) {
        const d = segmentDistance(x, z, ax, az, bx, bz);
        c.lerp(dirt, (1 - smooth(width * 0.4, width, d)) * (0.55 + n2 * 0.2));
      }
      const road = rectMask(x, z, (ROAD_END_X - 2.2) / 2, ROAD_Z, (ROAD_END_X + 2.2) / 2, 0.45, 0.3);
      if (road > 0) c.lerp(sand, road).lerp(rut, road * (1 - smooth(0.04, 0.14, Math.abs(Math.abs(z - ROAD_Z) - 0.24))) * 0.8);
      const yard = rectMask(x, z, FARM_CENTER.x, FARM_CENTER.z, 4.4, 3.3, 0.45);
      if (yard > 0) c.lerp(dirt, yard).lerp(dirtDark, yard * smooth(0.45, 0.85, n2) * 0.6);
      const r = Math.hypot(x, z);
      c.lerp(lip, smooth(15.2, 16, r) * 0.5);
      let shade = 0;
      for (const [sx, sz, radius, strength] of groundShade) {
        const d = Math.hypot(x - sx, z - sz);
        if (d < radius) shade += strength * (1 - d / radius) * (1 - d / radius);
      }
      shade = Math.min(0.42, shade);
      c.r *= 1 - shade;
      c.g *= 1 - shade * 0.92;
      c.b *= 1 - shade * 0.7;
      return c;
    };
    for (let i = 0; i < 12; i += 1) {
      const [px, pz] = plotPosition(i);
      groundShade.push([px, pz, 1.25, 0.1]);
    }
    groundShade.push([-2.1, -4.75, 2.1, 0.3], [1.6, -3.3, 1.3, 0.22], [TROUGH[0], TROUGH[1], 1.0, 0.15]);
    for (const [wx, wz] of Object.values(WORKSHOP_SPOTS)) groundShade.push([wx, wz, 1.3, 0.2]);
    // A square grid clipped to the circle: vertices outside are pulled onto the rim.
    const side = n + 1;
    const gridPositions = new Float32Array(side * side * 3);
    const gridColors = new Float32Array(side * side * 3);
    const outside = new Uint8Array(side * side);
    for (let i = 0; i < side; i += 1) {
      for (let j = 0; j < side; j += 1) {
        let x = -R + i * step, z = -R + j * step;
        const r = Math.hypot(x, z);
        const k = i * side + j;
        if (r > R) {
          x *= R / r;
          z *= R / r;
          outside[k] = 1;
        }
        gridPositions.set([x, -0.05, z], k * 3);
        const color = groundColor(x, z);
        gridColors.set([color.r, color.g, color.b], k * 3);
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const a = i * side + j, b = (i + 1) * side + j, cc = i * side + j + 1, d = (i + 1) * side + j + 1;
        if (!(outside[a] && outside[cc] && outside[b])) indices.push(a, cc, b);
        if (!(outside[b] && outside[cc] && outside[d])) indices.push(b, cc, d);
      }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.BufferAttribute(gridPositions, 3));
    top.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(side * side * 3).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    top.setAttribute("color", new THREE.BufferAttribute(gridColors, 3));
    top.setIndex(indices);
    owned.add(top);
    const topPart = part(top, "vertex");
    groundRoot.add(topPart);

    // Cliff rings from the grassy lip down to the point underneath; rough and faceted.
    const rings: [number, number, number, string][] = [
      [-0.05, 16, 0, "#6f9f4a"], [-0.17, 16.12, 0.05, "#5c8a3c"], [-0.42, 16.02, 0.12, "#6e4c33"], [-0.9, 15.85, 0.3, "#a38f74"],
      [-1.5, 15.6, 0.35, "#8f7b64"], [-2.1, 15.4, 0.35, "#b29d80"], [-2.7, 15.0, 0.4, "#857160"], [-3.6, 13.6, 0.9, "#7d6b59"],
      [-4.9, 11.2, 1.1, "#74624f"], [-6.3, 8.2, 1.0, "#6a5a49"], [-7.8, 5.0, 0.8, "#625343"], [-9.2, 2.0, 0.5, "#5b4d3f"], [-10.2, 0.25, 0, "#574a3d"],
    ];
    const segments = 120;
    const ringPoint = (ring: number, k: number): [number, number, number] => {
      const [y, radius, rough] = rings[ring];
      const angle = (k / segments) * Math.PI * 2;
      const wobble = rough * (noise2(k * 0.45, ring * 1.7) - 0.5) * 2;
      const lift = ring > 6 ? (noise2(k * 0.3 + 9, ring) - 0.5) * 0.6 : 0;
      return [Math.cos(angle) * (radius + wobble), y + lift, Math.sin(angle) * (radius + wobble)];
    };
    const cliffPositions: number[] = [];
    const cliffColors: number[] = [];
    for (let ring = 0; ring < rings.length - 1; ring += 1) {
      const upper = new THREE.Color(rings[ring][3]), lower = new THREE.Color(rings[ring + 1][3]);
      for (let k = 0; k < segments; k += 1) {
        const a = ringPoint(ring, k), b = ringPoint(ring, (k + 1) % segments), cc = ringPoint(ring + 1, k), d = ringPoint(ring + 1, (k + 1) % segments);
        const jitter = 0.94 + hash2(k, ring) * 0.12;
        for (const [p, col] of [[a, upper], [cc, lower], [b, upper], [b, upper], [cc, lower], [d, lower]] as const) {
          cliffPositions.push(...p);
          cliffColors.push(col.r * jitter, col.g * jitter, col.b * jitter);
        }
      }
    }
    const cliffGeometry = new THREE.BufferGeometry();
    cliffGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cliffPositions, 3));
    cliffGeometry.setAttribute("color", new THREE.Float32BufferAttribute(cliffColors, 3));
    cliffGeometry.computeVertexNormals();
    owned.add(cliffGeometry);
    groundRoot.add(part(cliffGeometry, "vertex"));
  }

  const groundMesh = bake(groundRoot, false, true, false);
  const propsMesh = bake(propsRoot, true, true);
  const foliageMesh = new THREE.Mesh(bakeGeometry(foliageRoot, true, true) ?? new THREE.BufferGeometry(), foliageMaterial);
  foliageMesh.castShadow = shadowsOn;
  foliageMesh.receiveShadow = true;
  const glowMesh = new THREE.Mesh(bakeGeometry(glowRoot, false) ?? new THREE.BufferGeometry(), glowMaterial);
  const farMesh = new THREE.Mesh(bakeGeometry(farRoot, false) ?? new THREE.BufferGeometry(), surface);
  // Purely decorative: skip them when picking so taps go straight to interactive objects.
  for (const item of [groundMesh, propsMesh, foliageMesh, glowMesh, farMesh]) {
    item.raycast = () => {};
    item.userData.ownsGeometry = true;
    world.add(item);
  }
  // The thousands of build-time parts are baked now; let them go.
  for (const root of [groundRoot, propsRoot, foliageRoot, glowRoot, farRoot]) root.clear();

  /* Grass tufts and wild flowers, in clumps wherever nothing else stands. */
  const riverClear = RIVER_HALF + 0.5;
  function grassFree(x: number, z: number): boolean {
    if (Math.hypot(x, z) > 15.75) return false;
    if (Math.abs(x - FARM_CENTER.x) < 4.9 && Math.abs(z - FARM_CENTER.z) < 3.8) return false;
    if (Math.abs(z - ROAD_Z) < 0.62 && x > -2.5 && x < ROAD_END_X + 1) return false;
    const px = (x - POND_CENTER.x) / (POND_RX + 0.5), pz = (z - POND_CENTER.z) / (POND_RZ + 0.5);
    if (px * px + pz * pz < 1) return false;
    for (const point of riverPoints) if (Math.abs(point.x - x) < riverClear && Math.abs(point.z - z) < riverClear && Math.hypot(point.x - x, point.z - z) < riverClear) return false;
    for (let i = 0; i < 6; i += 1) {
      const [sx, sz] = spotPosition(i);
      if (Math.hypot(sx - x, sz - z) < 1.0) return false;
    }
    for (const [wx, wz] of Object.values(WORKSHOP_SPOTS)) if (Math.hypot(wx - x, wz - z) < 1.15) return false;
    if (Math.hypot(TROUGH[0] - x, TROUGH[1] - z) < 1.0) return false;
    if (Math.hypot(-2.1 - x, -4.75 - z) < 1.75 || Math.hypot(1.6 - x, -3.3 - z) < 1.15) return false;
    for (const [cx, cz, radius] of keepClear) if (Math.hypot(cx - x, cz - z) < radius) return false;
    for (const [ax, az, bx, bz, width] of footpaths) if (segmentDistance(x, z, ax, az, bx, bz) < width * 0.8) return false;
    return true;
  }
  function scatter(count: number, clump: number, seed: number): THREE.Matrix4[] {
    const random = mulberry32(seed);
    const result: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let attempt = 0; attempt < count * 4 && result.length < count; attempt += 1) {
      const cx = (random() - 0.5) * 32, cz = (random() - 0.5) * 32;
      if (!grassFree(cx, cz)) continue;
      // The pasture is grazed short: fewer tufts there.
      if (Math.abs(cx - PASTURE.x) < PASTURE.hx && Math.abs(cz - PASTURE.z) < PASTURE.hz && random() < 0.6) continue;
      for (let k = 0; k < clump && result.length < count; k += 1) {
        const x = cx + (random() - 0.5) * 0.7, z = cz + (random() - 0.5) * 0.7;
        if (k > 0 && !grassFree(x, z)) continue;
        dummy.position.set(x, -0.05, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        const s = 0.75 + random() * 0.45;
        dummy.scale.set(s, s * (0.75 + random() * 0.55), s);
        dummy.updateMatrix();
        result.push(dummy.matrix.clone());
      }
    }
    return result;
  }
  const grassMaterial = makeSurface();
  addWind(grassMaterial, "instanced", 0.09);
  extraMaterials.push(grassMaterial);
  const tuft = tuftGeometry();
  const flower = flowerGeometry();
  owned.add(tuft);
  owned.add(flower);
  const tufts = scatter(preset.grass, 5, 91);
  const grass = new THREE.InstancedMesh(tuft, grassMaterial, Math.max(1, tufts.length));
  tufts.forEach((matrix, i) => {
    grass.setMatrixAt(i, matrix);
    const warm = decorRandom();
    grass.setColorAt(i, tmpColor.setRGB(0.9 + warm * 0.16, 0.96 + decorRandom() * 0.08, 0.86 - warm * 0.1));
  });
  grass.count = tufts.length;
  const blooms = scatter(preset.flowers, 4, 47);
  const flowers = new THREE.InstancedMesh(flower, grassMaterial, Math.max(1, blooms.length));
  const petalColors = ["#ffffff", "#f7a8c4", "#ffe27a", "#c7a6f0", "#ffb26b", "#ffffff"];
  blooms.forEach((matrix, i) => {
    flowers.setMatrixAt(i, matrix);
    flowers.setColorAt(i, tmpColor.set(petalColors[Math.floor(decorRandom() * petalColors.length)]));
  });
  flowers.count = blooms.length;
  for (const item of [grass, flowers]) {
    item.raycast = () => {};
    item.frustumCulled = false;
    item.receiveShadow = shadowsOn;
    world.add(item);
  }

  // Interactive buildings, one draw call each.
  function addBuilding(build: (root: THREE.Group) => void, hit: SceneHit, x: number, z: number, rotation: number, hitGeometry: THREE.BufferGeometry, hitY: number) {
    const root = new THREE.Group();
    build(root);
    const mesh = bake(root);
    mesh.raycast = () => {};
    const group = new THREE.Group();
    group.add(mesh, hitBox(hitGeometry, hit, hitY));
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    world.add(group);
    return group;
  }
  addBuilding((root) => {
    const random = mulberry32(5);
    const red = "#c4553f";
    root.add(part(rbox(2.4, 1.6, 1.8, 0.05), red, 0, 0.8, 0), part(rbox(2.46, 0.14, 1.86, 0.04), "#8e8a80", 0, 0.05, 0));
    // Vertical boards on the long walls.
    for (let i = -5; i <= 5; i += 1) {
      for (const side of [-1, 1]) root.add(part(box(0.016, 1.42, 0.012), tint(red, -0.1), i * 0.2, 0.82, side * 0.905));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(part(rbox(0.11, 1.62, 0.11, 0.025), "#f4ead6", sx * 1.18, 0.81, sz * 0.88));
    root.add(part(gable(2.4, 1.8, 0.88), red, 0, 1.6, 0));
    const roof = shingleRoof(2.75, 2.05, 1.0, "#6f4b3a", random);
    roof.position.y = 1.58;
    root.add(roof);
    // Double doors with white frames and cross braces.
    for (const side of [-1, 1]) {
      const x = side * 0.24;
      root.add(part(rbox(0.46, 1.04, 0.05, 0.015), tint(red, -0.05), x, 0.56, 0.92));
      root.add(part(rbox(0.5, 0.06, 0.06, 0.015), "#f4ead6", x, 1.06, 0.94), part(rbox(0.5, 0.06, 0.06, 0.015), "#f4ead6", x, 0.06, 0.94));
      root.add(part(rbox(0.06, 1.04, 0.06, 0.015), "#f4ead6", x + side * 0.22, 0.56, 0.94));
      root.add(turn(part(rbox(0.05, 1.12, 0.05, 0.015), "#f4ead6", x, 0.56, 0.945), 0, 0, side * 0.42));
    }
    // Hay loft door under the gable, a lantern over the doors and a weathervane.
    root.add(part(rbox(0.5, 0.42, 0.05, 0.015), "#f4ead6", 0, 1.95, 0.88), part(rbox(0.38, 0.32, 0.06, 0.015), tint(red, -0.08), 0, 1.95, 0.89));
    root.add(part(box(0.06, 0.1, 0.12), "#3b3530", 0, 1.32, 0.97));
    root.add(part(cylinder(0.015, 0.015, 0.5, 5), "#3b3530", 0.6, 2.85, 0), part(cone(0.06, 0.18, 4), "#3b3530", 0.6, 3.05, 0));
    root.add(turn(part(box(0.3, 0.05, 0.015), "#3b3530", 0.6, 2.98, 0), 0, 0.6, 0));
  }, { kind: "barn" }, -2.1, -4.75, -0.18, box(2.5, 2.6, 1.9), 1.2);
  // The barn's lamp, in world space over the doors.
  glowRoot.add(part(sphere(0.055, 8, 6), "#ffd99a", -2.1 + Math.sin(-0.18) * 1.0, 1.24, -4.75 + Math.cos(-0.18) * 1.0));
  addBuilding((root) => {
    const awning = part(rbox(1.75, 0.06, 1.05, 0.02), "#f2c94c", 0, 1.45, 0.08);
    awning.rotation.x = 0.18;
    root.add(awning);
    for (let i = 0; i < 4; i += 1) {
      const stripe = part(rbox(0.22, 0.07, 1.06, 0.02), "#e2533d", -0.66 + i * 0.44, 1.452, 0.08);
      stripe.rotation.x = 0.18;
      root.add(stripe);
    }
    // Scalloped edge along the front of the awning.
    for (let i = 0; i < 8; i += 1) {
      const scallop = part(sphere(0.11, 10, 6), i % 2 ? "#e2533d" : "#f2c94c", -0.77 + i * 0.22, 1.36, 0.6);
      scallop.scale.set(1, 0.7, 0.25);
      root.add(scallop);
    }
    root.add(part(rbox(1.5, 0.7, 0.75, 0.04), "#c8935a", 0, 0.35, 0), part(rbox(1.56, 0.06, 0.8, 0.02), "#a77a4c", 0, 0.72, 0));
    for (const y of [0.2, 0.45]) root.add(part(box(1.51, 0.015, 0.76), "#a77a4c", 0, y, 0));
    root.add(part(rbox(0.42, 0.26, 0.32, 0.03), "#a26f3f", -0.35, 0.88, 0), part(rbox(0.36, 0.2, 0.3, 0.03), "#b4834f", 0.3, 0.85, -0.05));
    for (let i = 0; i < 5; i += 1) root.add(part(sphere(0.075, 10, 8), "#e2533d", -0.48 + (i % 3) * 0.13, 1.04, -0.06 + Math.floor(i / 3) * 0.13));
    for (let i = 0; i < 4; i += 1) root.add(part(sphere(0.065, 10, 8), "#f08a2c", 0.22 + (i % 2) * 0.14, 0.99, -0.12 + Math.floor(i / 2) * 0.13));
    // A chalkboard sign.
    root.add(turn(part(rbox(0.36, 0.44, 0.03, 0.01), "#3c4a3e", 0.95, 0.35, 0.45), -0.2, -0.3, 0), turn(part(rbox(0.4, 0.04, 0.04, 0.01), "#a77a4c", 0.95, 0.58, 0.45), -0.2, -0.3, 0));
    for (const x of [-0.68, 0.68]) root.add(part(cylinder(0.04, 0.04, 1.45, 8), "#7a5638", x, 0.72, 0.4));
  }, { kind: "shop" }, 1.6, -3.3, -0.4, box(1.8, 1.8, 1.2), 0.8);
  addBuilding((root) => {
    root.add(part(box(1.4, 0.34, 0.6), "#9c6a3c", 0, 0.17, 0), part(box(1.24, 0.06, 0.44), "#5a3d24", 0, 0.32, 0));
    for (const x of [-0.6, 0.6]) root.add(part(box(0.1, 0.12, 0.6), "#7a5638", x, 0.04, 0));
  }, { kind: "trough" }, TROUGH[0], TROUGH[1], 0, box(1.6, 0.8, 0.9), 0.3);
  const feedFillRoot = new THREE.Group();
  // Origin at the bottom so scaling raises the feed level from the trough floor.
  feedFillRoot.add(part(box(1.2, 0.14, 0.42), "#e9c46a", 0, 0.07, 0));
  const feedFill = bake(feedFillRoot, false, true);
  feedFill.userData.ownsGeometry = true;
  feedFill.position.set(TROUGH[0], 0.3, TROUGH[1]);
  world.add(feedFill);

  // Windmill blades turn, so they stay a separate (single) mesh.
  const bladesRoot = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    arm.add(part(box(0.18, 1.25, 0.04), "#f8f3e6", 0, 0.62, 0));
    arm.rotation.z = (i * Math.PI) / 2;
    bladesRoot.add(arm);
  }
  const blades = bake(bladesRoot);
  blades.userData.ownsGeometry = true;
  blades.position.set(-9.9, 2.45, -1.98);
  world.add(blades);

  // Water stays separate because it is transparent. Medium and High use Làng Rêu's water: it
  // ripples, flows, takes the sky's colour at a glance and foams at the bank; Low stays flat.
  const shaderWater = preset.pbr;
  const pondWater = waterUniforms();
  const riverWaterUniforms = waterUniforms();
  for (const uniforms of [pondWater, riverWaterUniforms]) {
    uniforms.uSunDir.value.copy(sun.position).normalize();
    uniforms.uSunColor.value.set("#fff0d0");
    uniforms.uSky.value.set("#d6ecef");
  }
  pondWater.uDeep.value.set("#2c7672");
  pondWater.uShallow.value.set("#67c3b8");
  riverWaterUniforms.uDeep.value.set("#2f7d88");
  riverWaterUniforms.uShallow.value.set("#73c6cb");
  const waterMaterial: THREE.Material = shaderWater
    ? villageWater(pondWater, [0.4, 0.84])
    : new THREE.MeshLambertMaterial({ color: "#67c3b8", transparent: true, opacity: 0.45, depthWrite: false });
  extraMaterials.push(waterMaterial);
  const pondSurface = shaderWater ? pondGeometry() : null;
  if (pondSurface) owned.add(pondSurface);
  const water = new THREE.Mesh(pondSurface ?? circle(36), waterMaterial);
  if (pondSurface) {
    water.scale.set((POND_RX + 0.15) * 2, 1, (POND_RZ + 0.15) * 2);
  } else {
    water.rotation.x = -Math.PI / 2;
    water.scale.set(POND_RX + 0.15, POND_RZ + 0.15, 1);
  }
  water.position.set(POND_CENTER.x, WATER_Y, POND_CENTER.z);
  water.userData.hit = { kind: "pond" } satisfies SceneHit;
  water.renderOrder = 2;
  world.add(water);

  /** The river's surface with `aSide` (−1 west bank … 1 east bank) and `aFlow` downstream. */
  function riverSurface(): THREE.BufferGeometry {
    const geometry = riverRibbon(-RIVER_HALF - 0.02, RIVER_HALF + 0.02, RIVER_Y);
    const side: number[] = [];
    const flow: number[] = [];
    for (let i = 0; i < riverPoints.length - 1; i += 1) {
      const a = riverTangents[i], b = riverTangents[i + 1];
      // Same corner order as riverRibbon: a(from) c(next from) b(to) b c d(next to).
      for (const [s, t] of [[-1, a], [-1, b], [1, a], [1, a], [-1, b], [1, b]] as const) {
        side.push(s);
        flow.push(t.x * 0.55, t.z * 0.55);
      }
    }
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    geometry.setAttribute("aFlow", new THREE.Float32BufferAttribute(flow, 2));
    return geometry;
  }

  // The river's surface, flow streaks, fish shadows and the waterfall off the cliff.
  const riverMaterial: THREE.Material = shaderWater
    ? villageWater(riverWaterUniforms, [0.58, 0.9])
    : new THREE.MeshLambertMaterial({ color: "#5fb8b4", transparent: true, opacity: 0.58, depthWrite: false });
  extraMaterials.push(riverMaterial);
  const riverWater = new THREE.Mesh(shaderWater ? riverSurface() : riverRibbon(-RIVER_HALF - 0.02, RIVER_HALF + 0.02, RIVER_Y), riverMaterial);
  riverWater.userData.hit = { kind: "river" } satisfies SceneHit;
  riverWater.renderOrder = 2;
  world.add(riverWater);

  /** A point in the river: `u` 0 (spring) … 1 (waterfall), `offset` across it. */
  function riverAt(u: number, offset: number, target: THREE.Vector3): THREE.Vector3 {
    const f = Math.min(RIVER_SAMPLES - 0.001, Math.max(0, u * RIVER_SAMPLES));
    const i = Math.floor(f);
    const a = riverPoints[i], b = riverPoints[i + 1];
    const normal = across(riverTangents[i]);
    return target.set(a.x + (b.x - a.x) * (f - i) + normal.x * offset, RIVER_Y, a.z + (b.z - a.z) * (f - i) + normal.z * offset);
  }
  const flowMaterial = new THREE.MeshBasicMaterial({ color: "#f4fbf8", transparent: true, opacity: 0.45, depthWrite: false });
  extraMaterials.push(flowMaterial);
  const STREAKS = 18;
  const streaks = new THREE.InstancedMesh(box(0.55, 0.004, 0.035), flowMaterial, STREAKS);
  streaks.raycast = () => {};
  streaks.renderOrder = 3;
  const streakSeeds = Array.from({ length: STREAKS }, (_, i) => ({ u: i / STREAKS, offset: (((i * 37) % 11) / 10 - 0.5) * 1.5 }));
  world.add(streaks);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: "#163c3a", transparent: true, opacity: 0.32, depthWrite: false });
  extraMaterials.push(shadowMaterial);
  const SHADOWS = 5;
  const shadows = new THREE.InstancedMesh(circle(10), shadowMaterial, SHADOWS);
  shadows.raycast = () => {};
  const shadowSeeds = Array.from({ length: SHADOWS }, (_, i) => ({ u: 0.1 + i * 0.17, speed: (i % 2 ? 1 : -1) * (0.006 + i * 0.002), offset: (i % 3) * 0.35 - 0.35 }));
  world.add(shadows);
  const flowDummy = new THREE.Object3D();
  flowDummy.rotation.order = "YXZ";
  function placeAlong(mesh: THREE.InstancedMesh, index: number, u: number, offset: number, y: number, scale: [number, number, number], flat: boolean) {
    riverAt(u, offset, flowDummy.position);
    flowDummy.position.y = y;
    const tangent = riverTangents[Math.min(RIVER_SAMPLES, Math.round(u * RIVER_SAMPLES))];
    // Lie flat if needed, then turn the long side along the flow.
    flowDummy.rotation.set(flat ? -Math.PI / 2 : 0, Math.atan2(-tangent.z, tangent.x), 0);
    flowDummy.scale.set(...scale);
    flowDummy.updateMatrix();
    mesh.setMatrixAt(index, flowDummy.matrix);
  }
  function stepRiver(elapsed: number) {
    streakSeeds.forEach((seed, i) => {
      const u = (seed.u + elapsed * 0.012) % 1;
      const fade = Math.min(1, Math.min(u, 0.98 - u) * 12);
      placeAlong(streaks, i, u, seed.offset * RIVER_HALF * 0.6, RIVER_Y + 0.012, [Math.max(0.01, fade), 1, 1], false);
    });
    streaks.instanceMatrix.needsUpdate = true;
    shadowSeeds.forEach((seed, i) => {
      const u = (((seed.u + elapsed * seed.speed) % 0.9) + 0.9) % 0.9 + 0.04;
      const sway = Math.sin(elapsed * 0.7 + i * 2) * 0.25;
      placeAlong(shadows, i, u, seed.offset + sway, RIVER_Y - 0.03, [0.26, 0.09, 1], true);
    });
    shadows.instanceMatrix.needsUpdate = true;
  }
  stepRiver(0);

  // Waterfall: down the slope of the island's edge, then a free-falling curtain.
  const fallEnd = riverPoints[RIVER_SAMPLES];
  const fallOut = new THREE.Vector3(fallEnd.x, 0, fallEnd.z).normalize();
  const fallSide = across(riverTangents[RIVER_SAMPLES]).multiplyScalar(RIVER_HALF);
  const fallRows: [number, number][] = [[Math.hypot(fallEnd.x, fallEnd.z), RIVER_Y], [16.9, -1.05], [16.9, -3.4]];
  const fallPositions: number[] = [];
  const fallVertex = ([radius, y]: [number, number], side: number) => [fallOut.x * radius + fallSide.x * side, y, fallOut.z * radius + fallSide.z * side];
  for (let row = 0; row < fallRows.length - 1; row += 1) {
    const a = fallVertex(fallRows[row], -1), b = fallVertex(fallRows[row], 1), c = fallVertex(fallRows[row + 1], -1), d = fallVertex(fallRows[row + 1], 1);
    fallPositions.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const fallGeometry = new THREE.BufferGeometry();
  fallGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fallPositions, 3));
  fallGeometry.computeVertexNormals();
  owned.add(fallGeometry);
  const fallMaterial = new THREE.MeshBasicMaterial({ color: "#d4f1f0", transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
  extraMaterials.push(fallMaterial);
  const waterfall = new THREE.Mesh(fallGeometry, fallMaterial);
  waterfall.raycast = () => {};
  world.add(waterfall);

  const cloudMaterial = new THREE.MeshBasicMaterial({ color: "#fffdf2", transparent: true, opacity: 0.85 });
  extraMaterials.push(cloudMaterial);
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < preset.clouds; i += 1) {
    const root = new THREE.Group();
    for (let j = 0; j < 3; j += 1) root.add(part(sphere(0.75 + j * 0.12, 9, 7), "#ffffff", j * 0.85, j === 1 ? 0.25 : 0, 0));
    const geometry = bakeGeometry(root) ?? new THREE.BufferGeometry();
    const cloud = new THREE.Mesh(geometry, cloudMaterial);
    cloud.position.set(-14 + i * 8, 7 + (i % 2) * 1.2, -8 + i * 1.5);
    scene.add(cloud);
    clouds.push(cloud);
  }

  /* ───────────── plots ───────────── */
  interface PlotView { group: THREE.Group; key: string; popAt: number; icon: THREE.Sprite | null }
  const plotViews: PlotView[] = [];
  const clock = new THREE.Clock();

  function plotKey(plot: Plot): string {
    return [plot.status, plot.crop ?? "-", cropStage(plot), plot.thirsty ? 1 : 0, plot.weeds, plot.bugs].join("|");
  }

  function buildPlot(index: number, plot: Plot): { group: THREE.Group; icon: THREE.Sprite | null } {
    const group = new THREE.Group();
    const [x, z] = plotPosition(index);
    group.position.set(x, 0, z);
    const content = new THREE.Group();
    const random = mulberry32(index * 97 + 13);
    let iconSprite: THREE.Sprite | null = null;

    // A raised bed: a frame of rounded planks with corner posts around the soil.
    const frame = (wood: string, tall: number) => {
      const t = 0.13;
      const inner = PLOT_SIZE - t * 2;
      for (const side of [-1, 1]) {
        content.add(part(rbox(PLOT_SIZE, tall, t, 0.035, 2), tint(wood, side * 0.02), 0, tall / 2 - 0.05, side * (PLOT_SIZE / 2 - t / 2)));
        content.add(part(rbox(t, tall, inner, 0.035, 2), tint(wood, -side * 0.02), side * (PLOT_SIZE / 2 - t / 2), tall / 2 - 0.05, 0));
        // The seam between the two stacked boards.
        content.add(part(box(PLOT_SIZE + 0.004, 0.014, t + 0.004), tint(wood, -0.12), 0, tall / 2 - 0.06, side * (PLOT_SIZE / 2 - t / 2)));
        content.add(part(box(t + 0.004, 0.014, inner), tint(wood, -0.12), side * (PLOT_SIZE / 2 - t / 2), tall / 2 - 0.06, 0));
      }
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) content.add(part(rbox(0.17, tall + 0.08, 0.17, 0.04), tint(wood, -0.07), cx * (PLOT_SIZE / 2 - 0.07), (tall + 0.08) / 2 - 0.05, cz * (PLOT_SIZE / 2 - 0.07)));
      return inner;
    };
    if (plot.status === "locked") {
      const inner = frame("#c9b08a", 0.22);
      content.add(part(box(inner, 0.2, inner), "#94bd70", 0, 0.05, 0), part(rbox(0.08, 0.62, 0.08, 0.02), "#7a5638", 0, 0.36, 0), part(rbox(0.62, 0.36, 0.06, 0.02), "#d9b27a", 0, 0.62, 0.02));
      for (let i = 0; i < 5; i += 1) content.add(part(sphere(0.09, 8, 6), i % 2 ? "#7fb45a" : "#8fc265", (random() - 0.5) * 1.1, 0.16, (random() - 0.5) * 1.1));
      iconSprite = icon("lock", 0.55);
      iconSprite.position.set(0, 1.12, 0);
    } else {
      const soilColor = plot.status === "wild" ? "#8d7048" : plot.thirsty ? "#a9845c" : plot.status === "withered" ? "#7a573b" : "#5e3d29";
      const inner = frame(plot.thirsty ? "#c39a68" : "#b07a4a", 0.3);
      content.add(part(box(inner, 0.26, inner), soilColor, 0, 0.08, 0));
      // Crumbs of soil on top.
      for (let i = 0; i < 10; i += 1) content.add(part(dodeca(0.035 + random() * 0.03), tint(soilColor, (random() - 0.5) * 0.08), (random() - 0.5) * (inner - 0.1), 0.215, (random() - 0.5) * (inner - 0.1)));
      if (plot.status === "wild") {
        for (let i = 0; i < 9; i += 1) {
          const a = random() * Math.PI * 2;
          leafAt(content, i % 2 ? "#6fa24f" : "#88b65d", (random() - 0.5) * 1.2, 0.2, (random() - 0.5) * 1.2, a, 0.9 + random() * 0.4, 0.3 + random() * 0.12, 0.1, 0.2);
        }
        for (let i = 0; i < 3; i += 1) content.add(part(dodeca(0.1), "#b7b19c", (random() - 0.5) * 1.2, 0.24, (random() - 0.5) * 1.2));
      } else {
        const moundColor = tint(soilColor, plot.thirsty ? 0.02 : 0.035);
        const spots: [number, number][] = [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]];
        for (const [px, pz] of spots) {
          const mound = part(sphere(0.25, 12, 6), moundColor, px, 0.2, pz);
          mound.scale.set(1, 0.32, 1);
          content.add(mound);
        }
        if (plot.status === "withered") {
          for (let i = 0; i < 8; i += 1) {
            const stalk = part(cylinder(0.02, 0.03, 0.42, 4), "#a47d4e", (random() - 0.5) * 1.2, 0.42, (random() - 0.5) * 1.2);
            stalk.rotation.set((random() - 0.5) * 0.9, 0, (random() - 0.5) * 0.9);
            content.add(stalk);
          }
        }
        if (plot.status === "growing" && plot.crop) {
          const stage = cropStage(plot);
          spots.forEach(([px, pz], plantIndex) => {
            const plantNode = buildPlant(plot.crop as CropId, stage, mulberry32(index * 31 + plantIndex));
            plantNode.position.set(px + (random() - 0.5) * 0.06, 0.26, pz + (random() - 0.5) * 0.06);
            plantNode.rotation.y = random() * Math.PI * 2;
            content.add(plantNode);
          });
          for (let i = 0; i < plot.weeds; i += 1) {
            for (let j = 0; j < 5; j += 1) {
              leafAt(content, j % 2 ? "#3f6b2c" : "#4d7d35", (i === 0 ? -0.62 : 0.6) + (j - 2) * 0.03, 0.22, (i === 0 ? 0.02 : -0.08) + (j % 2) * 0.04, j * 1.3, 1.0 + (j % 3) * 0.15, 0.34, 0.07, 0.25);
            }
          }
          for (let i = 0; i < plot.bugs; i += 1) {
            const beetle = part(sphere(0.08, 10, 8), "#c8382c", i === 0 ? 0.08 : -0.15, stage >= 2 ? 0.68 : 0.38, i === 0 ? 0.05 : -0.22);
            beetle.scale.set(1, 0.6, 1.2);
            content.add(beetle, part(sphere(0.035, 6, 5), "#2b2b2b", (i === 0 ? 0.08 : -0.15), stage >= 2 ? 0.7 : 0.4, (i === 0 ? 0.05 : -0.22) + 0.09));
          }
          const iconName: IconName | null = isRipe(plot) ? "star" : plot.bugs > 0 ? "bug" : plot.thirsty ? "drop" : null;
          if (iconName) {
            iconSprite = icon(iconName);
            iconSprite.position.set(0, 1.55, 0);
          }
        }
      }
    }
    const mesh = bake(content);
    mesh.userData.ownsGeometry = true;
    // The hit box answers taps; testing the detailed bed and crops too would only cost time.
    mesh.raycast = () => {};
    group.add(mesh, hitBox(box(PLOT_PITCH * 0.98, 0.5, PLOT_PITCH * 0.98), { kind: "plot", index }, 0.2));
    if (iconSprite) group.add(iconSprite);
    return { group, icon: iconSprite };
  }

  function buildPlant(crop: CropId, stage: 0 | 1 | 2 | 3, random: () => number): THREE.Group {
    const plant = new THREE.Group();
    const leafDark = "#4a8f3a";
    const leafMid = "#5fa646";
    const leafLight = "#86c65c";
    if (stage === 0) {
      const hole = part(sphere(0.1, 10, 6), "#4a3020", 0, -0.02, 0);
      hole.scale.y = 0.35;
      plant.add(hole, part(sphere(0.032, 8, 6), "#e9d9a6", 0.01, 0.015, 0));
      return plant;
    }
    if (stage === 1) {
      plant.add(part(cylinder(0.012, 0.016, 0.12, 6), leafMid, 0, 0.05, 0));
      for (const side of [0, Math.PI]) leafAt(plant, leafLight, 0, 0.1, 0, side + 0.3, 0.35, 0.13, 0.11, 0.15);
      return plant;
    }
    const ripe = stage === 3;
    switch (crop) {
      case "cabbage": {
        const outer = ripe ? 8 : 6;
        for (let i = 0; i < outer; i += 1) {
          leafAt(plant, i % 2 ? "#4f9a3e" : "#5aa548", 0, 0.03, 0, (i / outer) * Math.PI * 2 + random() * 0.3, 0.22 + random() * 0.2, ripe ? 0.32 : 0.24, ripe ? 0.27 : 0.2, 0.35);
        }
        const head = part(sphere(ripe ? 0.19 : 0.12, 14, 10), ripe ? "#b4dc84" : "#86c062", 0, ripe ? 0.15 : 0.1, 0);
        head.scale.y = 0.85;
        plant.add(head);
        for (let i = 0; i < 4; i += 1) leafAt(plant, "#9fd273", 0, 0.05, 0, i * 1.57 + 0.4, 1.0, ripe ? 0.24 : 0.17, ripe ? 0.22 : 0.16, -0.12);
        break;
      }
      case "carrot": {
        for (let i = 0; i < 7; i += 1) {
          leafAt(plant, i % 2 ? leafMid : "#4c9a3a", 0, 0.02, 0, (i / 7) * Math.PI * 2 + random() * 0.4, 1.0 + random() * 0.3, ripe ? 0.46 : 0.32, 0.075, 0.22);
        }
        if (ripe) plant.add(part(cylinder(0.075, 0.06, 0.09, 12), "#f08a2c", 0, 0.01, 0), part(sphere(0.075, 12, 6), "#f39a45", 0, 0.055, 0));
        break;
      }
      case "tomato": {
        const height = ripe ? 0.62 : 0.46;
        plant.add(part(cylinder(0.014, 0.014, 0.85, 6), "#b98a55", 0.13, 0.4, 0), part(cylinder(0.018, 0.028, height, 6), "#4f8a3a", 0, height / 2, 0));
        const tiers = ripe ? 4 : 3;
        for (let i = 0; i < tiers * 3; i += 1) {
          leafAt(plant, i % 2 ? leafMid : leafDark, 0, 0.1 + Math.floor(i / 3) * 0.14, 0, i * 2.2 + random() * 0.5, 0.05 + random() * 0.3, 0.22, 0.17, 0.35);
        }
        for (const [cx, cy, cz, r] of [[0.08, 0.3, 0.05, 0.12], [-0.08, 0.4, -0.04, 0.11], [0.02, 0.5, -0.08, 0.09]] as const) {
          plant.add(part(sphere(r * (ripe ? 1 : 0.8), 10, 8), leafMid, cx, cy * (ripe ? 1 : 0.85), cz));
        }
        for (let i = 0; i < (ripe ? 6 : 3); i += 1) {
          const a = random() * Math.PI * 2;
          const y = 0.18 + random() * 0.3;
          const size = ripe ? 0.075 : 0.055;
          plant.add(part(sphere(size, 12, 9), ripe ? (i % 2 ? "#e2483a" : "#d93b2f") : "#9acb63", Math.cos(a) * 0.18, y, Math.sin(a) * 0.18));
          plant.add(part(cone(0.032, 0.025, 5), "#3f7a2c", Math.cos(a) * 0.18, y + size, Math.sin(a) * 0.18));
        }
        break;
      }
      case "corn": {
        const height = ripe ? 1.05 : 0.65;
        plant.add(part(cylinder(0.028, 0.045, height, 8), "#6aa84a", 0, height / 2, 0));
        for (let i = 0; i < 5; i += 1) leafAt(plant, i % 2 ? leafLight : leafMid, 0, 0.1 + i * height * 0.16, 0, i * 2.4, 0.45, 0.42 + (i < 3 ? 0.06 : 0), 0.085, 0.55);
        if (ripe) {
          const cob = part(cylinder(0.055, 0.07, 0.26, 10), "#f4cf45", 0.08, 0.6, 0);
          cob.rotation.z = -0.3;
          const husk = part(cone(0.075, 0.22, 8), "#a6c96a", 0.13, 0.43, 0);
          husk.rotation.z = Math.PI - 0.3;
          plant.add(cob, husk);
          for (let i = 0; i < 5; i += 1) leafAt(plant, "#d8b36a", 0, height, 0, i * 1.26, 1.1, 0.16, 0.025, 0.3);
        }
        break;
      }
      case "rice": {
        const color = ripe ? "#e2bf4f" : "#79b354";
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + random() * 0.3;
          const height = (ripe ? 0.62 : 0.45) + random() * 0.08;
          leafAt(plant, i % 2 ? color : tint(color, -0.05), Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03, a, 1.2 + random() * 0.15, height, 0.035, ripe ? 0.32 : 0.15);
          if (ripe) {
            const grain = part(sphere(0.035, 7, 6), "#f1d36b", Math.cos(a) * 0.19, height - 0.08, Math.sin(a) * 0.19);
            grain.scale.set(0.7, 2.0, 0.7);
            plant.add(grain);
          }
        }
        break;
      }
      case "strawberry": {
        for (let i = 0; i < 5; i += 1) leafAt(plant, i % 2 ? "#3f8a3a" : "#4f9a40", 0, 0.03, 0, (i / 5) * Math.PI * 2 + random() * 0.3, 0.35, 0.19, 0.17, 0.25);
        for (let i = 0; i < (ripe ? 4 : 2); i += 1) {
          const a = random() * Math.PI * 2;
          const berry = part(cone(0.055, 0.12, 10), ripe ? "#df3646" : "#e8f0c9", Math.cos(a) * 0.17, 0.07, Math.sin(a) * 0.17);
          berry.rotation.x = Math.PI;
          plant.add(berry, part(cone(0.04, 0.03, 5), "#3f7a2c", Math.cos(a) * 0.17, 0.135, Math.sin(a) * 0.17));
        }
        break;
      }
      case "pumpkin":
      case "watermelon": {
        for (let i = 0; i < 4; i += 1) leafAt(plant, i % 2 ? leafDark : leafMid, 0, 0.03, 0, (i / 4) * Math.PI * 2 + 0.6, 0.2, 0.3, 0.27, 0.3);
        const isPumpkin = crop === "pumpkin";
        const size = ripe ? 0.24 : 0.12;
        const color = isPumpkin ? (ripe ? "#ef8a2a" : "#b9c25a") : ripe ? "#3d7c3a" : "#8fbf62";
        if (isPumpkin) {
          // Ribs: a ring of squashed lobes around the core.
          for (let i = 0; i < 7; i += 1) {
            const a = (i / 7) * Math.PI * 2;
            const lobe = part(sphere(size * 0.55, 10, 8), tint(color, (i % 2) * 0.03), Math.cos(a) * size * 0.48, size * 0.62, Math.sin(a) * size * 0.48);
            lobe.scale.set(1, 1.15, 1);
            plant.add(lobe);
          }
          plant.add(part(sphere(size * 0.7, 12, 9), color, 0, size * 0.66, 0));
          if (ripe) plant.add(part(cylinder(0.022, 0.035, 0.12, 6), "#6b8a3a", 0, size * 1.3, 0));
        } else {
          const fruit = part(sphere(size, 14, 10), color, 0, size * 0.75, 0);
          fruit.scale.set(1.3, 0.85, 0.9);
          plant.add(fruit);
          if (ripe) {
            for (let i = 0; i < 4; i += 1) {
              const band = part(sphere(size * 1.01, 14, 10), "#86c46a", 0, size * 0.75, 0);
              band.scale.set(1.31, 0.86, 0.12);
              band.rotation.x = (i - 1.5) * 0.45;
              plant.add(band);
            }
          }
        }
        break;
      }
      case "sunflower": {
        const height = ripe ? 1.15 : 0.7;
        plant.add(part(cylinder(0.026, 0.04, height, 8), "#5d9a3f", 0, height / 2, 0));
        for (const [side, y] of [[1, 0.35], [-1, 0.55], [1, 0.75]] as const) leafAt(plant, leafLight, 0, height * y, 0, side > 0 ? 0.8 + y : 3.9 + y, 0.15, 0.24, 0.17, 0.35);
        const head = new THREE.Group();
        head.position.y = height;
        head.rotation.x = -0.5;
        const petals = ripe ? 14 : 8;
        for (let i = 0; i < petals; i += 1) {
          const petal = new THREE.Group();
          petal.rotation.z = (i / petals) * Math.PI * 2;
          const blade = part(leaf(0), ripe ? "#f6c629" : "#a7cf6b", 0, ripe ? 0.08 : 0.04, 0);
          blade.rotation.x = -Math.PI / 2;
          blade.scale.set(ripe ? 0.08 : 0.05, ripe ? 0.14 : 0.08, ripe ? 0.14 : 0.08);
          petal.add(blade);
          head.add(petal);
        }
        if (ripe) head.add(turn(part(cylinder(0.1, 0.1, 0.05, 14), "#6b3f22", 0, 0, 0.012), Math.PI / 2, 0, 0));
        plant.add(head);
        break;
      }
    }
    return plant;
  }

  /* ───────────── optional GLB models (Meshy) ───────────── */
  const models: Partial<Record<ModelKey, THREE.Object3D>> = {};
  let modelsVersion = 0;
  let disposed = false;

  async function loadModels() {
    try {
      const response = await fetch("/models/manifest.json", { cache: "no-cache" });
      if (!response.ok) return;
      const manifest = (await response.json()) as { models?: Partial<Record<ModelKey, ModelEntry>> };
      const entries = Object.entries(manifest.models ?? {}) as [ModelKey, ModelEntry][];
      if (entries.length === 0) return;
      const [{ GLTFLoader }, meshopt] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const loader = new GLTFLoader();
      // Models from scripts/meshy-models.mjs are meshopt-compressed; the decoder ships with three.
      type Decoder = Parameters<typeof loader.setMeshoptDecoder>[0];
      loader.setMeshoptDecoder((meshopt as unknown as { MeshoptDecoder: Decoder }).MeshoptDecoder);
      await Promise.all(
        entries.map(async ([key, entry]) => {
          if (!entry?.url || !/^\/models\/[\w.-]+\.glb$/.test(entry.url)) return;
          try {
            const gltf = await loader.loadAsync(entry.url);
            if (disposed) return;
            models[key] = normalizeModel(gltf.scene, entry.height ?? (key === "truck" ? 1.1 : ANIMAL_HEIGHT[key as AnimalId]), entry.rotationY ?? 0);
          } catch {
            // A broken model simply keeps the built-in look for that object.
          }
        }),
      );
      modelsVersion += 1;
    } catch {
      // No manifest, offline, or invalid JSON: built-in models are used.
    }
  }

  function normalizeModel(source: THREE.Object3D, height: number, rotationY: number): THREE.Object3D {
    const inner = source;
    inner.rotation.y = rotationY;
    const bounds = new THREE.Box3().setFromObject(inner);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = height / Math.max(0.0001, size.y);
    inner.scale.multiplyScalar(scale);
    bounds.setFromObject(inner);
    const center = bounds.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -bounds.min.y, -center.z);
    inner.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = shadowsOn;
      child.receiveShadow = true;
      const materials = (Array.isArray(child.material) ? child.material : [child.material]) as THREE.MeshStandardMaterial[];
      const next = materials.map((material) => {
        // On the cheapest preset, swap PBR materials for Lambert with the same colour texture.
        const replacement = preset.pbr ? material : new THREE.MeshLambertMaterial({ map: material.map ?? null, color: material.color });
        if (replacement.map) replacement.map.anisotropy = 1;
        extraMaterials.push(replacement);
        if (material.map) textures.push(material.map);
        return replacement;
      });
      child.material = Array.isArray(child.material) ? next : next[0];
      if (child.geometry) owned.add(child.geometry as THREE.BufferGeometry);
    });
    const wrapper = new THREE.Group();
    wrapper.add(inner);
    return wrapper;
  }
  void loadModels();

  /* ───────────── fish & litter ───────────── */
  interface FishView {
    group: THREE.Group;
    tail: THREE.Object3D;
    star: THREE.Sprite;
    phase: number;
    params: { ax: number; az: number; w1: number; w2: number; p1: number; p2: number; depth: number };
    scale: number;
    targetScale: number;
    mature: boolean;
  }
  const fishViews = new Map<string, FishView>();
  const trashViews = new Map<string, THREE.Group>();
  const fishTemplates = new Map<FishId, { body: THREE.BufferGeometry; tail: THREE.BufferGeometry }>();
  let hungry = false;

  function fishTemplate(species: FishId) {
    let template = fishTemplates.get(species);
    if (template) return template;
    const def = FISH_MAP[species];
    const round = species === "puffer";
    const bodyRoot = new THREE.Group();
    const body = part(sphere(0.5, 12, 8), def.color);
    body.scale.set(1, round ? 0.7 : 0.44, round ? 0.66 : 0.36);
    const dorsal = part(cone(0.12, 0.26, 4), def.accent, -0.05, round ? 0.33 : 0.22, 0);
    dorsal.scale.z = 0.3;
    dorsal.rotation.z = 0.5;
    bodyRoot.add(body, dorsal);
    if (species === "koi" || species === "goldfish") {
      for (const [x, s] of [[0.15, 0.17], [-0.18, 0.13]]) {
        const patch = part(sphere(s, 7, 5), species === "koi" ? def.accent : "#ffd29a", x, 0.15, 0);
        patch.scale.set(1.2, 0.4, 0.9);
        bodyRoot.add(patch);
      }
    }
    for (const side of [-1, 1]) bodyRoot.add(part(sphere(0.045, 6, 4), "#1d2420", 0.32, 0.06, side * (round ? 0.3 : 0.15)));
    const tailRoot = new THREE.Group();
    const fin = part(cone(0.26, 0.38, 4), def.accent, -0.17, 0, 0);
    fin.rotation.z = Math.PI / 2;
    fin.scale.z = 0.35;
    tailRoot.add(fin);
    template = { body: bakeGeometry(bodyRoot) ?? new THREE.BufferGeometry(), tail: bakeGeometry(tailRoot) ?? new THREE.BufferGeometry() };
    fishTemplates.set(species, template);
    return template;
  }

  function buildFish(fish: PondFish): FishView {
    const def = FISH_MAP[fish.species];
    const template = fishTemplate(fish.species);
    const random = mulberry32(hashString(fish.id));
    const group = new THREE.Group();
    group.userData.hit = { kind: "fish", id: fish.id } satisfies SceneHit;
    const body = new THREE.Mesh(template.body, surface);
    const tail = new THREE.Mesh(template.tail, surface);
    tail.position.x = -0.46;
    group.add(body, tail, new THREE.Mesh(sphere(0.75, 8, 6), hiddenMaterial));
    const star = icon("star", 0.62);
    star.visible = false;
    scene.add(star);
    const size = fishSize(fish.growth / def.growSeconds);
    group.scale.setScalar(size);
    world.add(group);
    return {
      group,
      tail,
      star,
      phase: random() * 100,
      params: { ax: 0.5 + random() * 0.28, az: 0.45 + random() * 0.25, w1: 0.16 + random() * 0.12, w2: 0.21 + random() * 0.16, p1: random() * 6.28, p2: random() * 6.28, depth: -0.02 + random() * 0.04 },
      scale: size,
      targetScale: size,
      mature: false,
    };
  }

  const trashTemplates = new Map<string, THREE.BufferGeometry>();
  function buildTrash(item: PondTrash): THREE.Group {
    let geometry = trashTemplates.get(item.kind);
    if (!geometry) {
      const root = new THREE.Group();
      if (item.kind === "leaf") {
        const leafNode = part(sphere(0.2, 6, 4), "#a0703a");
        leafNode.scale.set(1.4, 0.15, 0.8);
        root.add(leafNode);
      } else if (item.kind === "bottle") {
        const bottle = part(cylinder(0.08, 0.08, 0.36, 7), "#a9dbe8");
        bottle.rotation.z = Math.PI / 2;
        const neck = part(cylinder(0.035, 0.05, 0.1, 6), "#a9dbe8", 0.22, 0, 0);
        neck.rotation.z = Math.PI / 2;
        root.add(bottle, neck);
      } else {
        const can = part(cylinder(0.08, 0.08, 0.2, 8), "#c94a3a");
        can.rotation.x = Math.PI / 2;
        root.add(can);
      }
      geometry = bakeGeometry(root) ?? new THREE.BufferGeometry();
      trashTemplates.set(item.kind, geometry);
    }
    const group = new THREE.Group();
    group.userData.hit = { kind: "trash", id: item.id } satisfies SceneHit;
    group.add(new THREE.Mesh(geometry, surface), new THREE.Mesh(sphere(0.5, 8, 6), hiddenMaterial));
    const [x, z] = pondPoint(item.x, item.z);
    group.position.set(x, WATER_Y + 0.02, z);
    group.rotation.y = hashString(item.id) % 6;
    world.add(group);
    return group;
  }

  /* ───────────── ranch: animals, products, workshops, truck ───────────── */
  interface AnimalView {
    group: THREE.Group;
    body: THREE.Object3D;
    bowl: THREE.Sprite;
    species: AnimalId;
    modelsVersion: number;
    target: THREE.Vector2;
    wait: number;
    speed: number;
    hop: number;
  }
  const animalViews = new Map<string, AnimalView>();
  const dropViews = new Map<string, THREE.Group>();
  const animalTemplates = new Map<AnimalId, THREE.BufferGeometry>();
  const dropTemplates = new Map<ProductId, THREE.BufferGeometry>();

  function animalTemplate(species: AnimalId): THREE.BufferGeometry {
    let template = animalTemplates.get(species);
    if (template) return template;
    const def = ANIMAL_MAP[species];
    const root = new THREE.Group();
    if (species === "chicken") {
      const body = part(sphere(0.22, 10, 8), def.color, 0, 0.3, 0);
      body.scale.set(1, 0.9, 1.15);
      const tail = part(cone(0.12, 0.22, 5), def.color, 0, 0.42, -0.22);
      tail.rotation.x = -0.7;
      const beak = part(cone(0.05, 0.12, 4), "#f2a541", 0, 0.5, 0.3);
      beak.rotation.x = Math.PI / 2;
      root.add(body, tail, part(sphere(0.12, 8, 6), def.color, 0, 0.52, 0.17), part(box(0.04, 0.09, 0.12), def.accent, 0, 0.66, 0.17), part(sphere(0.035, 5, 4), def.accent, 0, 0.44, 0.27), beak);
      for (const side of [-1, 1]) {
        root.add(part(cylinder(0.02, 0.02, 0.18, 4), "#e9a23b", side * 0.08, 0.09, 0));
        root.add(part(sphere(0.025, 5, 4), "#222222", side * 0.075, 0.55, 0.26));
      }
    } else if (species === "duck") {
      const body = part(sphere(0.24, 10, 8), def.color, 0, 0.26, 0);
      body.scale.set(0.9, 0.72, 1.3);
      const tail = part(cone(0.1, 0.18, 5), def.color, 0, 0.36, -0.3);
      tail.rotation.x = -1;
      root.add(body, tail, part(sphere(0.13, 8, 6), def.color, 0, 0.5, 0.22), part(box(0.13, 0.05, 0.16), def.accent, 0, 0.46, 0.38));
      for (const side of [-1, 1]) {
        root.add(part(sphere(0.025, 5, 4), "#222222", side * 0.08, 0.54, 0.31));
        root.add(part(box(0.08, 0.03, 0.12), def.accent, side * 0.09, 0.02, 0.05));
      }
    } else if (species === "sheep") {
      const fleece = part(ico(0.36, 1), def.color, 0, 0.5, 0);
      fleece.scale.set(1, 0.85, 1.25);
      root.add(fleece, part(box(0.22, 0.24, 0.26), def.accent, 0, 0.56, 0.46), part(ico(0.13, 0), def.color, 0, 0.72, 0.42));
      for (const side of [-1, 1]) {
        const ear = part(box(0.14, 0.05, 0.07), def.accent, side * 0.16, 0.62, 0.44);
        ear.rotation.z = side * 0.4;
        root.add(ear, part(sphere(0.025, 5, 4), "#ffffff", side * 0.07, 0.6, 0.6));
        for (const z of [-0.22, 0.22]) root.add(part(cylinder(0.05, 0.05, 0.32, 5), def.accent, side * 0.17, 0.16, z));
      }
    } else {
      root.add(part(box(0.56, 0.46, 0.96), def.color, 0, 0.6, 0));
      root.add(part(box(0.57, 0.24, 0.3), def.accent, 0, 0.66, -0.15), part(box(0.3, 0.2, 0.25), def.accent, 0.05, 0.74, 0.3));
      root.add(part(box(0.36, 0.34, 0.36), def.color, 0, 0.78, 0.6), part(box(0.3, 0.16, 0.12), "#f1b5b0", 0, 0.68, 0.8));
      root.add(part(sphere(0.1, 7, 5), "#f1b5b0", 0, 0.36, -0.1));
      for (const side of [-1, 1]) {
        const horn = part(cone(0.04, 0.14, 4), "#efe3c4", side * 0.15, 1.0, 0.55);
        horn.rotation.z = -side * 0.5;
        root.add(horn, part(sphere(0.03, 5, 4), "#222222", side * 0.13, 0.84, 0.78));
        for (const z of [-0.34, 0.34]) root.add(part(cylinder(0.06, 0.06, 0.4, 5), "#f6f2ea", side * 0.2, 0.2, z), part(box(0.13, 0.06, 0.13), "#3a332c", side * 0.2, 0.03, z));
      }
    }
    template = bakeGeometry(root) ?? new THREE.BufferGeometry();
    animalTemplates.set(species, template);
    return template;
  }

  function animalBody(species: AnimalId): THREE.Object3D {
    const model = models[species];
    if (model) return model.clone(true);
    const mesh = new THREE.Mesh(animalTemplate(species), surface);
    mesh.castShadow = shadowsOn;
    return mesh;
  }

  function randomPasturePoint(seed: number): THREE.Vector2 {
    const random = mulberry32(seed);
    const [x, z] = pasturePoint(random() * 2 - 1, random() * 2 - 1);
    // Keep animals off the trough.
    if (Math.abs(x - TROUGH[0]) < 1 && Math.abs(z - TROUGH[1]) < 0.6) return new THREE.Vector2(x + 1.4, z + 0.8);
    return new THREE.Vector2(x, z);
  }

  function buildAnimal(animal: RanchAnimal, index: number): AnimalView {
    const group = new THREE.Group();
    group.userData.hit = { kind: "animal", id: animal.id } satisfies SceneHit;
    const body = animalBody(animal.species);
    const size = ANIMAL_HEIGHT[animal.species];
    group.add(body, new THREE.Mesh(sphere(Math.max(0.45, size * 0.6), 8, 6), hiddenMaterial));
    const start = randomPasturePoint(hashString(animal.id) + index);
    group.position.set(start.x, 0, start.y);
    const bowl = icon("bowl", 0.55);
    bowl.position.set(0, size + 0.45, 0);
    bowl.visible = false;
    group.add(bowl);
    world.add(group);
    return {
      group,
      body,
      bowl,
      species: animal.species,
      modelsVersion,
      target: randomPasturePoint(hashString(animal.id) * 7 + 1),
      wait: 0,
      speed: animal.species === "chicken" ? 0.9 : animal.species === "duck" ? 0.7 : 0.45,
      hop: hashString(animal.id) % 10,
    };
  }

  function dropTemplate(product: ProductId): THREE.BufferGeometry {
    let template = dropTemplates.get(product);
    if (template) return template;
    const root = new THREE.Group();
    if (product === "egg" || product === "duckEgg") {
      const egg = part(sphere(0.1, 10, 8), product === "egg" ? "#fff6e4" : "#cfe9df", 0, 0.13, 0);
      egg.scale.y = 1.3;
      root.add(egg);
    } else if (product === "wool") {
      root.add(part(ico(0.17, 1), "#f8f5ee", 0, 0.17, 0), part(ico(0.11, 0), "#ece6da", 0.12, 0.12, 0.05));
    } else {
      root.add(part(cylinder(0.08, 0.09, 0.24, 8), "#ffffff", 0, 0.12, 0), part(cylinder(0.04, 0.07, 0.08, 8), "#ffffff", 0, 0.28, 0), part(cylinder(0.045, 0.045, 0.05, 8), "#3e7fd6", 0, 0.34, 0));
    }
    template = bakeGeometry(root) ?? new THREE.BufferGeometry();
    dropTemplates.set(product, template);
    return template;
  }

  function buildDrop(drop: RanchDrop): THREE.Group {
    const group = new THREE.Group();
    group.userData.hit = { kind: "drop", id: drop.id } satisfies SceneHit;
    const mesh = new THREE.Mesh(dropTemplate(drop.product), surface);
    mesh.castShadow = shadowsOn;
    group.add(mesh, new THREE.Mesh(sphere(0.42, 8, 6), hiddenMaterial));
    const [x, z] = pasturePoint(drop.x, drop.z);
    group.position.set(x, 0, z);
    group.rotation.y = hashString(drop.id) % 6;
    world.add(group);
    return group;
  }

  interface WorkshopView { group: THREE.Group; key: string; smoke: THREE.Mesh[]; star: THREE.Sprite | null; running: boolean }
  const workshopViews = new Map<WorkshopId, WorkshopView>();
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#f4f1ea", transparent: true, opacity: 0.75 });
  extraMaterials.push(smokeMaterial);

  function buildWorkshop(id: WorkshopId, game: GameState): WorkshopView {
    const def = WORKSHOP_MAP[id];
    const state = game.ranch.workshops[id];
    const running = !!state && state.progress !== null;
    const ready = (state?.ready ?? 0) > 0;
    const locked = levelFromXp(game.xp) < def.level;
    const key = `${state ? "built" : locked ? "locked" : "open"}|${running}|${ready}`;
    const [x, z] = WORKSHOP_SPOTS[id];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = -0.25;
    const root = new THREE.Group();
    const smoke: THREE.Mesh[] = [];
    let star: THREE.Sprite | null = null;
    if (!state) {
      root.add(part(rbox(1.7, 0.08, 1.5, 0.03), "#b99a6b", 0, 0, 0), part(rbox(0.08, 0.7, 0.08, 0.02), "#7a5638", -0.55, 0.35, 0.55), part(rbox(0.6, 0.34, 0.06, 0.02), "#e8d3a6", -0.55, 0.66, 0.58));
      for (const [bx, bz] of [[0.35, -0.3], [0.55, 0.15]]) root.add(part(rbox(0.32, 0.22, 0.32, 0.03), "#c8935a", bx, 0.11, bz));
      const sprite = icon(locked ? "lock" : "build", 0.6);
      sprite.position.set(0, 1.25, 0);
      group.add(sprite);
    } else {
      root.add(part(rbox(1.6, 1.0, 1.3, 0.04), "#f3e3c3", 0, 0.5, 0), part(rbox(1.66, 0.12, 1.36, 0.03), "#b8a789", 0, 0.05, 0), part(gable(1.6, 1.3, 0.62), "#f3e3c3", 0, 1.0, 0));
      const roof = shingleRoof(1.85, 1.45, 0.7, def.roof, mulberry32(hashString(id)));
      roof.position.y = 0.98;
      root.add(roof, part(rbox(0.42, 0.62, 0.05, 0.015), "#7a5638", 0.3, 0.31, 0.66), part(rbox(0.22, 0.55, 0.22, 0.03), "#a9573f", -0.45, 1.55, -0.2));
      addWindow(root, -0.38, 0.6, 0.66, 0.36, 0.3, root);
      for (let i = 0; i < 2; i += 1) {
        const puff = new THREE.Mesh(sphere(0.14 + i * 0.05, 7, 5), smokeMaterial);
        puff.position.set(-0.45, 1.9 + i * 0.3, -0.2);
        puff.visible = running;
        group.add(puff);
        smoke.push(puff);
      }
      if (ready) {
        star = icon("star", 0.7);
        star.position.set(0.3, 2.25, 0);
        group.add(star);
      }
    }
    const mesh = bake(root);
    mesh.userData.ownsGeometry = true;
    mesh.raycast = () => {};
    group.add(mesh, hitBox(box(1.8, 2.2, 1.6), { kind: "workshop", id }, 0.9));
    world.add(group);
    return { group, key, smoke, star, running };
  }

  let truckGroup: THREE.Group | null = null;
  let truckModelsVersion = -1;
  const cargoRoot = new THREE.Group();
  cargoRoot.add(part(box(0.36, 0.3, 0.36), "#c8935a", -0.55, 0.78, 0.18), part(box(0.36, 0.3, 0.36), "#d9a86c", -0.15, 0.78, -0.16), part(box(0.3, 0.26, 0.3), "#b4834f", -0.55, 0.78, -0.2));
  // Owned by the scene for its whole life; it moves between truck rebuilds.
  const cargo = bake(cargoRoot);

  function buildTruck() {
    if (truckGroup) releaseGeometry(truckGroup);
    const group = new THREE.Group();
    group.userData.hit = { kind: "truck" } satisfies SceneHit;
    const model = models.truck;
    if (model) {
      group.add(model.clone(true));
    } else {
      const root = new THREE.Group();
      root.add(part(box(0.72, 0.62, 0.86), "#d9533b", 0.56, 0.55, 0), part(box(0.06, 0.3, 0.7), "#bfe3e8", 0.93, 0.66, 0), part(box(1.25, 0.12, 0.92), "#8b5a35", -0.38, 0.4, 0));
      for (const side of [-1, 1]) root.add(part(box(1.25, 0.26, 0.06), "#a77a4c", -0.38, 0.56, side * 0.44));
      root.add(part(box(0.06, 0.26, 0.92), "#a77a4c", -0.98, 0.56, 0));
      for (const [wx, wz] of [[0.55, 0.45], [0.55, -0.45], [-0.6, 0.45], [-0.6, -0.45]]) {
        const wheel = part(cylinder(0.19, 0.19, 0.14, 10), "#2f2b28", wx, 0.19, wz);
        wheel.rotation.x = Math.PI / 2;
        root.add(wheel, turn(part(cylinder(0.08, 0.08, 0.15, 8), "#d9d4c7", wx, 0.19, wz), Math.PI / 2, 0, 0));
      }
      root.add(part(box(0.08, 0.1, 0.18), "#ffe9a3", 0.93, 0.36, 0.28), part(box(0.08, 0.1, 0.18), "#ffe9a3", 0.93, 0.36, -0.28));
      const mesh = bake(root);
      mesh.userData.ownsGeometry = true;
      group.add(mesh);
    }
    group.add(cargo, hitBox(box(2.2, 1.4, 1.3), { kind: "truck" }, 0.6));
    group.position.set(TRUCK_PARK_X, 0, ROAD_Z);
    world.add(group);
    truckGroup = group;
    truckModelsVersion = modelsVersion;
  }
  buildTruck();

  /* ───────────── orchard ───────────── */
  interface SpotView { group: THREE.Group; tree: THREE.Object3D | null; key: string; popAt: number; shakeAt: number; height: number }
  const spotViews: SpotView[] = [];

  function fruitStage(spot: TreeSpot): number {
    if (!spot.tree || treeStage(spot) < 2) return 0;
    return Math.min(3, Math.floor((spot.fruit / TREE_MAP[spot.tree].fruitSeconds) * 3));
  }

  function spotKey(spot: TreeSpot): string {
    return [spot.status, spot.tree ?? "-", treeStage(spot), fruitStage(spot), spot.thirsty ? 1 : 0].join("|");
  }

  /** A fruit tree at a growth stage, with its fruit from tiny and green (1) to ripe (3). */
  function buildTree(fruit: FruitId, stage: 0 | 1 | 2, ripeness: number, random: () => number): { root: THREE.Group; height: number } {
    const def = TREE_MAP[fruit];
    const root = new THREE.Group();
    if (stage === 0) {
      root.add(part(cylinder(0.025, 0.035, 0.45, 5), "#7a5638", 0, 0.25, 0));
      for (let i = 0; i < 3; i += 1) {
        const leaf = part(sphere(0.09, 6, 4), def.leaf, Math.cos(i * 2.1) * 0.08, 0.36 + i * 0.06, Math.sin(i * 2.1) * 0.08);
        leaf.scale.set(1.4, 0.45, 0.8);
        leaf.rotation.y = i * 2.1;
        root.add(leaf);
      }
      return { root, height: 0.6 };
    }
    const s = stage === 1 ? 0.62 : 1;
    const fruitColor = ripeness >= 2 ? def.color : "#86b84f";
    const fruitSize = [0, 0.045, 0.07, 0.095][ripeness] * (fruit === "coconut" ? 1.5 : fruit === "mango" ? 1.15 : 1) * s;
    const frond = (holder: THREE.Group, angle: number, length: number, width: number, droop: number, color: string) => {
      const arm = new THREE.Group();
      arm.rotation.y = angle;
      const blade = part(leaf(0.4), color);
      blade.scale.set(width, length, length);
      const hinge = new THREE.Group();
      hinge.rotation.x = droop;
      hinge.add(blade);
      arm.add(hinge);
      holder.add(arm);
    };
    if (fruit === "banana") {
      const top = 1.3 * s;
      root.add(part(cylinder(0.11 * s, 0.16 * s, top, 7), "#8aa04e", 0, top / 2, 0));
      const crown = new THREE.Group();
      crown.position.y = top;
      for (let i = 0; i < 6; i += 1) frond(crown, (i / 6) * Math.PI * 2 + random() * 0.3, 1.05 * s, 0.34 * s, 0.45 + random() * 0.3, i % 2 ? def.leaf : "#7fc35a");
      root.add(crown);
      if (ripeness > 0) {
        for (let i = 0; i < 8; i += 1) {
          const finger = part(cylinder(0.03 * s, 0.035 * s, (0.1 + ripeness * 0.03) * s, 5), fruitColor, 0.2 * s + Math.cos(i * 1.7) * 0.06 * s, top - 0.22 * s - Math.floor(i / 3) * 0.09 * s, Math.sin(i * 1.7) * 0.06 * s);
          finger.rotation.z = 0.5;
          root.add(finger);
        }
        root.add(part(cone(0.05 * s, 0.14 * s, 6), "#7a2f4f", 0.2 * s, top - 0.55 * s, 0));
      }
      return { root, height: top + 0.6 * s };
    }
    if (fruit === "coconut") {
      let x = 0;
      let y = 0;
      for (let i = 0; i < 5; i += 1) {
        root.add(part(cylinder(0.1 * s, 0.12 * s, 0.48 * s, 7), i % 2 ? "#9a7b56" : "#8a6c4a", x, y + 0.24 * s, 0));
        x += 0.05 * s;
        y += 0.45 * s;
      }
      const crown = new THREE.Group();
      crown.position.set(x, y, 0);
      for (let i = 0; i < 8; i += 1) frond(crown, (i / 8) * Math.PI * 2 + random() * 0.2, 1.1 * s, 0.18 * s, 0.55 + random() * 0.3, i % 2 ? def.leaf : "#6fae52");
      root.add(crown);
      if (ripeness > 0) for (let i = 0; i < 4; i += 1) root.add(part(sphere(fruitSize, 8, 6), ripeness >= 2 ? def.color : "#86b84f", x + Math.cos(i * 1.6) * 0.13 * s, y - 0.1 * s, Math.sin(i * 1.6) * 0.13 * s));
      return { root, height: y + 0.35 * s };
    }
    // Round-crowned fruit trees: lemon, orange, mango.
    const trunk = 0.8 * s;
    const crown = (fruit === "mango" ? 0.7 : 0.6) * s;
    const middle = trunk + crown * 0.8;
    root.add(part(cylinder(0.08 * s, 0.13 * s, trunk, 6), "#7a5638", 0, trunk / 2, 0));
    for (const side of [-1, 1]) root.add(turn(part(cylinder(0.03 * s, 0.05 * s, 0.4 * s, 6), "#7a5638", side * 0.12 * s, trunk * 0.92, 0), 0, 0, -side * 0.7));
    // A clumpy crown: a core, a ring of smaller clumps and a top, lighter towards the sun.
    const blobs: [number, number, number, number][] = [[0, 0, 0, 0.85], [0, 0.62, 0, 0.62]];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + random() * 0.4;
      blobs.push([Math.cos(a) * 0.42, -0.1 + random() * 0.25, Math.sin(a) * 0.42, 0.5 + random() * 0.12]);
    }
    blobs.forEach(([bx, by, bz, r]) => root.add(part(sphere(crown * r, 12, 9), tint(def.leaf, by * 0.15 + (random() - 0.5) * 0.04), bx * crown * 1.15, middle + by * crown, bz * crown * 1.15)));
    if (ripeness > 0) {
      const count = fruit === "lemon" ? 8 : fruit === "orange" ? 9 : 7;
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const lift = -0.35 + random() * 0.8;
        const reach = crown * 1.02;
        const node = part(sphere(fruitSize * 1.3, 10, 8), fruitColor, Math.cos(angle) * Math.cos(lift) * reach, middle + Math.sin(lift) * reach, Math.sin(angle) * Math.cos(lift) * reach);
        if (fruit === "mango") node.scale.set(0.8, 1.2, 0.8);
        if (fruit === "lemon") node.scale.set(1.15, 0.9, 0.9);
        root.add(node);
      }
    }
    return { root, height: middle + crown };
  }

  function buildSpot(index: number, spot: TreeSpot): { group: THREE.Group; tree: THREE.Object3D | null; height: number } {
    const group = new THREE.Group();
    const [x, z] = spotPosition(index);
    group.position.set(x, 0, z);
    const base = new THREE.Group();
    const random = mulberry32(index * 53 + 7);
    let tree: THREE.Object3D | null = null;
    let height = 0.4;
    let iconSprite: THREE.Sprite | null = null;
    if (spot.status === "locked") {
      base.add(part(cylinder(0.85, 0.9, 0.08, 14), "#a6c97f", 0, 0, 0), part(box(0.08, 0.6, 0.08), "#7a5638", 0, 0.35, 0), part(box(0.62, 0.36, 0.06), "#d9b27a", 0, 0.62, 0.02));
      iconSprite = icon("lock", 0.55);
      iconSprite.position.set(0, 1.12, 0);
    } else {
      base.add(part(cylinder(0.82, 0.86, 0.07, 16), "#8fbd67", 0, 0, 0));
      if (spot.status === "grass") {
        for (let i = 0; i < 6; i += 1) {
          const x = (random() - 0.5) * 1.1, z = (random() - 0.5) * 1.1;
          for (let k = 0; k < 4; k += 1) leafAt(base, (i + k) % 2 ? "#6fa24f" : "#88b65d", x, 0.03, z, k * 1.6 + i, 1.0 + (k % 2) * 0.25, 0.26 + (k % 3) * 0.04, 0.07, 0.2);
        }
      } else if (spot.status === "hole") {
        const mound = part(sphere(0.26, 8, 6), "#7a573b", 0.48, 0.03, 0.22);
        mound.scale.y = 0.42;
        base.add(part(cylinder(0.34, 0.3, 0.03, 14), "#3b2a1d", 0, 0.045, 0), mound);
      } else if (spot.tree) {
        base.add(part(cylinder(0.5, 0.54, 0.05, 14), spot.thirsty ? "#a9845c" : "#6b4630", 0, 0.045, 0));
        const built = buildTree(spot.tree, treeStage(spot), fruitStage(spot), random);
        height = built.height;
        tree = bake(built.root);
        tree.userData.ownsGeometry = true;
        tree.position.y = 0.06;
        const iconName: IconName | null = isTreeRipe(spot) ? "star" : spot.thirsty ? "drop" : null;
        if (iconName) {
          iconSprite = icon(iconName);
          iconSprite.position.set(0, height + 0.5, 0);
        }
      }
    }
    const mesh = bake(base);
    mesh.userData.ownsGeometry = true;
    mesh.raycast = () => {};
    group.add(mesh, hitBox(box(1.9, 2.4, 1.9), { kind: "tree", index }, 1.2));
    if (tree) group.add(tree);
    if (iconSprite) group.add(iconSprite);
    return { group, tree, height };
  }

  /* ───────────── particles: dirt, seeds, water, leaves, fruit ───────────── */
  type Burst = "dirt" | "seed" | "water" | "leaf" | "bug" | "spark" | "crop" | "fruit" | "chips" | "splash";
  const PARTICLES = 160;
  const particleMaterial = new THREE.MeshLambertMaterial();
  extraMaterials.push(particleMaterial);
  const particles = new THREE.InstancedMesh(ico(1, 0), particleMaterial, PARTICLES);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  particles.raycast = () => {};
  const particleState = Array.from({ length: PARTICLES }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, gravity: 1, bounce: 0, spin: 0 }));
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < PARTICLES; i += 1) {
    particles.setMatrixAt(i, hiddenMatrix);
    particles.setColorAt(i, tmpColor.set("#ffffff"));
  }
  world.add(particles);
  let nextParticle = 0;
  let particlesLive = false;
  const BURSTS: Record<Burst, { colors: string[]; up: [number, number]; out: number; size: number; life: number; gravity: number; bounce: number; drop?: number }> = {
    dirt: { colors: ["#6b4630", "#8d7048", "#5a3a26"], up: [2, 3.4], out: 1.4, size: 0.07, life: 0.75, gravity: 1, bounce: 0 },
    seed: { colors: ["#e2c98f", "#c9a86a"], up: [-0.4, 0.4], out: 0.5, size: 0.035, life: 0.6, gravity: 1, bounce: 0, drop: 0.55 },
    water: { colors: ["#7cc6f0", "#a9dcf7"], up: [-1.6, -0.6], out: 0.35, size: 0.04, life: 0.55, gravity: 1, bounce: 0, drop: 0.75 },
    leaf: { colors: ["#5fa043", "#7fc35a"], up: [1.8, 3], out: 1.1, size: 0.07, life: 0.85, gravity: 0.6, bounce: 0 },
    bug: { colors: ["#c8382c", "#2b2b2b"], up: [2, 3], out: 1.5, size: 0.05, life: 0.55, gravity: 1, bounce: 0 },
    spark: { colors: ["#ffe066", "#fff4b8"], up: [1.2, 2.8], out: 0.7, size: 0.05, life: 0.9, gravity: 0.25, bounce: 0 },
    crop: { colors: ["#ffffff"], up: [2.8, 4], out: 1, size: 0.1, life: 0.85, gravity: 1, bounce: 0 },
    fruit: { colors: ["#ffffff"], up: [0, 0.6], out: 0.7, size: 0.11, life: 1.7, gravity: 1, bounce: 0.38 },
    chips: { colors: ["#c19a6b", "#a77a4c"], up: [2, 3.2], out: 1.6, size: 0.07, life: 0.75, gravity: 1, bounce: 0 },
    splash: { colors: ["#e8f6fb", "#bfe6f2"], up: [1.4, 2.6], out: 0.8, size: 0.045, life: 0.5, gravity: 1, bounce: 0 },
  };
  function burst(kind: Burst, x: number, y: number, z: number, count: number, color?: string) {
    const def = BURSTS[kind];
    const total = reducedMotion ? Math.ceil(count / 3) : count;
    for (let k = 0; k < total; k += 1) {
      const index = nextParticle;
      nextParticle = (nextParticle + 1) % PARTICLES;
      const p = particleState[index];
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random();
      p.x = x + Math.cos(angle) * spread * (kind === "fruit" ? 0.45 : 0.3);
      p.z = z + Math.sin(angle) * spread * (kind === "fruit" ? 0.45 : 0.3);
      p.y = y + (def.drop ?? 0);
      p.vx = Math.cos(angle) * def.out * (0.4 + Math.random() * 0.6);
      p.vz = Math.sin(angle) * def.out * (0.4 + Math.random() * 0.6);
      p.vy = def.up[0] + Math.random() * (def.up[1] - def.up[0]);
      p.size = def.size * (0.7 + Math.random() * 0.6);
      p.life = def.life * (0.75 + Math.random() * 0.5);
      p.gravity = def.gravity;
      p.bounce = def.bounce;
      p.spin = (Math.random() - 0.5) * 12;
      particles.setColorAt(index, tmpColor.set(color ?? def.colors[k % def.colors.length]));
    }
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
    particlesLive = true;
  }
  const particleMatrix = new THREE.Matrix4();
  const particleQuat = new THREE.Quaternion();
  const particleEuler = new THREE.Euler();
  const particlePos = new THREE.Vector3();
  const particleScale = new THREE.Vector3();
  function stepParticles(dt: number) {
    if (!particlesLive) return;
    let alive = false;
    particleState.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) {
        particles.setMatrixAt(i, hiddenMatrix);
        return;
      }
      alive = true;
      p.vy -= 9.8 * p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce > 0 && p.y < 0.08 && p.vy < 0) {
        p.y = 0.08;
        p.vy = Math.abs(p.vy) > 0.6 ? -p.vy * p.bounce : 0;
        p.vx *= 0.55;
        p.vz *= 0.55;
        p.spin *= 0.5;
      }
      const shrink = Math.min(1, p.life / 0.25);
      particleEuler.set(p.spin * p.life, p.spin * 0.6 * p.life, 0);
      particleQuat.setFromEuler(particleEuler);
      particlePos.set(p.x, p.y, p.z);
      particleScale.setScalar(p.size * shrink);
      particleMatrix.compose(particlePos, particleQuat, particleScale);
      particles.setMatrixAt(i, particleMatrix);
    });
    particles.instanceMatrix.needsUpdate = true;
    particlesLive = alive;
  }

  /* ───────────── the tool in hand during a drag ───────────── */
  type ToolModel = "hoe" | "bag" | "fert" | "can" | "glove" | "shovel" | "sapling";
  const TOOL_MODEL: Record<SceneTool, ToolModel> = { hand: "glove", seed: "bag", water: "can", weed: "glove", bug: "glove", fertilize: "fert", hoe: "hoe", shovel: "shovel", sapling: "sapling" };
  const toolMeshes = new Map<ToolModel, THREE.Mesh>();
  /** Where water or seeds leave the tool, in the tool's own space. */
  const TOOL_SPOUT: Partial<Record<ToolModel, THREE.Vector3>> = { can: new THREE.Vector3(0.42, 0.3, 0), bag: new THREE.Vector3(0.05, 0.3, 0), fert: new THREE.Vector3(0.05, 0.3, 0) };
  function toolMesh(model: ToolModel): THREE.Mesh {
    let mesh = toolMeshes.get(model);
    if (mesh) return mesh;
    const root = new THREE.Group();
    if (model === "hoe" || model === "shovel") {
      const handle = part(cylinder(0.025, 0.03, 1.15, 6), "#a77a4c", -0.28, 0.55, 0);
      handle.rotation.z = 0.5;
      root.add(handle);
      if (model === "hoe") root.add(turn(part(box(0.3, 0.05, 0.2), "#8d9aa3", 0.02, 0.06, 0), 0, 0, -0.9));
      else root.add(part(box(0.24, 0.32, 0.03), "#9aa5ad", 0.0, 0.12, 0), part(box(0.24, 0.05, 0.05), "#7a5638", -0.55, 1.06, 0));
    } else if (model === "bag" || model === "fert") {
      const sack = part(sphere(0.22, 10, 8), model === "bag" ? "#d9b27a" : "#f1ede0", 0, 0, 0);
      sack.scale.set(1, 1.15, 0.85);
      root.add(sack, part(cone(0.1, 0.16, 7), model === "bag" ? "#c49a5e" : "#e3dccb", 0, 0.29, 0), part(box(0.3, 0.06, 0.2), model === "bag" ? "#7fc35a" : "#4f9a3d", 0, 0.02, 0.15));
    } else if (model === "can") {
      const spout = part(cylinder(0.025, 0.04, 0.42, 6), "#4a87c2", 0.27, 0.16, 0);
      spout.rotation.z = -0.95;
      root.add(part(cylinder(0.18, 0.2, 0.3, 12), "#5b9bd5", 0, 0, 0), spout, part(sphere(0.06, 7, 5), "#4a87c2", 0.43, 0.3, 0), turn(part(box(0.06, 0.26, 0.05), "#4a87c2", -0.21, 0.12, 0), 0, 0, 0.3), part(box(0.24, 0.05, 0.05), "#4a87c2", -0.1, 0.26, 0));
    } else if (model === "glove") {
      const palm = part(sphere(0.15, 9, 7), "#f2c26b", 0, 0, 0);
      palm.scale.set(1, 0.55, 0.9);
      root.add(palm, part(cylinder(0.05, 0.06, 0.18, 6), "#d9a84f", -0.16, 0, 0));
      for (let i = 0; i < 4; i += 1) root.add(turn(part(cylinder(0.035, 0.035, 0.17, 5), "#f2c26b", 0.15, -0.02, -0.09 + i * 0.06), 0, 0, Math.PI / 2 + 0.3));
      root.add(turn(part(cylinder(0.035, 0.035, 0.13, 5), "#f2c26b", 0.04, 0, 0.14), 0.8, 0, 0));
    } else {
      root.add(part(cylinder(0.13, 0.1, 0.18, 9), "#c4553f", 0, 0, 0), part(cylinder(0.02, 0.025, 0.4, 5), "#7a5638", 0, 0.25, 0));
      for (let i = 0; i < 4; i += 1) {
        const leaf = part(sphere(0.08, 6, 4), "#5fa043", Math.cos(i * 1.6) * 0.07, 0.38 + i * 0.04, Math.sin(i * 1.6) * 0.07);
        leaf.scale.set(1.4, 0.45, 0.8);
        root.add(leaf);
      }
    }
    mesh = bake(root, false, false);
    mesh.userData.ownsGeometry = true;
    mesh.raycast = () => {};
    toolMeshes.set(model, mesh);
    return mesh;
  }
  const cursor = new THREE.Group();
  cursor.visible = false;
  cursor.scale.setScalar(1.6);
  // Turned so the tool is seen from the side by this camera.
  cursor.rotation.y = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
  world.add(cursor);
  const cursorTarget = new THREE.Vector3();
  let tool: SceneTool = "hand";
  let workAt = -10;
  let cursorLeft = 0;
  let emitCarry = 0;
  function setTool(next: SceneTool) {
    tool = next;
    cursor.clear();
    cursor.add(toolMesh(TOOL_MODEL[next]));
  }
  setTool("hand");

  /* ───────────── fishing: rod, line, float, ripples, the fish on the hook ───────────── */
  jettyRoot.updateMatrixWorld(true);
  const hands = jettyRoot.localToWorld(new THREE.Vector3(-0.02, 0.6, 0));
  const ROD_LENGTH = 1.7;
  const ROD_ANGLE = 0.85;
  const rodPivot = new THREE.Group();
  const rodTurn = new THREE.Group();
  rodTurn.position.copy(hands);
  rodTurn.rotation.y = -Math.atan2(jettyAcross.z, jettyAcross.x);
  rodTurn.add(rodPivot);
  const rodRoot = new THREE.Group();
  rodRoot.add(turn(part(cylinder(0.012, 0.024, ROD_LENGTH, 5), "#6b4a2b", ROD_LENGTH / 2, 0, 0), 0, 0, -Math.PI / 2), turn(part(cylinder(0.03, 0.03, 0.08, 8), "#3b3b3b", 0.25, 0, 0.04), Math.PI / 2, 0, 0));
  const rod = bake(rodRoot);
  rod.userData.ownsGeometry = true;
  rod.raycast = () => {};
  rodPivot.add(rod);
  rodPivot.rotation.z = ROD_ANGLE;
  world.add(rodTurn);
  const rodTip = new THREE.Vector3();
  const LINE_POINTS = 18;
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(LINE_POINTS * 3), 3));
  owned.add(lineGeometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color: "#fdfaf0" });
  extraMaterials.push(lineMaterial);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.frustumCulled = false;
  line.raycast = () => {};
  world.add(line);
  const floatRoot = new THREE.Group();
  floatRoot.add(part(sphere(0.075, 10, 8), "#e2533d", 0, 0.03, 0), part(sphere(0.07, 10, 8), "#fffdf2", 0, -0.015, 0), part(cylinder(0.008, 0.008, 0.14, 4), "#2b2b2b", 0, 0.13, 0));
  const bobber = bake(floatRoot, false, false);
  bobber.userData.ownsGeometry = true;
  bobber.raycast = () => {};
  bobber.visible = false;
  world.add(bobber);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });
  extraMaterials.push(ringMaterial);
  const ripple = new THREE.Mesh(primitive("ring", () => new THREE.RingGeometry(0.82, 1, 28)), ringMaterial);
  ripple.rotation.x = -Math.PI / 2;
  ripple.raycast = () => {};
  world.add(ripple);
  let rippleAt = -10;
  const alert = icon("alert", 0.7);
  alert.visible = false;
  world.add(alert);
  const approach = new THREE.Mesh(circle(10), shadowMaterial);
  approach.rotation.x = -Math.PI / 2;
  approach.scale.set(0.24, 0.09, 1);
  approach.visible = false;
  approach.raycast = () => {};
  world.add(approach);
  const catchGeometries = new Map<WildCatch, THREE.BufferGeometry>();
  function catchGeometry(caught: WildCatch): THREE.BufferGeometry {
    let geometry = catchGeometries.get(caught);
    if (geometry) return geometry;
    const root = new THREE.Group();
    if (caught === "boot") {
      root.add(part(box(0.14, 0.3, 0.14), "#4a3a2c", 0, 0.1, 0), part(box(0.28, 0.1, 0.15), "#4a3a2c", 0.07, -0.05, 0));
    } else if (caught === "prawn") {
      for (let i = 0; i < 5; i += 1) root.add(part(sphere(0.06 - i * 0.007, 7, 5), WILD_FISH_MAP.prawn.color, -i * 0.07, Math.sin(i * 0.6) * 0.04, 0));
      root.add(turn(part(cylinder(0.008, 0.008, 0.3, 4), "#d9534f", 0.14, 0.04, 0), 0, 0, 1.2));
    } else {
      const def = WILD_FISH_MAP[caught];
      const long = caught === "snakehead" || caught === "featherback" || caught === "catfish";
      const body = part(sphere(0.2, 10, 8), def.color);
      body.scale.set(long ? 1.6 : 1.1, 0.42, 0.32);
      const tail = part(cone(0.1, 0.16, 4), tint(def.color, -0.08), -(long ? 0.36 : 0.26), 0, 0);
      tail.rotation.z = Math.PI / 2;
      tail.scale.z = 0.35;
      root.add(body, tail, part(sphere(0.022, 6, 4), "#1d2420", (long ? 0.26 : 0.17), 0.03, 0.06));
      if (caught === "catfish") for (const side of [-1, 1]) root.add(turn(part(cylinder(0.006, 0.006, 0.18, 3), "#2b2b2b", 0.36, -0.02, side * 0.05), 0, side * 0.6, Math.PI / 2));
    }
    geometry = bakeGeometry(root) ?? new THREE.BufferGeometry();
    catchGeometries.set(caught, geometry);
    return geometry;
  }
  const hooked = new THREE.Mesh(new THREE.BufferGeometry(), surface);
  hooked.visible = false;
  hooked.raycast = () => {};
  world.add(hooked);
  let hookedKind: WildCatch | null = null;
  let lastPhase: FishingState["phase"] = "ready";
  let wasNibbling = false;
  const catchFrom = new THREE.Vector3();
  const floatPos = new THREE.Vector3();
  const castPoint = new THREE.Vector3();
  const tipWater = new THREE.Vector3();

  /** World point for fishing-spot coordinates (along the river, out from the jetty). */
  function fishingPoint([along, out]: [number, number], target: THREE.Vector3): THREE.Vector3 {
    return target
      .copy(jettyPoint)
      .addScaledVector(jettyTangent, along * CAST_ALONG)
      .addScaledVector(jettyAcross, -0.05 + out * (RIVER_HALF - 0.2))
      .setY(RIVER_Y);
  }

  function stepFishingView(elapsed: number, motion: number) {
    const link = options.fishing;
    if (!link) return;
    const state = link.state.current;
    const phase = state.phase;
    const active = phase === "waiting" || phase === "bite" || phase === "reeling";
    rodTip.set(ROD_LENGTH, 0, 0);
    rodPivot.rotation.z = ROD_ANGLE - (phase === "reeling" ? state.tension * 0.32 : 0) + (phase === "reeling" && state.t < 0.25 ? 0.3 * (1 - state.t / 0.25) : 0);
    rodTurn.updateMatrixWorld(true);
    rodPivot.localToWorld(rodTip);
    tipWater.copy(jettyPoint).addScaledVector(jettyAcross, 0.05).setY(RIVER_Y);
    if (state.at) fishingPoint(state.at, castPoint);

    if (phase !== lastPhase) {
      if (phase === "waiting") rippleAt = elapsed + 0.35;
      if (phase === "bite") {
        rippleAt = elapsed;
        burst("splash", castPoint.x, RIVER_Y, castPoint.z, 10);
        if (typeof navigator !== "undefined") navigator.vibrate?.(70);
      }
      if (phase === "caught") {
        catchFrom.copy(floatPos);
        burst("splash", floatPos.x, RIVER_Y, floatPos.z, 14);
      }
      if (phase === "reeling" && state.catch) {
        hookedKind = state.catch;
        hooked.geometry = catchGeometry(state.catch);
      }
      lastPhase = phase;
    }
    const nibbling = isNibbling(state);
    if (nibbling && !wasNibbling) rippleAt = elapsed;
    wasNibbling = nibbling;

    // The float: flies out, bobs, dips at a nibble, plunges at the bite, is dragged in while reeling.
    if (phase === "waiting" && state.t < 0.35) {
      const k = state.t / 0.35;
      floatPos.lerpVectors(rodTip, castPoint, k);
      floatPos.y = rodTip.y + (RIVER_Y - rodTip.y) * k + Math.sin(k * Math.PI) * 0.6;
    } else if (phase === "reeling") {
      floatPos.lerpVectors(tipWater, castPoint, state.distance);
      floatPos.y = RIVER_Y - 0.03 - state.tension * 0.03;
      floatPos.x += Math.sin(elapsed * 23) * state.pull * 0.03 * motion;
    } else {
      floatPos.copy(castPoint);
      floatPos.y = RIVER_Y + 0.02 + Math.sin(elapsed * 3) * 0.012 * motion - (nibbling ? 0.04 : 0) - (phase === "bite" ? 0.11 + Math.sin(elapsed * 30) * 0.02 * motion : 0);
    }
    const lingering = (phase === "late" || phase === "slack" || phase === "spooked") && state.t < 0.7;
    bobber.visible = active || lingering;
    bobber.position.copy(floatPos);
    line.visible = active || (lingering && phase !== "spooked");
    if (line.visible) {
      const positions = lineGeometry.attributes.position as THREE.BufferAttribute;
      const sag = phase === "reeling" ? (1 - Math.min(1, state.tension * 1.2)) * 0.35 : 0.3;
      for (let i = 0; i < LINE_POINTS; i += 1) {
        const k = i / (LINE_POINTS - 1);
        positions.setXYZ(i, rodTip.x + (floatPos.x - rodTip.x) * k, rodTip.y + (floatPos.y + 0.12 - rodTip.y) * k - sag * 4 * k * (1 - k), rodTip.z + (floatPos.z - rodTip.z) * k);
      }
      positions.needsUpdate = true;
    }
    alert.visible = phase === "bite";
    if (alert.visible) alert.position.set(castPoint.x, 0.75 + Math.sin(elapsed * 8) * 0.05 * motion, castPoint.z);
    const sinceRipple = elapsed - rippleAt;
    if (sinceRipple >= 0 && sinceRipple < 0.9) {
      ripple.visible = true;
      ripple.position.set(floatPos.x, RIVER_Y + 0.01, floatPos.z);
      ripple.scale.setScalar(0.08 + sinceRipple * 0.5);
      ringMaterial.opacity = 0.7 * (1 - sinceRipple / 0.9);
    } else ripple.visible = false;

    // A fish shadow swims up to the bait before the bite.
    const firstTouch = Math.min(state.nibbles[0] ?? state.biteAt, state.biteAt);
    approach.visible = (phase === "waiting" && state.t > firstTouch - 1.6) || phase === "bite";
    if (approach.visible) {
      const k = phase === "bite" ? 1 : Math.min(1, (state.t - (firstTouch - 1.6)) / 1.6);
      approach.position.copy(castPoint).addScaledVector(jettyTangent, -(1 - k) * 1.4).setY(RIVER_Y - 0.03);
      approach.rotation.z = Math.atan2(-jettyTangent.z, jettyTangent.x);
    }

    // The catch: under the float while reeling (leaping when it pulls), then up to the angler.
    hooked.visible = false;
    if (phase === "reeling" && hookedKind) {
      hooked.visible = true;
      const leap = state.pull > 0.35 ? Math.abs(Math.sin(elapsed * 9)) * 0.22 * motion : 0;
      hooked.position.set(floatPos.x, RIVER_Y - 0.06 + leap, floatPos.z);
      hooked.rotation.set(0, Math.atan2(floatPos.z - tipWater.z, tipWater.x - floatPos.x) + Math.sin(elapsed * 14) * 0.4 * motion, leap * 2);
    } else if (phase === "caught" && hookedKind && state.t < 2.2) {
      hooked.visible = true;
      const k = Math.min(1, state.t / 0.8);
      const above = hands.clone().setY(hands.y + 0.75);
      hooked.position.lerpVectors(catchFrom, above, k);
      hooked.position.y += Math.sin(k * Math.PI) * 0.7;
      hooked.rotation.set(0, Math.atan2(-jettyAcross.z, jettyAcross.x), k < 1 ? Math.sin(elapsed * 20) * 0.5 * motion : 0.2);
    }
  }

  /* ───────────── selection marker ───────────── */
  const selectorRoot = new THREE.Group();
  for (const [x, z, w, d] of [[0, -0.98, 2.04, 0.1], [0, 0.98, 2.04, 0.1], [-0.98, 0, 0.1, 2.04], [0.98, 0, 0.1, 2.04]]) selectorRoot.add(part(box(w, 0.08, d), "#fff2a8", x, 0.24, z));
  const selectorMaterial = new THREE.MeshBasicMaterial({ color: "#ffe680" });
  extraMaterials.push(selectorMaterial);
  const selector = new THREE.Mesh(bakeGeometry(selectorRoot) ?? new THREE.BufferGeometry(), selectorMaterial);
  selector.visible = false;
  world.add(selector);

  /* ───────────── state sync ───────────── */
  let latest: GameState | null = null;

  let previous: GameState | null = null;

  /** Dirt, seeds, water… for whatever changed on a plot since the last state. */
  function plotEffects(index: number, before: Plot, after: Plot) {
    const [x, z] = plotPosition(index);
    if ((before.status === "wild" || before.status === "withered") && after.status === "tilled") burst("dirt", x, 0.25, z, 16);
    if (before.status === "locked" && after.status !== "locked") burst("spark", x, 0.3, z, 12);
    if (before.status === "tilled" && after.status === "growing") burst("seed", x, 0.3, z, 14);
    if (before.status === "growing" && after.status === "withered" && before.crop) burst("crop", x, 0.4, z, 12, CROP_COLORS[before.crop]);
    if (before.thirsty && !after.thirsty && after.status === "growing") burst("water", x, 0.3, z, 18);
    if (after.weeds < before.weeds) burst("leaf", x, 0.3, z, 10);
    if (after.bugs < before.bugs) burst("bug", x, 0.45, z, 8);
    if (!before.fertilized && after.fertilized) burst("spark", x, 0.3, z, 16);
  }

  /** The same for a tree spot; returns true when the tree was just shaken. */
  function spotEffects(index: number, before: TreeSpot, after: TreeSpot, height: number): boolean {
    const [x, z] = spotPosition(index);
    if (before.status === "locked" && after.status !== "locked") burst("spark", x, 0.3, z, 12);
    if (before.status === "grass" && after.status === "hole") burst("dirt", x, 0.2, z, 16);
    if (before.status === "hole" && after.status === "tree") burst("leaf", x, 0.4, z, 10);
    if (before.status === "tree" && after.status === "hole") burst("chips", x, 0.5, z, 14);
    if (before.thirsty && !after.thirsty && after.status === "tree") burst("water", x, 0.5, z, 18);
    if (before.tree && isTreeRipe(before) && after.tree === before.tree && !isTreeRipe(after)) {
      const def = TREE_MAP[before.tree];
      burst("fruit", x, height * 0.75, z, def.yield + 2, def.color);
      return true;
    }
    return false;
  }

  function update(game: GameState) {
    latest = game;
    const now = clock.getElapsedTime();
    const before = previous;
    previous = game;
    game.plots.forEach((plot, index) => {
      if (before) plotEffects(index, before.plots[index], plot);
      const key = plotKey(plot);
      const current = plotViews[index];
      if (current && current.key === key) return;
      if (current) releaseGeometry(current.group);
      const built = buildPlot(index, plot);
      world.add(built.group);
      plotViews[index] = { group: built.group, key, icon: built.icon, popAt: current ? now : -10 };
    });

    game.orchard.spots.forEach((spot, index) => {
      const current = spotViews[index];
      const shaken = before && current ? spotEffects(index, before.orchard.spots[index], spot, current.height) : false;
      const key = spotKey(spot);
      if (current && current.key === key) {
        if (shaken) current.shakeAt = now;
        return;
      }
      if (current) releaseGeometry(current.group);
      const built = buildSpot(index, spot);
      world.add(built.group);
      spotViews[index] = { group: built.group, tree: built.tree, key, height: built.height, popAt: current && !shaken ? now : -10, shakeAt: shaken ? now : -10 };
    });

    const seen = new Set<string>();
    for (const fish of game.pond.fish) {
      seen.add(fish.id);
      let view = fishViews.get(fish.id);
      if (!view) {
        view = buildFish(fish);
        fishViews.set(fish.id, view);
      }
      view.targetScale = fishSize(fish.growth / FISH_MAP[fish.species].growSeconds);
      view.mature = isFishMature(fish);
    }
    for (const [id, view] of fishViews) {
      if (seen.has(id)) continue;
      view.group.removeFromParent();
      view.star.removeFromParent();
      fishViews.delete(id);
    }

    const trashIds = new Set(game.pond.trash.map((item) => item.id));
    for (const item of game.pond.trash) if (!trashViews.has(item.id)) trashViews.set(item.id, buildTrash(item));
    for (const [id, group] of trashViews) {
      if (trashIds.has(id)) continue;
      group.removeFromParent();
      trashViews.delete(id);
    }
    hungry = game.pond.fish.length > 0 && game.pond.fedUntil <= game.lastTick;
    const pondColor = game.pond.trash.length >= 4 ? "#8fb79a" : game.pond.trash.length >= 2 ? "#79bfa9" : "#67c3b8";
    if (waterMaterial instanceof THREE.MeshLambertMaterial) waterMaterial.color.set(pondColor);
    pondWater.uShallow.value.set(pondColor);
    pondWater.uDeep.value.set(pondColor).offsetHSL(0, 0, -0.2);

    syncRanch(game);
  }

  function syncRanch(game: GameState) {
    const animalIds = new Set<string>();
    const pastureFull = game.ranch.drops.length >= MAX_DROPS;
    game.ranch.animals.forEach((animal, index) => {
      animalIds.add(animal.id);
      let view = animalViews.get(animal.id);
      if (view && view.modelsVersion !== modelsVersion && models[animal.species]) {
        const position = view.group.position.clone();
        view.group.removeFromParent();
        view = undefined;
        const rebuilt = buildAnimal(animal, index);
        rebuilt.group.position.copy(position);
        animalViews.set(animal.id, rebuilt);
        view = rebuilt;
      }
      if (!view) {
        view = buildAnimal(animal, index);
        animalViews.set(animal.id, view);
      }
      view.bowl.visible = !animal.fed && (game.items.feed < 1 || pastureFull);
    });
    for (const [id, view] of animalViews) {
      if (animalIds.has(id)) continue;
      view.group.removeFromParent();
      animalViews.delete(id);
    }

    const dropIds = new Set(game.ranch.drops.map((item) => item.id));
    for (const drop of game.ranch.drops) if (!dropViews.has(drop.id)) dropViews.set(drop.id, buildDrop(drop));
    for (const [id, group] of dropViews) {
      if (dropIds.has(id)) continue;
      group.removeFromParent();
      dropViews.delete(id);
    }

    for (const def of WORKSHOPS) {
      const state = game.ranch.workshops[def.id];
      const locked = levelFromXp(game.xp) < def.level;
      const key = `${state ? "built" : locked ? "locked" : "open"}|${!!state && state.progress !== null}|${(state?.ready ?? 0) > 0}`;
      const view = workshopViews.get(def.id);
      if (view && view.key === key) continue;
      if (view) releaseGeometry(view.group);
      workshopViews.set(def.id, buildWorkshop(def.id, game));
    }

    feedFill.scale.y = 0.35 + 0.65 * Math.min(1, game.items.feed / 20);
    feedFill.visible = game.items.feed > 0;
    if (truckModelsVersion !== modelsVersion && models.truck) buildTruck();
  }

  let selectedPlot: number | null = null;
  function setSelectedPlot(index: number | null) {
    selectedPlot = index;
    selector.visible = index !== null;
    if (index !== null) {
      const [x, z] = plotPosition(index);
      selector.position.set(x, 0, z);
    }
  }

  function setView(view: FarmView) {
    viewName = view;
  }

  /* ───────────── input ───────────── */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down: { x: number; y: number; time: number; id: number } | null = null;
  let lastHover = 0;
  /** A drag with a tool across plots or trees: each one is worked once. */
  let work: { id: number; seen: Set<number> } | null = null;
  let fishingPointer: number | null = null;
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const riverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -RIVER_Y);
  const planeHit = new THREE.Vector3();

  function aim(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
  }

  /** The plot (fields) or tree spot (orchard) under the pointer, if this view works them. */
  function workTarget(clientX: number, clientY: number): (SceneHit & { kind: "plot" | "tree" }) | null {
    if (viewName !== "farm" && viewName !== "orchard") return null;
    aim(clientX, clientY);
    if (viewName === "farm") {
      for (const intersection of raycaster.intersectObjects(plotViews.map((view) => view?.group).filter(Boolean), true)) {
        const hit = findHit(intersection.object);
        if (hit?.kind === "plot") return hit;
      }
      return null;
    }
    // Orchard: the tree the pointer is on; otherwise the spot whose ground is under it (tall
    // boxes would let a tree in front catch presses meant for the spot behind it).
    const trees = spotViews.flatMap((view) => (view?.tree ? [view.tree] : []));
    const first = raycaster.intersectObjects(trees, false)[0];
    const treeIndex = first ? spotViews.findIndex((view) => view?.tree === first.object) : -1;
    if (treeIndex >= 0) return { kind: "tree", index: treeIndex };
    if (!raycaster.ray.intersectPlane(groundPlane, planeHit)) return null;
    let best = -1;
    let bestDistance = 1.05;
    spotViews.forEach((_, index) => {
      const [x, z] = spotPosition(index);
      const distance = Math.hypot(planeHit.x - x, planeHit.z - z);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best >= 0 ? { kind: "tree", index: best } : null;
  }

  /** Fishing-spot coordinates of a press on the water, or null when it is not near the jetty. */
  function riverLocal(clientX: number, clientY: number): [number, number] | null {
    aim(clientX, clientY);
    if (!raycaster.ray.intersectPlane(riverPlane, planeHit)) return null;
    const offset = planeHit.clone().sub(jettyPoint);
    const along = offset.dot(jettyTangent) / CAST_ALONG;
    const out = (offset.dot(jettyAcross) + 0.05) / (RIVER_HALF - 0.2);
    if (Math.abs(along) > 1.6 || out < -0.3 || out > 1.5) return null;
    return [Math.max(-1, Math.min(1, along)), Math.max(0.2, Math.min(1, out))];
  }

  function moveCursor(clientX: number, clientY: number) {
    aim(clientX, clientY);
    if (raycaster.ray.intersectPlane(groundPlane, planeHit)) cursorTarget.copy(planeHit);
  }

  function findHit(object: THREE.Object3D | null): SceneHit | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.hit) return current.userData.hit as SceneHit;
      current = current.parent;
    }
    return null;
  }

  function pick(clientX: number, clientY: number): SceneHit | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(world.children, true);
    let fallback: SceneHit | null = null;
    for (const intersection of hits) {
      if (intersection.object.userData.icon) continue;
      const hit = findHit(intersection.object);
      if (!hit) continue;
      // In the orchard, presses on trees are handled as work (see workTarget).
      if (hit.kind === "tree" && viewName === "orchard") continue;
      if (hit.kind === "fish" || hit.kind === "trash" || hit.kind === "drop" || hit.kind === "animal") return hit;
      fallback ??= hit;
    }
    return fallback;
  }

  function onPointerDown(event: PointerEvent) {
    if (viewName === "river" && options.fishing) {
      // Any press strikes or reels; a press on the water near the jetty also aims the cast.
      const input = options.fishing.input.current;
      input.tapped = true;
      input.holding = true;
      input.castAt = riverLocal(event.clientX, event.clientY);
      fishingPointer = event.pointerId;
      renderer.domElement.setPointerCapture?.(event.pointerId);
      return;
    }
    const target = event.button === 0 ? workTarget(event.clientX, event.clientY) : null;
    if (target) {
      const key = target.index;
      work = { id: event.pointerId, seen: new Set([key]) };
      renderer.domElement.setPointerCapture?.(event.pointerId);
      moveCursor(event.clientX, event.clientY);
      cursor.position.copy(cursorTarget);
      cursor.visible = true;
      workAt = clock.getElapsedTime();
      options.onHit(target);
      return;
    }
    down = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  }
  function endPress(event: PointerEvent) {
    if (fishingPointer === event.pointerId) {
      fishingPointer = null;
      if (options.fishing) options.fishing.input.current.holding = false;
      return true;
    }
    if (work && work.id === event.pointerId) {
      work = null;
      cursorLeft = 0.45;
      return true;
    }
    return false;
  }
  function onPointerUp(event: PointerEvent) {
    if (endPress(event)) return;
    if (!down || down.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const quick = performance.now() - down.time < 650;
    down = null;
    if (moved > 10 || !quick) return;
    const hit = pick(event.clientX, event.clientY);
    if (hit) options.onHit(hit);
  }
  function onPointerCancel(event: PointerEvent) {
    endPress(event);
    down = null;
  }
  function onPointerMove(event: PointerEvent) {
    if (work && work.id === event.pointerId) {
      moveCursor(event.clientX, event.clientY);
      const target = workTarget(event.clientX, event.clientY);
      if (target && !work.seen.has(target.index)) {
        work.seen.add(target.index);
        workAt = clock.getElapsedTime();
        options.onHit({ ...target, drag: true });
      }
      return;
    }
    if (event.pointerType !== "mouse") return;
    const time = performance.now();
    if (time - lastHover < 90) return;
    lastHover = time;
    renderer.domElement.style.cursor = pick(event.clientX, event.clientY) ? "pointer" : "default";
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerCancel);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  // A touch that starts on a plot, a tree or at the river works the game instead of scrolling the page.
  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) return;
    // Pointer events come first, so a drag may already have started on this touch.
    if (viewName === "river" || work || workTarget(touch.clientX, touch.clientY)) event.preventDefault();
  }
  renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });

  /* ───────────── layout & loop ───────────── */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let started = false;
  let frame = 0;
  let last = performance.now();
  let lastRender = 0;
  let visible = true;
  let perfWindowStart = 0;
  let perfFrames = 0;
  let slowWindows = 0;

  function desiredHeight() {
    const view = VIEWS[viewName];
    return Math.max(view.height, view.width / aspect);
  }

  function applyCamera() {
    const halfH = viewHeight / 2;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.copy(cameraTarget).add(CAMERA_OFFSET);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
  }

  let post: FarmPost | null = preset.post ? makePost(renderer, scene, camera) : null;

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(280, container.clientWidth);
    const height = Math.max(260, container.clientHeight);
    aspect = width / height;
    renderer.setSize(width, height, false);
    post?.setSize(width, height, dpr);
    if (!started) {
      viewHeight = desiredHeight();
      cameraTarget.copy(VIEWS[viewName].target);
    }
    applyCamera();
  });
  resizeObserver.observe(container);

  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  });
  intersection.observe(container);

  /** One step down the ladder: glow and blur, resolution, then shadows, then frame rate. */
  function downgrade(): string | null {
    if (post) {
      post.dispose();
      post = null;
      return "Tắt hiệu ứng phát sáng và làm mờ viền để mượt hơn.";
    }
    if (dpr > 1) {
      dpr = Math.max(1, dpr - 0.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      return "Giảm độ phân giải để mượt hơn.";
    }
    if (shadowsOn) {
      shadowsOn = false;
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      for (const material of [surface, ...extraMaterials]) material.needsUpdate = true;
      return "Tắt bóng đổ để mượt hơn.";
    }
    if (fpsCap > 30) {
      fpsCap = 30;
      return "Giới hạn 30 khung hình/giây để mượt và mát máy hơn.";
    }
    if (dpr > 0.75 && deviceDpr <= 1) {
      dpr = 0.75;
      renderer.setPixelRatio(dpr);
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      return "Giảm thêm độ phân giải cho máy yếu.";
    }
    return null;
  }

  function measure(time: number) {
    if (!options.adaptive) return;
    if (perfWindowStart === 0) perfWindowStart = time;
    perfFrames += 1;
    const span = time - perfWindowStart;
    if (span < 2000) return;
    const fps = (perfFrames * 1000) / span;
    perfWindowStart = time;
    perfFrames = 0;
    if (fps < (fpsCap >= 60 ? 42 : 22)) slowWindows += 1;
    else slowWindows = 0;
    if (slowWindows >= 2) {
      slowWindows = 0;
      const note = downgrade();
      if (note) options.onDowngrade?.(note);
    }
  }

  function render(time: number) {
    frame = window.requestAnimationFrame(render);
    if (!visible || document.hidden) {
      last = time;
      perfWindowStart = 0;
      perfFrames = 0;
      return;
    }
    if (fpsCap < 60 && time - lastRender < 1000 / fpsCap - 2) return;
    lastRender = time;
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    started = true;
    const elapsed = clock.getElapsedTime();
    const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
    cameraTarget.lerp(VIEWS[viewName].target, ease);
    viewHeight += (desiredHeight() - viewHeight) * ease;
    applyCamera();

    const motion = reducedMotion ? 0 : 1;
    wind.uTime.value = elapsed;
    wind.uWind.value = motion;
    blades.rotation.z += dt * 1.2 * motion;
    clouds.forEach((cloud, index) => {
      cloud.position.x += dt * (0.25 + index * 0.06) * motion;
      if (cloud.position.x > 18) cloud.position.x = -18;
    });
    if (shaderWater) {
      for (const uniforms of [pondWater, riverWaterUniforms]) {
        uniforms.uTime.value = elapsed;
        uniforms.uMotion.value = motion;
      }
    } else {
      waterMaterial.opacity = 0.45 + Math.sin(elapsed * 1.6) * 0.04 * motion;
    }

    plotViews.forEach((view) => {
      if (!view) return;
      const since = elapsed - view.popAt;
      const pop = since < 0.45 && motion ? 1 + Math.sin((since / 0.45) * Math.PI) * 0.12 : 1;
      view.group.scale.set(pop, pop, pop);
      if (view.icon) view.icon.position.y = (view.icon.scale.x < 0.6 ? 1.12 : 1.55) + Math.sin(elapsed * 3 + view.group.position.x) * 0.08 * motion;
    });
    if (selectedPlot !== null) {
      const pulse = 1 + Math.sin(elapsed * 4) * 0.025 * motion;
      selector.scale.set(pulse, 1, pulse);
    }

    // Orchard: new trees pop, shaken trees sway.
    spotViews.forEach((view) => {
      if (!view) return;
      const since = elapsed - view.popAt;
      const pop = since < 0.45 && motion ? 1 + Math.sin((since / 0.45) * Math.PI) * 0.1 : 1;
      view.group.scale.setScalar(pop);
      if (view.tree) {
        const shake = elapsed - view.shakeAt;
        const sway = shake < 0.9 ? Math.sin(shake * 30) * 0.1 * (1 - shake / 0.9) * (motion || 0.3) : 0;
        view.tree.rotation.set(sway * 0.6, 0, sway);
      }
    });

    // The tool follows the pointer and acts out the work.
    if (cursor.visible) {
      cursor.position.lerp(cursorTarget, motion ? 1 - Math.exp(-dt * 18) : 1);
      const model = cursor.children[0];
      const since = elapsed - workAt;
      const hit = since < 0.28 ? Math.sin((since / 0.28) * Math.PI) : 0;
      const kind = TOOL_MODEL[tool];
      let lift = 0.5;
      let tilt = 0;
      if (kind === "hoe" || kind === "shovel") {
        lift = 0.2 + hit * 0.5;
        tilt = 0.5 * hit;
      } else if (kind === "can") {
        lift = 0.6;
        tilt = work ? -0.7 : -0.15;
      } else if (kind === "bag" || kind === "fert") {
        lift = 0.6;
        tilt = work ? Math.sin(elapsed * 18) * 0.18 * motion - 0.3 : 0;
      } else {
        lift = 0.35 - hit * 0.2;
      }
      if (model) {
        model.position.y = lift;
        model.rotation.z = tilt;
      }
      const spout = TOOL_SPOUT[kind];
      if (work && spout && model) {
        emitCarry += dt * (kind === "can" ? 40 : 18);
        const from = model.localToWorld(spout.clone());
        while (emitCarry >= 1) {
          emitCarry -= 1;
          burst(kind === "can" ? "water" : kind === "fert" ? "spark" : "seed", from.x, from.y - (kind === "can" ? 0.75 : 0.55), from.z, 1);
        }
      }
      if (!work) {
        cursorLeft -= dt;
        if (cursorLeft <= 0) cursor.visible = false;
      }
    }
    stepParticles(dt);
    if (motion) stepRiver(elapsed);
    stepFishingView(elapsed, motion);
    fallMaterial.opacity = 0.74 + Math.sin(elapsed * 5) * 0.05 * motion;

    for (const view of fishViews.values()) {
      const speed = hungry ? 0.45 : 1;
      view.phase += dt * speed * motion;
      const { ax, az, w1, w2, p1, p2, depth } = view.params;
      const nx = Math.sin(view.phase * w1 * 2.2 + p1) * ax;
      const nz = Math.sin(view.phase * w2 * 2.2 + p2) * az;
      const tx = Math.cos(view.phase * w1 * 2.2 + p1) * ax * w1;
      const tz = Math.cos(view.phase * w2 * 2.2 + p2) * az * w2;
      const [x, z] = pondPoint(nx, nz);
      view.group.position.set(x, depth + Math.sin(elapsed * 2 + view.phase) * 0.015, z);
      if (tx !== 0 || tz !== 0) view.group.rotation.y = Math.atan2(-tz * POND_RZ, tx * POND_RX);
      view.tail.rotation.y = Math.sin(elapsed * (hungry ? 5 : 9) + view.phase) * 0.45 * motion;
      view.scale += (view.targetScale - view.scale) * Math.min(1, dt * 2);
      view.group.scale.setScalar(view.scale);
      view.star.visible = view.mature;
      if (view.mature) view.star.position.set(x, 1.05 + Math.sin(elapsed * 3 + view.phase) * 0.07, z);
    }
    for (const group of trashViews.values()) {
      group.position.y = WATER_Y + 0.02 + Math.sin(elapsed * 1.8 + group.position.x) * 0.02 * motion;
    }

    // Animals wander between random spots in the pasture, pausing to graze.
    for (const [id, view] of animalViews) {
      const position = view.group.position;
      const dx = view.target.x - position.x;
      const dz = view.target.y - position.z;
      const distance = Math.hypot(dx, dz);
      if (view.wait > 0) {
        view.wait -= dt;
        view.body.position.y = 0;
      } else if (distance < 0.08) {
        view.wait = 1.5 + (hashString(id + Math.floor(elapsed)) % 40) / 10;
        view.target = randomPasturePoint(hashString(id) + Math.floor(elapsed * 10));
      } else if (motion) {
        const step = Math.min(distance, view.speed * dt);
        position.x += (dx / distance) * step;
        position.z += (dz / distance) * step;
        view.group.rotation.y = Math.atan2(dx, dz);
        view.hop += dt * (view.species === "chicken" ? 14 : 9);
        view.body.position.y = Math.abs(Math.sin(view.hop)) * (view.species === "cow" ? 0.03 : 0.07);
      }
      if (view.bowl.visible) view.bowl.position.y = ANIMAL_HEIGHT[view.species] + 0.45 + Math.sin(elapsed * 3) * 0.05 * motion;
    }
    for (const group of dropViews.values()) {
      group.position.y = Math.abs(Math.sin(elapsed * 2.4 + group.position.x * 3)) * 0.06 * motion;
    }
    for (const view of workshopViews.values()) {
      view.smoke.forEach((puff, index) => {
        const t = (elapsed * 0.6 + index * 0.5) % 1;
        puff.position.y = 1.9 + t * 0.8;
        puff.scale.setScalar(0.6 + t * 0.8);
      });
      if (view.star) view.star.position.y = 2.25 + Math.sin(elapsed * 3) * 0.07 * motion;
    }
    if (truckGroup) {
      const trip = latest?.ranch.truck;
      if (!trip) {
        truckGroup.visible = true;
        truckGroup.position.x = TRUCK_PARK_X;
        truckGroup.position.y = 0;
        truckGroup.rotation.y = 0;
        cargo.visible = false;
      } else {
        const t = Math.min(1, Math.max(0, (Date.now() - trip.departAt) / Math.max(1, trip.returnAt - trip.departAt)));
        const leg = ROAD_END_X - TRUCK_PARK_X;
        if (t < 0.22) {
          truckGroup.visible = true;
          truckGroup.rotation.y = 0;
          truckGroup.position.x = TRUCK_PARK_X + leg * (t / 0.22);
          cargo.visible = true;
        } else if (t > 0.78) {
          truckGroup.visible = true;
          truckGroup.rotation.y = Math.PI;
          truckGroup.position.x = ROAD_END_X - leg * ((t - 0.78) / 0.22);
          cargo.visible = false;
        } else {
          truckGroup.visible = false;
        }
        // Up onto the bridge deck over the river.
        truckGroup.position.y = Math.abs(truckGroup.position.x - bridgeX) < RIVER_HALF + 0.7 ? 0.11 : 0;
      }
    }

    if (post) post.composer.render(dt);
    else renderer.render(scene, camera);
    measure(time);
  }
  frame = window.requestAnimationFrame(render);

  return {
    update,
    setView,
    setSelectedPlot,
    setTool,
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      catchGeometries.forEach((item) => item.dispose());
      primitives.forEach((item) => item.dispose());
      owned.forEach((item) => item.dispose());
      fishTemplates.forEach((item) => {
        item.body.dispose();
        item.tail.dispose();
      });
      animalTemplates.forEach((item) => item.dispose());
      dropTemplates.forEach((item) => item.dispose());
      trashTemplates.forEach((item) => item.dispose());
      clouds.forEach((cloud) => cloud.geometry.dispose());
      selector.geometry.dispose();
      post?.dispose();
      surface.dispose();
      extraMaterials.forEach((item) => item.dispose());
      iconMaterials.forEach((item) => item.dispose());
      textures.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Draws the floating status bubbles with canvas paths, so they don't depend on emoji fonts. */
function drawIcon(ctx: CanvasRenderingContext2D, name: IconName) {
  ctx.clearRect(0, 0, 128, 128);
  ctx.save();
  ctx.shadowColor = "rgba(23, 63, 48, 0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#fffdf2";
  ctx.beginPath();
  ctx.arc(64, 60, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#24583e";
  ctx.beginPath();
  ctx.arc(64, 60, 46, 0, Math.PI * 2);
  ctx.stroke();

  if (name === "star") {
    ctx.fillStyle = "#f6c629";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 32 : 14;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 64 + Math.cos(angle) * radius;
      const y = 62 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (name === "drop") {
    ctx.fillStyle = "#3e9bd6";
    ctx.beginPath();
    ctx.moveTo(64, 26);
    ctx.bezierCurveTo(78, 48, 88, 60, 88, 72);
    ctx.arc(64, 72, 24, 0, Math.PI, false);
    ctx.bezierCurveTo(40, 60, 50, 48, 64, 26);
    ctx.fill();
    ctx.fillStyle = "#cfeafa";
    ctx.beginPath();
    ctx.ellipse(55, 70, 5, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === "bug") {
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      for (const y of [56, 68, 80]) {
        ctx.beginPath();
        ctx.moveTo(64 + side * 18, y);
        ctx.lineTo(64 + side * 32, y + (y - 68) * 0.4 + 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(64, 42, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8392c";
    ctx.beginPath();
    ctx.ellipse(64, 68, 23, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.moveTo(64, 44);
    ctx.lineTo(64, 93);
    ctx.stroke();
    ctx.fillStyle = "#2b2b2b";
    for (const [x, y] of [[53, 60], [75, 60], [52, 78], [76, 78]]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name === "bowl") {
    ctx.fillStyle = "#e9c46a";
    ctx.beginPath();
    ctx.ellipse(64, 58, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a26f3f";
    ctx.beginPath();
    ctx.moveTo(36, 58);
    ctx.quadraticCurveTo(64, 104, 92, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d8392c";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 64, 46);
  } else if (name === "alert") {
    ctx.fillStyle = "#f6c629";
    ctx.beginPath();
    ctx.arc(64, 60, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24583e";
    ctx.fillRect(58, 34, 12, 34);
    ctx.beginPath();
    ctx.arc(64, 80, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === "build") {
    ctx.fillStyle = "#3c9a5a";
    ctx.fillRect(56, 34, 16, 52);
    ctx.fillRect(38, 52, 52, 16);
  } else {
    ctx.strokeStyle = "#596b5f";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 52, 15, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#d9a23c";
    ctx.fillRect(40, 52, 48, 34);
    ctx.fillStyle = "#5a4031";
    ctx.beginPath();
    ctx.arc(64, 66, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(62, 66, 4, 11);
  }
}
