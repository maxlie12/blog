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
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ANIMAL_MAP,
  FISH_MAP,
  MAX_DROPS,
  PLOT_COLUMNS,
  WORKSHOPS,
  WORKSHOP_MAP,
  cropStage,
  hashString,
  isFishMature,
  isRipe,
  levelFromXp,
  mulberry32,
  type AnimalId,
  type CropId,
  type FishId,
  type GameState,
  type Plot,
  type PondFish,
  type PondTrash,
  type ProductId,
  type RanchAnimal,
  type RanchDrop,
  type WorkshopId,
} from "./engine";
import { QUALITY_PRESETS, type Quality } from "./quality";

export type FarmView = "farm" | "pond" | "ranch";
export type SceneHit =
  | { kind: "plot"; index: number }
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
}

export interface FarmSceneController {
  update(game: GameState): void;
  setView(view: FarmView): void;
  setSelectedPlot(index: number | null): void;
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
  pond: { target: new THREE.Vector3(5.9, 0, 0.7), width: 9.6, height: 8.4 },
  ranch: { target: new THREE.Vector3(2.4, 0, 9.1), width: 11.8, height: 9.4 },
};
const ANIMAL_HEIGHT: Record<AnimalId, number> = { chicken: 0.6, duck: 0.6, sheep: 0.85, cow: 1.15 };

export function plotPosition(index: number): [number, number] {
  const col = index % PLOT_COLUMNS;
  const row = Math.floor(index / PLOT_COLUMNS);
  return [FARM_CENTER.x + (col - (PLOT_COLUMNS - 1) / 2) * PLOT_PITCH, FARM_CENTER.z + (1 - row) * PLOT_PITCH];
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

type IconName = "star" | "drop" | "bug" | "lock" | "bowl" | "build";

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
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "Nông trại 3D với ruộng, ao cá và trang trại vật nuôi. Chạm vào ô ruộng, cá, vật nuôi hoặc sản phẩm để thao tác; các nút bên dưới làm được mọi việc tương tự.",
  );
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color("#cfe8d4");
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 46, 80);

  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 140);
  const cameraTarget = VIEWS.farm.target.clone();
  let viewName: FarmView = "farm";
  let viewHeight = VIEWS.farm.height;
  let aspect = 1;

  scene.add(new THREE.HemisphereLight("#fff8dc", "#5d7f54", preset.pbr ? 2.0 : 1.7));
  const sun = new THREE.DirectionalLight("#fff1c2", preset.pbr ? 3.1 : 2.4);
  sun.position.set(-10, 18, 9);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 18, bottom: -17, near: 1, far: 70 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  /* ───────────── shared resources ───────────── */
  // One material for every baked object: colours live in the geometry, so the GPU switches
  // state once for the whole island.
  const surface: THREE.Material = preset.pbr
    ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 })
    : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const carrier = new THREE.MeshBasicMaterial();
  const primitives = new Map<string, THREE.BufferGeometry>();
  const owned = new Set<THREE.BufferGeometry>();
  const textures: THREE.Texture[] = [];
  const extraMaterials: THREE.Material[] = [hiddenMaterial, carrier];
  const tmpColor = new THREE.Color();

  function primitive<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let value = primitives.get(key);
    if (!value) {
      value = make();
      primitives.set(key, value);
    }
    return value as T;
  }
  const box = (w: number, h: number, d: number) => primitive(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  const sphere = (r: number, w = 10, h = 8) => primitive(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
  const cone = (r: number, h: number, s = 7) => primitive(`cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s));
  const cylinder = (rt: number, rb: number, h: number, s = 8) =>
    primitive(`cyl:${rt}:${rb}:${h}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const ico = (r: number, d = 0) => primitive(`ico:${r}:${d}`, () => new THREE.IcosahedronGeometry(r, d));
  const dodeca = (r: number) => primitive(`dodeca:${r}`, () => new THREE.DodecahedronGeometry(r, 0));
  const circle = (s: number) => primitive(`circle:${s}`, () => new THREE.CircleGeometry(1, s));

  /** A coloured building block. Never drawn itself: it only feeds `bake`. */
  function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
    const item = new THREE.Mesh(geometry, carrier);
    item.userData.color = color;
    item.position.set(x, y, z);
    return item;
  }

  function turn(mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
    mesh.rotation.set(x, y, z);
    return mesh;
  }

  /** Merges every coloured part under `root` into one vertex-coloured geometry. */
  function bakeGeometry(root: THREE.Object3D): THREE.BufferGeometry | null {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const matrix = new THREE.Matrix4();
    const pieces: THREE.BufferGeometry[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || typeof object.userData.color !== "string") return;
      const source = object.geometry as THREE.BufferGeometry;
      const geometry = source.index ? source.toNonIndexed() : source.clone();
      for (const name of Object.keys(geometry.attributes)) if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      geometry.applyMatrix4(matrix);
      tmpColor.set(object.userData.color as string);
      const count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      pieces.push(geometry);
    });
    if (pieces.length === 0) return null;
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((item) => item.dispose());
    if (merged) owned.add(merged);
    return merged;
  }

  function bake(root: THREE.Object3D, cast = true, receive = true): THREE.Mesh {
    const geometry = bakeGeometry(root) ?? new THREE.BufferGeometry();
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

  /* ───────────── static world (two draw calls) ───────────── */
  const world = new THREE.Group();
  scene.add(world);
  const groundRoot = new THREE.Group();
  const propsRoot = new THREE.Group();

  const ground = part(cylinder(16, 16.8, 1, 12), "#89b46a", 0, -0.55, 0);
  const cliff = part(cylinder(16.8, 15.4, 2.2, 12), "#7b6248", 0, -2.15, 0);
  const yard = part(box(8.9, 0.06, 6.7), "#a9875a", FARM_CENTER.x, -0.02, FARM_CENTER.z);
  const pasture = part(box(PASTURE.hx * 2, 0.05, PASTURE.hz * 2), "#a6d377", PASTURE.x, -0.02, PASTURE.z);
  const road = part(box(ROAD_END_X + 2.2, 0.05, 1.05), "#d6c08f", (ROAD_END_X - 2.2) / 2, -0.015, ROAD_Z);
  groundRoot.add(ground, cliff, yard, pasture, road);
  for (let i = 0; i < 6; i += 1) {
    const stone = part(cylinder(0.32, 0.36, 0.08, 7), "#d8d0b8", 0.55 + i * 0.62, -0.01, FARM_CENTER.z + 0.15 + Math.sin(i * 1.3) * 0.25);
    stone.rotation.y = i;
    groundRoot.add(stone);
  }
  const pondBed = part(circle(28), "#2b6764", POND_CENTER.x, -0.035, POND_CENTER.z);
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.scale.set(POND_RX + 0.2, POND_RZ + 0.2, 1);
  groundRoot.add(pondBed);

  function addFence(root: THREE.Object3D, cx: number, cz: number, segments: [number, number, number, number][], color: string) {
    for (const [x1, z1, x2, z2] of segments) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const posts = Math.max(2, Math.round(length / 1.15) + 1);
      for (let i = 0; i < posts; i += 1) {
        const t = i / (posts - 1);
        root.add(part(box(0.14, 0.62, 0.14), color, cx + x1 + (x2 - x1) * t, 0.28, cz + z1 + (z2 - z1) * t));
      }
      for (const y of [0.22, 0.44]) {
        const rail = part(box(length, 0.07, 0.06), color, cx + (x1 + x2) / 2, y, cz + (z1 + z2) / 2);
        rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        root.add(rail);
      }
    }
  }
  addFence(propsRoot, FARM_CENTER.x, FARM_CENTER.z, [
    [-4.75, -3.65, 4.75, -3.65],
    [-4.75, 3.65, -0.9, 3.65],
    [0.9, 3.65, 4.75, 3.65],
    [-4.75, -3.65, -4.75, 3.65],
    [4.75, -3.65, 4.75, -0.9],
    [4.75, 0.9, 4.75, 3.65],
  ], "#b98a55");
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
    const bale = part(cylinder(0.32, 0.32, 0.5, 10), "#e2c25f", x, 0.3, z);
    bale.rotation.z = Math.PI / 2;
    propsRoot.add(bale);
  }

  const house = new THREE.Group();
  house.add(
    part(box(2, 1.35, 1.6), "#f3d99a", 0, 0.68, 0),
    turn(part(cone(1.65, 1.05, 4), "#3f7a52", 0, 1.86, 0), 0, Math.PI / 4, 0),
    part(box(0.4, 0.75, 0.05), "#6a4a35", 0.35, 0.38, 0.81),
    part(box(0.4, 0.34, 0.05), "#bfe3e8", -0.45, 0.82, 0.81),
  );
  house.position.set(-7.1, 0, -4.9);
  house.rotation.y = 0.12;
  propsRoot.add(house);

  const tower = new THREE.Group();
  tower.add(part(cylinder(0.32, 0.55, 2.6, 6), "#efe6d2", 0, 1.3, 0), part(cone(0.48, 0.55, 6), "#c4553f", 0, 2.85, 0));
  tower.position.set(-9.9, 0, -2.4);
  propsRoot.add(tower);

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
    for (let i = 0; i < 4; i += 1) {
      const [x, z] = pondPoint(px + i * 0.03, pz + i * 0.025);
      const reed = part(cylinder(0.02, 0.03, 0.75 + i * 0.12, 4), "#4f8a3f", x, 0.38, z);
      reed.rotation.z = (i - 1.5) * 0.08;
      propsRoot.add(reed);
    }
  }
  for (const [px, pz, s] of [[0.45, -0.55, 1], [0.6, -0.35, 0.7], [-0.55, 0.5, 0.85]]) {
    const [x, z] = pondPoint(px, pz);
    propsRoot.add(part(cylinder(0.32 * s, 0.32 * s, 0.03, 9), "#5c9d48", x, WATER_Y + 0.02, z));
  }
  const [fx, fz] = pondPoint(0.45, -0.55);
  propsRoot.add(part(sphere(0.09, 6, 5), "#f6b6c8", fx + 0.05, WATER_Y + 0.09, fz));
  const dock = new THREE.Group();
  for (let i = 0; i < 5; i += 1) dock.add(part(box(0.34, 0.07, 1.25), i % 2 ? "#a77a4c" : "#b98a55", i * 0.36, 0.36, 0));
  for (const [x, z] of [[0, -0.55], [0, 0.55], [1.45, -0.55], [1.45, 0.55]]) dock.add(part(cylinder(0.06, 0.06, 0.7, 5), "#7a5638", x, 0.05, z));
  const [dx, dz] = pondPoint(-1.25, 0.55);
  dock.position.set(dx, 0, dz);
  dock.rotation.y = -0.5;
  propsRoot.add(dock);

  // Road sign towards town, at the island edge.
  const sign = new THREE.Group();
  sign.add(part(box(0.1, 1.1, 0.1), "#7a5638", 0, 0.55, 0), part(box(1.1, 0.42, 0.08), "#f2c94c", 0.2, 1.05, 0), part(cone(0.24, 0.3, 3), "#24583e", 0.62, 1.05, 0.05));
  (sign.children[2] as THREE.Mesh).rotation.z = -Math.PI / 2;
  sign.position.set(ROAD_END_X - 1.4, 0, ROAD_Z - 0.9);
  propsRoot.add(sign);

  // Trees, mountains.
  function addTree(x: number, z: number, scale: number, round: boolean) {
    const tree = new THREE.Group();
    tree.add(part(cylinder(0.12, 0.18, 0.95, 6), "#7a5638", 0, 0.47, 0));
    if (round) tree.add(part(ico(0.75), "#5e9e4a", 0, 1.35, 0));
    else tree.add(part(cone(0.75, 1.25, 7), "#2f7048", 0, 1.25, 0), part(cone(0.52, 0.95, 7), "#3a8255", 0, 1.85, 0));
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.rotation.y = x * 1.7;
    propsRoot.add(tree);
  }
  const treeSpots: [number, number, number, boolean][] = [
    [-11.5, -5.5, 1.1, false], [-12.6, -2.6, 0.95, true], [-12.2, 1.8, 1.05, false], [-11.6, 5.4, 0.9, true],
    [-8.4, 7.9, 1, false], [-4.2, -7.6, 1.15, false], [-0.6, -7.2, 0.95, true], [2.6, -6.6, 1.1, false],
    [5.5, -5.6, 0.9, true], [9.2, -5.2, 1.15, false], [11.8, -2.2, 1, true], [12.4, 2.4, 1.1, false],
    [-6.2, 11.6, 1.05, false], [-1.4, 13.2, 0.95, true], [3.8, 12.9, 1.1, false], [11.5, 7.2, 0.9, true],
    [-9.9, 9.8, 0.95, true],
  ];
  treeSpots.forEach(([x, z, s, round]) => addTree(x, z, s, round));
  for (const [x, z, s] of [[-6, -12, 3.4], [-1, -13, 4.4], [4.5, -12.5, 3.6], [9.5, -11.5, 2.8]]) {
    propsRoot.add(part(cone(s, s * 1.6, 6), "#7f9a78", x, s * 0.7 - 0.6, z), part(cone(s * 0.32, s * 0.5, 6), "#f5f1e3", x, s * 0.7 - 0.6 + s * 0.56, z));
  }

  const groundMesh = bake(groundRoot, false, true);
  const propsMesh = bake(propsRoot, true, true);
  // Purely decorative: skip them when picking so taps go straight to interactive objects.
  for (const item of [groundMesh, propsMesh]) {
    item.raycast = () => {};
    item.userData.ownsGeometry = true;
    world.add(item);
  }

  // Interactive buildings, one draw call each.
  function addBuilding(build: (root: THREE.Group) => void, hit: SceneHit, x: number, z: number, rotation: number, hitGeometry: THREE.BufferGeometry, hitY: number) {
    const root = new THREE.Group();
    build(root);
    const mesh = bake(root);
    const group = new THREE.Group();
    group.add(mesh, hitBox(hitGeometry, hit, hitY));
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    world.add(group);
    return group;
  }
  addBuilding((root) => {
    const roof = part(cylinder(1.02, 1.02, 2.6, 3), "#6f4b3a", 0, 2.11, 0);
    roof.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    const cross = part(box(1.18, 0.08, 0.03), "#c4553f", 0, 0.53, 0.95);
    cross.rotation.z = 0.86;
    root.add(part(box(2.4, 1.6, 1.8), "#c4553f", 0, 0.8, 0), roof, part(box(0.9, 1.05, 0.06), "#f5e7c8", 0, 0.53, 0.91), cross);
  }, { kind: "barn" }, -2.1, -4.75, -0.18, box(2.5, 2.6, 1.9), 1.2);
  addBuilding((root) => {
    const awning = part(box(1.75, 0.08, 1.05), "#f2c94c", 0, 1.45, 0.08);
    awning.rotation.x = 0.18;
    const stripe = part(box(1.76, 0.09, 0.22), "#e2533d", 0, 1.47, 0.08);
    stripe.rotation.x = 0.18;
    root.add(part(box(1.5, 0.7, 0.75), "#c8935a", 0, 0.35, 0), awning, stripe, part(box(0.42, 0.28, 0.32), "#a26f3f", -0.35, 0.84, 0));
    root.add(part(sphere(0.14, 7, 5), "#e2533d", -0.35, 1.03, 0), part(sphere(0.12, 7, 5), "#f08a2c", 0.25, 0.82, 0.05));
    for (const x of [-0.68, 0.68]) root.add(part(cylinder(0.04, 0.04, 1.45, 5), "#7a5638", x, 0.72, 0.4));
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

  // Water stays separate because it is transparent.
  const waterMaterial = preset.pbr
    ? new THREE.MeshStandardMaterial({ color: "#67c3b8", roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.4, depthWrite: false })
    : new THREE.MeshLambertMaterial({ color: "#67c3b8", transparent: true, opacity: 0.45, depthWrite: false });
  extraMaterials.push(waterMaterial);
  const water = new THREE.Mesh(circle(36), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(POND_RX + 0.15, POND_RZ + 0.15, 1);
  water.position.set(POND_CENTER.x, WATER_Y, POND_CENTER.z);
  water.userData.hit = { kind: "pond" } satisfies SceneHit;
  water.renderOrder = 2;
  world.add(water);

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

    if (plot.status === "locked") {
      content.add(part(box(PLOT_SIZE, 0.14, PLOT_SIZE), "#9cc27a", 0, 0.03, 0), part(box(0.08, 0.6, 0.08), "#7a5638", 0, 0.35, 0), part(box(0.62, 0.36, 0.06), "#d9b27a", 0, 0.62, 0.02));
      iconSprite = icon("lock", 0.55);
      iconSprite.position.set(0, 1.12, 0);
    } else {
      const soilColor = plot.status === "wild" ? "#8d7048" : plot.thirsty ? "#a9845c" : plot.status === "withered" ? "#7a573b" : "#6b4630";
      content.add(part(box(PLOT_SIZE, 0.22, PLOT_SIZE), soilColor, 0, 0.06, 0));
      if (plot.status === "wild") {
        for (let i = 0; i < 7; i += 1) {
          const tuft = part(cone(0.12, 0.34, 4), i % 2 ? "#6fa24f" : "#88b65d", (random() - 0.5) * 1.4, 0.32, (random() - 0.5) * 1.4);
          tuft.rotation.z = (random() - 0.5) * 0.5;
          content.add(tuft);
        }
        for (let i = 0; i < 3; i += 1) content.add(part(dodeca(0.1), "#b7b19c", (random() - 0.5) * 1.3, 0.2, (random() - 0.5) * 1.3));
      } else {
        const ridgeColor = plot.thirsty ? "#987351" : "#5c3b28";
        for (let row = -1; row <= 1; row += 1) content.add(part(box(PLOT_SIZE * 0.9, 0.07, 0.2), ridgeColor, 0, 0.2, row * 0.5));
        if (plot.status === "withered") {
          for (let i = 0; i < 8; i += 1) {
            const stalk = part(cylinder(0.02, 0.03, 0.42, 4), "#a47d4e", (random() - 0.5) * 1.3, 0.38, (random() - 0.5) * 1.3);
            stalk.rotation.set((random() - 0.5) * 0.9, 0, (random() - 0.5) * 0.9);
            content.add(stalk);
          }
        }
        if (plot.status === "growing" && plot.crop) {
          const stage = cropStage(plot);
          const spots: [number, number][] = [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]];
          spots.forEach(([px, pz], plantIndex) => {
            const plantNode = buildPlant(plot.crop as CropId, stage, mulberry32(index * 31 + plantIndex));
            plantNode.position.set(px + (random() - 0.5) * 0.08, 0.2, pz + (random() - 0.5) * 0.08);
            plantNode.rotation.y = random() * Math.PI * 2;
            content.add(plantNode);
          });
          for (let i = 0; i < plot.weeds; i += 1) {
            for (let j = 0; j < 4; j += 1) {
              const blade = part(cone(0.06, 0.38, 3), "#3f6b2c", (i === 0 ? -0.72 : 0.7) + (j - 1.5) * 0.06, 0.38, (i === 0 ? 0.05 : -0.1) + (j % 2) * 0.05);
              blade.rotation.z = (j - 1.5) * 0.25;
              content.add(blade);
            }
          }
          for (let i = 0; i < plot.bugs; i += 1) {
            const beetle = part(sphere(0.08, 7, 5), "#c8382c", i === 0 ? 0.08 : -0.15, stage >= 2 ? 0.62 : 0.32, i === 0 ? 0.05 : -0.22);
            beetle.scale.set(1, 0.6, 1.2);
            content.add(beetle);
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
    group.add(mesh, hitBox(box(PLOT_PITCH * 0.98, 0.5, PLOT_PITCH * 0.98), { kind: "plot", index }, 0.2));
    if (iconSprite) group.add(iconSprite);
    return { group, icon: iconSprite };
  }

  function buildPlant(crop: CropId, stage: 0 | 1 | 2 | 3, random: () => number): THREE.Group {
    const plant = new THREE.Group();
    const leaf = "#4f9a3d";
    const leafLight = "#7fc35a";
    if (stage === 0) {
      const mound = part(sphere(0.12, 6, 4), "#5a3a26");
      mound.scale.y = 0.45;
      plant.add(mound, part(sphere(0.035, 5, 4), "#e9d9a6", 0, 0.05, 0));
      return plant;
    }
    if (stage === 1) {
      for (const side of [-1, 1]) {
        const sprout = part(sphere(0.08, 6, 4), leafLight, side * 0.07, 0.12, 0);
        sprout.scale.set(1.5, 0.35, 0.8);
        sprout.rotation.z = side * 0.4;
        plant.add(sprout);
      }
      plant.add(part(cylinder(0.015, 0.02, 0.12, 4), leaf, 0, 0.06, 0));
      return plant;
    }
    const ripe = stage === 3;
    switch (crop) {
      case "cabbage": {
        const head = part(sphere(ripe ? 0.27 : 0.18, 8, 6), ripe ? "#a5d877" : "#77b75a", 0, ripe ? 0.17 : 0.12, 0);
        head.scale.y = 0.75;
        plant.add(head);
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          const outer = part(sphere(0.16, 6, 4), "#4e9a3e", Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16);
          outer.scale.set(1.4, 0.35, 0.9);
          outer.rotation.y = -a;
          plant.add(outer);
        }
        break;
      }
      case "carrot": {
        for (let i = 0; i < 3; i += 1) {
          const top = part(cone(0.05, ripe ? 0.5 : 0.36, 4), leaf, (i - 1) * 0.06, ripe ? 0.32 : 0.22, 0);
          top.rotation.z = (i - 1) * 0.3;
          plant.add(top);
        }
        if (ripe) {
          const root = part(cone(0.1, 0.24, 6), "#f08a2c", 0, 0.05, 0);
          root.rotation.x = Math.PI;
          plant.add(root);
        }
        break;
      }
      case "tomato": {
        const bush = part(ico(0.26), leaf, 0, ripe ? 0.4 : 0.3, 0);
        bush.scale.setScalar(ripe ? 1 : 0.8);
        plant.add(part(cylinder(0.015, 0.015, 0.85, 4), "#b98a55", 0.12, 0.42, 0), bush);
        for (let i = 0; i < (ripe ? 5 : 2); i += 1) {
          const a = random() * Math.PI * 2;
          plant.add(part(sphere(ripe ? 0.085 : 0.06, 7, 5), ripe ? "#e2483a" : "#9acb63", Math.cos(a) * 0.24, 0.3 + random() * 0.2, Math.sin(a) * 0.24));
        }
        break;
      }
      case "corn": {
        const height = ripe ? 1.05 : 0.65;
        plant.add(part(cylinder(0.035, 0.05, height, 5), "#6aa84a", 0, height / 2, 0));
        for (let i = 0; i < 3; i += 1) {
          const blade = part(box(0.05, 0.02, 0.42), leafLight, 0, 0.25 + i * 0.22, 0.15);
          blade.rotation.set(-0.5, (i * 2.1) % 6, 0);
          plant.add(blade);
        }
        if (ripe) {
          const cob = part(cylinder(0.06, 0.075, 0.28, 7), "#f4cf45", 0.09, 0.62, 0);
          cob.rotation.z = -0.3;
          const husk = part(cone(0.07, 0.2, 5), "#a6c96a", 0.14, 0.43, 0);
          husk.rotation.z = Math.PI - 0.3;
          plant.add(cob, husk, part(cone(0.05, 0.18, 4), "#d8b36a", 0, height + 0.06, 0));
        }
        break;
      }
      case "rice": {
        const color = ripe ? "#e2bf4f" : "#79b354";
        for (let i = 0; i < 6; i += 1) {
          const height = (ripe ? 0.62 : 0.45) + random() * 0.08;
          const a = (i / 6) * Math.PI * 2;
          const stem = part(cylinder(0.012, 0.018, height, 3), color, Math.cos(a) * 0.06, height / 2, Math.sin(a) * 0.06);
          stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
          plant.add(stem);
          if (ripe) {
            const grain = part(sphere(0.04, 5, 4), "#f1d36b", Math.cos(a) * 0.2, height - 0.02, Math.sin(a) * 0.2);
            grain.scale.set(0.7, 1.8, 0.7);
            plant.add(grain);
          }
        }
        break;
      }
      case "strawberry": {
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * Math.PI * 2;
          const leafNode = part(sphere(0.13, 6, 4), "#3f8a3a", Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
          leafNode.scale.set(1.2, 0.4, 1);
          plant.add(leafNode);
        }
        for (let i = 0; i < (ripe ? 4 : 2); i += 1) {
          const a = random() * Math.PI * 2;
          const berry = part(cone(0.06, 0.12, 6), ripe ? "#df3646" : "#e8f0c9", Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2);
          berry.rotation.x = Math.PI;
          plant.add(berry);
        }
        break;
      }
      case "pumpkin":
      case "watermelon": {
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * Math.PI * 2 + 0.6;
          const leafNode = part(dodeca(0.15), leaf, Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22);
          leafNode.scale.set(1.3, 0.35, 1.1);
          plant.add(leafNode);
        }
        const isPumpkin = crop === "pumpkin";
        const size = ripe ? 0.25 : 0.12;
        const fruit = part(sphere(size, 10, 7), isPumpkin ? (ripe ? "#ef8a2a" : "#b9c25a") : ripe ? "#3d7c3a" : "#8fbf62", 0, size * 0.7, 0);
        fruit.scale.set(isPumpkin ? 1.1 : 1.25, isPumpkin ? 0.75 : 0.85, isPumpkin ? 1.1 : 0.9);
        plant.add(fruit);
        if (ripe && isPumpkin) plant.add(part(cylinder(0.025, 0.035, 0.12, 5), "#6b8a3a", 0, size * 1.4, 0));
        if (ripe && !isPumpkin) {
          const band = part(cylinder(size * 0.9, size * 0.9, 0.05, 10), "#7fbf5f", 0, size * 0.7, 0);
          band.rotation.z = Math.PI / 2;
          band.scale.set(1, 1.2, 0.85);
          plant.add(band);
        }
        break;
      }
      case "sunflower": {
        const height = ripe ? 1.15 : 0.7;
        plant.add(part(cylinder(0.03, 0.045, height, 5), "#5d9a3f", 0, height / 2, 0));
        for (const side of [-1, 1]) {
          const leafNode = part(sphere(0.11, 6, 4), leafLight, side * 0.13, height * 0.45, 0);
          leafNode.scale.set(1.6, 0.3, 0.9);
          plant.add(leafNode);
        }
        const head = new THREE.Group();
        const petals = part(cylinder(ripe ? 0.24 : 0.12, ripe ? 0.24 : 0.12, 0.04, 10), ripe ? "#f6c629" : "#a7cf6b");
        petals.rotation.x = Math.PI / 2;
        head.add(petals);
        if (ripe) {
          const center = part(cylinder(0.12, 0.12, 0.06, 10), "#6b3f22", 0, 0, 0.02);
          center.rotation.x = Math.PI / 2;
          head.add(center);
        }
        head.position.y = height;
        head.rotation.x = -0.35;
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
      root.add(part(box(1.7, 0.08, 1.5), "#b99a6b", 0, 0, 0), part(box(0.08, 0.7, 0.08), "#7a5638", -0.55, 0.35, 0.55), part(box(0.6, 0.34, 0.06), "#e8d3a6", -0.55, 0.66, 0.58));
      for (const [bx, bz] of [[0.35, -0.3], [0.55, 0.15]]) root.add(part(box(0.32, 0.22, 0.32), "#c8935a", bx, 0.11, bz));
      const sprite = icon(locked ? "lock" : "build", 0.6);
      sprite.position.set(0, 1.25, 0);
      group.add(sprite);
    } else {
      root.add(part(box(1.6, 1.0, 1.3), "#f3e3c3", 0, 0.5, 0));
      const roof = part(cone(1.32, 0.75, 4), def.roof, 0, 1.37, 0);
      roof.rotation.y = Math.PI / 4;
      root.add(roof, part(box(0.42, 0.62, 0.05), "#7a5638", 0.3, 0.31, 0.66), part(box(0.38, 0.3, 0.05), "#bfe3e8", -0.38, 0.6, 0.66), part(box(0.22, 0.55, 0.22), "#a9573f", -0.45, 1.55, -0.2));
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

  function update(game: GameState) {
    latest = game;
    const now = clock.getElapsedTime();
    game.plots.forEach((plot, index) => {
      const key = plotKey(plot);
      const current = plotViews[index];
      if (current && current.key === key) return;
      if (current) releaseGeometry(current.group);
      const built = buildPlot(index, plot);
      world.add(built.group);
      plotViews[index] = { group: built.group, key, icon: built.icon, popAt: current ? now : -10 };
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
    waterMaterial.color.set(game.pond.trash.length >= 4 ? "#8fb79a" : game.pond.trash.length >= 2 ? "#79bfa9" : "#67c3b8");

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
      if (hit.kind === "fish" || hit.kind === "trash" || hit.kind === "drop" || hit.kind === "animal") return hit;
      fallback ??= hit;
    }
    return fallback;
  }

  function onPointerDown(event: PointerEvent) {
    down = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  }
  function onPointerUp(event: PointerEvent) {
    if (!down || down.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const quick = performance.now() - down.time < 650;
    down = null;
    if (moved > 10 || !quick) return;
    const hit = pick(event.clientX, event.clientY);
    if (hit) options.onHit(hit);
  }
  function onPointerCancel() {
    down = null;
  }
  function onPointerMove(event: PointerEvent) {
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

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(280, container.clientWidth);
    const height = Math.max(260, container.clientHeight);
    aspect = width / height;
    renderer.setSize(width, height, false);
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

  /** One step down the ladder: resolution, then shadows, then frame rate. */
  function downgrade(): string | null {
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
      surface.needsUpdate = true;
      waterMaterial.needsUpdate = true;
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
    blades.rotation.z += dt * 1.2 * motion;
    clouds.forEach((cloud, index) => {
      cloud.position.x += dt * (0.25 + index * 0.06) * motion;
      if (cloud.position.x > 18) cloud.position.x = -18;
    });
    waterMaterial.opacity = (preset.pbr ? 0.4 : 0.45) + Math.sin(elapsed * 1.6) * 0.04 * motion;

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
      }
    }

    renderer.render(scene, camera);
    measure(time);
  }
  frame = window.requestAnimationFrame(render);

  return {
    update,
    setView,
    setSelectedPlot,
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
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
