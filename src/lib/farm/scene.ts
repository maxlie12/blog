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
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pondGeometry, waterMaterial as villageWater, waterUniforms } from "../village/graphics";
import { animalMaterial, animalUniforms, headAttributes, legAttributes, swimMaterial, type AnimalUniforms, type Gait, type Neck, type SwimUniforms } from "./legs";
import { SEASON_LOOK, addSeason, addWind, flowerGeometry, lightAt, makePost, paintSky, season as seasonTint, skyTexture, starField, tuftGeometry, wind, type FarmPost } from "./look";
import {
  ANIMAL_MAP,
  FISH_MAP,
  MAX_DROPS,
  TREE_MAP,
  WILD_FISH_MAP,
  WORKSHOPS,
  WORKSHOP_MAP,
  SEASON_DAYS,
  INCUBATOR,
  eggNeedsTurn,
  isHatched,
  cropStage,
  gameClock,
  hashString,
  isGrown,
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
import { NO_COVER, ZOOM_MAX, clampZoom, coverLift, defaultHeight, isNarrow, panLimits, zoomMin, type Cover } from "./view";
import { FIELD, HOME, IDLE_SPOTS, JETTY_FOOT, ORCHARD, PEN_GATES, POND, RIVER_HALF, RIVER_POINTS, ROAD_Z, dropStand, incubatorStand, plotPosition, plotStand, pondPoint, pondStand, route, routeLength, spotPosition, treeStand, troughStand, type Place, type Point } from "./paths";
import { choresBetween, type Chore } from "./chores";
import { BODY_SIZE, CHORE_ACTS, IDLE_SECONDS, REST, SITTING, SPEED, STRIDE, TWO_HANDED, chorePose, fishingPose, idlePose, mixPose, phaseFor, standPose, walkPose, type Idle, type Pose, type Tool } from "./people";
import { DUCK_POND, FIXTURES, LANE, PEN_OF, PEN_ROOM, RANCH_BOUNDS, TOP_LEVEL, TROUGH_OF, fixtureRect, inDuckPond, inside, penRect, walkable, type PenId } from "./ranchLayout";

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
  | { kind: "truck" }
  | { kind: "incubator" };

/** Where the player's zoom stands, for the zoom buttons. */
export interface ZoomState {
  atMin: boolean;
  atMax: boolean;
  /** Zoomed or panned away from the area's default framing. */
  moved: boolean;
}

export interface SceneOptions {
  quality: Quality;
  /** Measure frame rate and step quality down on slow devices. */
  adaptive: boolean;
  onHit: (hit: SceneHit) => void;
  onDowngrade?: (note: string) => void;
  onZoom?: (state: ZoomState) => void;
  fishing?: FishingLink;
}

export interface FarmSceneController {
  update(game: GameState): void;
  setView(view: FarmView): void;
  setSelectedPlot(index: number | null): void;
  setTool(tool: SceneTool): void;
  /** Zoom by a factor about the middle of the screen (above 1 is closer). */
  zoomBy(factor: number): void;
  /** Move the view by a share of the screen (x to the right, y up). */
  panBy(x: number, y: number): void;
  /** Back to the area's default framing. */
  resetZoom(): void;
  /** Pixels the page's own bars and cards cover at the top and bottom of the canvas. */
  setCover(top: number, bottom: number): void;
  dispose(): void;
}

type ModelKey = AnimalId | "truck" | FishId;
/** height: metres for animals and the truck; length: for fish (the scene's fish are one unit long). */
interface ModelEntry { url: string; height?: number; length?: number; rotationY?: number }
const FISH_IDS: FishId[] = ["tilapia", "carp", "puffer", "goldfish", "koi", "sturgeon"];

/**
 * How each animal walks: two legs or four, the hip as a share of its height, and how far each leg
 * swings (foot travel per unit of leg length). The step rate follows from these, so feet do not slide.
 * `reach` is how far ahead of the body its mouth meets the grass; `room` how close another animal
 * may come (grown size). `neck` is where a Meshy model's head bends down to eat; eating, the head
 * turns down by `graze` radians and sinks by `drop` (a share of the height). The built-in models
 * mark their head parts themselves and turn them about `builtInPivot` ([y, z]) without sinking.
 */
const LEGS: Record<AnimalId, { gait: Gait; hip: number; swing: number; reach: number; room: number; neck: Neck; builtInPivot: [number, number]; graze: number; drop: number }> = {
  chicken: { gait: "biped", hip: 0.28, swing: 0.45, reach: 0.2, room: 0.2, neck: { back: 0.25, up: 0.6, low: 0.58 }, builtInPivot: [0.45, 0.1], graze: 1.35, drop: 0.14 },
  duck: { gait: "biped", hip: 0.24, swing: 0.4, reach: 0.22, room: 0.2, neck: { back: 0.28, up: 0.55, low: 0.52 }, builtInPivot: [0.42, 0.14], graze: 1.1, drop: 0.16 },
  sheep: { gait: "quadruped", hip: 0.29, swing: 0.42, reach: 0.42, room: 0.36, neck: { back: 0.28, up: 0.62, low: 0.4 }, builtInPivot: [0.6, 0.3], graze: 1.0, drop: 0.22 },
  cow: { gait: "quadruped", hip: 0.31, swing: 0.4, reach: 0.6, room: 0.46, neck: { back: 0.34, up: 0.65, low: 0.45 }, builtInPivot: [0.7, 0.44], graze: 0.9, drop: 0.2 },
};

const FARM_CENTER = new THREE.Vector3(FIELD.x, 0, FIELD.z);
const POND_CENTER = new THREE.Vector3(POND.x, 0, POND.z);
const POND_RX = POND.rx;
const POND_RZ = POND.rz;
const WATER_Y = 0.27;
const TRUCK_PARK_X = 3.1;
const ROAD_END_X = 15.2;
const WORKSHOP_SPOTS: Record<WorkshopId, [number, number]> = {
  saltery: [6.9, 7.35],
  bakery: [9.25, 8.15],
  loom: [6.9, 9.95],
  dairy: [9.25, 10.75],
};
const PLOT_PITCH = FIELD.pitch;
const PLOT_SIZE = FIELD.size;
const CAMERA_OFFSET = new THREE.Vector3(1, 1.08, 1.3).normalize().multiplyScalar(40);
/**
 * Each area's centre and size on screen. `phone` is the share of its width a phone shows at
 * first (the rest is a sideways drag away); a phone starts centred on `focus` when there is one.
 * The fields keep every plot in view (only the outer corners touch the edges); the ranch shows
 * its first pens, and the parts added by upgrades are a drag away.
 */
const VIEWS: Record<FarmView, { target: THREE.Vector3; width: number; height: number; phone: number; focus?: THREE.Vector3 }> = {
  farm: { target: new THREE.Vector3(-4.1, 0, 0.3), width: 11.2, height: 10, phone: 0.86, focus: FARM_CENTER },
  orchard: { target: new THREE.Vector3(-7.4, 0, 8.3), width: 9.4, height: 8.6, phone: 0.7 },
  pond: { target: new THREE.Vector3(5.9, 0, 0.7), width: 9.6, height: 8.4, phone: 0.66 },
  river: { target: new THREE.Vector3(12, 0, -0.9), width: 7.8, height: 7.6, phone: 0.8 },
  ranch: { target: new THREE.Vector3(1.5, 0, 9.9), width: 13.6, height: 10.4, phone: 0.7 },
};
const RIVER_Y = 0.07;
const JETTY_Z = -1.2;
/** Fishing spot coordinates: `along` the river ±1 is this far either side of the jetty. */
const CAST_ALONG = 1.6;
const CROP_COLORS: Record<CropId, string> = {
  cabbage: "#7fc35a", carrot: "#f08a2c", tomato: "#e2533d", corn: "#f2c94c", rice: "#e9d48a",
  strawberry: "#e23d5a", pumpkin: "#f28d34", sunflower: "#f6c443", watermelon: "#4f9a3d",
};
const ANIMAL_HEIGHT: Record<AnimalId, number> = { chicken: 0.6, duck: 0.6, sheep: 0.85, cow: 1.15 };


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



/** Fry start clearly visible and grow to about twice their size. */
function fishSize(ratio: number): number {
  return 0.58 + 0.6 * Math.min(1, Math.max(0, ratio));
}

type IconName = "star" | "drop" | "bug" | "lock" | "bowl" | "build" | "alert" | "sleep" | "turn";

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
  /** The player's zoom (1 is the area's default framing) and how far they panned from its centre, on the ground. */
  let zoom = 1;
  const pan = new THREE.Vector3();
  const panGoal = new THREE.Vector3();
  // Ground directions that move the view right and up on screen; a step up the screen covers
  // more ground than the same step across it, by 1 / UP_SCALE (the camera looks down at an angle).
  const SCREEN_RIGHT = new THREE.Vector3(CAMERA_OFFSET.z, 0, -CAMERA_OFFSET.x).normalize();
  const SCREEN_UP = new THREE.Vector3(-CAMERA_OFFSET.x, 0, -CAMERA_OFFSET.z).normalize();
  const UP_SCALE = CAMERA_OFFSET.y / CAMERA_OFFSET.length();

  // Cool sky light in the shade, warm afternoon sun: the contrast reads as cosy.
  const hemi = new THREE.HemisphereLight("#d9ecff", "#6f8f4f", preset.pbr ? 1.55 : 1.45);
  scene.add(hemi);
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
  addSeason(foliageMaterial, 1);
  // Lantern and string-light bulbs: unlit and brighter than white, so the High preset's bloom
  // picks them up; elsewhere they simply look lit.
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glowBase = preset.post ? 2.6 : 1.25;
  glowMaterial.color.setScalar(glowBase);
  // Lit windows: invisible by day, fading in at dusk.
  const nightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const carrier = new THREE.MeshBasicMaterial();
  const primitives = new Map<string, THREE.BufferGeometry>();
  const owned = new Set<THREE.BufferGeometry>();
  const textures: THREE.Texture[] = [sky];
  const extraMaterials: THREE.Material[] = [hiddenMaterial, carrier, foliageMaterial, glowMaterial, nightMaterial];
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

  /**
   * A star of `points` sepals one unit across, facing up with its tips drooping, with a back face:
   * the green cap on a tomato or a strawberry (a few triangles, unlike a ring of leaves).
   */
  const star = (points: number) => primitive(`star:${points}`, () => {
    const outline = new THREE.Shape();
    for (let i = 0; i < points * 2; i += 1) {
      const a = (i / (points * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.16 : 0.5;
      if (i === 0) outline.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else outline.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const front = new THREE.ShapeGeometry(outline);
    front.rotateX(-Math.PI / 2);
    front.deleteAttribute("uv");
    const position = front.attributes.position;
    for (let i = 0; i < position.count; i += 1) position.setY(i, -0.5 * (position.getX(i) ** 2 + position.getZ(i) ** 2));
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
  const nightRoot = new THREE.Group();
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
  {
    const lit = new THREE.Group();
    lit.position.copy(house.position);
    lit.rotation.copy(house.rotation);
    lit.add(part(box(0.42, 0.36, 0.02), "#ffcf7a", -0.42, 0.84, 0.835), part(box(0.26, 0.22, 0.02), "#ffcf7a", 0, 1.62, 0.685));
    nightRoot.add(lit);
  }
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
  nightRoot.add(part(box(0.15, 0.19, 0.02), "#ffcf7a", -9.9, 1.55, -2.4 + 0.425));
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
    [-12.6, 7.6, 0.95, false],
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
  // Jetty from the west bank; the farmer comes to fish at its end.
  const jettyRoot = new THREE.Group();
  const jettyLength = RIVER_HALF + 0.3;
  for (let i = 0; i < 6; i += 1) jettyRoot.add(part(box(0.22, 0.06, 0.92), i % 2 ? "#a77a4c" : "#b98a55", -jettyLength + 0.14 + i * (jettyLength / 5.6), 0.2, 0));
  for (const [x, z] of [[-jettyLength + 0.1, -0.42], [-jettyLength + 0.1, 0.42], [-0.12, -0.42], [-0.12, 0.42]]) jettyRoot.add(part(cylinder(0.05, 0.05, 0.5, 5), "#7a5638", x, 0.0, z));
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
  /* ───────────── ranch: buildings that are there from the start ───────────── */
  /* A poultry yard with the hen house, straw nests and a duck pond, a sheep pen with its
     shelter, a cow pen with a shed and hay rack, a trough in each, and the middle lane with the
     feed store and a water pump. They sit where each pen starts; fences and the extras that come
     with bigger pens are built in `buildRanchYard`. */
  /** A hay bale on its side (a round one rolled along x). */
  function addBale(root: THREE.Object3D, x: number, y: number, z: number, yaw = 0) {
    const bale = new THREE.Group();
    bale.position.set(x, y, z);
    bale.rotation.y = yaw;
    bale.add(turn(part(cylinder(0.26, 0.26, 0.42, 14), "#e2c25f", 0, 0.26, 0), 0, 0, Math.PI / 2));
    for (const side of [-1, 1]) bale.add(turn(part(cylinder(0.262, 0.262, 0.025, 14), "#c9a443", side * 0.2, 0.26, 0), 0, 0, Math.PI / 2));
    root.add(bale);
  }
  {
    // Hen house: a raised coop with a ramp, a small window and a nest box on its east side.
    const { x, z } = FIXTURES.henHouse;
    const coop = new THREE.Group();
    coop.position.set(x, 0, z);
    const wood = "#d9a066";
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) coop.add(part(rbox(0.07, 0.3, 0.07, 0.02), "#7a5638", sx * 0.38, 0.15, sz * 0.22));
    coop.add(part(rbox(0.86, 0.5, 0.56, 0.04), wood, 0, 0.55, 0));
    for (let i = -3; i <= 3; i += 1) coop.add(part(box(0.012, 0.44, 0.012), tint(wood, -0.12), i * 0.12, 0.55, 0.284));
    coop.add(part(gable(0.86, 0.56, 0.3), wood, 0, 0.8, 0));
    const roof = shingleRoof(1.0, 0.72, 0.32, "#6f8f4e", mulberry32(77));
    roof.position.y = 0.78;
    coop.add(roof);
    // A door with a ramp down to the yard.
    coop.add(part(rbox(0.22, 0.28, 0.03, 0.02), "#4a3122", -0.18, 0.52, 0.29));
    const ramp = part(rbox(0.2, 0.03, 0.52, 0.01), "#a77a4c", -0.18, 0.2, 0.5);
    ramp.rotation.x = 0.6;
    coop.add(ramp);
    for (let i = 0; i < 4; i += 1) coop.add(turn(part(box(0.2, 0.02, 0.02), "#7a5638", -0.18, 0.33 - i * 0.075, 0.33 + i * 0.1), 0.6, 0, 0));
    coop.add(part(box(0.18, 0.14, 0.02), "#b9dfe6", 0.2, 0.62, 0.29), part(rbox(0.24, 0.035, 0.05, 0.01), "#fbf5e8", 0.2, 0.54, 0.3));
    coop.add(part(rbox(0.22, 0.24, 0.42, 0.03), tint(wood, -0.05), 0.53, 0.52, 0), part(rbox(0.26, 0.04, 0.46, 0.02), "#6f8f4e", 0.53, 0.66, 0));
    propsRoot.add(coop);
    for (let i = 0; i < 6; i += 1) leafAt(foliageRoot, i % 2 ? "#e9cc6a" : "#d8b44e", x + 0.62, 0.44, z - 0.17 + i * 0.07, Math.PI / 2, -0.7, 0.1, 0.03, 0, 0.2);
    keepClear.push([x, z, 0.72]);
    groundShade.push([x, z, 0.95, 0.22]);
    // Straw nests beside it.
    for (const [nx, nz] of [[x - 0.4, z + 0.78], [x + 0.25, z + 0.86]]) {
      propsRoot.add(part(cylinder(0.17, 0.2, 0.07, 10), "#e2c25f", nx, 0.035, nz), part(cylinder(0.1, 0.1, 0.075, 10), "#c9a443", nx, 0.04, nz));
      for (let i = 0; i < 7; i += 1) leafAt(foliageRoot, i % 2 ? "#e9cc6a" : "#d8b44e", nx, 0.06, nz, (i / 7) * Math.PI * 2, 0.2, 0.15, 0.03, 0, 0.15);
      keepClear.push([nx, nz, 0.22]);
    }
  }
  {
    // The duck pond: a stony edge, reeds and cattails at the back, lily pads on the water.
    const { x, z, rx, rz } = DUCK_POND;
    const bed = part(cylinder(1, 1, 0.03, 24), "#557a63", x, 0.012, z);
    bed.scale.set(rx + 0.05, 1, rz + 0.05);
    propsRoot.add(bed);
    const random = mulberry32(19);
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + random() * 0.2;
      const stone = part(ico(0.07 + random() * 0.04, 1), random() < 0.5 ? "#a9a79a" : "#9b998c", x + Math.cos(a) * (rx + 0.07), 0.035, z + Math.sin(a) * (rz + 0.07));
      stone.scale.set(1.25, 0.6, 1);
      stone.rotation.y = random() * 3;
      propsRoot.add(stone);
    }
    for (let i = 0; i < 10; i += 1) {
      const a = Math.PI * (1.05 + i * 0.075);
      const px = x + Math.cos(a) * (rx + 0.02), pz = z + Math.sin(a) * (rz + 0.02);
      leafAt(foliageRoot, i % 2 ? "#5f9a45" : "#6faa4f", px, 0.02, pz, random() * 6, 1.25, 0.32 + random() * 0.18, 0.05, -0.1, 0.8);
      if (i % 3 === 1) {
        foliageRoot.add(leafy(cylinder(0.007, 0.007, 0.5, 4), "#6f8f3a", px, 0.25, pz, 0.7));
        const head = leafy(sphere(0.026, 6, 5), "#6b4528", px, 0.47, pz, 0.8);
        head.scale.y = 2.4;
        foliageRoot.add(head);
      }
    }
    for (const [lx, lz, flower] of [[x + 0.22, z + 0.1, true], [x - 0.15, z + 0.2, false], [x + 0.05, z - 0.18, false]] as const) {
      propsRoot.add(part(cylinder(0.085, 0.085, 0.008, 10), "#4f9a48", lx, 0.07, lz));
      if (flower) propsRoot.add(part(sphere(0.035, 8, 6), "#f6a5c0", lx, 0.09, lz));
    }
    keepClear.push([x, z, Math.max(rx, rz) + 0.15]);
  }
  {
    // Sheep shelter: a lean-to with a plank back wall, straw bedding and a hay rack.
    const { x, z } = FIXTURES.sheepShelter;
    const shed = new THREE.Group();
    shed.position.set(x, 0, z);
    const wood = "#a8784a";
    shed.add(part(rbox(1.0, 0.64, 0.06, 0.02), wood, 0, 0.32, -0.25));
    for (let i = 0; i < 6; i += 1) shed.add(part(box(0.012, 0.6, 0.07), tint(wood, -0.12), -0.42 + i * 0.17, 0.32, -0.25));
    for (const sx of [-1, 1]) shed.add(part(rbox(0.06, 0.5, 0.5, 0.02), tint(wood, 0.04), sx * 0.5, 0.25, 0), part(rbox(0.07, 0.84, 0.07, 0.02), "#7a5638", sx * 0.5, 0.42, 0.27));
    const roof = new THREE.Group();
    roof.position.set(0, 0.8, 0.02);
    roof.rotation.x = 0.24;
    roof.add(part(rbox(1.18, 0.05, 0.78, 0.02), "#5f8a8a", 0, 0, 0));
    for (let i = 0; i < 4; i += 1) roof.add(part(box(1.19, 0.018, 0.025), tint("#5f8a8a", -0.14), 0, 0.03, -0.3 + i * 0.2));
    shed.add(roof);
    shed.add(part(rbox(0.9, 0.025, 0.45, 0.01), "#e2c25f", 0, 0.013, 0.02), part(rbox(0.62, 0.18, 0.12, 0.02), "#8f5d3a", 0, 0.44, -0.17));
    propsRoot.add(shed);
    for (let i = 0; i < 7; i += 1) leafAt(foliageRoot, i % 2 ? "#e2c25f" : "#cfae4b", x - 0.27 + i * 0.09, 0.5, z - 0.17, Math.PI, -1.0, 0.14, 0.04, 0.1, 0.2);
    keepClear.push([x, z, 0.7]);
    groundShade.push([x, z, 0.9, 0.2]);
  }
  {
    // Cow shed: an open-fronted red barn with white corner posts, a shingled roof, straw and hay.
    const { x, z } = FIXTURES.cowShed;
    const shed = new THREE.Group();
    shed.position.set(x, 0, z);
    const red = "#b5523b";
    shed.add(part(rbox(1.5, 0.92, 0.07, 0.02), red, 0, 0.46, -0.4));
    for (let i = -6; i <= 6; i += 1) shed.add(part(box(0.012, 0.86, 0.08), tint(red, -0.1), i * 0.11, 0.46, -0.4));
    for (const sx of [-1, 1]) {
      shed.add(part(rbox(0.07, 0.92, 0.82, 0.02), red, sx * 0.73, 0.46, 0));
      shed.add(part(rbox(0.1, 1.0, 0.1, 0.025), "#f4ead6", sx * 0.74, 0.5, 0.42), part(rbox(0.1, 1.0, 0.1, 0.025), "#f4ead6", sx * 0.74, 0.5, -0.42));
    }
    shed.add(part(gable(1.5, 0.86, 0.4), red, 0, 0.92, 0), part(rbox(1.5, 0.08, 0.08, 0.02), "#f4ead6", 0, 0.92, 0.43));
    const roof = shingleRoof(1.72, 1.08, 0.42, "#8e3b2c", mulberry32(83));
    roof.position.y = 0.92;
    shed.add(roof);
    shed.add(part(rbox(1.4, 0.025, 0.76, 0.01), "#e2c25f", 0, 0.013, 0), part(rbox(1.0, 0.3, 0.14, 0.02), "#8f5d3a", 0, 0.5, -0.3));
    for (let i = 0; i < 4; i += 1) shed.add(part(box(0.02, 0.3, 0.02), "#6b4a30", -0.45 + i * 0.3, 0.5, -0.22));
    propsRoot.add(shed);
    for (let i = 0; i < 10; i += 1) leafAt(foliageRoot, i % 2 ? "#e2c25f" : "#cfae4b", x - 0.45 + i * 0.1, 0.64, z - 0.3, Math.PI, -1.1, 0.16, 0.05, 0.1, 0.15);
    keepClear.push([x, z, 0.9]);
    groundShade.push([x, z, 1.15, 0.24]);
  }
  {
    // The lane: sacks of feed and a grain bin at the back, a hand pump with a bucket.
    const { x, z } = FIXTURES.feedStore;
    propsRoot.add(part(cylinder(0.19, 0.19, 0.55, 12), "#b9c2c6", x + 0.22, 0.28, z), part(cone(0.21, 0.14, 12), "#9aa4a8", x + 0.22, 0.62, z));
    for (const [sx, sy, sz] of [[-0.18, 0.11, -0.1], [-0.2, 0.11, 0.14], [-0.19, 0.3, 0.02]] as const) {
      const sack = part(rbox(0.3, 0.2, 0.22, 0.08), "#e8dcc0", x + sx, sy, z + sz);
      sack.rotation.y = sz * 3;
      propsRoot.add(sack, part(cylinder(0.035, 0.05, 0.06, 6), "#c9b48a", x + sx + 0.15, sy + 0.04, z + sz));
    }
    keepClear.push([x, z, 0.5]);
    groundShade.push([x, z, 0.6, 0.15]);
    const pump = FIXTURES.pump;
    propsRoot.add(part(rbox(0.15, 0.62, 0.15, 0.03), "#3b6f8f", pump.x, 0.31, pump.z), part(cylinder(0.03, 0.03, 0.2, 8), "#3b6f8f", pump.x + 0.1, 0.5, pump.z));
    propsRoot.add(turn(part(rbox(0.04, 0.04, 0.36, 0.015), "#2f5a75", pump.x, 0.68, pump.z - 0.12), -0.5, 0, 0));
    propsRoot.add(part(cylinder(0.11, 0.09, 0.15, 12), "#8f5d3a", pump.x + 0.2, 0.075, pump.z + 0.02), part(cylinder(0.2, 0.2, 0.004, 14), "#8fc3cc", pump.x + 0.14, 0.006, pump.z + 0.08));
    keepClear.push([pump.x, pump.z, 0.3]);
  }
  /** Each pen's trough: one hit box each opening the feed sheet, and the feed showing in it. */
  const troughFills: THREE.Mesh[] = [];
  for (const pen of ["poultry", "sheep", "cow"] as const) {
    const { x, z, hx, hz } = FIXTURES[TROUGH_OF[pen]];
    const w = hx * 2, d = hz * 2;
    propsRoot.add(part(rbox(w, 0.24, d, 0.03), "#9c6a3c", x, 0.12, z), part(box(w - 0.1, 0.04, d - 0.1), "#5a3d24", x, 0.23, z));
    for (const side of [-1, 1]) propsRoot.add(part(box(hx > hz ? 0.06 : w + 0.04, 0.08, hx > hz ? d + 0.04 : 0.06), "#7a5638", hx > hz ? x + side * (hx - 0.05) : x, 0.04, hx > hz ? z : z + side * (hz - 0.05)));
    groundShade.push([x, z, Math.max(hx, hz) + 0.4, 0.15]);
    keepClear.push([x, z, Math.max(hx, hz) + 0.15]);
    const fillRoot = new THREE.Group();
    // Origin at the bottom so scaling raises the feed level from the trough floor.
    fillRoot.add(part(box(w - 0.14, 0.1, d - 0.14), pen === "poultry" ? "#e9c46a" : "#d8b44e", 0, 0.05, 0));
    const fill = bake(fillRoot, false, true);
    fill.userData.ownsGeometry = true;
    fill.raycast = () => {};
    fill.position.set(x, 0.2, z);
    const hit = hitBox(box(w + 0.35, 0.8, d + 0.35), { kind: "trough" });
    hit.position.set(x, 0.3, z);
    world.add(fill, hit);
    troughFills.push(fill);
  }

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
    [3.3, 3.2, 0.8, ""], [6.0, 4.45, 0.85, "#f28fb1"], [-14.6, -4.5, 1.1, ""],
    [-15.0, 3.0, 1.0, "#f28fb1"], [13.9, -5.8, 1.0, ""], [-6.2, 14.6, 1.1, "#ffffff"], [8.9, 12.4, 1.0, "#ffd166"],
    [-11.6, 6.35, 0.9, ""], [-4.15, 12.3, 0.7, "#ffffff"], [5.95, 11.9, 0.8, ""], [-10.6, -1.6, 0.8, "#ffffff"],
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
    // The ranch's middle lane, from the road down past the pens to the incubator hut.
    [(LANE.x0 + LANE.x1) / 2, ROAD_Z, (LANE.x0 + LANE.x1) / 2, FIXTURES.incubator.z - 0.4, 0.62],
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
      // Lusher grass in the pens (painted at their full size), scratched earth round the hen house.
      for (const pen of ["poultry", "sheep", "cow"] as const) {
        const r = penRect(pen, TOP_LEVEL);
        c.lerp(pastureColor, rectMask(x, z, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2 - 0.1, (r.z1 - r.z0) / 2 - 0.1, 0.5) * 0.55);
      }
      c.lerp(dirt, (1 - smooth(0.5, 1.5, Math.hypot(x - FIXTURES.henHouse.x - 0.2, (z - FIXTURES.henHouse.z - 0.7) * 1.2))) * (0.35 + n2 * 0.25));
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
    groundShade.push([-2.1, -4.75, 2.1, 0.3], [1.6, -3.3, 1.3, 0.22], [FIXTURES.incubator.x, FIXTURES.incubator.z, 1.2, 0.2]);
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
  const nightMesh = new THREE.Mesh(bakeGeometry(nightRoot, false) ?? new THREE.BufferGeometry(), nightMaterial);
  nightMesh.renderOrder = 3;
  // The ground takes the season's colour on its grass (and only there).
  const groundMaterial = makeSurface();
  addSeason(groundMaterial, 0.6);
  extraMaterials.push(groundMaterial);
  groundMesh.material = groundMaterial;
  const farMesh = new THREE.Mesh(bakeGeometry(farRoot, false) ?? new THREE.BufferGeometry(), surface);
  // Purely decorative: skip them when picking so taps go straight to interactive objects.
  for (const item of [groundMesh, propsMesh, foliageMesh, glowMesh, nightMesh, farMesh]) {
    item.raycast = () => {};
    item.userData.ownsGeometry = true;
    world.add(item);
  }
  // The thousands of build-time parts are baked now; let them go.
  for (const root of [groundRoot, propsRoot, foliageRoot, glowRoot, nightRoot, farRoot]) root.clear();

  // Stars far behind the island, seen in the sky around it at night.
  const stars = (() => {
    const back = CAMERA_OFFSET.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(back, -back.y).normalize();
    const right = new THREE.Vector3().crossVectors(up, back);
    return starField(220, (random) => right.clone().multiplyScalar((random() - 0.5) * 70).addScaledVector(up, (random() - 0.5) * 44).addScaledVector(back, -70));
  })();
  stars.raycast = () => {};
  stars.frustumCulled = false;
  world.add(stars);
  extraMaterials.push(stars.material as THREE.Material);
  owned.add(stars.geometry);

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
    // Ranch: the lane is a dirt path, and nothing grows in the pond, on the troughs or buildings.
    if (inside(LANE, x, z, -0.1) || inDuckPond(x, z, 0.2)) return false;
    for (const name of Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]) if (inside(fixtureRect(name), x, z, -0.3)) return false;
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
      if (inside(RANCH_BOUNDS, cx, cz) && random() < 0.55) continue;
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
  addSeason(grassMaterial, 0.85);
  extraMaterials.push(grassMaterial);
  const tuft = tuftGeometry();
  const flower = flowerGeometry();
  owned.add(tuft);
  owned.add(flower);
  const tufts = scatter(preset.grass, 5, 91);
  /* Clumps of fresh grass in the pasture: animals walk over to graze one short and it grows back. */
  interface GrazePatch {
    x: number;
    z: number;
    /** The pen it grows in (it is only grazed once that pen reaches it). */
    pen: PenId;
    /** Its tufts in the grass instances, and how much is left to eat (0.2 grazed short, 1 full). */
    first: number;
    count: number;
    food: number;
    shown: number;
    /** The animal walking to it or eating it, and when it was last bitten. */
    claim: string | null;
    bitten: number;
  }
  const grazePatches: GrazePatch[] = [];
  {
    const random = mulberry32(213);
    const dummy = new THREE.Object3D();
    // Grass for the sheep and cows across their pens at full size, a little in the poultry yard.
    const wanted: Record<PenId, number> = { poultry: 2, sheep: 5, cow: 6 };
    const candidates: [PenId, number, number][] = [];
    for (const pen of ["poultry", "sheep", "cow"] as const) {
      const r = penRect(pen, TOP_LEVEL);
      let found = 0;
      for (let tries = 0; tries < 200 && found < wanted[pen]; tries += 1) {
        const x = r.x0 + 0.5 + random() * (r.x1 - r.x0 - 1), z = r.z0 + 0.5 + random() * (r.z1 - r.z0 - 1);
        if (!walkable(pen, TOP_LEVEL, x, z) || !grassFree(x, z) || candidates.some(([, ox, oz]) => Math.hypot(ox - x, oz - z) < 1.1)) continue;
        candidates.push([pen, x, z]);
        found += 1;
      }
    }
    for (const [pen, x, z] of candidates) {
      const patch: GrazePatch = { x, z, pen, first: tufts.length, count: 5, food: 1, shown: 1, claim: null, bitten: -10 };
      for (let k = 0; k < patch.count; k += 1) {
        const angle = (k / patch.count) * Math.PI * 2 + random();
        const r = k === 0 ? 0 : 0.12 + random() * 0.13;
        dummy.position.set(x + Math.cos(angle) * r, -0.05, z + Math.sin(angle) * r);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        const size = 0.95 + random() * 0.35;
        dummy.scale.set(size, size * (1.05 + random() * 0.35), size);
        dummy.updateMatrix();
        tufts.push(dummy.matrix.clone());
      }
      grazePatches.push(patch);
    }
  }
  const grazeShrink = new THREE.Matrix4();
  const grazeMatrix = new THREE.Matrix4();
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
  // The ranch's little duck pond shares the pond's water; it is scenery, not a tap target.
  const duckWater = new THREE.Mesh(pondSurface ?? circle(28), waterMaterial);
  if (pondSurface) {
    duckWater.scale.set(DUCK_POND.rx * 2 + 0.06, 1, DUCK_POND.rz * 2 + 0.06);
  } else {
    duckWater.rotation.x = -Math.PI / 2;
    duckWater.scale.set(DUCK_POND.rx + 0.03, DUCK_POND.rz + 0.03, 1);
  }
  duckWater.position.set(DUCK_POND.x, 0.055, DUCK_POND.z);
  duckWater.raycast = () => {};
  duckWater.renderOrder = 2;
  world.add(duckWater);

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

  /* ───────────── fruit ───────────── */
  /**
   * A fruit-shaped piece with its own colours: a unit sphere moved point by point by `shape` and
   * coloured by `paint` (both are given the point on the unit sphere; `paint` also gets the
   * vertex's column around and row down, for seeds and stripes that sit on the mesh), smooth
   * across its seam. Cached by `key`, so every fruit of a kind and ripeness shares one geometry.
   * Columns are kept a multiple of four so patterns meet at the seam.
   */
  function fruitGeometry(key: string, w: number, h: number, shape: (point: THREE.Vector3, unit: THREE.Vector3) => void, paint: (unit: THREE.Vector3, color: THREE.Color, column: number, row: number) => void): THREE.BufferGeometry {
    return primitive(`fruit:${key}`, () => {
      const columns = Math.max(8, Math.round((w * coarse) / 4) * 4);
      const rows = Math.max(6, Math.round(h * coarse));
      const ball = new THREE.SphereGeometry(1, columns, rows);
      ball.deleteAttribute("uv");
      ball.deleteAttribute("normal");
      const position = ball.attributes.position;
      const colors = new Float32Array(position.count * 3);
      const unit = new THREE.Vector3();
      const point = new THREE.Vector3();
      const color = new THREE.Color();
      for (let i = 0; i < position.count; i += 1) {
        unit.fromBufferAttribute(position, i);
        point.copy(unit);
        shape(point, unit);
        paint(unit, color, i % (columns + 1), Math.floor(i / (columns + 1)));
        position.setXYZ(i, point.x, point.y, point.z);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      ball.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const merged = mergeVertices(ball);
      ball.dispose();
      merged.computeVertexNormals();
      return merged;
    });
  }
  /** From unripe green to the ripe colour: stage 1 green, 2 turning, 3 ripe. */
  const ripening = (green: string, ripe: string, ripeness: number) => new THREE.Color(green).lerp(new THREE.Color(ripe), [0, 0, 0.5, 1][ripeness] ?? 1);
  /** A soft light on top and shade underneath, painted into a fruit's colour. */
  function shadeFruit(color: THREE.Color, base: THREE.Color, unit: THREE.Vector3, light = 0.12, dark = 0.22) {
    color.copy(base);
    if (unit.y > 0) color.lerp(tmpColor.copy(base).offsetHSL(0, -0.05, 0.12), unit.y * light * 4);
    else color.multiplyScalar(1 + unit.y * dark);
  }
  const longitude = (unit: THREE.Vector3) => Math.atan2(unit.z, unit.x);

  function orangeGeometry(ripeness: number) {
    const base = ripening("#7fae45", "#f28a22", ripeness);
    return fruitGeometry(`orange:${ripeness}`, 14, 10, (p, u) => {
      // Slightly flattened with a pitted skin and a dip where the stem joins.
      p.y *= 0.92;
      p.multiplyScalar(1 + 0.018 * Math.sin(u.x * 41 + u.y * 29) * Math.sin(u.z * 37 - u.y * 23));
      if (u.y > 0.9) p.y -= (u.y - 0.9) * 0.6;
    }, (u, c) => shadeFruit(c, base, u));
  }
  function lemonGeometry(ripeness: number) {
    const base = ripening("#86b84a", "#f1da3a", ripeness);
    const green = new THREE.Color("#8cbf4a");
    return fruitGeometry(`lemon:${ripeness}`, 12, 12, (p, u) => {
      // An oval with a nub at each end, the lower one longer.
      const tip = Math.max(0, Math.abs(u.y) - 0.8) / 0.2;
      p.x *= 0.92;
      p.z *= 0.92;
      p.y = u.y * 1.2 + Math.sign(u.y) * tip * tip * (u.y < 0 ? 0.3 : 0.14);
      p.multiplyScalar(1 + 0.012 * Math.sin(u.x * 47 + u.z * 31));
    }, (u, c) => {
      shadeFruit(c, base, u);
      c.lerp(green, Math.max(0, Math.abs(u.y) - 0.75) * 1.6 * (ripeness >= 3 ? 0.5 : 0));
    });
  }
  function mangoGeometry(ripeness: number) {
    const top = ripening("#6f9f3f", "#b7c043", ripeness);
    const bottom = ripening("#7fae45", "#f5a524", ripeness);
    const blush = new THREE.Color("#e2553a");
    return fruitGeometry(`mango:${ripeness}`, 12, 12, (p, u) => {
      // A long oval, bent like a bean, with a little beak at the bottom on one side.
      p.set(u.x * 0.76, u.y * 1.3, u.z * 0.66);
      p.x += 0.12 * (1 - u.y * u.y) - 0.2 * u.y * u.y;
      if (u.y < -0.55) p.x += 0.2 * ((-u.y - 0.55) / 0.45) ** 2;
    }, (u, c) => {
      shadeFruit(c, bottom, u, 0.05);
      c.lerp(top, Math.min(1, Math.max(0, (u.y + 0.2) / 1.2)));
      if (ripeness >= 3) c.lerp(blush, Math.max(0, u.x) * Math.min(1, Math.max(0, (u.y + 0.3) / 0.9)) * 0.7);
    });
  }
  function coconutGeometry(ripeness: number) {
    const base = ripening("#6f9a3a", "#9a7444", ripeness);
    return fruitGeometry(`coconut:${ripeness}`, 12, 10, (p, u) => {
      // Rounded with three soft ridges and a point at the bottom.
      const ridge = 1 + 0.07 * Math.cos(3 * longitude(u)) * (1 - u.y * u.y);
      p.set(u.x * 0.95 * ridge, u.y * 1.08, u.z * 0.95 * ridge);
      if (u.y < -0.85) p.y -= (-u.y - 0.85) * 0.5;
    }, (u, c) => {
      shadeFruit(c, base, u, 0.1, 0.25);
      c.multiplyScalar(1 - 0.1 * Math.max(0, Math.cos(3 * longitude(u))));
    });
  }
  /** One banana, a unit long, from the stalk along +y, curving towards +x. */
  function bananaGeometry(ripeness: number) {
    return primitive(`fruit:banana:${ripeness}:${coarse}`, () => {
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i += 1) {
        const t = i / 10;
        const r = t < 0.12 ? 0.07 + (t / 0.12) * 0.07 : 0.14 * (1 - Math.pow((t - 0.12) / 0.88, 2.4) * 0.7);
        profile.push(new THREE.Vector2(Math.max(0.03, r), t));
      }
      const lathe = new THREE.LatheGeometry(profile, coarse < 1 ? 5 : 6);
      lathe.deleteAttribute("uv");
      lathe.deleteAttribute("normal");
      const position = lathe.attributes.position;
      const colors = new Float32Array(position.count * 3);
      const body = ripening("#79a83c", "#f4d23e", ripeness);
      const green = new THREE.Color("#6f9a34");
      const tip = new THREE.Color("#4a3a24");
      const color = new THREE.Color();
      const bend = 0.95;
      const radius = 1 / bend;
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const a = y * bend;
        position.setXYZ(i, radius - (radius - x) * Math.cos(a), (radius - x) * Math.sin(a), z);
        color.copy(body).lerp(green, Math.max(0, 1 - y / 0.2) * 0.8);
        if (y > 0.94) color.lerp(tip, 0.85);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      lathe.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const merged = mergeVertices(lathe);
      lathe.dispose();
      merged.computeVertexNormals();
      return merged;
    });
  }
  function tomatoGeometry(ripe: boolean) {
    const base = new THREE.Color(ripe ? "#e2453a" : "#9acb63");
    return fruitGeometry(`tomato:${ripe}`, 12, 9, (p, u) => {
      // Flattened, with soft lobes and a dip at the stem.
      const lobe = 1 + 0.05 * Math.cos(5 * longitude(u)) * (1 - Math.abs(u.y));
      p.set(u.x * lobe, u.y * 0.8, u.z * lobe);
      if (u.y > 0.8) p.y -= (u.y - 0.8) * 0.4;
    }, (u, c) => shadeFruit(c, base, u, 0.16));
  }
  function strawberryGeometry(ripe: boolean) {
    const base = new THREE.Color(ripe ? "#d92f3f" : "#e3eec3");
    const seed = new THREE.Color(ripe ? "#f3d36b" : "#b9cf8a");
    return fruitGeometry(`strawberry:${ripe}`, 12, 10, (p, u) => {
      // Wide at the shoulders, coming to a rounded point.
      const width = 0.08 + 0.92 * Math.pow((u.y + 1) / 2, 0.6);
      p.set(u.x * width, u.y * 1.1, u.z * width);
    }, (u, c, column, row) => {
      shadeFruit(c, base, u, 0.08);
      // Seeds: single vertices on a diagonal lattice, so each shows as a small speck.
      if ((column + 2 * row) % 4 === 0 && u.y < 0.8 && u.y > -0.9) c.lerp(seed, 0.8);
    });
  }
  function melonGeometry(ripe: boolean) {
    const light = new THREE.Color(ripe ? "#8cc46a" : "#b5da86");
    const dark = new THREE.Color(ripe ? "#2f6a2f" : "#7fb35a");
    const spot = new THREE.Color("#e6d98a");
    const up = new THREE.Vector3();
    // The sphere's poles become the melon's ends (turned a quarter about z), so its stripes run
    // along the mesh's columns from end to end.
    return fruitGeometry(`melon:${ripe}`, 24, 12, (p, u) => {
      p.set(u.y * 1.3, -u.x * 0.85, u.z * 0.9);
    }, (u, c, column, row) => {
      up.set(u.y, -u.x, u.z);
      const wave = Math.round(Math.sin(row * 0.9) * 0.8);
      shadeFruit(c, (column + wave + 8) % 4 < 2 ? dark : light, up, 0.06, 0.18);
      // The pale patch it lay on.
      if (ripe && up.y < -0.7) c.lerp(spot, (-up.y - 0.7) * 2.2);
    });
  }
  function pumpkinGeometry(ripe: boolean) {
    const base = new THREE.Color(ripe ? "#ef8a2a" : "#b9c25a");
    return fruitGeometry(`pumpkin:${ripe}`, 24, 12, (p, u) => {
      // Eight ribs, squat, dipped in at the top and bottom.
      const rib = Math.abs(Math.cos(4 * longitude(u)));
      const k = 0.9 + 0.1 * Math.sqrt(rib);
      p.set(u.x * k, u.y * 0.72 - Math.sign(u.y) * Math.pow(Math.abs(u.y), 6) * 0.2, u.z * k);
    }, (u, c) => {
      shadeFruit(c, base, u, 0.1);
      c.multiplyScalar(0.8 + 0.2 * Math.sqrt(Math.abs(Math.cos(4 * longitude(u)))));
    });
  }
  function cobGeometry() {
    const kernel = new THREE.Color("#f4cf45");
    const kernelDark = new THREE.Color("#e2b232");
    return fruitGeometry("cob", 12, 14, (p, u) => {
      p.set(u.x * 0.4 * (1 - 0.3 * Math.max(0, u.y) ** 2), u.y * 1.2, u.z * 0.4 * (1 - 0.3 * Math.max(0, u.y) ** 2));
    }, (u, c) => {
      // Rows of kernels.
      const row = Math.floor(((longitude(u) + Math.PI) / (Math.PI * 2)) * 12) + Math.floor((u.y + 1) * 9);
      shadeFruit(c, row % 2 ? kernel : kernelDark, u, 0.05, 0.15);
    });
  }

  /**
   * A fruit hanging from a tree, its stalk at the origin: stalk, fruit and (for oranges, lemons and
   * mangoes) a leaf. `size` is the fruit's radius.
   */
  function treeFruit(fruit: "lemon" | "orange" | "mango" | "coconut", ripeness: number, size: number, random: () => number): THREE.Group {
    const group = new THREE.Group();
    const leafColor = TREE_MAP[fruit].leaf;
    if (fruit === "coconut") {
      const nut = part(coconutGeometry(ripeness), "vertex", 0, -size * 0.95, 0);
      nut.scale.setScalar(size);
      nut.rotation.z = (random() - 0.5) * 0.6;
      group.add(nut, part(cylinder(size * 0.28, size * 0.36, size * 0.18, 5), ripeness >= 3 ? "#6b4f2c" : "#5f7a2c", 0, -size * 0.05, 0));
      return group;
    }
    const stalk = fruit === "mango" ? size * 1.3 : size * 0.35;
    group.add(part(cylinder(size * 0.05, size * 0.07, stalk, 4), "#6b5a32", 0, -stalk / 2, 0));
    const geometry = fruit === "orange" ? orangeGeometry(ripeness) : fruit === "lemon" ? lemonGeometry(ripeness) : mangoGeometry(ripeness);
    const reach = fruit === "orange" ? 0.92 : fruit === "lemon" ? 1.2 : 1.3;
    const body = part(geometry, "vertex", 0, -stalk - size * reach, 0);
    body.scale.setScalar(size);
    body.rotation.y = random() * Math.PI * 2;
    if (fruit !== "mango") body.rotation.z = (random() - 0.5) * 0.35;
    group.add(body, part(cylinder(size * 0.16, size * 0.2, size * 0.08, 5), "#5d7a2e", 0, -stalk - size * 0.02, 0));
    leafAt(group, tint(leafColor, 0.05), 0, -stalk * 0.3, 0, random() * Math.PI * 2, 0.5, size * 1.9, size * 0.8, 0.3);
    return group;
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
        // Trusses of lobed tomatoes, each with its star of green sepals and a stalk.
        for (let i = 0; i < (ripe ? 6 : 3); i += 1) {
          const a = random() * Math.PI * 2;
          const y = 0.18 + random() * 0.3;
          const size = ripe ? 0.075 : 0.055;
          const x = Math.cos(a) * 0.18, z = Math.sin(a) * 0.18;
          const tomato = part(tomatoGeometry(ripe), "vertex", x, y, z);
          tomato.scale.setScalar(size);
          tomato.rotation.y = random() * Math.PI * 2;
          const cap = part(star(5), "#3f7a2c", x, y + size * 0.74, z);
          cap.scale.set(size * 1.5, size * 1.5, size * 1.5);
          cap.rotation.y = a;
          plant.add(tomato, cap, part(cylinder(0.006, 0.008, 0.07, 4), "#4f7a2c", x, y + size * 0.8 + 0.03, z));
        }
        break;
      }
      case "corn": {
        const height = ripe ? 1.05 : 0.65;
        plant.add(part(cylinder(0.028, 0.045, height, 8), "#6aa84a", 0, height / 2, 0));
        for (let i = 0; i < 5; i += 1) leafAt(plant, i % 2 ? leafLight : leafMid, 0, 0.1 + i * height * 0.16, 0, i * 2.4, 0.45, 0.42 + (i < 3 ? 0.06 : 0), 0.085, 0.55);
        if (ripe) {
          // An ear of corn, its kernels showing at the top of the opened husk, with silk.
          const ear = new THREE.Group();
          ear.position.set(0.05, 0.46, 0);
          ear.rotation.z = -0.35;
          const cob = part(cobGeometry(), "vertex", 0, 0.14, 0);
          cob.scale.setScalar(0.115);
          ear.add(cob);
          for (let k = 0; k < 4; k += 1) leafAt(ear, k % 2 ? "#a6c96a" : "#94bb5a", 0, 0.01, 0, (k / 4) * Math.PI * 2 + 0.4, 1.25, 0.2, 0.075, -0.12);
          for (let k = 0; k < 4; k += 1) leafAt(ear, "#c9a15a", 0, 0.27, 0, k * 1.6, 0.7, 0.07, 0.012, 0.3);
          plant.add(ear);
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
        // Berries lying out on the leaves, seeds on their skin, leafy caps and stalks back to the crown.
        for (let i = 0; i < (ripe ? 4 : 2); i += 1) {
          const a = (i / (ripe ? 4 : 2)) * Math.PI * 2 + random() * 0.8;
          const x = Math.cos(a) * 0.19, z = Math.sin(a) * 0.19;
          const holder = new THREE.Group();
          holder.position.set(x, 0.06, z);
          holder.rotation.y = -a;
          const berry = part(strawberryGeometry(ripe), "vertex", 0, 0, 0);
          berry.scale.setScalar(ripe ? 0.062 : 0.045);
          // Lying on its side, tip pointing out.
          berry.rotation.z = Math.PI / 2 + 0.25;
          holder.add(berry);
          const cap = part(star(6), "#3f8a3a", -0.06, 0.015, 0);
          cap.scale.setScalar(0.085);
          cap.rotation.z = Math.PI / 2 + 0.25;
          holder.add(cap);
          holder.add(turn(part(cylinder(0.005, 0.006, 0.16, 4), "#5f8a3a", -0.12, 0.03, 0), 0, 0, 1.2));
          plant.add(holder);
        }
        break;
      }
      case "pumpkin":
      case "watermelon": {
        for (let i = 0; i < 4; i += 1) leafAt(plant, i % 2 ? leafDark : leafMid, 0, 0.03, 0, (i / 4) * Math.PI * 2 + 0.6, 0.2, 0.3, 0.27, 0.3);
        const isPumpkin = crop === "pumpkin";
        const size = ripe ? 0.24 : 0.12;
        // A vine with a curl of tendril leads to the fruit.
        plant.add(turn(part(cylinder(0.01, 0.012, 0.32, 4), "#5f8a3a", -0.2, 0.03, 0.05), 0, 0, Math.PI / 2 - 0.1));
        if (isPumpkin) {
          // Ribbed and squat, with a thick woody stem.
          const pumpkin = part(pumpkinGeometry(ripe), "vertex", 0, size * 0.72, 0);
          pumpkin.scale.setScalar(size * 1.02);
          plant.add(pumpkin, turn(part(cylinder(0.022, 0.034, 0.12, 6), ripe ? "#7a6a3a" : "#6b8a3a", 0.01, size * 1.42, 0), 0, 0, -0.35));
        } else {
          // Striped, lying on its pale patch.
          const melon = part(melonGeometry(ripe), "vertex", 0, size * 0.75, 0);
          melon.scale.setScalar(size);
          plant.add(melon, part(cylinder(0.01, 0.014, 0.06, 4), "#6b8a3a", -size * 1.28, size * 0.85, 0));
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
            if (FISH_IDS.includes(key as FishId)) {
              models[key] = bakeModelFrame(normalizeFish(gltf.scene, entry.length ?? 1, entry.rotationY ?? 0));
              return;
            }
            const model = normalizeModel(gltf.scene, entry.height ?? (key === "truck" ? 1.1 : ANIMAL_HEIGHT[key as AnimalId]), entry.rotationY ?? 0);
            models[key] = key === "truck" ? model : prepareLegs(bakeModelFrame(model), key as AnimalId);
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

  /** A GLB fish turned to face +x, `length` long, centred on its middle. */
  function normalizeFish(source: THREE.Object3D, length: number, rotationY: number): THREE.Object3D {
    const wrapper = normalizeModel(source, 1, rotationY);
    const bounds = new THREE.Box3().setFromObject(wrapper);
    const size = bounds.getSize(new THREE.Vector3());
    wrapper.scale.setScalar(length / Math.max(0.0001, size.x));
    bounds.setFromObject(wrapper);
    const center = bounds.getCenter(new THREE.Vector3());
    wrapper.position.sub(center);
    const outer = new THREE.Group();
    outer.add(wrapper);
    return outer;
  }

  /** A float copy of a (possibly quantised or interleaved) attribute. */
  function floatAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
    const size = attribute.itemSize;
    const array = new Float32Array(attribute.count * size);
    for (let i = 0; i < attribute.count; i += 1) for (let c = 0; c < size; c += 1) array[i * size + c] = attribute.getComponent(i, c);
    return new THREE.BufferAttribute(array, size);
  }

  /**
   * Bakes every mesh's transform into its own copy of the geometry so the vertices sit in the
   * model's frame (y up from the feet, facing +z, or a fish along +x) — what the leg and swim
   * shaders measure from.
   */
  function bakeModelFrame(wrapper: THREE.Object3D): THREE.Object3D {
    wrapper.updateMatrixWorld(true);
    const inverse = wrapper.matrixWorld.clone().invert();
    const meshes: THREE.Mesh[] = [];
    wrapper.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    const frame = new THREE.Group();
    for (const mesh of meshes) {
      const source = mesh.geometry as THREE.BufferGeometry;
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(source.attributes)) {
        geometry.setAttribute(name, name === "position" || name === "normal" ? floatAttribute(attribute) : attribute);
      }
      if (source.index) geometry.setIndex(source.index);
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      owned.add(geometry);
      const baked = new THREE.Mesh(geometry, mesh.material);
      baked.castShadow = mesh.castShadow;
      baked.receiveShadow = mesh.receiveShadow;
      frame.add(baked);
    }
    return frame;
  }

  /**
   * Marks each vertex with its leg and how much it swings; keeps the hip height and the body's
   * height on `owner` for the shader.
   */
  function markLegs(positions: Float32Array, species: AnimalId, owner: { userData: Record<string, unknown> }): Float32Array {
    let top = 0;
    for (let i = 1; i < positions.length; i += 3) top = Math.max(top, positions[i]);
    owner.userData.hip = LEGS[species].hip * top;
    owner.userData.top = top;
    return legAttributes(positions, LEGS[species].gait, owner.userData.hip as number);
  }

  /** Marks the vertices of a grown animal's model with its legs and head. */
  function prepareLegs(model: THREE.Object3D, species: AnimalId): THREE.Object3D {
    const meshes: THREE.Mesh[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    // Legs and head are found across the whole model at once (a GLB may split one animal into parts).
    const all = new Float32Array(meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.array.length, 0));
    let filled = 0;
    for (const mesh of meshes) {
      const array = mesh.geometry.attributes.position.array as Float32Array;
      all.set(array, filled);
      filled += array.length;
    }
    const legs = markLegs(all, species, model);
    const { weights: head, pivot } = headAttributes(all, LEGS[species].neck);
    model.userData.neck = pivot;
    model.userData.drop = LEGS[species].drop * (model.userData.top as number);
    let offset = 0;
    for (const mesh of meshes) {
      const count = mesh.geometry.attributes.position.count;
      mesh.geometry.setAttribute("aLeg", new THREE.BufferAttribute(legs.slice(offset * 2, (offset + count) * 2), 2));
      mesh.geometry.setAttribute("aHead", new THREE.BufferAttribute(head.slice(offset, offset + count), 1));
      offset += count;
    }
    return model;
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
    body: THREE.Object3D;
    /** Its own swim wave (phase and how far the tail swings) and the material copies carrying it. */
    swim: SwimUniforms;
    materials: THREE.Material[];
    modelsVersion: number;
    yaw: number;
    star: THREE.Sprite;
    phase: number;
    params: { ax: number; az: number; w1: number; w2: number; p1: number; p2: number; depth: number };
    scale: number;
    targetScale: number;
    mature: boolean;
  }
  const fishViews = new Map<string, FishView>();
  const trashViews = new Map<string, THREE.Group>();
  const fishTemplates = new Map<FishId, THREE.BufferGeometry>();
  let hungry = false;

  /**
   * How each pond fish is built, facing +x from the nose (x 0.5) to the root of the tail (x -0.42):
   * `height` and `width` of the body, its tail fin outline, the fins it has, and how it is marked.
   */
  const FISH_SHAPES: Record<FishId, { height: number; width: number; tail: [number, number][]; dorsal: number; barbels: boolean; spikes: boolean; scutes: boolean }> = {
    tilapia: { height: 0.25, width: 0.42, tail: [[0, 0.05], [-0.26, 0.2], [-0.29, 0], [-0.26, -0.2], [0, -0.05]], dorsal: 0.12, barbels: false, spikes: false, scutes: false },
    carp: { height: 0.21, width: 0.5, tail: [[0, 0.05], [-0.3, 0.24], [-0.19, 0], [-0.3, -0.24], [0, -0.05]], dorsal: 0.1, barbels: true, spikes: false, scutes: false },
    puffer: { height: 0.3, width: 0.86, tail: [[0, 0.05], [-0.15, 0.13], [-0.12, 0], [-0.15, -0.13], [0, -0.05]], dorsal: 0.07, barbels: false, spikes: true, scutes: false },
    goldfish: { height: 0.27, width: 0.6, tail: [[0, 0.06], [-0.3, 0.32], [-0.46, 0.22], [-0.3, 0], [-0.46, -0.22], [-0.3, -0.32], [0, -0.06]], dorsal: 0.15, barbels: false, spikes: false, scutes: false },
    koi: { height: 0.2, width: 0.52, tail: [[0, 0.05], [-0.3, 0.23], [-0.2, 0], [-0.3, -0.23], [0, -0.05]], dorsal: 0.09, barbels: true, spikes: false, scutes: false },
    sturgeon: { height: 0.13, width: 0.75, tail: [[0, 0.04], [-0.36, 0.2], [-0.16, 0], [-0.2, -0.09], [0, -0.04]], dorsal: 0.06, barbels: true, spikes: false, scutes: true },
  };

  /**
   * A pond fish in one geometry: a smooth tapered body shaded dark on the back and pale on the
   * belly with its own markings, a tail fin, dorsal, anal and side fins, eyes and a mouth.
   */
  function fishTemplate(species: FishId): THREE.BufferGeometry {
    let template = fishTemplates.get(species);
    if (template) return template;
    const def = FISH_MAP[species];
    const shape = FISH_SHAPES[species];
    const temporary: THREE.BufferGeometry[] = [];
    const own = <T extends THREE.BufferGeometry>(geometry: T) => {
      temporary.push(geometry);
      return geometry;
    };
    const base = new THREE.Color(def.color);
    const back = new THREE.Color(def.accent);
    if (species === "goldfish") back.set("#d4601e");
    if (species === "koi") back.set(def.color);
    if (species === "puffer") back.set(def.color).multiplyScalar(0.8);
    const belly = base.clone().lerp(new THREE.Color("#fffaf0"), 0.6);
    const fin = species === "goldfish" ? base.clone().lerp(new THREE.Color(def.accent), 0.4) : base.clone().lerp(new THREE.Color(def.accent), 0.55);
    const sturgeonSnout = species === "sturgeon";
    // Half the body's height at a point along it (0 at the nose, 1 at the tail root).
    const radius = (t: number) => Math.max(0.035 * t, shape.height * Math.pow(Math.sin(Math.PI * Math.pow(t, sturgeonSnout ? 0.55 : 0.75)), 0.85));
    const along = (x: number) => Math.min(1, Math.max(0, (0.5 - x) / 0.92));
    const root = new THREE.Group();

    // The body: a lathe along +x, flattened to the fish's width, coloured per vertex.
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i += 1) {
      const t = i / 18;
      profile.push(new THREE.Vector2(radius(t), 0.5 - t * 0.92));
    }
    const lathe = own(new THREE.LatheGeometry(profile, options.quality === "low" ? 10 : 16));
    lathe.rotateZ(-Math.PI / 2);
    lathe.scale(1, 1, shape.width);
    // Lathe winds its faces inside out once turned this way; flip them so the outside faces out.
    const index = lathe.index as THREE.BufferAttribute;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
    lathe.computeVertexNormals();
    const positions = lathe.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    const koiPatches: [number, number, number][] = [[0.27, 0.1, 0.11], [0.02, 0.14, 0.13], [-0.27, 0.06, 0.08]];
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const v = y / Math.max(0.02, radius(along(x)));
      // Countershading: pale belly, the body colour on the flanks, darker along the back.
      color.copy(belly).lerp(base, Math.min(1, Math.max(0, (v + 0.55) / 0.6)));
      color.lerp(back, Math.min(1, Math.max(0, (v - 0.35) / 0.6)) * (species === "koi" ? 0 : 0.85));
      if (species === "tilapia" && v > -0.3 && Math.sin(x * 30) > 0.55) color.multiplyScalar(0.84);
      if (species === "carp" && Math.sin(x * 46 + v * 3) * Math.sin(v * 9) > 0.45) color.multiplyScalar(0.9);
      if (species === "koi" && v > -0.35 && koiPatches.some(([px, py, r]) => Math.hypot(x - px, (y - py) * 1.3) < r)) color.set(def.accent);
      if (species === "puffer" && v > 0.05 && Math.sin(x * 34) * Math.sin(z * 34 + 1) > 0.45) color.set(def.accent);
      if (species === "goldfish" && v > -0.2 && v < 0.4 && x < -0.05 && Math.sin(x * 20 + v * 4) > 0.8) color.lerp(new THREE.Color("#fff0d2"), 0.6);
      if (species === "sturgeon" && Math.abs(v - 0.15) < 0.1 && x < 0.32) color.lerp(new THREE.Color(def.accent), 0.5);
      // A faint gill line behind the head.
      if (Math.abs(x - 0.3) < 0.012 && v < 0.75) color.multiplyScalar(0.82);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    lathe.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    root.add(part(lathe, "vertex"));

    // Flat fins with a little thickness so they show from both sides.
    const finAt = (outline: [number, number][], tone: THREE.Color, x: number, y: number, z = 0, thickness = 0.016) => {
      const path = new THREE.Shape(outline.map(([px, py]) => new THREE.Vector2(px, py)));
      const geometry = own(new THREE.ExtrudeGeometry(path, { depth: thickness, bevelEnabled: false, curveSegments: 4 }));
      geometry.translate(0, 0, -thickness / 2);
      const item = part(geometry, `#${tone.getHexString()}`, x, y, z);
      root.add(item);
      return item;
    };
    // Tail: a goldfish's is double and veil-like, wider.
    finAt(shape.tail, fin, -0.4, 0, 0, species === "goldfish" ? 0.03 : 0.016);
    const top = (x: number) => radius(along(x)) * 0.94;
    const d = shape.dorsal;
    finAt([[0.14, top(0.14) - 0.03], [0.02, top(0.02) + d], [-0.2, top(-0.2) + d * 0.45], [-0.26, top(-0.26) - 0.03]], fin, 0, 0);
    finAt([[-0.12, -top(-0.12) + 0.02], [-0.22, -top(-0.22) - d * 0.6], [-0.32, -top(-0.32) + 0.01]], fin, 0, 0);
    for (const side of [-1, 1]) {
      const sideZ = radius(along(0.18)) * shape.width;
      const pectoral = finAt([[0, 0.02], [-0.12, 0.05], [-0.15, -0.02], [-0.04, -0.03]], fin, 0.2, -radius(along(0.2)) * 0.45, side * sideZ * 0.92, 0.012);
      pectoral.rotation.set(side * 0.9, side * 0.35, -0.35);
      // Eyes: a pale ring with a dark pupil, sitting on the head's surface.
      const eyeX = sturgeonSnout ? 0.24 : 0.36;
      const eyeY = radius(along(eyeX)) * 0.28;
      const eyeZ = radius(along(eyeX)) * shape.width * 0.86;
      root.add(part(sphere(0.042, 8, 6), "#f4f1e6", eyeX, eyeY, side * eyeZ));
      root.add(part(sphere(0.028, 8, 6), "#141a18", eyeX + 0.012, eyeY, side * (eyeZ + 0.022)));
      if (shape.barbels) {
        const barbel = part(cylinder(0.006, 0.004, 0.11, 4), fin.getStyle(), 0.46, -0.04, side * 0.03);
        barbel.rotation.set(side * 0.6, 0, 1.0);
        root.add(barbel);
      }
    }
    // The mouth.
    root.add(part(sphere(0.022, 6, 4), "#3a2a26", 0.5, sturgeonSnout ? -0.03 : -0.01, 0));
    if (shape.spikes) {
      for (let i = 0; i < 14; i += 1) {
        const angle = (i / 14) * Math.PI * 2;
        const x = 0.2 - (i % 3) * 0.17;
        const r = radius(along(x));
        const spike = part(cone(0.016, 0.06, 4), def.accent, x, Math.cos(angle) * r * 0.98, Math.sin(angle) * r * shape.width * 0.98);
        spike.rotation.x = -angle;
        root.add(spike);
      }
    }
    if (shape.scutes) {
      for (let i = 0; i < 7; i += 1) {
        const x = 0.24 - i * 0.09;
        const scute = part(cone(0.02, 0.045, 4), def.accent, x, radius(along(x)) * 0.97, 0);
        root.add(scute);
      }
    }
    template = bakeGeometry(root, false) ?? new THREE.BufferGeometry();
    temporary.forEach((geometry) => geometry.dispose());
    fishTemplates.set(species, template);
    return template;
  }

  /** The fish's body: the Meshy model when there is one, or the built-in fish, swimming on its own. */
  function fishBody(species: FishId, swim: SwimUniforms, materials: THREE.Material[]): THREE.Object3D {
    const model = models[species];
    if (model) {
      const body = model.clone(true);
      body.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = swimMaterial(child.material as THREE.Material, swim);
        materials.push(material);
        child.material = material;
      });
      return body;
    }
    const material = swimMaterial(surface, swim);
    materials.push(material);
    return new THREE.Mesh(fishTemplate(species), material);
  }

  function buildFish(fish: PondFish): FishView {
    const def = FISH_MAP[fish.species];
    const random = mulberry32(hashString(fish.id));
    const group = new THREE.Group();
    group.userData.hit = { kind: "fish", id: fish.id } satisfies SceneHit;
    const swim: SwimUniforms = { uSwim: { value: random() * 6.28 }, uSwimAmp: { value: 0 } };
    const materials: THREE.Material[] = [];
    const body = fishBody(fish.species, swim, materials);
    group.add(body, new THREE.Mesh(sphere(0.75, 8, 6), hiddenMaterial));
    const star = icon("star", 0.62);
    star.visible = false;
    scene.add(star);
    const size = fishSize(fish.growth / def.growSeconds);
    group.scale.setScalar(size);
    group.rotation.order = "YXZ";
    world.add(group);
    return {
      group,
      body,
      swim,
      materials,
      modelsVersion,
      yaw: 0,
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
    /** Scales the body: the young are smaller. */
    holder: THREE.Group;
    /** Tilts, rolls and squashes the body for pecking, grazing, waddling and lying down. */
    pose: THREE.Group;
    body: THREE.Object3D;
    /** What it does while standing still: peck, preen or graze; its timer; how lying down it is. */
    idle: number;
    lie: number;
    heading: number;
    /** Its own leg and head shader values, how far its head sinks to eat, and the material copies. */
    legs: AnimalUniforms;
    drop: number;
    materials: THREE.Material[];
    /** The grass patch it is walking to, and the one it is eating now (-1 for none). */
    goal: number;
    eat: number;
    bowl: THREE.Sprite;
    sleep: THREE.Sprite;
    species: AnimalId;
    young: boolean;
    modelsVersion: number;
    target: THREE.Vector2;
    wait: number;
    speed: number;
    /** A per-animal number that varies its idle habits. */
    hop: number;
    /** How far a duck has settled into the water (0 on land, 1 swimming). */
    swim: number;
  }
  const animalViews = new Map<string, AnimalView>();
  const dropViews = new Map<string, THREE.Group>();
  const animalTemplates = new Map<AnimalId, THREE.BufferGeometry>();
  const dropTemplates = new Map<ProductId, THREE.BufferGeometry>();

  function animalTemplate(species: AnimalId, young = false): THREE.BufferGeometry {
    // Chicks and ducklings are downy yellow; lambs and calves are just smaller.
    const downy = young && (species === "chicken" || species === "duck");
    const key = downy ? `${species}:young` : species;
    let template = animalTemplates.get(key as AnimalId);
    if (template) return template;
    const base = ANIMAL_MAP[species];
    const def = downy ? { ...base, color: "#f6d55c", accent: species === "chicken" ? "#f2a541" : "#f0a030" } : base;
    const root = new THREE.Group();
    // The head's parts go in their own group, marked so they can turn down to eat.
    const head = new THREE.Group();
    root.add(head);
    if (species === "chicken") {
      const body = part(sphere(0.22, 10, 8), def.color, 0, 0.3, 0);
      body.scale.set(1, 0.9, 1.15);
      const tail = part(cone(0.12, 0.22, 5), def.color, 0, 0.42, -0.22);
      tail.rotation.x = -0.7;
      const beak = part(cone(0.05, 0.12, 4), "#f2a541", 0, 0.5, 0.3);
      beak.rotation.x = Math.PI / 2;
      root.add(body, tail);
      head.add(part(sphere(0.12, 8, 6), def.color, 0, 0.52, 0.17), part(box(0.04, 0.09, 0.12), def.accent, 0, 0.66, 0.17), part(sphere(0.035, 5, 4), def.accent, 0, 0.44, 0.27), beak);
      for (const side of [-1, 1]) {
        root.add(part(cylinder(0.02, 0.02, 0.18, 4), "#e9a23b", side * 0.08, 0.09, 0));
        head.add(part(sphere(0.025, 5, 4), "#222222", side * 0.075, 0.55, 0.26));
      }
    } else if (species === "duck") {
      const body = part(sphere(0.24, 10, 8), def.color, 0, 0.26, 0);
      body.scale.set(0.9, 0.72, 1.3);
      const tail = part(cone(0.1, 0.18, 5), def.color, 0, 0.36, -0.3);
      tail.rotation.x = -1;
      root.add(body, tail);
      head.add(part(sphere(0.13, 8, 6), def.color, 0, 0.5, 0.22), part(box(0.13, 0.05, 0.16), def.accent, 0, 0.46, 0.38));
      for (const side of [-1, 1]) {
        head.add(part(sphere(0.025, 5, 4), "#222222", side * 0.08, 0.54, 0.31));
        root.add(part(box(0.08, 0.03, 0.12), def.accent, side * 0.09, 0.02, 0.05));
      }
    } else if (species === "sheep") {
      const fleece = part(ico(0.36, 1), def.color, 0, 0.5, 0);
      fleece.scale.set(1, 0.85, 1.25);
      root.add(fleece);
      head.add(part(box(0.22, 0.24, 0.26), def.accent, 0, 0.56, 0.46), part(ico(0.13, 0), def.color, 0, 0.72, 0.42));
      for (const side of [-1, 1]) {
        const ear = part(box(0.14, 0.05, 0.07), def.accent, side * 0.16, 0.62, 0.44);
        ear.rotation.z = side * 0.4;
        head.add(ear, part(sphere(0.025, 5, 4), "#ffffff", side * 0.07, 0.6, 0.6));
        for (const z of [-0.22, 0.22]) root.add(part(cylinder(0.05, 0.05, 0.32, 5), def.accent, side * 0.17, 0.16, z));
      }
    } else {
      root.add(part(box(0.56, 0.46, 0.96), def.color, 0, 0.6, 0));
      root.add(part(box(0.57, 0.24, 0.3), def.accent, 0, 0.66, -0.15), part(box(0.3, 0.2, 0.25), def.accent, 0.05, 0.74, 0.3));
      head.add(part(box(0.36, 0.34, 0.36), def.color, 0, 0.78, 0.6), part(box(0.3, 0.16, 0.12), "#f1b5b0", 0, 0.68, 0.8));
      root.add(part(sphere(0.1, 7, 5), "#f1b5b0", 0, 0.36, -0.1));
      for (const side of [-1, 1]) {
        const horn = part(cone(0.04, 0.14, 4), "#efe3c4", side * 0.15, 1.0, 0.55);
        horn.rotation.z = -side * 0.5;
        head.add(horn, part(sphere(0.03, 5, 4), "#222222", side * 0.13, 0.84, 0.78));
        for (const z of [-0.34, 0.34]) root.add(part(cylinder(0.06, 0.06, 0.4, 5), "#f6f2ea", side * 0.2, 0.2, z), part(box(0.13, 0.06, 0.13), "#3a332c", side * 0.2, 0.03, z));
      }
    }
    head.traverse((item) => {
      item.userData.sway = 1;
    });
    template = bakeGeometry(root, true, true) ?? new THREE.BufferGeometry();
    animalTemplates.set(key as AnimalId, template);
    return template;
  }

  /** The animal's body with its own copy of the material, so its legs and head move on their own. */
  function animalBody(species: AnimalId, young: boolean, legs: AnimalUniforms, materials: THREE.Material[]): THREE.Object3D {
    const model = models[species];
    if (model) {
      legs.uHip.value = model.userData.hip as number;
      legs.uNeck.value.fromArray(model.userData.neck as [number, number]);
      const body = model.clone(true);
      body.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = animalMaterial(child.material as THREE.Material, legs);
        materials.push(material);
        child.material = material;
      });
      return body;
    }
    const geometry = animalTemplate(species, young);
    if (!geometry.getAttribute("aLeg")) {
      geometry.setAttribute("aLeg", new THREE.BufferAttribute(markLegs(geometry.attributes.position.array as Float32Array, species, geometry), 2));
      // The head parts were marked while building (as sway); they turn as one piece.
      geometry.setAttribute("aHead", geometry.getAttribute("aSway"));
      geometry.deleteAttribute("aSway");
      geometry.userData.neck = LEGS[species].builtInPivot;
      geometry.userData.drop = 0;
    }
    legs.uHip.value = geometry.userData.hip as number;
    legs.uNeck.value.fromArray(geometry.userData.neck as [number, number]);
    const material = animalMaterial(surface, legs);
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadowsOn;
    return mesh;
  }

  /** The ranch's capacity level, which sets how big the pens are. */
  let ranchLevel = 0;
  /** A free spot in each pen, whatever its size (used when a random spot keeps landing on something). */
  const PEN_REST: Record<PenId, [number, number]> = { poultry: [-2.0, 8.4], sheep: [-1.0, 11.65], cow: [3.25, 9.6] };
  /** A random free spot in a pen; a swimmer may get one on the duck pond. */
  function randomPenPoint(pen: PenId, seed: number, swim = false): THREE.Vector2 {
    const random = mulberry32(seed);
    if (swim) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 0.62;
      return new THREE.Vector2(DUCK_POND.x + Math.cos(a) * r * DUCK_POND.rx, DUCK_POND.z + Math.sin(a) * r * DUCK_POND.rz);
    }
    const rect = penRect(pen, ranchLevel);
    for (let i = 0; i < 16; i += 1) {
      const x = rect.x0 + random() * (rect.x1 - rect.x0), z = rect.z0 + random() * (rect.z1 - rect.z0);
      if (walkable(pen, ranchLevel, x, z)) return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(...PEN_REST[pen]);
  }
  /** Where an animal stands to eat at its pen's trough (on the pen's side, spread along it). */
  function troughPoint(pen: PenId, seed: number): THREE.Vector2 {
    const { x, z, hx, hz } = FIXTURES[TROUGH_OF[pen]];
    const spread = (((seed % 9) - 4) / 4) * 0.8;
    if (pen === "poultry") return new THREE.Vector2(x + spread * hx, z + hz + 0.2);
    if (pen === "sheep") return new THREE.Vector2(x - hx - 0.32, z + spread * hz);
    return new THREE.Vector2(x + hx + 0.45, z + spread * hz);
  }
  const PEN_OF_PRODUCT: Record<ProductId, PenId> = { egg: "poultry", duckEgg: "poultry", wool: "sheep", milk: "cow" };
  /** A product left lying in its pen: drops keep their place in -1..1 across the pen. */
  function dropPoint(drop: RanchDrop): [number, number] {
    const pen = PEN_OF_PRODUCT[drop.product] ?? "poultry";
    const rect = penRect(pen, ranchLevel);
    const room = PEN_ROOM[pen] + 0.1;
    for (let i = 0; i < 8; i += 1) {
      const u = (((drop.x + 1) / 2 + i * 0.37) % 1), v = (((drop.z + 1) / 2 + i * 0.61) % 1);
      const x = rect.x0 + room + u * (rect.x1 - rect.x0 - room * 2), z = rect.z0 + room + v * (rect.z1 - rect.z0 - room * 2);
      if (walkable(pen, ranchLevel, x, z)) return [x, z];
    }
    return PEN_REST[pen];
  }

  function buildAnimal(animal: RanchAnimal, index: number): AnimalView {
    const group = new THREE.Group();
    group.userData.hit = { kind: "animal", id: animal.id } satisfies SceneHit;
    const young = !isGrown(animal);
    const size = ANIMAL_HEIGHT[animal.species];
    const legs = animalUniforms(0, LEGS[animal.species].swing);
    const materials: THREE.Material[] = [];
    const body = animalBody(animal.species, young, legs, materials);
    const holder = new THREE.Group();
    const pose = new THREE.Group();
    pose.add(body);
    holder.add(pose);
    group.add(holder, new THREE.Mesh(sphere(Math.max(0.45, size * 0.6), 8, 6), hiddenMaterial));
    const start = randomPenPoint(PEN_OF[animal.species], hashString(animal.id) + index);
    group.position.set(start.x, 0, start.y);
    const bowl = icon("bowl", 0.55);
    bowl.position.set(0, size + 0.45, 0);
    bowl.visible = false;
    const sleep = icon("sleep", 0.5);
    sleep.position.set(0.15, size + 0.35, 0);
    sleep.visible = false;
    group.add(bowl, sleep);
    world.add(group);
    return {
      group,
      holder,
      pose,
      body,
      idle: 0,
      lie: 0,
      heading: 0,
      legs,
      drop: (models[animal.species]?.userData.drop as number | undefined) ?? 0,
      materials,
      goal: -1,
      eat: -1,
      bowl,
      sleep,
      species: animal.species,
      young,
      modelsVersion,
      target: randomPenPoint(PEN_OF[animal.species], hashString(animal.id) * 7 + 1),
      swim: 0,
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
    const [x, z] = dropPoint(drop);
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

  /* ───────────── ranch yard: fences and extras that grow with the pens ───────────── */
  interface RanchYardView { level: number; group: THREE.Group }
  let ranchYard: RanchYardView | null = null;
  /** A picket fence from (x1, z1) to (x2, z2): posts, two rails and pointed pickets. */
  function picketFence(root: THREE.Object3D, x1: number, z1: number, x2: number, z2: number, color: string) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 0.1) return;
    const yaw = -Math.atan2(z2 - z1, x2 - x1);
    const posts = Math.max(2, Math.round(length / 1.0) + 1);
    for (let i = 0; i < posts; i += 1) {
      const t = i / (posts - 1);
      root.add(part(rbox(0.1, 0.56, 0.1, 0.03), tint(color, -0.04), x1 + (x2 - x1) * t, 0.28, z1 + (z2 - z1) * t));
    }
    for (const y of [0.15, 0.36]) root.add(turn(part(rbox(length, 0.045, 0.035, 0.015), tint(color, -0.08), (x1 + x2) / 2, y, (z1 + z2) / 2), 0, yaw, 0));
    const pickets = Math.max(2, Math.round(length / 0.15));
    for (let i = 0; i < pickets; i += 1) {
      const t = (i + 0.5) / pickets;
      const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
      root.add(turn(part(rbox(0.065, 0.4, 0.022, 0.01), color, px, 0.24, pz), 0, yaw, 0), turn(part(cone(0.042, 0.07, 4), color, px, 0.475, pz), 0, yaw + Math.PI / 4, 0));
    }
  }
  /** Gate posts either side of an opening, the gate swung open into the pen. */
  function gateAt(root: THREE.Object3D, x: number, z0: number, z1: number, into: number, color: string) {
    for (const z of [z0, z1]) root.add(part(rbox(0.13, 0.78, 0.13, 0.035), tint(color, -0.08), x, 0.39, z), part(sphere(0.07, 8, 6), tint(color, -0.08), x, 0.8, z));
    const width = z1 - z0 - 0.08;
    const gate = new THREE.Group();
    gate.position.set(x, 0, z0 + 0.04);
    gate.rotation.y = into * 1.0;
    for (const y of [0.18, 0.42]) gate.add(part(rbox(0.04, 0.05, width, 0.015), color, 0, y, width / 2));
    for (let i = 0; i <= 3; i += 1) gate.add(part(rbox(0.04, 0.32, 0.04, 0.012), color, 0, 0.3, (i / 3) * width));
    gate.add(turn(part(rbox(0.035, 0.035, Math.hypot(width, 0.24), 0.01), color, 0, 0.3, width / 2), Math.atan2(0.24, width), 0, 0));
    root.add(gate);
  }
  /** Small triangular flags on a sagging string between two points. */
  function bunting(root: THREE.Object3D, ax: number, az: number, bx: number, bz: number, y: number) {
    const colors = ["#e2533d", "#f2c94c", "#5fa043", "#3e8fd6", "#f28fb1"];
    const length = Math.hypot(bx - ax, bz - az);
    const flags = Math.max(3, Math.round(length / 0.22));
    const yaw = -Math.atan2(bz - az, bx - ax);
    for (let i = 0; i <= flags; i += 1) {
      const t = i / flags;
      const sag = 0.16 * 4 * t * (1 - t);
      const fx = ax + (bx - ax) * t, fz = az + (bz - az) * t;
      if (i < flags) {
        const flag = part(cone(0.07, 0.16, 3), colors[i % colors.length], fx + ((bx - ax) / flags) * 0.5, y - sag - 0.09, fz + ((bz - az) / flags) * 0.5);
        flag.rotation.set(Math.PI, yaw, 0);
        flag.scale.set(1, 1, 0.2);
        root.add(flag);
      }
      if (i > 0) {
        const pt = i - 1;
        const t0 = pt / flags;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, y0 = y - 0.16 * 4 * t0 * (1 - t0);
        const wire = part(cylinder(0.006, 0.006, Math.hypot(fx - x0, y - sag - y0, fz - z0), 4), "#5a4a3a", (fx + x0) / 2, (y - sag + y0) / 2, (fz + z0) / 2);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fx - x0, y - sag - y0, fz - z0).normalize());
        root.add(wire);
      }
    }
  }

  function buildRanchYard(level: number): RanchYardView {
    const props = new THREE.Group();
    const leaves = new THREE.Group();
    const glow = new THREE.Group();
    const poultry = penRect("poultry", level), sheep = penRect("sheep", level), cow = penRect("cow", level);
    // Poultry: a white picket fence; its gate onto the lane between the trough and the pond.
    const white = "#f4efe2";
    picketFence(props, poultry.x0, poultry.z0, poultry.x1, poultry.z0, white);
    picketFence(props, poultry.x0, poultry.z0, poultry.x0, poultry.z1, white);
    picketFence(props, poultry.x0, poultry.z1, poultry.x1, poultry.z1, white);
    picketFence(props, poultry.x1, poultry.z0, poultry.x1, 7.3, white);
    picketFence(props, poultry.x1, 7.95, poultry.x1, poultry.z1, white);
    gateAt(props, poultry.x1, 7.3, 7.95, 1, white);
    // Sheep: cream rails; cows: rustic wood rails; each with a gate onto the lane.
    const cream = "#f1e4c8", wood = "#b98a55";
    addFence(props, 0, 0, [
      [sheep.x0, sheep.z0, sheep.x1, sheep.z0],
      [sheep.x0, sheep.z0, sheep.x0, sheep.z1],
      [sheep.x0, sheep.z1, sheep.x1, sheep.z1],
      [sheep.x1, sheep.z0, sheep.x1, 11.05],
      [sheep.x1, 11.75, sheep.x1, sheep.z1],
    ], cream);
    gateAt(props, sheep.x1, 11.05, 11.75, 1, cream);
    addFence(props, 0, 0, [
      [cow.x0, cow.z0, cow.x1, cow.z0],
      [cow.x1, cow.z0, cow.x1, cow.z1],
      [cow.x0, cow.z1, cow.x1, cow.z1],
      [cow.x0, cow.z0, cow.x0, 9.45],
      [cow.x0, 10.25, cow.x0, cow.z1],
    ], wood);
    gateAt(props, cow.x0, 9.45, 10.25, -1, wood);

    const lane = (LANE.x0 + LANE.x1) / 2;
    if (level >= 1) {
      // A stack of hay bales in the lane, a wheelbarrow of hay beside it (clear of the sheep gate),
      // straw piles for the hens.
      addBale(props, lane + 0.25, 0, 10.0, 0.1);
      addBale(props, lane - 0.22, 0, 10.05, -0.15);
      addBale(props, lane + 0.02, 0.42, 10.02, 0.05);
      const barrow = new THREE.Group();
      barrow.position.set(lane + 0.4, 0, 10.95);
      barrow.rotation.y = 0.6;
      barrow.add(part(rbox(0.36, 0.16, 0.5, 0.03), "#5f8a8a", 0, 0.24, 0), turn(part(cylinder(0.1, 0.1, 0.04, 12), "#3b3530", 0, 0.1, 0.3), 0, 0, Math.PI / 2));
      for (const side of [-1, 1]) barrow.add(turn(part(rbox(0.03, 0.03, 0.42, 0.01), "#7a5638", side * 0.14, 0.24, -0.36), 0.25, 0, 0), part(rbox(0.03, 0.18, 0.03, 0.01), "#7a5638", side * 0.13, 0.09, -0.12));
      props.add(barrow);
      for (let i = 0; i < 6; i += 1) leafAt(leaves, "#e2c25f", lane + 0.4 + Math.cos(i) * 0.06, 0.33, 10.95 + Math.sin(i) * 0.08, i * 1.1, 0.5, 0.14, 0.04, 0, 0.2);
      for (const [hx, hz] of [[poultry.x0 + 0.45, poultry.z1 - 0.45], [poultry.x0 + 0.5, 7.4]]) {
        const heap = part(sphere(0.26, 10, 6), "#e2c25f", hx, 0.03, hz);
        heap.scale.set(1, 0.32, 0.8);
        props.add(heap);
        for (let i = 0; i < 6; i += 1) leafAt(leaves, i % 2 ? "#e9cc6a" : "#d8b44e", hx, 0.06, hz, i * 1.05, 0.4, 0.16, 0.03, 0, 0.2);
      }
    }
    if (level >= 2) {
      // A bench, milk cans by the cow pen's gate, a water barrel, flower boxes along the lane.
      const bench = new THREE.Group();
      bench.position.set(lane + 0.5, 0, 11.75);
      bench.rotation.y = -Math.PI / 2;
      bench.add(part(rbox(0.62, 0.05, 0.2, 0.015), "#8f5d3a", 0, 0.28, 0), part(rbox(0.62, 0.16, 0.04, 0.015), "#8f5d3a", 0, 0.42, -0.09));
      for (const side of [-1, 1]) bench.add(part(rbox(0.05, 0.28, 0.18, 0.012), "#6b4a30", side * 0.26, 0.14, 0));
      props.add(bench);
      for (const [mx, mz] of [[lane + 0.62, 9.05], [lane + 0.55, 9.3]]) props.add(part(cylinder(0.09, 0.1, 0.3, 12), "#c9cfd2", mx, 0.15, mz), part(cylinder(0.05, 0.08, 0.08, 12), "#c9cfd2", mx, 0.34, mz), part(cylinder(0.06, 0.06, 0.02, 12), "#9aa4a8", mx, 0.39, mz));
      props.add(part(cylinder(0.17, 0.15, 0.4, 12), "#8f5d3a", lane - 0.6, 0.2, 9.3), part(cylinder(0.172, 0.172, 0.03, 12), "#5a4a3a", lane - 0.6, 0.12, 9.3), part(cylinder(0.172, 0.172, 0.03, 12), "#5a4a3a", lane - 0.6, 0.3, 9.3), part(cylinder(0.15, 0.15, 0.01, 12), "#7fb6c0", lane - 0.6, 0.39, 9.3));
      const blooms = ["#f28fb1", "#ffd166", "#ef6f6c", "#ffffff"];
      for (const [bx, bz] of [[LANE.x0 + 0.12, 9.85], [LANE.x0 + 0.12, 12.6], [LANE.x1 - 0.12, 7.6], [LANE.x1 - 0.12, 11.3]]) {
        props.add(part(rbox(0.16, 0.12, 0.42, 0.02), "#8f5d3a", bx, 0.06, bz));
        for (let i = 0; i < 4; i += 1) {
          leafAt(leaves, "#4f8f3b", bx, 0.12, bz - 0.15 + i * 0.1, i * 1.7, 0.7, 0.12, 0.06, 0.3, 0.5);
          leaves.add(leafy(sphere(0.04, 7, 5), blooms[(i + Math.round(bz)) % blooms.length], bx, 0.2, bz - 0.15 + i * 0.1, 0.6));
        }
      }
    }
    if (level >= 3) {
      // Bunting over the lane, lanterns at its entrance, a round bale in the cow pen.
      for (const z of [7.05, 11.95]) {
        for (const x of [LANE.x0 + 0.06, LANE.x1 - 0.06]) props.add(part(rbox(0.06, 1.45, 0.06, 0.02), "#7a5638", x, 0.72, z));
        bunting(props, LANE.x0 + 0.06, z, LANE.x1 - 0.06, z, 1.4);
      }
      for (const x of [LANE.x0 + 0.2, LANE.x1 - 0.2]) {
        props.add(part(rbox(0.08, 1.1, 0.08, 0.02), "#4a3a2c", x, 0.55, 6.4), part(rbox(0.16, 0.18, 0.16, 0.03), "#3b3530", x, 1.15, 6.4), part(cone(0.13, 0.09, 4), "#3b3530", x, 1.28, 6.4));
        glow.add(part(box(0.11, 0.13, 0.17), "#ffcf7a", x, 1.15, 6.4), part(box(0.17, 0.13, 0.11), "#ffcf7a", x, 1.15, 6.4));
      }
      addBale(props, cow.x1 - 0.6, 0, cow.z1 - 0.6, 0.8);
      addBale(props, sheep.x0 + 0.6, 0, sheep.z1 - 0.55, -0.4);
    }

    const group = new THREE.Group();
    const mesh = bake(props);
    mesh.userData.ownsGeometry = true;
    mesh.raycast = () => {};
    const foliage = new THREE.Mesh(bakeGeometry(leaves, true, true) ?? new THREE.BufferGeometry(), foliageMaterial);
    foliage.castShadow = shadowsOn;
    foliage.receiveShadow = true;
    foliage.userData.ownsGeometry = true;
    owned.add(foliage.geometry);
    foliage.raycast = () => {};
    group.add(mesh, foliage);
    if (glow.children.length) {
      const lights = new THREE.Mesh(bakeGeometry(glow, false) ?? new THREE.BufferGeometry(), glowMaterial);
      lights.userData.ownsGeometry = true;
      owned.add(lights.geometry);
      lights.raycast = () => {};
      group.add(lights);
    }
    world.add(group);
    return { level, group };
  }

  interface IncubatorView { group: THREE.Group; key: string; icon: THREE.Sprite | null }
  let incubatorView: IncubatorView | null = null;

  /**
   * A small hatchery hut: a warm lamp, a tray of eggs behind the open front, and the hatched chicks
   * and ducklings waiting beside it. Before it is built, a plot with a sign.
   */
  function buildIncubatorView(game: GameState): IncubatorView {
    const incubator = game.ranch.incubator;
    const eggs = incubator?.eggs ?? [];
    const hatched = eggs.filter(isHatched);
    const needTurn = eggs.some(eggNeedsTurn);
    const locked = levelFromXp(game.xp) < INCUBATOR.level;
    const key = `${incubator ? "built" : locked ? "locked" : "open"}|${eggs.map((egg) => `${egg.kind}${isHatched(egg) ? "!" : ""}`).join(",")}|${needTurn}`;
    const { x, z } = FIXTURES.incubator;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = 0.15;
    const root = new THREE.Group();
    const lamp = new THREE.Group();
    let marker: THREE.Sprite | null = null;
    if (!incubator) {
      root.add(part(rbox(1.4, 0.08, 1.1, 0.03), "#b99a6b", 0, 0, 0), part(rbox(0.08, 0.7, 0.08, 0.02), "#7a5638", -0.45, 0.35, 0.42), part(rbox(0.5, 0.32, 0.06, 0.02), "#e8d3a6", -0.45, 0.66, 0.45));
      root.add(part(sphere(0.07, 10, 8), "#fff6e4", -0.45, 0.68, 0.49));
      marker = icon(locked ? "lock" : "build", 0.6);
      marker.position.set(0, 1.2, 0);
    } else {
      root.add(part(rbox(1.3, 0.85, 1.0, 0.04), "#f6ead2", 0, 0.43, 0), part(rbox(1.36, 0.1, 1.06, 0.03), "#b8a789", 0, 0.05, 0), part(gable(1.3, 1.0, 0.5), "#f6ead2", 0, 0.85, 0));
      const roof = shingleRoof(1.5, 1.15, 0.56, "#c96f4a", mulberry32(41));
      roof.position.y = 0.83;
      root.add(roof);
      // Open front with a straw-lined tray of eggs under the lamp.
      root.add(part(box(0.9, 0.42, 0.03), "#5a3b26", 0, 0.46, 0.5), part(rbox(0.84, 0.06, 0.3, 0.02), "#d9b27a", 0, 0.3, 0.42));
      for (let i = 0; i < 8; i += 1) root.add(part(sphere(0.035, 6, 5), "#e7c96a", -0.36 + i * 0.1, 0.335, 0.42 + ((i % 2) - 0.5) * 0.12));
      eggs.forEach((egg, i) => {
        if (isHatched(egg)) return;
        const shell = part(sphere(0.07, 10, 8), egg.kind === "egg" ? "#fff6e4" : "#cfe9df", -0.3 + i * 0.2, 0.39, 0.42);
        shell.scale.y = 1.25;
        root.add(shell);
      });
      lamp.add(part(sphere(0.06, 10, 8), "#ffb35c", 0, 0.62, 0.42));
      root.add(part(cylinder(0.08, 0.05, 0.08, 10), "#3b3530", 0, 0.68, 0.42));
      // A little egg sign by the door.
      root.add(part(rbox(0.26, 0.26, 0.04, 0.01), "#fbf5e8", 0.48, 0.62, 0.52), part(sphere(0.06, 10, 8), "#f2c94c", 0.48, 0.62, 0.55));
      // Hatchlings waiting beside the hut: yellow chicks and ducklings.
      hatched.forEach((egg, i) => {
        const cx = -0.95 + (i % 2) * 0.3, cz = 0.25 + Math.floor(i / 2) * 0.32;
        const color = "#f6d55c";
        const body = part(sphere(0.11, 10, 8), color, cx, 0.11, cz);
        body.scale.set(1, 0.9, egg.kind === "duckEgg" ? 1.25 : 1.05);
        root.add(body, part(sphere(0.07, 8, 6), color, cx, 0.22, cz + 0.07));
        const beak = part(cone(0.025, 0.06, 4), egg.kind === "duckEgg" ? "#f0a030" : "#f2a541", cx, 0.21, cz + 0.15);
        beak.rotation.x = Math.PI / 2;
        root.add(beak);
      });
      if (hatched.length) {
        marker = icon("star", 0.65);
        marker.position.set(0, 1.75, 0);
      } else if (needTurn) {
        marker = icon("turn", 0.65);
        marker.position.set(0, 1.75, 0);
      }
    }
    const mesh = bake(root);
    mesh.userData.ownsGeometry = true;
    mesh.raycast = () => {};
    group.add(mesh, hitBox(box(1.7, 1.8, 1.5), { kind: "incubator" }, 0.7));
    if (lamp.children.length) {
      const glow = new THREE.Mesh(bakeGeometry(lamp, false) ?? new THREE.BufferGeometry(), glowMaterial);
      glow.userData.ownsGeometry = true;
      glow.raycast = () => {};
      group.add(glow);
    }
    if (marker) group.add(marker);
    world.add(group);
    return { group, key, icon: marker };
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
        // A bunch on a stalk hanging from the crown: hands of bananas curving up, the purple bell below.
        const bunch = new THREE.Group();
        bunch.position.set(0.2 * s, top - 0.08 * s, 0);
        bunch.rotation.z = 0.25;
        const drop = 0.62 * s;
        bunch.add(part(cylinder(0.018 * s, 0.024 * s, drop, 5), "#7f8f45", 0, -drop / 2, 0));
        const length = [0, 0.14, 0.19, 0.23][ripeness] * s;
        for (let hand = 0; hand < 3; hand += 1) {
          for (let k = 0; k < 6; k += 1) {
            const arm = new THREE.Group();
            arm.position.y = -0.1 * s - hand * 0.11 * s;
            arm.rotation.y = (k / 6) * Math.PI * 2 + hand * 0.5;
            const finger = part(bananaGeometry(ripeness), "vertex", 0.02 * s, 0, 0);
            // Starts out from the stalk (along +x here) and curves up.
            finger.rotation.set(0, Math.PI, Math.PI / 2);
            finger.scale.setScalar(length * (1 - hand * 0.08));
            arm.add(finger);
            bunch.add(arm);
          }
        }
        const bell = part(sphere(0.06 * s, 8, 6), "#7a2f4f", 0, -drop - 0.04 * s, 0);
        bell.scale.set(0.8, 1.5, 0.8);
        bunch.add(bell);
        root.add(bunch);
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
      if (ripeness > 0) {
        for (let i = 0; i < 5; i += 1) {
          const nut = treeFruit("coconut", ripeness, fruitSize, random);
          nut.position.set(x + Math.cos(i * 1.3) * 0.12 * s, y - 0.02 * s - (i % 2) * 0.06 * s, Math.sin(i * 1.3) * 0.12 * s);
          root.add(nut);
        }
      }
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
      // Fruit hang on short stalks from the outside of the crown (mangoes on long ones), mostly
      // around its middle and lower half, where they show.
      const count = fruit === "lemon" ? 8 : fruit === "orange" ? 9 : 7;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + random() * 0.6;
        const lift = -0.45 + random() * 0.75;
        const reach = crown * 1.0 + fruitSize * 0.3;
        const node = treeFruit(fruit, ripeness, fruitSize * 1.25, random);
        node.position.set(Math.cos(angle) * Math.cos(lift) * reach, middle + Math.sin(lift) * reach + fruitSize, Math.sin(angle) * Math.cos(lift) * reach);
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

  /* ───────────── people: a farmer who works with the player, two helpers ───────────── */
  // Each person is one skinned mesh: the body parts are baked per joint and bound to a bone
  // (hips, waist, neck, shoulders, hips), so a pose is a few bone turns and one draw call.
  interface Look { shirt: string; trousers: string; skin: string; hair: string; hat: "conical" | "brim"; hatColor: string; band?: string }
  const FARMER_LOOK: Look = { shirt: "#3d6fa8", trousers: "#33405a", skin: "#e8c39e", hair: "#2b2320", hat: "conical", hatColor: "#e6d39c" };
  const HELPER_LOOKS: Look[] = [
    { shirt: "#a8553f", trousers: "#2f2f35", skin: "#e3b892", hair: "#1f1a18", hat: "conical", hatColor: "#efe2b8", band: "#c75b6e" },
    { shirt: "#e6dfca", trousers: "#5b6c48", skin: "#d6a27a", hair: "#3a2a20", hat: "brim", hatColor: "#c9a35f", band: "#6b4a2b" },
  ];
  interface Body {
    mesh: THREE.SkinnedMesh;
    hips: THREE.Bone;
    spine: THREE.Bone;
    head: THREE.Bone;
    armL: THREE.Bone;
    armR: THREE.Bone;
    legL: THREE.Bone;
    legR: THREE.Bone;
    handR: THREE.Object3D;
    tools: Map<Tool, THREE.Object3D>;
    tool: Tool;
  }

  /** A tool in the hand's frame (the arm hanging: −y down along it, +z forward). */
  const toolGeometries = new Map<Tool, THREE.BufferGeometry>();
  function toolGeometry(tool: Tool): THREE.BufferGeometry {
    let geometry = toolGeometries.get(tool);
    if (geometry) return geometry;
    const root = new THREE.Group();
    const wood = "#8f6a44";
    if (tool === "hoe") {
      root.add(part(cylinder(0.013, 0.015, 0.58, 6), wood, 0, -0.21, 0));
      root.add(part(rbox(0.12, 0.022, 0.1, 0.008), "#9aa3a8", 0, -0.5, 0.05));
    } else if (tool === "can") {
      root.add(part(cylinder(0.065, 0.072, 0.12, 12), "#4f9a8f", 0, -0.1, 0.03));
      root.add(part(rbox(0.025, 0.05, 0.1, 0.01), "#3f7f75", 0, -0.025, 0.03));
      root.add(turn(part(cylinder(0.011, 0.017, 0.17, 6), "#4f9a8f", 0, -0.08, 0.15), -1.0, 0, 0));
      root.add(turn(part(cylinder(0.032, 0.02, 0.025, 8), "#3f7f75", 0, -0.03, 0.22), -1.0, 0, 0));
    } else if (tool === "pouch") {
      const bag = part(sphere(0.055, 10, 8), "#d9c39a", 0, -0.06, 0.02);
      bag.scale.set(1, 0.9, 0.85);
      root.add(bag, part(cylinder(0.018, 0.022, 0.03, 8), "#b8a27a", 0, -0.01, 0.02));
    } else if (tool === "basket") {
      root.add(part(cylinder(0.12, 0.09, 0.11, 12), "#b5874f", 0.13, -0.08, 0.08), part(cylinder(0.126, 0.126, 0.02, 12), "#9c6f3c", 0.13, -0.025, 0.08));
      for (const [x, z, c] of [[0.1, 0.05, "#e2533d"], [0.16, 0.1, "#7fc35a"], [0.12, 0.12, "#f2c94c"]] as const) root.add(part(sphere(0.038, 8, 6), c, x, -0.02, z));
    } else if (tool === "net") {
      root.add(part(cylinder(0.011, 0.012, 0.72, 6), wood, 0, -0.26, 0));
      const ring = part(cylinder(0.12, 0.12, 0.012, 14), "#3b3b3b", 0, -0.66, 0.08);
      ring.rotation.x = Math.PI / 2;
      const mesh = part(sphere(0.11, 10, 6), "#d8d8cf", 0, -0.66, 0.11);
      mesh.scale.set(1, 1, 0.45);
      root.add(ring, mesh);
    } else if (tool === "sack") {
      root.add(part(rbox(0.2, 0.24, 0.15, 0.06), "#cdb88a", 0.13, -0.12, 0.1), part(cylinder(0.03, 0.045, 0.05, 8), "#a8925f", 0.13, 0.02, 0.1));
    } else if (tool === "bucket") {
      root.add(part(cylinder(0.078, 0.062, 0.13, 12), "#8aa3b3", 0.13, -0.1, 0.09), part(cylinder(0.07, 0.07, 0.01, 12), "#7cc6f0", 0.13, -0.045, 0.09));
      root.add(part(rbox(0.16, 0.012, 0.012, 0.004), "#5a6b75", 0.13, -0.01, 0.09));
    }
    geometry = bakeGeometry(root, false) ?? new THREE.BufferGeometry();
    toolGeometries.set(tool, geometry);
    return geometry;
  }
  /** Tools carried on the shoulder or in front while walking, and the angle they are held at. */
  const CARRY: Partial<Record<Tool, { tool: number; arm: number }>> = { hoe: { tool: 2.45, arm: 0.55 }, net: { tool: 2.2, arm: 0.6 }, can: { tool: 0, arm: 0.25 } };

  function buildBody(look: Look): Body {
    const size = BODY_SIZE;
    const groups = Array.from({ length: 8 }, () => new THREE.Group());
    const [, hipsGroup, spineGroup, headGroup, armLGroup, armRGroup, legLGroup, legRGroup] = groups;
    const waist = size.hip + size.waist;
    const neck = waist + size.neck;
    const shoulder = waist + size.shoulder;
    for (const [group, side] of [[legLGroup, 1], [legRGroup, -1]] as const) {
      const x = side * size.legApart;
      group.add(part(cylinder(0.05, 0.042, size.leg - 0.04, 7), look.trousers, x, size.hip - (size.leg - 0.04) / 2, 0));
      group.add(part(sphere(0.031, 7, 5), look.skin, x, 0.055, 0));
      group.add(part(rbox(0.07, 0.04, 0.12, 0.015), "#4a3a2c", x, 0.02, 0.022));
    }
    hipsGroup.add(part(rbox(0.19, 0.1, 0.125, 0.04), look.trousers, 0, size.hip + 0.015, 0));
    spineGroup.add(part(rbox(0.21, 0.24, 0.14, 0.055), look.shirt, 0, waist + 0.125, 0));
    spineGroup.add(part(cylinder(0.034, 0.04, 0.05, 8), look.skin, 0, neck - 0.015, 0));
    if (look.band) spineGroup.add(part(rbox(0.214, 0.032, 0.144, 0.012), look.band, 0, waist + 0.035, 0));
    const headY = neck + size.head * 0.95;
    headGroup.add(part(sphere(size.head, 14, 10), look.skin, 0, headY, 0));
    const hair = part(sphere(size.head * 1.03, 14, 10), look.hair, 0, headY + 0.014, -0.02);
    hair.scale.set(1, 0.93, 0.93);
    headGroup.add(hair);
    for (const side of [-1, 1]) headGroup.add(part(sphere(0.013, 6, 5), "#1d1a18", side * 0.034, headY + 0.004, size.head * 0.92));
    headGroup.add(part(sphere(0.015, 6, 5), tint(look.skin, -0.06), 0, headY - 0.025, size.head * 0.97));
    if (look.hat === "conical") {
      headGroup.add(part(cone(0.19, 0.11, 18), look.hatColor, 0, headY + 0.095, 0));
      if (look.band) headGroup.add(part(cylinder(0.006, 0.006, 0.17, 4), look.band, size.head * 0.9, headY - 0.02, 0));
    } else {
      headGroup.add(part(cylinder(0.165, 0.165, 0.018, 18), look.hatColor, 0, headY + 0.07, 0));
      headGroup.add(part(cylinder(0.105, 0.115, 0.085, 14), look.hatColor, 0, headY + 0.115, 0));
      if (look.band) headGroup.add(part(cylinder(0.117, 0.117, 0.022, 14), look.band, 0, headY + 0.088, 0));
    }
    for (const [group, side] of [[armLGroup, 1], [armRGroup, -1]] as const) {
      const x = side * size.shoulderApart;
      group.add(part(sphere(0.046, 8, 6), look.shirt, x, shoulder, 0));
      group.add(part(cylinder(0.037, 0.031, size.arm - 0.04, 7), look.shirt, x, shoulder - (size.arm - 0.04) / 2, 0));
      group.add(part(sphere(0.032, 8, 6), look.skin, x, shoulder - size.arm + 0.012, 0));
    }
    // Bake each joint's parts in place and bind them to that joint's bone.
    const pieces: THREE.BufferGeometry[] = [];
    groups.forEach((group, index) => {
      const geometry = bakeGeometry(group, false);
      if (!geometry) return;
      owned.delete(geometry);
      const count = geometry.attributes.position.count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) {
        indices[i * 4] = index;
        weights[i * 4] = 1;
      }
      geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
      pieces.push(geometry);
    });
    const geometry = mergeGeometries(pieces, false) ?? new THREE.BufferGeometry();
    pieces.forEach((piece) => piece.dispose());
    owned.add(geometry);
    const root = new THREE.Bone();
    const hips = new THREE.Bone(), spine = new THREE.Bone(), head = new THREE.Bone();
    const armL = new THREE.Bone(), armR = new THREE.Bone(), legL = new THREE.Bone(), legR = new THREE.Bone();
    hips.position.set(0, size.hip, 0);
    spine.position.set(0, size.waist, 0);
    head.position.set(0, size.neck, 0);
    armL.position.set(size.shoulderApart, size.shoulder, 0);
    armR.position.set(-size.shoulderApart, size.shoulder, 0);
    legL.position.set(size.legApart, 0, 0);
    legR.position.set(-size.legApart, 0, 0);
    root.add(hips);
    hips.add(spine, legL, legR);
    spine.add(head, armL, armR);
    const mesh = new THREE.SkinnedMesh(geometry, surface);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([root, hips, spine, head, armL, armR, legL, legR]));
    mesh.castShadow = shadowsOn;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    // Tools hang from the hands; one shows at a time.
    const handR = new THREE.Object3D();
    handR.position.set(0, -size.arm + 0.012, 0);
    armR.add(handR);
    const handL = new THREE.Object3D();
    handL.position.set(0, -size.arm + 0.012, 0);
    armL.add(handL);
    const tools = new Map<Tool, THREE.Object3D>();
    for (const tool of ["hoe", "can", "pouch", "basket", "net", "sack", "bucket"] as Tool[]) {
      const pivot = new THREE.Group();
      const item = new THREE.Mesh(toolGeometry(tool), surface);
      item.castShadow = shadowsOn;
      item.raycast = () => {};
      pivot.add(item);
      pivot.visible = false;
      (tool === "pouch" ? handL : handR).add(pivot);
      tools.set(tool, pivot);
    }
    world.add(mesh);
    return { mesh, hips, spine, head, armL, armR, legL, legR, handR, tools, tool: "none" };
  }

  function applyPose(body: Body, pose: Pose) {
    body.hips.position.y = BODY_SIZE.hip + pose.lift;
    body.spine.rotation.set(pose.lean, pose.twist, 0);
    body.head.rotation.set(pose.nod, pose.turn, 0);
    body.armL.rotation.set(-pose.armL[0], 0, pose.armL[1]);
    body.armR.rotation.set(-pose.armR[0], 0, -pose.armR[1]);
    body.legL.rotation.x = -pose.legL;
    body.legR.rotation.x = -pose.legR;
    const tool = body.tools.get(body.tool);
    if (tool) tool.rotation.x = pose.tool;
  }

  function holdTool(body: Body, tool: Tool) {
    if (body.tool === tool) return;
    body.tools.forEach((item, name) => (item.visible = name === tool));
    body.tool = tool;
  }

  type Activity =
    | { kind: "none" }
    | { kind: "chore"; chore: Chore; target: Point; t: number; seconds: number; fired: number }
    | { kind: "idle"; idle: Idle | "weed" | "harvest"; t: number; seconds: number }
    | { kind: "fish" };

  interface Walker {
    body: Body;
    x: number;
    z: number;
    facing: number;
    /** The direction to turn to once stopped. */
    face: number | null;
    path: Point[];
    arrive: (() => void) | null;
    hurry: number;
    phase: number;
    activity: Activity;
    pose: Pose;
    from: Pose;
    ease: number;
    mode: string;
  }

  function makeWalker(look: Look, x: number, z: number): Walker {
    const body = buildBody(look);
    return { body, x, z, facing: 0.6, face: null, path: [], arrive: null, hurry: 0, phase: 0, activity: { kind: "none" }, pose: REST, from: REST, ease: 0, mode: "stand" };
  }

  /** Walks a person to `to` (in `place`) by the paths, then calls `arrive`. */
  function walkTo(walker: Walker, to: Point, place: Place, hurry: number, arrive: (() => void) | null = null) {
    walker.path = route([walker.x, walker.z], "any", to, place, ranchLevel);
    walker.hurry = hurry;
    walker.arrive = arrive;
    walker.face = null;
    walker.activity = { kind: "none" };
  }

  // The jetty's top: people step up onto it to fish.
  const jettyInverse = new THREE.Matrix4();
  const jettyLocal = new THREE.Vector3();
  function groundHeight(x: number, z: number): number {
    jettyLocal.set(x, 0, z).applyMatrix4(jettyInverse);
    return jettyLocal.x > -RIVER_HALF - 0.32 && Math.abs(jettyLocal.z) < 0.46 ? 0.23 : 0;
  }

  const turnTo = (from: number, to: number, step: number) => {
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + Math.max(-step, Math.min(step, delta));
  };

  /** Moves a person along their path, then plays their activity; eases between the two. */
  function stepWalker(walker: Walker, dt: number, elapsed: number, motion: number, activityPose: () => Pose | null) {
    let target: Pose;
    let mode: string;
    if (walker.path.length) {
      const [tx, tz] = walker.path[0];
      const dx = tx - walker.x, dz = tz - walker.z;
      const distance = Math.hypot(dx, dz);
      const speed = SPEED.walk + (SPEED.hurry - SPEED.walk) * walker.hurry;
      const step = Math.min(distance, speed * dt);
      if (distance > 1e-4) {
        walker.x += (dx / distance) * step;
        walker.z += (dz / distance) * step;
        walker.facing = turnTo(walker.facing, Math.atan2(dx, dz), dt * 9);
      }
      walker.phase += phaseFor(step, STRIDE.walk + (STRIDE.hurry - STRIDE.walk) * walker.hurry);
      if (distance - step < 1e-3) {
        walker.path.shift();
        if (!walker.path.length && walker.arrive) {
          const arrive = walker.arrive;
          walker.arrive = null;
          arrive();
        }
      }
      const carry = CARRY[walker.body.tool];
      target = walkPose(walker.phase, walker.hurry, TWO_HANDED.includes(walker.body.tool), motion);
      if (carry) target = { ...target, tool: carry.tool, armR: [carry.arm, 0.12] };
      mode = "walk";
    } else {
      if (walker.face !== null) walker.facing = turnTo(walker.facing, walker.face, dt * 7);
      target = activityPose() ?? standPose(elapsed, motion);
      mode = walker.activity.kind === "chore" ? `chore${walker.activity.chore.kind}` : walker.activity.kind;
    }
    if (mode !== walker.mode) {
      walker.from = walker.pose;
      walker.ease = mode === "fish" ? 0.35 : 0.2;
      walker.mode = mode;
    }
    const length = walker.mode === "fish" ? 0.35 : 0.2;
    walker.pose = walker.ease > 0 ? mixPose(walker.from, target, 1 - Math.pow(walker.ease / length, 2)) : target;
    walker.ease = Math.max(0, walker.ease - dt);
    applyPose(walker.body, walker.pose);
    walker.body.mesh.position.set(walker.x, groundHeight(walker.x, walker.z), walker.z);
    walker.body.mesh.rotation.y = walker.facing;
  }

  /* The farmer: in the area being viewed, doing what the player does there. */
  const firstSpot = IDLE_SPOTS.farm[0].at;
  const farmer = makeWalker(FARMER_LOOK, firstSpot[0], firstSpot[1]);
  const farmerChores: Chore[] = [];
  const MAX_QUEUED = 5;
  /** Between areas the farmer jogs (a little past a hurry). */
  const TRAVEL_HURRY = 1.3;
  let farmerSeated = false;
  let travelling = false;
  /** Why the farmer is walking: to a chore, between areas, or pottering about. */
  let farmerWalk: "chore" | "travel" | "idle" = "idle";
  let farmerRest = 4;
  let farmerSpot = 0;
  let skipCheck = 0;
  const seatAt = new THREE.Vector3();
  const seatFacing = Math.atan2(jettyAcross.x, jettyAcross.z);

  /** Where to stand for a chore. */
  function standFor(chore: Chore): { at: Point; place: Place; facing: number; target: Point } {
    if (chore.plot !== undefined) return { ...plotStand(chore.plot), target: plotPosition(chore.plot) };
    if (chore.spot !== undefined) return { ...treeStand(chore.spot), target: spotPosition(chore.spot) };
    if (chore.pond) return { ...pondStand(chore.pond[0], chore.pond[1]), target: pondPoint(chore.pond[0] * 0.7, chore.pond[1] * 0.7) };
    if (chore.drop) {
      const [x, z] = dropPoint(chore.drop);
      return { ...dropStand(PEN_OF_PRODUCT[chore.drop.product], x, z, ranchLevel), target: [x, z] };
    }
    if (chore.kind === "pour" && chore.species) {
      const pen = PEN_OF[chore.species];
      const trough = FIXTURES[TROUGH_OF[pen]];
      return { ...troughStand(pen), target: [trough.x, trough.z] };
    }
    if (chore.kind === "newAnimal" && chore.species) {
      const [outside, inside, z] = PEN_GATES[PEN_OF[chore.species]];
      return { at: [outside, z], place: "ranch", facing: Math.atan2(inside - outside, 0), target: [inside, z] };
    }
    if (chore.kind === "stackFeed") {
      const store = FIXTURES.feedStore;
      return { at: [store.x + store.hx + 0.16, store.z], place: "ranch", facing: -Math.PI / 2, target: [store.x, store.z] };
    }
    const stand = incubatorStand();
    return { ...stand, target: [FIXTURES.incubator.x, FIXTURES.incubator.z] };
  }

  /** A little of the chore's effect, when the farmer does it (the result itself showed at once). */
  const CHORE_PUFFS: Partial<Record<Chore["kind"], [Burst, number][]>> = {
    hoe: [["dirt", 0.36], ["dirt", 0.72]], dig: [["dirt", 0.36], ["dirt", 0.72]], fellTree: [["chips", 0.36], ["chips", 0.72]],
    sow: [["seed", 0.35], ["seed", 0.7]], fertilize: [["spark", 0.35], ["spark", 0.7]], feedFish: [["seed", 0.35], ["seed", 0.7]],
    water: [["water", 0.5], ["water", 0.7]], waterTree: [["water", 0.5], ["water", 0.7]],
    weed: [["leaf", 0.5]], shake: [["leaf", 0.4]], skim: [["splash", 0.55]], netFish: [["splash", 0.55]],
    stockFish: [["splash", 0.6]], pour: [["seed", 0.6]],
  };

  function startChore(chore: Chore) {
    const stand = standFor(chore);
    holdTool(farmer.body, CHORE_ACTS[chore.kind].tool);
    farmerWalk = "chore";
    walkTo(farmer, stand.at, stand.place, farmerChores.length ? 1 : 0.35, () => {
      farmer.face = stand.facing;
      farmer.activity = { kind: "chore", chore, target: stand.target, t: 0, seconds: CHORE_ACTS[chore.kind].seconds, fired: 0 };
    });
  }

  function seatFarmer() {
    farmer.x = seatAt.x;
    farmer.z = seatAt.z;
    farmer.facing = seatFacing;
    farmer.face = seatFacing;
    farmer.path = [];
    farmer.arrive = null;
    farmer.activity = { kind: "fish" };
    holdTool(farmer.body, "none");
    farmerSeated = true;
    travelling = false;
  }

  /** The farmer heads for an area: off the jetty first if he was fishing, then by the paths. */
  function farmerGo(view: FarmView, instant: boolean) {
    farmerChores.length = 0;
    holdTool(farmer.body, "none");
    if (view === "river") {
      if (instant) {
        seatFarmer();
        return;
      }
      if (farmerSeated) return;
      travelling = true;
      farmerWalk = "travel";
      walkTo(farmer, JETTY_FOOT, "river", TRAVEL_HURRY, () => {
        travelling = false;
        farmer.path = [[seatAt.x, seatAt.z]];
        farmer.hurry = 0.2;
        farmer.arrive = seatFarmer;
      });
      return;
    }
    farmerSeated = false;
    const spots = IDLE_SPOTS[view];
    farmerSpot = 0;
    const [x, z] = spots[0].at;
    if (instant) {
      farmer.x = x;
      farmer.z = z;
      farmer.path = [];
      farmer.activity = { kind: "none" };
      travelling = false;
      return;
    }
    // Off the jetty (it stands over the water) to its foot first, then on to the area.
    const onJetty = groundHeight(farmer.x, farmer.z) > 0;
    travelling = true;
    farmerWalk = "travel";
    farmer.activity = { kind: "none" };
    farmer.face = null;
    farmer.hurry = TRAVEL_HURRY;
    farmer.path = [...(onJetty ? [JETTY_FOOT] : []), ...route(onJetty ? JETTY_FOOT : [farmer.x, farmer.z], "any", [x, z], spots[0].place, ranchLevel)];
    farmer.arrive = () => {
      travelling = false;
      farmerRest = 2 + Math.random() * 3;
    };
  }

  /** Whether a ground point shows on screen. */
  const screenPoint = new THREE.Vector3();
  function onScreen(x: number, z: number, margin = 0.08): boolean {
    screenPoint.set(x, 0.45, z).project(camera);
    return Math.abs(screenPoint.x) < 1 + margin && Math.abs(screenPoint.y) < 1 + margin;
  }

  /** Whether a ground point will show once the camera has settled on the area being opened. */
  const goalCentre = new THREE.Vector3();
  function onGoalScreen(x: number, z: number, margin = 0.1): boolean {
    lookAt(goalCentre);
    const dx = (x - goalCentre.x) * SCREEN_RIGHT.x + (z - goalCentre.z) * SCREEN_RIGHT.z;
    const dy = ((x - goalCentre.x) * SCREEN_UP.x + (z - goalCentre.z) * SCREEN_UP.z) * UP_SCALE;
    const height = desiredHeight();
    return Math.abs(dx) < ((height * aspect) / 2) * (1 + margin) && Math.abs(dy) < (height / 2) * (1 + margin);
  }

  /**
   * A long walk between areas: once the farmer is off screen, he skips ahead to the last point
   * of his route that is off screen both now and where the camera is heading (at least a few
   * steps from the end), so he walks back into view from the right side without the player waiting.
   */
  function skipAhead() {
    if (!travelling || !farmer.path.length || onScreen(farmer.x, farmer.z)) return;
    let last: Point = [farmer.x, farmer.z];
    let remaining = routeLength(last, farmer.path);
    let best: { at: Point; index: number } | null = null;
    for (let i = 0; i < farmer.path.length; i += 1) {
      const next = farmer.path[i];
      const length = Math.hypot(next[0] - last[0], next[1] - last[1]);
      for (let d = 0; d < length; d += 0.3) {
        const k = d / length;
        const at: Point = [last[0] + (next[0] - last[0]) * k, last[1] + (next[1] - last[1]) * k];
        if (remaining - d < 2.4) break;
        if (!onScreen(at[0], at[1], 0.15) && !onGoalScreen(at[0], at[1])) best = { at, index: i };
      }
      remaining -= length;
      last = next;
    }
    if (!best) return;
    farmer.x = best.at[0];
    farmer.z = best.at[1];
    farmer.path.splice(0, best.index);
  }

  function farmerActivityPose(elapsed: number, motion: number): Pose | null {
    const activity = farmer.activity;
    if (activity.kind === "fish") {
      const link = options.fishing;
      return link ? fishingPose(link.state.current, elapsed, isNibbling(link.state.current), motion) : SITTING;
    }
    if (activity.kind === "chore") return chorePose(activity.chore.kind, activity.t / activity.seconds);
    if (activity.kind === "idle") return activity.idle === "weed" || activity.idle === "harvest" ? chorePose(activity.idle, activity.t / activity.seconds) : idlePose(activity.idle, activity.t / activity.seconds);
    return null;
  }

  function stepFarmer(dt: number, elapsed: number, motion: number) {
    const fishing = options.fishing?.state.current;
    if (viewName === "river" && fishing && fishing.phase !== "ready" && !farmerSeated) seatFarmer();
    const activity = farmer.activity;
    const onChore = activity.kind === "chore" || (farmerWalk === "chore" && farmer.path.length > 0);
    if (!travelling && viewName !== "river" && !onChore && farmerChores.length) {
      // Something to do: drop any pottering about and go.
      startChore(farmerChores.shift() as Chore);
    } else if (activity.kind === "chore") {
      activity.t += dt;
      const puffs = CHORE_PUFFS[activity.chore.kind] ?? [];
      while (activity.fired < puffs.length && activity.t / activity.seconds >= puffs[activity.fired][1]) {
        const [kind] = puffs[activity.fired];
        const [x, z] = activity.target;
        burst(kind, x, kind === "water" ? 0.55 : 0.3, z, kind === "water" ? 8 : 5);
        activity.fired += 1;
      }
      if (activity.t >= activity.seconds) {
        farmer.activity = { kind: "none" };
        farmerRest = 1.5 + Math.random() * 2;
        if (!farmerChores.length) holdTool(farmer.body, "none");
      }
    } else if (activity.kind === "idle") {
      activity.t += dt;
      if (activity.t >= activity.seconds) farmer.activity = { kind: "none" };
    } else if (activity.kind === "none" && !farmer.path.length && !travelling && viewName !== "river") {
      if ((farmerRest -= dt) <= 0) {
        // Nothing to do: potter about the area.
        const spots = IDLE_SPOTS[viewName as Exclude<FarmView, "river">];
        if (Math.random() < 0.45 && spots.length > 1) {
          farmerSpot = (farmerSpot + 1 + Math.floor(Math.random() * (spots.length - 1))) % spots.length;
          farmerWalk = "idle";
          walkTo(farmer, spots[farmerSpot].at, spots[farmerSpot].place, 0);
        } else if (motion) {
          const choices: Idle[] = viewName === "farm" || viewName === "orchard" ? ["tend", "look", "stretch", "wipe"] : ["look", "stretch", "wipe"];
          const idle = choices[Math.floor(Math.random() * choices.length)];
          farmer.activity = { kind: "idle", idle, t: 0, seconds: IDLE_SECONDS[idle] };
        }
        farmerRest = (motion ? 4 : 9) + Math.random() * 5;
      }
    }
    if ((skipCheck -= dt) <= 0) {
      skipCheck = 0.2;
      skipAhead();
    }
    stepWalker(farmer, dt, elapsed, motion, () => farmerActivityPose(elapsed, motion));
  }

  /* Two helpers: out of the house in the morning to the fields and the orchard, home at dusk. */
  const HELPER_HOURS: [number, number][] = [[6.2, 18.3], [6.7, 17.8]];
  const helpers = HELPER_LOOKS.map((look) => ({ walker: makeWalker(look, HOME[0], HOME[1]), state: "home" as "home" | "out" | "leaving", rest: 0 }));
  helpers.forEach((helper) => (helper.walker.body.mesh.visible = false));
  let helpersPlaced = false;

  /** Whether the farmer is (or is heading) within `distance` of a person. */
  function farmerNear(walker: Walker, distance: number): boolean {
    const goal = farmer.path[farmer.path.length - 1] ?? [farmer.x, farmer.z];
    return Math.hypot(goal[0] - walker.x, goal[1] - walker.z) < distance || Math.hypot(farmer.x - walker.x, farmer.z - walker.z) < distance * 0.7;
  }

  /** Somewhere for a helper to work: the first one in the fields, the second mostly in the orchard. */
  function helperSpot(index: number): { at: Point; place: Place; facing: number } {
    const game = latest;
    const plots = game ? game.plots.map((plot, i) => (plot.status === "locked" ? -1 : i)).filter((i) => i >= 0) : [0, 1, 2, 3];
    const spots = game ? game.orchard.spots.map((spot, i) => (spot.status === "locked" ? -1 : i)).filter((i) => i >= 0) : [0, 1, 2];
    const goal = farmer.path[farmer.path.length - 1] ?? [farmer.x, farmer.z];
    const busy = (at: Point) => Math.hypot(at[0] - farmer.x, at[1] - farmer.z) < 1 || Math.hypot(at[0] - goal[0], at[1] - goal[1]) < 1 || helpers.some((other, i) => i !== index && other.state === "out" && Math.hypot(at[0] - other.walker.x, at[1] - other.walker.z) < 1);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const inOrchard = index === 1 ? Math.random() < 0.75 && spots.length > 0 : false;
      const stand = inOrchard ? treeStand(spots[Math.floor(Math.random() * spots.length)]) : plotStand(plots[Math.floor(Math.random() * plots.length)] ?? 0);
      if (!busy(stand.at)) return stand;
    }
    return plotStand(plots[0] ?? 0);
  }

  function stepHelpers(dt: number, elapsed: number, motion: number, hour: number) {
    helpers.forEach((helper, index) => {
      const walker = helper.walker;
      const [start, end] = HELPER_HOURS[index];
      const working = hour >= start && hour < end;
      if (working && helper.state === "home") {
        helper.state = "out";
        walker.body.mesh.visible = true;
        holdTool(walker.body, index === 0 ? "hoe" : "basket");
        const spot = helperSpot(index);
        if (!helpersPlaced) {
          // The farm opened in the middle of the day: they are already at work.
          walker.x = spot.at[0];
          walker.z = spot.at[1];
          walker.face = spot.facing;
          walker.facing = spot.facing;
        } else {
          walker.x = HOME[0];
          walker.z = HOME[1];
          walkTo(walker, spot.at, spot.place, 0, () => (walker.face = spot.facing));
        }
        helper.rest = 1 + Math.random() * 2;
      } else if (!working && helper.state === "out") {
        helper.state = "leaving";
        walkTo(walker, HOME, "house", 0, () => {
          helper.state = "home";
          walker.body.mesh.visible = false;
        });
      } else if (helper.state === "out" && !walker.path.length && farmerNear(walker, 0.9) && (helper.rest -= dt) <= 0) {
        // Make room where the farmer comes to work (or, with nowhere else free, wait a moment).
        const spot = helperSpot(index);
        if (Math.hypot(spot.at[0] - walker.x, spot.at[1] - walker.z) > 0.5) walkTo(walker, spot.at, spot.place, 0.3, () => (walker.face = spot.facing));
        helper.rest = 1.5;
      } else if (helper.state === "out" && !walker.path.length) {
        const activity = walker.activity;
        if (activity.kind === "idle") {
          activity.t += dt;
          if (activity.t >= activity.seconds) walker.activity = { kind: "none" };
        } else if ((helper.rest -= dt) <= 0) {
          if (Math.random() < 0.35) {
            const spot = helperSpot(index);
            walkTo(walker, spot.at, spot.place, 0, () => (walker.face = spot.facing));
          } else if (motion) {
            const work = index === 0 ? (["weed", "weed", "wipe", "look"] as const) : (["harvest", "look", "stretch", "harvest"] as const);
            const idle = work[Math.floor(Math.random() * work.length)];
            walker.activity = { kind: "idle", idle, t: 0, seconds: idle === "weed" || idle === "harvest" ? 1.6 : IDLE_SECONDS[idle] };
          }
          helper.rest = (motion ? 2.5 : 8) + Math.random() * 3;
        }
      }
      if (!walker.body.mesh.visible) return;
      stepWalker(walker, dt, elapsed, motion, () => {
        const activity = walker.activity;
        if (activity.kind !== "idle") return null;
        return activity.idle === "weed" || activity.idle === "harvest" ? chorePose(activity.idle, activity.t / activity.seconds) : idlePose(activity.idle, activity.t / activity.seconds);
      });
    });
    helpersPlaced = true;
  }

  function stepPeople(dt: number, elapsed: number, motion: number, hour: number) {
    stepFarmer(dt, elapsed, motion);
    // The helpers keep the farm's own hours: wait until its clock is known.
    if (latest) stepHelpers(dt, elapsed, motion, hour);
  }

  /** New chores from the player: the farmer queues the ones in his area (the newest few). */
  function giveChores(chores: Chore[]) {
    for (const chore of chores) if (chore.view === viewName) farmerChores.push(chore);
    while (farmerChores.length > MAX_QUEUED) farmerChores.shift();
  }

  /* ───────────── fishing: the farmer's rod, line, float, the fish on the hook, the basket ───────────── */
  jettyRoot.updateMatrixWorld(true);
  jettyInverse.copy(jettyRoot.matrixWorld).invert();
  jettyRoot.localToWorld(seatAt.set(-0.1, 0, 0));
  seatAt.y = 0;
  const ROD_LENGTH = 1.7;
  const ROD_ANGLE = 0.85;
  const rodPivot = new THREE.Group();
  const rodTurn = new THREE.Group();
  rodTurn.add(rodPivot);
  // The rod bends: its vertices are moved along a curve each frame from their straight positions.
  const rodGeometry = new THREE.CylinderGeometry(0.011, 0.022, ROD_LENGTH, 5, 12);
  rodGeometry.rotateZ(-Math.PI / 2);
  rodGeometry.translate(ROD_LENGTH / 2, 0, 0);
  {
    const positions = rodGeometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const shaft = new THREE.Color("#6b4a2b"), grip = new THREE.Color("#3b3b3b"), tip = new THREE.Color("#c9452f");
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const color = x < 0.4 ? grip : x > ROD_LENGTH - 0.06 ? tip : shaft;
      colors.set([color.r, color.g, color.b], i * 3);
    }
    rodGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  owned.add(rodGeometry);
  const rodRest = Float32Array.from(rodGeometry.attributes.position.array as Float32Array);
  const rod = new THREE.Mesh(rodGeometry, surface);
  rod.castShadow = shadowsOn;
  rod.raycast = () => {};
  rod.frustumCulled = false;
  rodPivot.add(rod);
  const reelRoot = new THREE.Group();
  reelRoot.add(turn(part(cylinder(0.035, 0.035, 0.05, 10), "#3b3b3b", 0.25, -0.04, 0), Math.PI / 2, 0, 0));
  const reel = bake(reelRoot, false, false);
  reel.userData.ownsGeometry = true;
  reel.raycast = () => {};
  rodPivot.add(reel);
  world.add(rodTurn);
  const ROD_SAMPLES = 12;
  const rodCurve = Array.from({ length: ROD_SAMPLES + 1 }, () => ({ x: 0, y: 0, a: 0 }));
  const rodTipLocal = new THREE.Vector3(ROD_LENGTH, 0, 0);
  let rodBent = -1;
  /** Curves the rod down toward its tip: the bend grows with the square of the distance along it. */
  function bendRod(amount: number) {
    if (Math.abs(amount - rodBent) < 0.004) return;
    rodBent = amount;
    let x = 0, y = 0;
    const ds = ROD_LENGTH / ROD_SAMPLES;
    for (let i = 0; i <= ROD_SAMPLES; i += 1) {
      const s = i / ROD_SAMPLES;
      rodCurve[i].x = x;
      rodCurve[i].y = y;
      rodCurve[i].a = -amount * s * s;
      const mid = -amount * Math.pow((i + 0.5) / ROD_SAMPLES, 2);
      x += Math.cos(mid) * ds;
      y += Math.sin(mid) * ds;
    }
    const positions = rodGeometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i += 1) {
      const rx = rodRest[i * 3], ry = rodRest[i * 3 + 1], rz = rodRest[i * 3 + 2];
      const f = Math.min(ROD_SAMPLES - 1e-6, Math.max(0, (rx / ROD_LENGTH) * ROD_SAMPLES));
      const k = Math.floor(f), u = f - k;
      const p0 = rodCurve[k], p1 = rodCurve[k + 1];
      const angle = p0.a + (p1.a - p0.a) * u;
      positions.setXYZ(i, p0.x + (p1.x - p0.x) * u - Math.sin(angle) * ry, p0.y + (p1.y - p0.y) * u + Math.cos(angle) * ry, rz);
    }
    positions.needsUpdate = true;
    rodTipLocal.set(rodCurve[ROD_SAMPLES].x, rodCurve[ROD_SAMPLES].y, 0);
  }
  bendRod(0);
  const rodTip = new THREE.Vector3();
  const hands = new THREE.Vector3();
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

  /**
   * The river's catches, facing +x: each fish built like the pond fish (a tapered body shaded dark
   * above and pale below, with its markings, fins, eyes and barbels), a river prawn with its long
   * blue claws, and an old rubber boot.
   */
  const WILD_SHAPES: Record<Exclude<WildCatch, "boot" | "prawn">, { length: number; height: number; width: number; back: string; pattern: "blotch" | "bars" | "spots" | "chain" | "plain"; peak: number; fill: number; tail: [number, number][]; dorsal: [number, number][]; anal: [number, number][]; barbels: number }> = {
    goby: { length: 0.3, height: 0.2, width: 0.62, back: "#6e5a40", pattern: "blotch", peak: 0.55, fill: 0.7, tail: [[0, 0.06], [-0.2, 0.15], [-0.26, 0], [-0.2, -0.15], [0, -0.06]], dorsal: [[0.1, 0], [0.04, 0.1], [-0.04, 0.02], [-0.08, 0.08], [-0.3, 0.05], [-0.34, 0]], anal: [[-0.1, 0], [-0.18, 0.06], [-0.32, 0.05], [-0.34, 0]], barbels: 0 },
    perch: { length: 0.36, height: 0.26, width: 0.42, back: "#3e4a2e", pattern: "bars", peak: 0.75, fill: 0.85, tail: [[0, 0.05], [-0.24, 0.2], [-0.2, 0], [-0.24, -0.2], [0, -0.05]], dorsal: [[0.22, 0], [0.15, 0.13], [0.0, 0.12], [-0.15, 0.1], [-0.3, 0.07], [-0.34, 0]], anal: [[-0.05, 0], [-0.14, 0.08], [-0.3, 0.07], [-0.34, 0]], barbels: 0 },
    catfish: { length: 0.55, height: 0.14, width: 0.95, back: "#2e2d29", pattern: "spots", peak: 0.5, fill: 0.55, tail: [[0, 0.05], [-0.16, 0.12], [-0.2, 0], [-0.16, -0.12], [0, -0.05]], dorsal: [[0.18, 0], [0.12, 0.05], [-0.36, 0.05], [-0.4, 0]], anal: [[0.0, 0], [-0.05, 0.05], [-0.36, 0.05], [-0.4, 0]], barbels: 4 },
    snakehead: { length: 0.62, height: 0.15, width: 0.85, back: "#22291f", pattern: "chain", peak: 0.55, fill: 0.5, tail: [[0, 0.06], [-0.16, 0.13], [-0.21, 0], [-0.16, -0.13], [0, -0.06]], dorsal: [[0.2, 0], [0.15, 0.06], [-0.36, 0.07], [-0.4, 0]], anal: [[-0.02, 0], [-0.07, 0.06], [-0.36, 0.06], [-0.4, 0]], barbels: 0 },
    featherback: { length: 0.66, height: 0.3, width: 0.3, back: "#8a959b", pattern: "spots", peak: 0.45, fill: 1.2, tail: [[0, 0.03], [-0.12, 0.06], [-0.16, 0], [-0.12, -0.06], [0, -0.03]], dorsal: [[-0.02, 0], [-0.06, 0.05], [-0.1, 0]], anal: [[0.2, 0], [0.1, 0.07], [-0.3, 0.05], [-0.42, 0]], barbels: 0 },
  };
  const wildGeometries = new Map<WildCatch, THREE.BufferGeometry>();
  function wildGeometry(caught: WildCatch): THREE.BufferGeometry {
    let geometry = wildGeometries.get(caught);
    if (geometry) return geometry;
    const root = new THREE.Group();
    const temporary: THREE.BufferGeometry[] = [];
    if (caught === "boot") {
      root.add(part(cylinder(0.075, 0.08, 0.25, 12), "#3d5a3a", 0, 0.135, 0), part(cylinder(0.083, 0.083, 0.025, 12), "#2f4a2e", 0, 0.255, 0));
      root.add(part(rbox(0.12, 0.09, 0.22, 0.04), "#3d5a3a", 0, 0.045, 0.06), part(rbox(0.125, 0.025, 0.23, 0.01), "#262626", 0, 0.0, 0.06));
      root.rotation.z = 0.5;
    } else if (caught === "prawn") {
      const blue = "#5b7fa0", claw = "#2f5f9e", joint = "#e08a3c";
      const head = part(sphere(0.07, 10, 8), tint(blue, 0.06), 0.1, 0, 0);
      head.scale.set(1.5, 0.85, 0.8);
      root.add(head, turn(part(cone(0.012, 0.12, 4), tint(blue, 0.12), 0.24, 0.035, 0), 0, 0, -Math.PI / 2 + 0.25));
      for (let i = 0; i < 6; i += 1) {
        const r = 0.058 - i * 0.006;
        const angle = i * 0.16;
        root.add(part(sphere(r, 9, 7), i % 2 ? blue : tint(blue, -0.04), -0.02 - Math.cos(angle) * i * 0.055, -Math.sin(angle) * i * 0.055 * 0.9, 0));
      }
      for (const [dy, dz] of [[0.03, 0], [-0.03, 0.03], [-0.03, -0.03]]) root.add(turn(part(cone(0.035, 0.07, 3), tint(blue, 0.1), -0.3, -0.16 + dy, dz), 0, 0, Math.PI / 2 + 0.9));
      for (const side of [-1, 1]) {
        root.add(part(sphere(0.012, 6, 5), "#141414", 0.19, 0.03, side * 0.035));
        root.add(turn(part(cylinder(0.003, 0.003, 0.42, 3), tint(blue, -0.1), 0.38, 0.06, side * 0.05), side * 0.25, 0, -1.3));
        // The long blue claws of a river prawn, jointed in orange.
        root.add(turn(part(cylinder(0.009, 0.011, 0.28, 5), claw, 0.26, -0.03, side * 0.06), side * 0.3, 0, -1.45));
        root.add(part(sphere(0.014, 6, 5), joint, 0.13, -0.035, side * 0.045));
        const pincer = part(sphere(0.03, 8, 6), claw, 0.42, -0.02, side * 0.1);
        pincer.scale.set(2.2, 0.7, 0.8);
        root.add(pincer);
        for (let i = 0; i < 3; i += 1) root.add(turn(part(cylinder(0.004, 0.004, 0.09, 3), tint(blue, -0.08), 0.06 - i * 0.04, -0.07, side * 0.035), side * 0.5, 0, 0));
      }
    } else {
      const shape = WILD_SHAPES[caught];
      const base = new THREE.Color(WILD_FISH_MAP[caught].color);
      const back = new THREE.Color(shape.back);
      const belly = base.clone().lerp(new THREE.Color("#fffaf0"), caught === "featherback" ? 0.55 : 0.45);
      const fin = base.clone().lerp(back, 0.5);
      const radius = (t: number) => Math.max(0.03 * t, shape.height * Math.min(1, shape.fill * Math.pow(Math.sin(Math.PI * Math.pow(t, shape.peak)), 0.8)));
      const along = (x: number) => Math.min(1, Math.max(0, (0.5 - x) / 0.92));
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 18; i += 1) {
        const t = i / 18;
        profile.push(new THREE.Vector2(radius(t), 0.5 - t * 0.92));
      }
      const lathe = new THREE.LatheGeometry(profile, 12);
      temporary.push(lathe);
      lathe.rotateZ(-Math.PI / 2);
      lathe.scale(1, 1, shape.width);
      const index = lathe.index as THREE.BufferAttribute;
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, a);
      }
      lathe.computeVertexNormals();
      const positions = lathe.attributes.position;
      const colors = new Float32Array(positions.count * 3);
      const color = new THREE.Color();
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i), y = positions.getY(i);
        const v = y / Math.max(0.02, radius(along(x)));
        color.copy(belly).lerp(base, Math.min(1, Math.max(0, (v + 0.55) / 0.6)));
        color.lerp(back, Math.min(1, Math.max(0, (v - 0.3) / 0.6)) * 0.9);
        if (shape.pattern === "bars" && v > -0.4 && Math.sin(x * 34) > 0.45) color.multiplyScalar(0.78);
        if (shape.pattern === "blotch" && v > -0.3 && Math.sin(x * 26 + v * 4) * Math.cos(v * 5) > 0.45) color.multiplyScalar(0.72);
        if (shape.pattern === "chain" && Math.abs(v - 0.05) < 0.32 && Math.sin(x * 22) > 0.2) color.multiplyScalar(0.62);
        if (shape.pattern === "spots" && caught === "featherback" && x < -0.05 && v > -0.6 && v < 0.2 && Math.sin(x * 30) * Math.sin(v * 7 + 1) > 0.7) color.set("#3b3f40");
        if (shape.pattern === "spots" && caught === "catfish" && v > -0.2 && Math.sin(x * 40) * Math.sin(v * 9) > 0.75) color.lerp(belly, 0.5);
        if (Math.abs(x - 0.3) < 0.012 && v < 0.75) color.multiplyScalar(0.82);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      lathe.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      root.add(part(lathe, "vertex"));
      const finAt = (outline: [number, number][], x: number, y: number, z = 0, thickness = 0.014) => {
        const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([px, py]) => new THREE.Vector2(px, py))), { depth: thickness, bevelEnabled: false, curveSegments: 3 });
        temporary.push(geometry);
        geometry.translate(0, 0, -thickness / 2);
        const item = part(geometry, `#${fin.getHexString()}`, x, y, z);
        root.add(item);
        return item;
      };
      finAt(shape.tail, -0.4, 0);
      const top = (x: number) => radius(along(x)) * 0.92;
      finAt(shape.dorsal.map(([x, h]) => [x, top(x) - 0.02 + h]), 0, 0);
      finAt(shape.anal.map(([x, h]) => [x, -top(x) + 0.02 - h]), 0, 0);
      for (const side of [-1, 1]) {
        const eyeX = caught === "featherback" ? 0.4 : 0.37;
        const eyeY = radius(along(eyeX)) * 0.3;
        const eyeZ = radius(along(eyeX)) * shape.width * 0.86;
        root.add(part(sphere(0.04, 8, 6), "#f4f1e6", eyeX, eyeY, side * eyeZ), part(sphere(0.026, 8, 6), "#141a18", eyeX + 0.01, eyeY, side * (eyeZ + 0.02)));
        const pectoral = finAt([[0, 0.02], [-0.11, 0.05], [-0.14, -0.02], [-0.04, -0.03]], 0.22, -radius(along(0.22)) * 0.45, side * radius(along(0.18)) * shape.width * 0.9, 0.012);
        pectoral.rotation.set(side * 0.9, side * 0.35, -0.35);
        for (let b = 0; b < shape.barbels / 2; b += 1) {
          const barbel = part(cylinder(0.006, 0.003, 0.2 - b * 0.06, 4), `#${back.getHexString()}`, 0.5, -0.02 - b * 0.03, side * (0.03 + b * 0.03));
          barbel.rotation.set(side * (0.5 + b * 0.4), 0, 1.15 + b * 0.3);
          root.add(barbel);
        }
      }
      root.add(part(sphere(0.022, 6, 4), "#3a2a26", 0.5, -0.01, 0));
      root.scale.setScalar(shape.length);
    }
    const wrapper = new THREE.Group();
    wrapper.add(root);
    geometry = bakeGeometry(wrapper, false) ?? new THREE.BufferGeometry();
    temporary.forEach((item) => item.dispose());
    wildGeometries.set(caught, geometry);
    return geometry;
  }
  const hooked = new THREE.Mesh(new THREE.BufferGeometry(), surface);
  hooked.visible = false;
  hooked.raycast = () => {};
  world.add(hooked);

  // The basket on the jetty beside the farmer, showing the wild fish waiting in the barn.
  const basketAt = jettyRoot.localToWorld(new THREE.Vector3(-0.2, 0.23, 0.3));
  const basketRoot = new THREE.Group();
  basketRoot.add(part(cylinder(0.13, 0.11, 0.17, 12), "#b5874f", 0, 0.085, 0), part(cylinder(0.135, 0.135, 0.022, 12), "#9c6f3c", 0, 0.17, 0), part(cylinder(0.118, 0.118, 0.02, 12), "#9c6f3c", 0, 0.06, 0));
  const basket = bake(basketRoot, true, true, false);
  basket.userData.ownsGeometry = true;
  basket.position.copy(basketAt);
  basket.raycast = () => {};
  world.add(basket);
  const fillGeometries = new Map<number, THREE.BufferGeometry>();
  function fillGeometry(count: number): THREE.BufferGeometry {
    let geometry = fillGeometries.get(count);
    if (geometry) return geometry;
    const root = new THREE.Group();
    const colors = ["#a08a68", "#6f7d55", "#b9c2c6", "#4b4a44", "#3d4a3a"];
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.4;
      const tail = turn(part(cone(0.035, 0.07, 3), colors[i % colors.length], Math.cos(angle) * 0.06, 0.21, Math.sin(angle) * 0.06), Math.sin(angle) * 0.3, angle, Math.cos(angle) * 0.3);
      tail.scale.z = 0.35;
      root.add(tail, part(sphere(0.04, 8, 6), colors[i % colors.length], Math.cos(angle) * 0.06, 0.16, Math.sin(angle) * 0.06));
    }
    geometry = bakeGeometry(root, false) ?? new THREE.BufferGeometry();
    fillGeometries.set(count, geometry);
    return geometry;
  }
  const basketFill = new THREE.Mesh(fillGeometry(0), surface);
  basketFill.position.copy(basketAt);
  basketFill.raycast = () => {};
  world.add(basketFill);
  let basketShown = -1;
  let basketPopAt = -10;

  let hookedKind: WildCatch | null = null;
  let lastPhase: FishingState["phase"] = "ready";
  let wasNibbling = false;
  let splashAt = 0;
  const catchFrom = new THREE.Vector3();
  const floatPos = new THREE.Vector3();
  const castPoint = new THREE.Vector3();
  const tipWater = new THREE.Vector3();
  const lifted = new THREE.Vector3();
  const rodLeaning = jettyRoot.localToWorld(new THREE.Vector3(-0.15, 0.24, -0.38));

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

    // The rod: in the farmer's hands while he sits at the end of the jetty, else leaning by the basket.
    if (farmerSeated) {
      farmer.body.mesh.updateMatrixWorld(true);
      farmer.body.handR.getWorldPosition(hands);
      rodTurn.position.copy(hands);
      rodTurn.rotation.y = farmer.facing - Math.PI / 2;
      rodPivot.rotation.z = ROD_ANGLE + farmer.pose.tool;
    } else {
      rodTurn.position.copy(rodLeaning);
      rodTurn.rotation.y = seatFacing - Math.PI / 2 + 0.4;
      rodPivot.rotation.z = 1.32;
    }
    const strain = phase === "reeling" ? 0.22 + state.tension * 0.95 + state.pull * 0.12 * Math.sin(elapsed * 23) * motion : phase === "bite" ? 0.32 + Math.sin(elapsed * 30) * 0.05 * motion : phase === "caught" && state.t < 0.6 ? 0.5 : active ? 0.06 : 0;
    bendRod(farmerSeated ? strain : 0);
    rodTurn.updateMatrixWorld(true);
    rodTip.copy(rodTipLocal);
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
        hooked.geometry = wildGeometry(state.catch);
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
      // The fish fights: it darts up and down the river, harder while it pulls.
      floatPos.addScaledVector(jettyTangent, (Math.sin(elapsed * 2.3) * 0.22 * state.pull + Math.sin(elapsed * 6.1) * 0.05) * motion);
    } else {
      floatPos.copy(castPoint);
      floatPos.y = RIVER_Y + 0.02 + Math.sin(elapsed * 3) * 0.012 * motion - (nibbling ? 0.04 : 0) - (phase === "bite" ? 0.11 + Math.sin(elapsed * 30) * 0.02 * motion : 0);
    }
    const lingering = (phase === "late" || phase === "slack" || phase === "spooked") && state.t < 0.7;
    bobber.visible = active || lingering;
    bobber.position.copy(floatPos);
    line.visible = active || (lingering && phase !== "spooked") || (phase === "caught" && state.t < 0.7);
    if (line.visible) {
      const positions = lineGeometry.attributes.position as THREE.BufferAttribute;
      const end = phase === "caught" ? hooked.position : floatPos;
      const sag = phase === "reeling" ? (1 - Math.min(1, state.tension * 1.2)) * 0.35 : phase === "caught" ? 0.05 : 0.3;
      for (let i = 0; i < LINE_POINTS; i += 1) {
        const k = i / (LINE_POINTS - 1);
        positions.setXYZ(i, rodTip.x + (end.x - rodTip.x) * k, rodTip.y + (end.y + 0.12 - rodTip.y) * k - sag * 4 * k * (1 - k), rodTip.z + (end.z - rodTip.z) * k);
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

    // The catch: under the float while reeling (splashing and leaping when it pulls), then lifted
    // up to the farmer and swung into the basket.
    hooked.visible = false;
    let inFlight = false;
    if (phase === "reeling" && hookedKind) {
      hooked.visible = true;
      const leap = state.pull > 0.35 ? Math.abs(Math.sin(elapsed * 4.5)) * 0.32 * motion : 0;
      hooked.position.set(floatPos.x, RIVER_Y - 0.06 + leap, floatPos.z);
      hooked.rotation.set(0, Math.atan2(floatPos.z - tipWater.z, tipWater.x - floatPos.x) + Math.sin(elapsed * 14) * 0.4 * motion, leap * 2.2);
      if (state.pull > 0.45 && elapsed - splashAt > 0.32) {
        splashAt = elapsed;
        burst("splash", floatPos.x, RIVER_Y, floatPos.z, 6);
      }
    } else if (phase === "caught" && hookedKind && state.t < 1.2) {
      hooked.visible = true;
      inFlight = true;
      lifted.copy(hands).setY(hands.y + 0.3);
      if (state.t < 0.7) {
        const k = state.t / 0.7;
        hooked.position.lerpVectors(catchFrom, lifted, k);
        hooked.position.y += Math.sin(k * Math.PI) * 0.6;
        hooked.rotation.set(0, Math.atan2(-jettyAcross.z, jettyAcross.x), Math.sin(elapsed * 20) * 0.5 * motion);
      } else {
        const k = (state.t - 0.7) / 0.5;
        hooked.position.lerpVectors(lifted, basketAt, k);
        hooked.position.y += Math.sin(k * Math.PI) * 0.25 + 0.15 * (1 - k);
        hooked.rotation.set(0, Math.atan2(-jettyAcross.z, jettyAcross.x) + k * 1.2, -k * 1.1);
      }
    }
    if (phase === "caught" && state.t >= 1.2 && basketPopAt < elapsed - 2) basketPopAt = elapsed;
    // The basket: one fish per wild catch in the barn (up to five), the one in the air not yet.
    const wild = latest ? Object.values(latest.barn.wild).reduce((sum, count) => sum + (count ?? 0), 0) : 0;
    const shown = Math.min(5, Math.max(0, wild - (inFlight ? 1 : 0)));
    if (shown !== basketShown) {
      basketShown = shown;
      basketFill.geometry = fillGeometry(shown);
    }
    const pop = elapsed - basketPopAt < 0.35 && motion ? 1 + Math.sin(((elapsed - basketPopAt) / 0.35) * Math.PI) * 0.12 : 1;
    basket.scale.setScalar(pop);
    basketFill.scale.setScalar(pop);
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
  /* ───────────── time of day and season ───────────── */
  const sunAt = new THREE.Vector3();
  let skyKey = -1;
  const nextSeason: Record<string, string> = { spring: "summer", summer: "autumn", autumn: "winter", winter: "spring" };
  const tintA = new THREE.Color();
  const tintB = new THREE.Color();
  /**
   * Moves the sun across the sky (the moon at night), blends sky, fog and light colours for the
   * hour, lights windows and stars after dusk, and eases the season's colour in over the last
   * game day of the season before.
   */
  function applyTime(time: ReturnType<typeof gameClock>) {
    const light = lightAt(time.hour);
    const night = 1 - time.daylight;
    if (time.hour >= 5 && time.hour < 19.5) {
      const t = Math.min(1, Math.max(0, (time.hour - 5.5) / 13));
      const azimuth = 2.4 + (0.5 - t) * 1.7;
      const elevation = Math.sin(t * Math.PI);
      sunAt.set(Math.cos(azimuth) * 16, 5 + 15 * elevation, Math.sin(azimuth) * 16);
    } else {
      sunAt.set(-7, 19, 11);
    }
    sun.position.copy(sunAt);
    sun.color.copy(light.sun);
    sun.intensity = light.sunPower * (preset.pbr ? 1 : 0.76);
    hemi.color.copy(light.skyLight);
    hemi.groundColor.copy(light.groundLight);
    hemi.intensity = light.skyPower * (preset.pbr ? 1 : 0.94);
    (scene.fog as THREE.Fog).color.copy(light.fog);
    // Repaint the sky every ten game minutes (ten real seconds).
    const key = Math.floor(time.hour * 6);
    if (key !== skyKey) {
      skyKey = key;
      paintSky(sky, light.sky);
    }
    glowMaterial.color.setScalar(glowBase * (1 + night * 0.9));
    nightMaterial.opacity = Math.min(1, night * 1.3);
    (stars.material as THREE.PointsMaterial).opacity = night * 0.85;
    for (const uniforms of [pondWater, riverWaterUniforms]) {
      uniforms.uLight.value = 0.3 + 0.7 * time.daylight;
      uniforms.uSky.value.copy(light.sky[2]);
      uniforms.uSunColor.value.copy(light.sun);
      uniforms.uSunDir.value.copy(sunAt).normalize();
    }
    const now = SEASON_LOOK[time.season];
    const next = SEASON_LOOK[nextSeason[time.season]];
    const blend = Math.max(0, time.seasonDay - SEASON_DAYS + time.hour / 24);
    seasonTint.uSeasonTint.value.copy(tintA.set(now.mix ? now.tint : next.tint)).lerp(tintB.set(next.mix ? next.tint : now.tint), blend);
    seasonTint.uSeasonMix.value = now.mix + (next.mix - now.mix) * blend;
    seasonTint.uSeasonGain.value = now.gain + (next.gain - now.gain) * blend;
  }

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
    // Pens grow with the ranch's capacity upgrades: rebuild the fences and extras when it changes.
    const level = Math.min(TOP_LEVEL, Math.max(0, game.ranch.capacityLevel));
    if (!ranchYard || ranchYard.level !== level) {
      ranchLevel = level;
      if (ranchYard) releaseGeometry(ranchYard.group);
      ranchYard = buildRanchYard(level);
      // Drops sit by pen size: move them with it.
      for (const [id, group] of dropViews) {
        const drop = game.ranch.drops.find((item) => item.id === id);
        if (drop) {
          const [x, z] = dropPoint(drop);
          group.position.set(x, 0, z);
        }
      }
    }
    const now = clock.getElapsedTime();
    const before = previous;
    previous = game;
    // What the player just did: the farmer goes and does it.
    giveChores(choresBetween(before, game));
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
      if (view && view.modelsVersion !== modelsVersion && models[fish.species]) {
        // A Meshy model arrived: swap the built-in fish for it, where it was.
        const { position, rotation } = view.group;
        const old = view;
        old.group.removeFromParent();
        old.star.removeFromParent();
        old.materials.forEach((material) => material.dispose());
        view = buildFish(fish);
        view.group.position.copy(position);
        view.group.rotation.copy(rotation);
        view.phase = old.phase;
        view.yaw = old.yaw;
        fishViews.set(fish.id, view);
      }
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
      view.materials.forEach((material) => material.dispose());
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
      // A new model arrived, or a chick grew its feathers: rebuild in place.
      if (view && ((view.modelsVersion !== modelsVersion && models[animal.species]) || view.young !== !isGrown(animal))) {
        const position = view.group.position.clone();
        view.group.removeFromParent();
        view.materials.forEach((material) => material.dispose());
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
      const def = ANIMAL_MAP[animal.species];
      view.holder.scale.setScalar(isGrown(animal) ? 1 : 0.5 + 0.4 * (animal.age / def.growSeconds));
    });
    for (const [id, view] of animalViews) {
      if (animalIds.has(id)) continue;
      view.group.removeFromParent();
      view.materials.forEach((material) => material.dispose());
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

    {
      const eggs = game.ranch.incubator?.eggs ?? [];
      const key = `${game.ranch.incubator ? "built" : levelFromXp(game.xp) < INCUBATOR.level ? "locked" : "open"}|${eggs.map((egg) => `${egg.kind}${isHatched(egg) ? "!" : ""}`).join(",")}|${eggs.some(eggNeedsTurn)}`;
      if (!incubatorView || incubatorView.key !== key) {
        if (incubatorView) releaseGeometry(incubatorView.group);
        incubatorView = buildIncubatorView(game);
      }
    }

    for (const fill of troughFills) {
      fill.scale.y = 0.35 + 0.65 * Math.min(1, game.items.feed / 20);
      fill.visible = game.items.feed > 0;
    }
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
    if (view === viewName) return;
    viewName = view;
    // A new area starts at its usual place, at the zoom the player chose (within its limits).
    zoom = clampZoom(zoom, VIEWS[viewName], aspect, cover());
    panned = false;
    homePan(pan);
    reportZoom();
    // The farmer follows to the new area (placed there at once before the first frame).
    farmerGo(view, !started);
  }

  /* ───────────── input ───────────── */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down: { x: number; y: number; time: number; id: number } | null = null;
  /** Pointers on the canvas (for pinching), a one-finger or mouse drag looking around, and a pinch. */
  const pointers = new Map<number, { x: number; y: number }>();
  let panning: { id: number; grab: THREE.Vector3 } | null = null;
  let pinch: { distance: number; zoom: number; x: number; y: number } | null = null;
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

  function pinchMiddle() {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }
  function onPointerDown(event: PointerEvent) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && !(viewName === "river" && options.fishing)) {
      // A second finger: pinch to zoom (and move both to look around); whatever the first
      // finger was doing stops.
      work = null;
      cursorLeft = 0.45;
      down = null;
      panning = null;
      const middle = pinchMiddle();
      pinch = { distance: middle.distance, zoom, x: middle.x, y: middle.y };
      for (const id of pointers.keys()) renderer.domElement.setPointerCapture?.(id);
      return;
    }
    if (pointers.size > 2 || pinch) return;
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
    // Keep this pointer's events (and its release) even if it slides off the canvas, so a
    // finger lifted over the HUD is not left behind as a phantom second finger.
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }
  function endPointer(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (pinch && pointers.size < 2) {
      pinch = null;
      down = null;
      return true;
    }
    if (panning && panning.id === event.pointerId) {
      panning = null;
      down = null;
      return true;
    }
    return false;
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
    if (endPointer(event)) return;
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
    endPointer(event);
    endPress(event);
    down = null;
  }
  function onPointerMove(event: PointerEvent) {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      const middle = pinchMiddle();
      const from = new THREE.Vector3();
      const moved = groundAt(pinch.x, pinch.y, from);
      zoomTo(pinch.zoom * (middle.distance / pinch.distance), middle.x, middle.y);
      if (moved) dragGround(from, middle.x, middle.y);
      pinch.x = middle.x;
      pinch.y = middle.y;
      pinch.distance = middle.distance;
      pinch.zoom = zoom;
      return;
    }
    if (panning && panning.id === event.pointerId) {
      dragGround(panning.grab, event.clientX, event.clientY);
      return;
    }
    if (down && down.id === event.pointerId && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8 && canPan()) {
      // A drag on empty ground looks around: the ground under the pointer follows it.
      const grab = new THREE.Vector3();
      if (groundAt(down.x, down.y, grab)) {
        panning = { id: event.pointerId, grab };
        renderer.domElement.setPointerCapture?.(event.pointerId);
        dragGround(grab, event.clientX, event.clientY);
        return;
      }
    }
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
  // Ctrl/⌘ + wheel (and a trackpad pinch, which arrives that way) zooms about the pointer; a
  // plain wheel keeps scrolling the page.
  function onWheel(event: WheelEvent) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    zoomTo(zoom * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
  }
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

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

  /** Pixels the page's bars and cards cover at the top and bottom of the canvas, and its height. */
  const coverPx = { top: 0, bottom: 0 };
  let canvasHeight = 1;
  /** A narrow screen frames the area in the part the page leaves open; a wide one keeps the old framing. */
  function cover(): Cover {
    if (!isNarrow(aspect)) return NO_COVER;
    return { top: Math.min(0.3, coverPx.top / canvasHeight), bottom: Math.min(0.4, coverPx.bottom / canvasHeight) };
  }

  function desiredHeight() {
    return defaultHeight(VIEWS[viewName], aspect, cover()) / zoom;
  }

  /* ───────────── zoom & pan ───────────── */
  /** Keeps a pan (by default the player's) within the area. */
  function clampPan(value = pan) {
    const limit = panLimits(VIEWS[viewName], aspect, zoom, cover());
    const x = Math.max(-limit.x, Math.min(limit.x, value.dot(SCREEN_RIGHT)));
    const y = Math.max(-limit.y, Math.min(limit.y, value.dot(SCREEN_UP) * UP_SCALE));
    value.copy(SCREEN_RIGHT).multiplyScalar(x).addScaledVector(SCREEN_UP, y / UP_SCALE);
  }
  /** Where an area starts: its centre, or on a phone its focus. */
  function homePan(out: THREE.Vector3) {
    const view = VIEWS[viewName];
    if (view.focus && isNarrow(aspect)) out.copy(view.focus).sub(view.target).setY(0);
    else out.set(0, 0, 0);
    clampPan(out);
    return out;
  }
  /** Whether the player moved the view since the area opened; until then it stays at the area's start. */
  let panned = false;
  function settlePan() {
    if (panned) clampPan();
    else homePan(pan);
  }
  /** Where the camera looks: the area's centre plus the pan, lowered so that point sits in the middle of the open part. */
  function lookAt(out: THREE.Vector3) {
    return out.copy(VIEWS[viewName].target).add(pan).addScaledVector(SCREEN_UP, -coverLift(desiredHeight(), cover()) / UP_SCALE);
  }
  function canPan() {
    const limit = panLimits(VIEWS[viewName], aspect, zoom, cover());
    return limit.x > 0.05 || limit.y > 0.05;
  }
  let reported = "";
  function reportZoom() {
    const state: ZoomState = {
      atMin: zoom <= zoomMin(VIEWS[viewName], aspect, cover()) + 1e-3,
      atMax: zoom >= ZOOM_MAX - 1e-3,
      moved: Math.abs(zoom - 1) > 1e-3 || panned,
    };
    // Zoomed in, every drag on empty ground looks around; otherwise the page still scrolls up
    // and down over the game and sideways drags look around.
    renderer.domElement.style.touchAction = zoom > 1.02 ? "none" : "pan-y";
    const key = `${state.atMin}${state.atMax}${state.moved}`;
    if (key === reported) return;
    reported = key;
    options.onZoom?.(state);
  }
  /** The point on the ground under a screen position. */
  function groundAt(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(groundPlane, out) !== null;
  }
  /** Puts the camera where the zoom and pan say at once (no easing), for direct gestures. */
  function snapCamera() {
    viewHeight = desiredHeight();
    lookAt(cameraTarget);
    applyCamera();
  }
  const grabBefore = new THREE.Vector3();
  const grabAfter = new THREE.Vector3();
  const grabDelta = new THREE.Vector3();
  /** Zooms to `next`; with a screen point, the ground under it stays put. */
  function zoomTo(next: number, clientX?: number, clientY?: number) {
    const anchored = clientX !== undefined && clientY !== undefined && groundAt(clientX, clientY, grabBefore);
    zoom = clampZoom(next, VIEWS[viewName], aspect, cover());
    if (anchored) {
      snapCamera();
      if (groundAt(clientX, clientY, grabAfter)) pan.add(grabBefore.sub(grabAfter));
      panned = true;
    }
    settlePan();
    if (anchored) snapCamera();
    reportZoom();
  }
  /** Moves the view so the ground point `from` ends up under the screen point. */
  function dragGround(from: THREE.Vector3, clientX: number, clientY: number) {
    if (!groundAt(clientX, clientY, grabAfter)) return;
    pan.add(grabDelta.copy(from).sub(grabAfter));
    panned = true;
    clampPan();
    snapCamera();
    reportZoom();
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
    canvasHeight = height;
    renderer.setSize(width, height, false);
    post?.setSize(width, height, dpr);
    zoom = clampZoom(zoom, VIEWS[viewName], aspect, cover());
    settlePan();
    reportZoom();
    if (!started) {
      viewHeight = desiredHeight();
      lookAt(cameraTarget);
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
    cameraTarget.lerp(lookAt(panGoal), ease);
    viewHeight += (desiredHeight() - viewHeight) * ease;
    applyCamera();

    const motion = reducedMotion ? 0 : 1;
    const clockNow = gameClock(latest ?? { clockStart: Date.now() - 12 * 3600 * 1000 / 60 }, Date.now());
    applyTime(clockNow);
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
    stepPeople(dt, elapsed, motion, clockNow.hour);
    stepFishingView(elapsed, motion);
    fallMaterial.opacity = 0.74 + Math.sin(elapsed * 5) * 0.05 * motion;

    for (const view of fishViews.values()) {
      const { ax, az, w1, w2, p1, p2, depth } = view.params;
      // Cruising with now and then a quick dart; hungry fish are sluggish.
      const dart = Math.pow(Math.max(0, Math.sin(elapsed * 0.55 + p1 * 3)), 6);
      const speed = (hungry ? 0.45 : 1) * (1 + 1.6 * dart);
      view.phase += dt * speed * motion;
      const nx = Math.sin(view.phase * w1 * 2.2 + p1) * ax;
      const nz = Math.sin(view.phase * w2 * 2.2 + p2) * az;
      const tx = Math.cos(view.phase * w1 * 2.2 + p1) * ax * w1;
      const tz = Math.cos(view.phase * w2 * 2.2 + p2) * az * w2;
      const [x, z] = pondPoint(nx, nz);
      // Now and then a fish rises towards the surface.
      const rise = Math.pow(Math.max(0, Math.sin(view.phase * 0.31 + p2 * 5)), 14) * 0.12;
      view.group.position.set(x, depth + rise + Math.sin(elapsed * 2 + view.phase) * 0.015 * motion, z);
      if (tx !== 0 || tz !== 0) {
        const yaw = Math.atan2(-tz * POND_RZ, tx * POND_RX);
        let turn = yaw - view.yaw;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        view.yaw = yaw;
        // Lean into turns.
        view.group.rotation.x += (Math.max(-0.5, Math.min(0.5, (turn / Math.max(dt, 1e-3)) * 0.25)) * motion - view.group.rotation.x) * Math.min(1, dt * 4);
        view.group.rotation.y = yaw;
      }
      // A wave runs down the body to the tail, faster and wider when darting; hungry fish are slow.
      view.swim.uSwim.value = (view.swim.uSwim.value + dt * (hungry ? 5 : 9) * (1 + dart) * motion) % (Math.PI * 2000);
      view.swim.uSwimAmp.value = motion * (hungry ? 0.05 : 0.08 + 0.05 * dart);
      view.scale += (view.targetScale - view.scale) * Math.min(1, dt * 2);
      view.group.scale.setScalar(view.scale);
      view.star.visible = view.mature;
      if (view.mature) view.star.position.set(x, 1.05 + Math.sin(elapsed * 3 + view.phase) * 0.07, z);
    }
    for (const group of trashViews.values()) {
      group.position.y = WATER_Y + 0.02 + Math.sin(elapsed * 1.8 + group.position.x) * 0.02 * motion;
    }

    // Pasture grass grows back once nothing has bitten it for a moment. A claim lapses when its
    // animal left, was rebuilt (grew up, got its model) or went elsewhere.
    for (const [index, patch] of grazePatches.entries()) {
      const owner = patch.claim ? animalViews.get(patch.claim) : undefined;
      if (patch.claim && (!owner || (owner.goal !== index && owner.eat !== index))) patch.claim = null;
      if (elapsed - patch.bitten > 0.5) patch.food = Math.min(1, patch.food + dt * (0.8 / 90));
      if (Math.abs(patch.food - patch.shown) < 0.01 && !(patch.food === 1 && patch.shown !== 1)) continue;
      patch.shown = patch.food;
      grazeShrink.makeScale(1, patch.food, 1);
      for (let k = 0; k < patch.count; k += 1) grass.setMatrixAt(patch.first + k, grazeMatrix.multiplyMatrices(tufts[patch.first + k], grazeShrink));
      grass.instanceMatrix.addUpdateRange(patch.first * 16, patch.count * 16);
      grass.instanceMatrix.needsUpdate = true;
    }

    // Animals walk the pasture on their own legs (two for birds, four in diagonal pairs for sheep
    // and cows), stop to graze the grass patches they meet or head for, peck and preen, now and
    // then go to the trough; chicks and ducklings keep close to a grown one of their kind; grown
    // animals lie down to sleep at night, breathing slowly.
    const release = (view: AnimalView, id: string) => {
      for (const index of [view.goal, view.eat]) if (grazePatches[index]?.claim === id) grazePatches[index].claim = null;
      view.goal = -1;
      view.eat = -1;
    };
    // Walks to the near side of a patch so its mouth, not its feet, ends over the grass.
    const headFor = (view: AnimalView, id: string, index: number) => {
      const patch = grazePatches[index];
      const position = view.group.position;
      const away = Math.hypot(patch.x - position.x, patch.z - position.z) || 1;
      const reach = LEGS[view.species].reach * view.holder.scale.x;
      view.goal = index;
      patch.claim = id;
      view.target = new THREE.Vector2(patch.x - ((patch.x - position.x) / away) * reach, patch.z - ((patch.z - position.z) / away) * reach);
    };
    for (const [id, view] of animalViews) {
      const position = view.group.position;
      const dx = view.target.x - position.x;
      const dz = view.target.y - position.z;
      const distance = Math.hypot(dx, dz);
      const sleeping = clockNow.asleep && !view.young;
      view.sleep.visible = sleeping && !view.bowl.visible;
      view.lie += ((sleeping ? 1 : 0) - view.lie) * Math.min(1, dt * 2);
      const bird = view.species === "chicken" || view.species === "duck";
      const follower = view.young && bird;
      const size = ANIMAL_HEIGHT[view.species];
      const pen = PEN_OF[view.species];
      const penArea = penRect(pen, ranchLevel);
      // Ducks settle into the water on the pond and paddle instead of walking.
      const swimming = view.species === "duck" && inDuckPond(position.x, position.z);
      view.swim += ((swimming ? 1 : 0) - view.swim) * Math.min(1, dt * 4);
      let pitch = 0;
      let roll = 0;
      // How far the head is lowered (as a share of the species' reach to the ground).
      let head = 0;
      let headSpeed = 8;
      let walking = false;
      view.body.position.y = 0;
      if (sleeping) {
        head = 0.2;
        if (view.goal >= 0 || view.eat >= 0) release(view, id);
        view.sleep.position.y = size * (1 - 0.25 * view.lie) + 0.35 + Math.sin(elapsed * 1.5) * 0.05 * motion;
      } else if (view.wait > 0) {
        view.wait -= dt;
        view.idle += dt;
        const t = view.idle;
        const meal = grazePatches[view.eat];
        if (meal) {
          // Face the grass and crop it shorter while eating.
          let turn = Math.atan2(meal.x - position.x, meal.z - position.z) - view.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          view.heading += turn * Math.min(1, dt * 5);
          meal.food = Math.max(0.2, meal.food - dt * (view.species === "cow" ? 0.16 : bird ? 0.08 : 0.12));
          meal.bitten = elapsed;
          if (view.wait <= 0) release(view, id);
        }
        // The head and neck go down to eat; the body stays level.
        if (view.species === "chicken") {
          // Quick pecks in bursts; steady pecking at grass.
          head = Math.pow(Math.max(0, Math.sin(t * 9)), 3) * (meal || Math.sin(t * 1.3 + view.hop) > -0.2 ? 1 : 0);
          headSpeed = 22;
        } else if (view.species === "duck") {
          // Dabbling and a preen to the side.
          head = (meal ? 1 : 0.7) * Math.pow(Math.max(0, Math.sin(t * 5)), 2);
          headSpeed = 14;
          roll = meal ? 0 : 0.18 * Math.sin(t * 2.1) * (Math.sin(t * 0.7 + view.hop) > 0.4 ? 1 : 0);
        } else if (meal) {
          // Head down in the grass, chewing, now and then a pause.
          head = 0.94 + 0.06 * Math.sin(t * 6) - 0.25 * Math.max(0, Math.sin(t * 0.8 + view.hop) - 0.7) / 0.3;
          pitch = 0.04;
        } else {
          // Nibbling at the short grass, looking up from time to time.
          head = 0.45 + 0.3 * Math.max(0, Math.sin(t * 0.9 + view.hop));
        }
      } else if (distance < 0.08) {
        view.idle = 0;
        const seed = hashString(id + Math.floor(elapsed));
        view.wait = view.young ? 0.6 + (seed % 15) / 10 : 1.5 + (seed % 40) / 10;
        if (view.goal >= 0) {
          // Arrived at the grass: a proper meal, longer than a pause.
          view.eat = view.goal;
          view.goal = -1;
          view.wait = (bird ? 3.5 : 5.5) + (seed % 35) / 10;
        }
        // Ducks spend a good part of their time on the pond.
        let next = randomPenPoint(pen, hashString(id) + Math.floor(elapsed * 10), view.species === "duck" && seed % 10 < 4);
        if (follower) {
          // Follow a grown hen or duck of the same kind, a little behind and to one side.
          const mother = [...animalViews.values()].find((other) => other.species === view.species && !other.young);
          if (mother) next = new THREE.Vector2(mother.group.position.x + ((seed % 7) - 3) * 0.12, mother.group.position.z + (((seed >>> 3) % 7) - 3) * 0.12);
          view.target = next;
        } else if (view.eat < 0 && seed % 10 < 6) {
          // Off to the nearest patch of good grass nobody else is at.
          let best = -1;
          let bestD = Infinity;
          grazePatches.forEach((patch, index) => {
            const d = Math.hypot(patch.x - position.x, patch.z - position.z);
            if (patch.pen === pen && inside(penArea, patch.x, patch.z, PEN_ROOM[pen]) && !patch.claim && patch.food > 0.55 && d < bestD) {
              best = index;
              bestD = d;
            }
          });
          if (best >= 0) headFor(view, id, best);
          else view.target = next;
        } else if (seed % 4 === 0) {
          // Off to its pen's trough for a bite.
          view.target = troughPoint(pen, seed);
        } else {
          view.target = next;
        }
      } else if (motion) {
        walking = !swimming;
        const speed = view.speed * (view.young ? 1.25 : 1) * (swimming ? 0.6 : 1);
        const step = Math.min(distance, speed * dt);
        const nx = position.x + (dx / distance) * step, nz = position.z + (dz / distance) * step;
        if (view.species !== "duck" && inDuckPond(nx, nz, 0.1)) {
          // Hens and chicks walk round the water, not through it.
          view.target = randomPenPoint(pen, hashString(id) + Math.floor(elapsed * 7));
        } else {
          position.x = nx;
          position.z = nz;
        }
        // Turn smoothly towards where it is going.
        const want = Math.atan2(dx, dz);
        let turn = want - view.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        view.heading += turn * Math.min(1, dt * 8);
        // One gait cycle covers four times a foot's swing, so planted feet keep pace with the ground.
        const stride = Math.max(0.04, 4 * view.legs.uSwing.value * view.legs.uHip.value * view.holder.scale.x);
        view.legs.uStep.value = (view.legs.uStep.value + (step / stride) * Math.PI * 2) % (Math.PI * 200);
        const phase = view.legs.uStep.value;
        // The body rises over each planted leg; ducks waddle, chickens bob their heads.
        view.body.position.y = Math.pow(Math.sin(phase), 2) * size * (bird ? 0.035 : 0.014) * view.legs.uStride.value;
        roll = Math.sin(phase) * (view.species === "duck" ? 0.16 : view.species === "chicken" ? 0.05 : 0.025);
        if (view.species === "chicken") {
          head = 0.16 * Math.max(0, Math.sin(phase * 2));
          headSpeed = 22;
        }
        if (swimming) {
          // Paddling: no steps, just a gentle bob.
          view.body.position.y = 0;
          roll = 0;
        }
        // Grass on the way: stop for a bite if nobody is at it.
        if (!follower && !swimming && view.goal < 0 && view.eat < 0) {
          const reach = LEGS[view.species].reach * view.holder.scale.x + 0.35;
          const near = grazePatches.findIndex((patch) => patch.pen === pen && inside(penArea, patch.x, patch.z, PEN_ROOM[pen]) && !patch.claim && patch.food > 0.7 && Math.hypot(patch.x - position.x, patch.z - position.z) < reach);
          if (near >= 0) headFor(view, id, near);
        }
      }
      view.legs.uStride.value += ((walking ? 1 : 0) - view.legs.uStride.value) * Math.min(1, dt * 6);
      const lower = Math.min(1, dt * headSpeed);
      view.legs.uHead.value += (head * LEGS[view.species].graze * motion - view.legs.uHead.value) * lower;
      view.legs.uDrop.value += (head * view.drop * motion - view.legs.uDrop.value) * lower;
      view.group.rotation.y = view.heading;
      // Afloat: the body sinks to the waterline (the legs go under) and bobs.
      if (view.swim > 0.001) view.body.position.y += -view.swim * view.legs.uHip.value * 1.05 + Math.sin(elapsed * 2.2 + view.hop) * 0.012 * view.swim * motion;
      // Lying down: lower and wider, with slow breaths.
      const breath = 1 + Math.sin(elapsed * 1.6 + view.hop) * 0.025 * view.lie * motion;
      view.pose.position.y = -0.12 * size * view.lie;
      view.pose.scale.set(1 + 0.08 * view.lie, (1 - 0.18 * view.lie) * breath, 1 + 0.05 * view.lie);
      view.pose.rotation.x += (pitch * motion - view.pose.rotation.x) * Math.min(1, dt * 14);
      view.pose.rotation.z += (roll * motion + 0.12 * view.lie * (bird ? 0 : 1) - view.pose.rotation.z) * Math.min(1, dt * 10);
      if (view.bowl.visible) view.bowl.position.y = size + 0.45 + Math.sin(elapsed * 3) * 0.05 * motion;
    }
    // Animals do not walk through one another: bodies that overlap ease apart, inside the fence.
    if (motion) {
      const herd = [...animalViews.values()];
      for (let i = 0; i < herd.length; i += 1) {
        for (let j = i + 1; j < herd.length; j += 1) {
          const a = herd[i].group.position, b = herd[j].group.position;
          const room = LEGS[herd[i].species].room * herd[i].holder.scale.x + LEGS[herd[j].species].room * herd[j].holder.scale.x;
          const dx = b.x - a.x, dz = b.z - a.z;
          const apart = Math.hypot(dx, dz);
          if (apart >= room || apart < 1e-4) continue;
          const push = ((room - apart) * Math.min(1, dt * 3)) / 2 / apart;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
        }
      }
      for (const view of herd) {
        const position = view.group.position;
        const pen = PEN_OF[view.species];
        const area = penRect(pen, ranchLevel);
        const room = Math.min(PEN_ROOM[pen], 0.3);
        position.x = Math.min(area.x1 - room, Math.max(area.x0 + room, position.x));
        position.z = Math.min(area.z1 - room, Math.max(area.z0 + room, position.z));
        if (view.species !== "duck" && inDuckPond(position.x, position.z, 0.05)) {
          // Nudged into the pond by a neighbour: step back onto the bank.
          const ax = (position.x - DUCK_POND.x) / DUCK_POND.rx, az = (position.z - DUCK_POND.z) / DUCK_POND.rz;
          const r = Math.hypot(ax, az) || 1;
          position.x = DUCK_POND.x + (ax / r) * (DUCK_POND.rx + 0.08);
          position.z = DUCK_POND.z + (az / r) * (DUCK_POND.rz + 0.08);
        }
      }
    }
    for (const group of dropViews.values()) {
      group.position.y = Math.abs(Math.sin(elapsed * 2.4 + group.position.x * 3)) * 0.06 * motion;
    }
    if (incubatorView?.icon) incubatorView.icon.position.y = 1.75 + Math.sin(elapsed * 3) * 0.07 * motion;
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
    zoomBy(factor: number) {
      zoomTo(zoom * factor);
    },
    panBy(x: number, y: number) {
      pan.addScaledVector(SCREEN_RIGHT, x * viewHeight * aspect).addScaledVector(SCREEN_UP, (y * viewHeight) / UP_SCALE);
      panned = true;
      clampPan();
      reportZoom();
    },
    resetZoom() {
      zoom = clampZoom(1, VIEWS[viewName], aspect, cover());
      panned = false;
      homePan(pan);
      reportZoom();
    },
    setCover(top: number, bottom: number) {
      coverPx.top = Math.max(0, top);
      coverPx.bottom = Math.max(0, bottom);
      zoom = clampZoom(zoom, VIEWS[viewName], aspect, cover());
      settlePan();
      reportZoom();
    },
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
      renderer.domElement.removeEventListener("wheel", onWheel);
      [farmer, ...helpers.map((helper) => helper.walker)].forEach((walker) => walker.body.mesh.skeleton.dispose());
      primitives.forEach((item) => item.dispose());
      owned.forEach((item) => item.dispose());
      fishTemplates.forEach((item) => item.dispose());
      for (const view of fishViews.values()) view.materials.forEach((material) => material.dispose());
      for (const view of animalViews.values()) view.materials.forEach((material) => material.dispose());
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

  if (name === "turn") {
    // Two curved arrows: "turn the eggs".
    ctx.strokeStyle = "#c96f4a";
    ctx.fillStyle = "#c96f4a";
    ctx.lineWidth = 9;
    for (const start of [0.15, Math.PI + 0.15]) {
      ctx.beginPath();
      ctx.arc(64, 60, 24, start, start + 2.4);
      ctx.stroke();
      const end = start + 2.4;
      const x = 64 + Math.cos(end) * 24, y = 60 + Math.sin(end) * 24;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(end) * 11, y + Math.sin(end) * 11);
      ctx.lineTo(x - Math.cos(end) * 11, y - Math.sin(end) * 11);
      ctx.lineTo(x + Math.cos(end + Math.PI / 2) * 13, y + Math.sin(end + Math.PI / 2) * 13);
      ctx.closePath();
      ctx.fill();
    }
  } else if (name === "sleep") {
    ctx.fillStyle = "#3a4f7a";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("z", 48, 80);
    ctx.font = "bold 54px sans-serif";
    ctx.fillText("Z", 76, 62);
  } else if (name === "star") {
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
