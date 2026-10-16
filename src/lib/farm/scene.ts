/**
 * Three.js view of the Learning Farm. It owns no game rules: it renders a GameState handed to
 * it, animates idle motion (fish, clouds, windmill), and reports taps as SceneHit values.
 * Loaded with a dynamic import so three.js only downloads when the player enters the farm.
 */
import * as THREE from "three";
import {
  FISH_MAP,
  PLOT_COLUMNS,
  cropStage,
  hashString,
  isFishMature,
  isRipe,
  mulberry32,
  type CropId,
  type GameState,
  type Plot,
  type PondFish,
  type PondTrash,
} from "./engine";

export type FarmView = "farm" | "pond";
export type SceneHit =
  | { kind: "plot"; index: number }
  | { kind: "fish"; id: string }
  | { kind: "trash"; id: string }
  | { kind: "pond" }
  | { kind: "barn" }
  | { kind: "shop" };

export interface FarmSceneController {
  update(game: GameState): void;
  setView(view: FarmView): void;
  setSelectedPlot(index: number | null): void;
  dispose(): void;
}

const FARM_CENTER = new THREE.Vector3(-4.6, 0, 0.7);
const POND_CENTER = new THREE.Vector3(6.1, 0, 0.9);
const POND_RX = 3.7;
const POND_RZ = 2.8;
const WATER_Y = 0.27;
const PLOT_PITCH = 2.05;
const PLOT_SIZE = 1.74;
const CAMERA_OFFSET = new THREE.Vector3(1, 1.08, 1.3).normalize().multiplyScalar(36);
const VIEWS: Record<FarmView, { target: THREE.Vector3; width: number; height: number }> = {
  farm: { target: new THREE.Vector3(-4.1, 0, 0.3), width: 11.2, height: 10 },
  pond: { target: new THREE.Vector3(5.9, 0, 0.7), width: 9.6, height: 8.4 },
};

export function plotPosition(index: number): [number, number] {
  const col = index % PLOT_COLUMNS;
  const row = Math.floor(index / PLOT_COLUMNS);
  return [FARM_CENTER.x + (col - (PLOT_COLUMNS - 1) / 2) * PLOT_PITCH, FARM_CENTER.z + (1 - row) * PLOT_PITCH];
}

/** Fry start clearly visible and grow to about twice their size. */
function fishSize(ratio: number): number {
  return 0.58 + 0.6 * Math.min(1, Math.max(0, ratio));
}

function pondPoint(x: number, z: number): [number, number] {
  return [POND_CENTER.x + x * POND_RX, POND_CENTER.z + z * POND_RZ];
}

type IconName = "star" | "drop" | "bug" | "lock";

export function createFarmScene(container: HTMLElement, onHit: (hit: SceneHit) => void): FarmSceneController {
  /* ───────────── renderer, camera, lights ───────────── */
  const small = window.innerWidth < 720;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 2 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "Nông trại 3D với 12 ô ruộng, nhà kho và ao cá. Chạm vào ô ruộng, cá hoặc rác để thao tác; các nút bên dưới làm được mọi việc tương tự.",
  );
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color("#cfe8d4");
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 40, 70);

  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 120);
  const cameraTarget = VIEWS.farm.target.clone();
  let viewName: FarmView = "farm";
  let viewHeight = VIEWS.farm.height;
  let aspect = 1;

  scene.add(new THREE.HemisphereLight("#fff8dc", "#5d7f54", 2.0));
  const sun = new THREE.DirectionalLight("#fff1c2", 3.1);
  sun.position.set(-10, 18, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 15, bottom: -15, near: 1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  /* ───────────── shared resources ───────────── */
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Map<string, THREE.Material>();
  const textures: THREE.Texture[] = [];

  function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let value = geometries.get(key);
    if (!value) {
      value = make();
      geometries.set(key, value);
    }
    return value as T;
  }

  function mat(color: string, options: { rough?: number; opacity?: number; emissive?: string } = {}) {
    const key = `${color}|${options.rough ?? 0.86}|${options.opacity ?? 1}|${options.emissive ?? ""}`;
    let value = materials.get(key);
    if (!value) {
      value = new THREE.MeshStandardMaterial({
        color,
        roughness: options.rough ?? 0.86,
        flatShading: true,
        transparent: options.opacity !== undefined,
        opacity: options.opacity ?? 1,
        emissive: options.emissive ?? "#000000",
        emissiveIntensity: options.emissive ? 0.55 : 0,
      });
      materials.set(key, value);
    }
    return value;
  }

  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, shadow = true) {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = shadow;
    item.receiveShadow = true;
    return item;
  }

  const box = (w: number, h: number, d: number) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  const sphere = (r: number, w = 10, h = 8) => geo(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
  const cone = (r: number, h: number, s = 7) => geo(`cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s));
  const cylinder = (rt: number, rb: number, h: number, s = 8) =>
    geo(`cyl:${rt}:${rb}:${h}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

  const iconMaterials = new Map<IconName, THREE.SpriteMaterial>();
  function icon(name: IconName): THREE.Sprite {
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
    sprite.scale.setScalar(0.82);
    sprite.renderOrder = 10;
    sprite.userData.icon = true;
    return sprite;
  }

  /* ───────────── static world ───────────── */
  const world = new THREE.Group();
  scene.add(world);

  const ground = mesh(cylinder(16, 16.8, 1, 12), mat("#89b46a"), false);
  ground.position.y = -0.55;
  world.add(ground);
  const cliff = mesh(cylinder(16.8, 15.4, 2.2, 12), mat("#7b6248"), false);
  cliff.position.y = -2.15;
  world.add(cliff);

  // Farm yard under the plots, with a fence that leaves a gate towards the pond path.
  const yard = mesh(box(8.9, 0.06, 6.7), mat("#a9875a"), false);
  yard.position.set(FARM_CENTER.x, -0.02, FARM_CENTER.z);
  world.add(yard);
  const fenceWood = mat("#b98a55");
  const halfW = 4.75;
  const halfD = 3.65;
  const fenceSegments: [number, number, number, number][] = [
    [-halfW, -halfD, halfW, -halfD],
    [-halfW, halfD, -0.9, halfD],
    [0.9, halfD, halfW, halfD],
    [-halfW, -halfD, -halfW, halfD],
    [halfW, -halfD, halfW, -0.9],
    [halfW, 0.9, halfW, halfD],
  ];
  for (const [x1, z1, x2, z2] of fenceSegments) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const posts = Math.max(2, Math.round(length / 1.15) + 1);
    for (let i = 0; i < posts; i += 1) {
      const t = i / (posts - 1);
      const post = mesh(box(0.14, 0.62, 0.14), fenceWood);
      post.position.set(FARM_CENTER.x + x1 + (x2 - x1) * t, 0.28, FARM_CENTER.z + z1 + (z2 - z1) * t);
      world.add(post);
    }
    for (const y of [0.22, 0.44]) {
      const rail = mesh(box(length, 0.07, 0.06), fenceWood);
      rail.position.set(FARM_CENTER.x + (x1 + x2) / 2, y, FARM_CENTER.z + (z1 + z2) / 2);
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      world.add(rail);
    }
  }

  // Stepping-stone path from the farm gate to the pond.
  for (let i = 0; i < 6; i += 1) {
    const stone = mesh(cylinder(0.32, 0.36, 0.08, 7), mat("#d8d0b8"), false);
    stone.position.set(0.55 + i * 0.62, -0.01, FARM_CENTER.z + 0.15 + Math.sin(i * 1.3) * 0.25);
    stone.rotation.y = i;
    world.add(stone);
  }

  // Barn (opens the storehouse) and market stall (opens the shop).
  const barn = new THREE.Group();
  const barnBody = mesh(box(2.4, 1.6, 1.8), mat("#c4553f"));
  barnBody.position.y = 0.8;
  // A three-sided cylinder turned on its side is a gable roof with the ridge on top.
  const barnRoof = mesh(cylinder(1.02, 1.02, 2.6, 3), mat("#6f4b3a"));
  barnRoof.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  barnRoof.position.y = 2.11;
  const barnDoor = mesh(box(0.9, 1.05, 0.06), mat("#f5e7c8"));
  barnDoor.position.set(0, 0.53, 0.91);
  const barnCross = mesh(box(1.18, 0.08, 0.03), mat("#c4553f"));
  barnCross.position.set(0, 0.53, 0.95);
  barnCross.rotation.z = 0.86;
  barn.add(barnBody, barnRoof, barnDoor, barnCross);
  barn.position.set(-2.1, 0, -4.75);
  barn.rotation.y = -0.18;
  barn.userData.hit = { kind: "barn" } satisfies SceneHit;
  world.add(barn);

  const house = new THREE.Group();
  const houseBody = mesh(box(2, 1.35, 1.6), mat("#f3d99a"));
  houseBody.position.y = 0.68;
  const houseRoof = mesh(cone(1.65, 1.05, 4), mat("#3f7a52"));
  houseRoof.position.y = 1.86;
  houseRoof.rotation.y = Math.PI / 4;
  const houseDoor = mesh(box(0.4, 0.75, 0.05), mat("#6a4a35"));
  houseDoor.position.set(0.35, 0.38, 0.81);
  const houseWindow = mesh(box(0.4, 0.34, 0.05), mat("#bfe3e8", { rough: 0.3 }));
  houseWindow.position.set(-0.45, 0.82, 0.81);
  house.add(houseBody, houseRoof, houseDoor, houseWindow);
  house.position.set(-7.1, 0, -4.9);
  house.rotation.y = 0.12;
  world.add(house);

  // Windmill beside the house; its blades turn in the render loop.
  const windmill = new THREE.Group();
  const tower = mesh(cylinder(0.32, 0.55, 2.6, 6), mat("#efe6d2"));
  tower.position.y = 1.3;
  const cap = mesh(cone(0.48, 0.55, 6), mat("#c4553f"));
  cap.position.y = 2.85;
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const blade = mesh(box(0.18, 1.25, 0.04), mat("#f8f3e6"));
    blade.position.y = 0.62;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  blades.position.set(0, 2.45, 0.42);
  windmill.add(tower, cap, blades);
  windmill.position.set(-9.9, 0, -2.4);
  world.add(windmill);

  const stall = new THREE.Group();
  const counter = mesh(box(1.5, 0.7, 0.75), mat("#c8935a"));
  counter.position.y = 0.35;
  const awning = mesh(box(1.75, 0.08, 1.05), mat("#f2c94c"));
  awning.position.set(0, 1.45, 0.08);
  awning.rotation.x = 0.18;
  const stripe = mesh(box(1.76, 0.09, 0.22), mat("#e2533d"));
  stripe.position.set(0, 1.47, 0.08);
  stripe.rotation.x = 0.18;
  for (const x of [-0.68, 0.68]) {
    const pole = mesh(cylinder(0.04, 0.04, 1.45, 5), mat("#7a5638"));
    pole.position.set(x, 0.72, 0.4);
    stall.add(pole);
  }
  const crate = mesh(box(0.42, 0.28, 0.32), mat("#a26f3f"));
  crate.position.set(-0.35, 0.84, 0);
  const produce = mesh(sphere(0.14, 7, 5), mat("#e2533d"));
  produce.position.set(-0.35, 1.03, 0);
  const produce2 = mesh(sphere(0.12, 7, 5), mat("#f08a2c"));
  produce2.position.set(0.25, 0.82, 0.05);
  stall.add(counter, awning, stripe, crate, produce, produce2);
  stall.position.set(1.6, 0, -3.3);
  stall.rotation.y = -0.4;
  stall.userData.hit = { kind: "shop" } satisfies SceneHit;
  world.add(stall);

  // Pond: dark bed, translucent water, rim stones, reeds, lily pads and a small dock.
  const pondBed = mesh(geo("pond-bed", () => new THREE.CircleGeometry(1, 28)), mat("#2b6764"), false);
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.scale.set(POND_RX + 0.2, POND_RZ + 0.2, 1);
  pondBed.position.set(POND_CENTER.x, -0.035, POND_CENTER.z);
  world.add(pondBed);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: "#67c3b8",
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const water = new THREE.Mesh(geo("pond-water", () => new THREE.CircleGeometry(1, 36)), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(POND_RX + 0.15, POND_RZ + 0.15, 1);
  water.position.set(POND_CENTER.x, WATER_Y, POND_CENTER.z);
  water.userData.hit = { kind: "pond" } satisfies SceneHit;
  water.renderOrder = 2;
  world.add(water);
  const rimRandom = mulberry32(7);
  for (let i = 0; i < 34; i += 1) {
    const angle = (i / 34) * Math.PI * 2;
    const size = 0.22 + rimRandom() * 0.22;
    const stone = mesh(geo(`rim:${i % 4}`, () => new THREE.DodecahedronGeometry(1, 0)), mat(i % 3 ? "#a9ab9b" : "#c3c2b0"));
    stone.scale.set(size * 1.3, size * 0.7, size);
    const [x, z] = pondPoint(Math.cos(angle) * 1.08, Math.sin(angle) * 1.08);
    stone.position.set(x, 0.12, z);
    stone.rotation.set(rimRandom(), rimRandom() * 3, rimRandom());
    world.add(stone);
  }
  for (const [px, pz] of [[-0.95, -0.35], [-0.9, -0.55], [0.85, -0.6], [0.95, -0.4], [0.7, 0.75]]) {
    for (let i = 0; i < 4; i += 1) {
      const reed = mesh(cylinder(0.02, 0.03, 0.75 + i * 0.12, 4), mat("#4f8a3f"));
      const [x, z] = pondPoint(px + i * 0.03, pz + i * 0.025);
      reed.position.set(x, 0.38, z);
      reed.rotation.z = (i - 1.5) * 0.08;
      world.add(reed);
    }
  }
  const lilyPads: THREE.Object3D[] = [];
  for (const [px, pz, s] of [[0.45, -0.55, 1], [0.6, -0.35, 0.7], [-0.55, 0.5, 0.85]]) {
    const pad = mesh(cylinder(0.32 * s, 0.32 * s, 0.03, 9), mat("#5c9d48"), false);
    const [x, z] = pondPoint(px, pz);
    pad.position.set(x, WATER_Y + 0.02, z);
    world.add(pad);
    lilyPads.push(pad);
  }
  const flower = mesh(sphere(0.09, 6, 5), mat("#f6b6c8"));
  const [fx, fz] = pondPoint(0.45, -0.55);
  flower.position.set(fx + 0.05, WATER_Y + 0.09, fz);
  world.add(flower);
  const dock = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const plank = mesh(box(0.34, 0.07, 1.25), mat(i % 2 ? "#a77a4c" : "#b98a55"));
    plank.position.set(i * 0.36, 0.36, 0);
    dock.add(plank);
  }
  for (const [x, z] of [[0, -0.55], [0, 0.55], [1.45, -0.55], [1.45, 0.55]]) {
    const pile = mesh(cylinder(0.06, 0.06, 0.7, 5), mat("#7a5638"));
    pile.position.set(x, 0.05, z);
    dock.add(pile);
  }
  const [dx, dz] = pondPoint(-1.25, 0.55);
  dock.position.set(dx, 0, dz);
  dock.rotation.y = -0.5;
  world.add(dock);

  // Trees around the island edge, mountains behind, drifting clouds.
  const swaying: THREE.Object3D[] = [];
  function addTree(x: number, z: number, scale: number, round: boolean) {
    const tree = new THREE.Group();
    const trunk = mesh(cylinder(0.12, 0.18, 0.95, 6), mat("#7a5638"));
    trunk.position.y = 0.47;
    tree.add(trunk);
    if (round) {
      const crown = mesh(geo("tree-round", () => new THREE.IcosahedronGeometry(0.75, 0)), mat("#5e9e4a"));
      crown.position.y = 1.35;
      tree.add(crown);
    } else {
      const lower = mesh(cone(0.75, 1.25, 7), mat("#2f7048"));
      lower.position.y = 1.25;
      const upper = mesh(cone(0.52, 0.95, 7), mat("#3a8255"));
      upper.position.y = 1.85;
      tree.add(lower, upper);
    }
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    world.add(tree);
    swaying.push(tree);
  }
  const treeSpots: [number, number, number, boolean][] = [
    [-11.5, -5.5, 1.1, false], [-12.6, -2.6, 0.95, true], [-12.2, 1.8, 1.05, false], [-11.6, 5.4, 0.9, true],
    [-8.5, 7.6, 1, false], [-4.2, -7.6, 1.15, false], [-0.6, -7.2, 0.95, true], [2.6, -6.6, 1.1, false],
    [5.5, -5.6, 0.9, true], [9.2, -5.2, 1.15, false], [11.8, -2.2, 1, true], [12.4, 2.4, 1.1, false],
    [10.9, 5.9, 0.95, true], [6.2, 7.3, 1.05, false], [1.8, 6.4, 0.9, true], [-2.4, 7.4, 1, false],
  ];
  treeSpots.forEach(([x, z, s, round]) => addTree(x, z, s, round));
  for (const [x, z, s] of [[-6, -12, 3.4], [-1, -13, 4.4], [4.5, -12.5, 3.6], [9.5, -11.5, 2.8]]) {
    const mountain = mesh(cone(s, s * 1.6, 6), mat("#7f9a78"), false);
    mountain.position.set(x, s * 0.7 - 0.6, z);
    world.add(mountain);
    const snow = mesh(cone(s * 0.32, s * 0.5, 6), mat("#f5f1e3"), false);
    snow.position.set(x, s * 0.7 - 0.6 + s * 0.56, z);
    world.add(snow);
  }
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 4; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(sphere(0.75 + j * 0.12, 9, 7), new THREE.MeshBasicMaterial({ color: "#fffdf2", transparent: true, opacity: 0.85 }));
      puff.position.set(j * 0.85, j === 1 ? 0.25 : 0, 0);
      cloud.add(puff);
    }
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
    group.userData.hit = { kind: "plot", index } satisfies SceneHit;
    const random = mulberry32(index * 97 + 13);

    // Invisible, slightly larger hit area so taps between rows still land on a plot.
    const hit = new THREE.Mesh(box(PLOT_PITCH * 0.98, 0.5, PLOT_PITCH * 0.98), hiddenMaterial);
    hit.position.y = 0.2;
    group.add(hit);

    let iconSprite: THREE.Sprite | null = null;
    if (plot.status === "locked") {
      const turf = mesh(box(PLOT_SIZE, 0.14, PLOT_SIZE), mat("#9cc27a"), false);
      turf.position.y = 0.03;
      group.add(turf);
      const post = mesh(box(0.08, 0.6, 0.08), mat("#7a5638"));
      post.position.set(0, 0.35, 0);
      const board = mesh(box(0.62, 0.36, 0.06), mat("#d9b27a"));
      board.position.set(0, 0.62, 0.02);
      group.add(post, board);
      iconSprite = icon("lock");
      iconSprite.scale.setScalar(0.55);
      iconSprite.position.set(0, 1.12, 0);
      group.add(iconSprite);
      return { group, icon: iconSprite };
    }

    const soilColor = plot.status === "wild" ? "#8d7048" : plot.thirsty ? "#a9845c" : plot.status === "withered" ? "#7a573b" : "#6b4630";
    const soil = mesh(box(PLOT_SIZE, 0.22, PLOT_SIZE), mat(soilColor), false);
    soil.position.y = 0.06;
    group.add(soil);

    if (plot.status === "wild") {
      for (let i = 0; i < 7; i += 1) {
        const tuft = mesh(cone(0.12, 0.34, 4), mat(i % 2 ? "#6fa24f" : "#88b65d"));
        tuft.position.set((random() - 0.5) * 1.4, 0.32, (random() - 0.5) * 1.4);
        tuft.rotation.z = (random() - 0.5) * 0.5;
        group.add(tuft);
      }
      for (let i = 0; i < 3; i += 1) {
        const pebble = mesh(geo("pebble", () => new THREE.DodecahedronGeometry(0.1, 0)), mat("#b7b19c"));
        pebble.position.set((random() - 0.5) * 1.3, 0.2, (random() - 0.5) * 1.3);
        group.add(pebble);
      }
      return { group, icon: null };
    }

    const ridgeColor = plot.thirsty ? "#987351" : "#5c3b28";
    for (let row = -1; row <= 1; row += 1) {
      const ridge = mesh(box(PLOT_SIZE * 0.9, 0.07, 0.2), mat(ridgeColor), false);
      ridge.position.set(0, 0.2, row * 0.5);
      group.add(ridge);
    }

    if (plot.status === "withered") {
      for (let i = 0; i < 8; i += 1) {
        const stalk = mesh(cylinder(0.02, 0.03, 0.42, 4), mat("#a47d4e"));
        stalk.position.set((random() - 0.5) * 1.3, 0.38, (random() - 0.5) * 1.3);
        stalk.rotation.set((random() - 0.5) * 0.9, 0, (random() - 0.5) * 0.9);
        group.add(stalk);
      }
      return { group, icon: null };
    }

    if (plot.status === "growing" && plot.crop) {
      const stage = cropStage(plot);
      const spots: [number, number][] = [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]];
      spots.forEach(([px, pz], plantIndex) => {
        const plantNode = buildPlant(plot.crop as CropId, stage, mulberry32(index * 31 + plantIndex));
        plantNode.position.set(px + (random() - 0.5) * 0.08, 0.2, pz + (random() - 0.5) * 0.08);
        plantNode.rotation.y = random() * Math.PI * 2;
        group.add(plantNode);
      });
      for (let i = 0; i < plot.weeds; i += 1) {
        const clump = new THREE.Group();
        for (let j = 0; j < 4; j += 1) {
          const blade = mesh(cone(0.06, 0.38, 3), mat("#3f6b2c"));
          blade.position.set((j - 1.5) * 0.06, 0.18, (j % 2) * 0.05);
          blade.rotation.z = (j - 1.5) * 0.25;
          clump.add(blade);
        }
        clump.position.set(i === 0 ? -0.72 : 0.7, 0.2, i === 0 ? 0.05 : -0.1);
        group.add(clump);
      }
      if (plot.bugs > 0) {
        for (let i = 0; i < plot.bugs; i += 1) {
          const beetle = mesh(sphere(0.08, 7, 5), mat("#c8382c"));
          beetle.scale.set(1, 0.6, 1.2);
          beetle.position.set(i === 0 ? 0.08 : -0.15, stage >= 2 ? 0.62 : 0.32, i === 0 ? 0.05 : -0.22);
          group.add(beetle);
        }
      }
      const iconName: IconName | null = isRipe(plot) ? "star" : plot.bugs > 0 ? "bug" : plot.thirsty ? "drop" : null;
      if (iconName) {
        iconSprite = icon(iconName);
        iconSprite.position.set(0, 1.55, 0);
        group.add(iconSprite);
      }
    }
    return { group, icon: iconSprite };
  }

  function buildPlant(crop: CropId, stage: 0 | 1 | 2 | 3, random: () => number): THREE.Group {
    const plant = new THREE.Group();
    const leaf = mat("#4f9a3d");
    const leafLight = mat("#7fc35a");
    if (stage === 0) {
      const mound = mesh(sphere(0.12, 6, 4), mat("#5a3a26"), false);
      mound.scale.y = 0.45;
      const seed = mesh(sphere(0.035, 5, 4), mat("#e9d9a6"), false);
      seed.position.y = 0.05;
      plant.add(mound, seed);
      return plant;
    }
    if (stage === 1) {
      for (const side of [-1, 1]) {
        const sprout = mesh(sphere(0.08, 6, 4), leafLight);
        sprout.scale.set(1.5, 0.35, 0.8);
        sprout.position.set(side * 0.07, 0.12, 0);
        sprout.rotation.z = side * 0.4;
        plant.add(sprout);
      }
      const stem = mesh(cylinder(0.015, 0.02, 0.12, 4), leaf);
      stem.position.y = 0.06;
      plant.add(stem);
      return plant;
    }
    const ripe = stage === 3;
    switch (crop) {
      case "cabbage": {
        const head = mesh(sphere(ripe ? 0.27 : 0.18, 8, 6), mat(ripe ? "#a5d877" : "#77b75a"));
        head.scale.y = 0.75;
        head.position.y = ripe ? 0.17 : 0.12;
        plant.add(head);
        for (let i = 0; i < 4; i += 1) {
          const outer = mesh(sphere(0.16, 6, 4), mat("#4e9a3e"));
          outer.scale.set(1.4, 0.35, 0.9);
          const a = (i / 4) * Math.PI * 2;
          outer.position.set(Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16);
          outer.rotation.y = -a;
          plant.add(outer);
        }
        break;
      }
      case "carrot": {
        for (let i = 0; i < 3; i += 1) {
          const top = mesh(cone(0.05, ripe ? 0.5 : 0.36, 4), leaf);
          top.position.set((i - 1) * 0.06, ripe ? 0.32 : 0.22, 0);
          top.rotation.z = (i - 1) * 0.3;
          plant.add(top);
        }
        if (ripe) {
          const root = mesh(cone(0.1, 0.24, 6), mat("#f08a2c"));
          root.rotation.x = Math.PI;
          root.position.y = 0.05;
          plant.add(root);
        }
        break;
      }
      case "tomato": {
        const stake = mesh(cylinder(0.015, 0.015, 0.85, 4), mat("#b98a55"));
        stake.position.set(0.12, 0.42, 0);
        const bush = mesh(geo("bush", () => new THREE.IcosahedronGeometry(0.26, 0)), leaf);
        bush.position.y = ripe ? 0.4 : 0.3;
        bush.scale.setScalar(ripe ? 1 : 0.8);
        plant.add(stake, bush);
        const fruitCount = ripe ? 5 : 2;
        for (let i = 0; i < fruitCount; i += 1) {
          const a = random() * Math.PI * 2;
          const fruit = mesh(sphere(ripe ? 0.085 : 0.06, 7, 5), mat(ripe ? "#e2483a" : "#9acb63"));
          fruit.position.set(Math.cos(a) * 0.24, 0.3 + random() * 0.2, Math.sin(a) * 0.24);
          plant.add(fruit);
        }
        break;
      }
      case "corn": {
        const height = ripe ? 1.05 : 0.65;
        const stalk = mesh(cylinder(0.035, 0.05, height, 5), mat("#6aa84a"));
        stalk.position.y = height / 2;
        plant.add(stalk);
        for (let i = 0; i < 3; i += 1) {
          const blade = mesh(box(0.05, 0.02, 0.42), leafLight);
          blade.position.set(0, 0.25 + i * 0.22, 0.15);
          blade.rotation.set(-0.5, (i * 2.1) % 6, 0);
          plant.add(blade);
        }
        if (ripe) {
          const cob = mesh(cylinder(0.06, 0.075, 0.28, 7), mat("#f4cf45"));
          cob.position.set(0.09, 0.62, 0);
          cob.rotation.z = -0.3;
          const husk = mesh(cone(0.07, 0.2, 5), mat("#a6c96a"));
          husk.position.set(0.14, 0.43, 0);
          husk.rotation.z = Math.PI - 0.3;
          const tassel = mesh(cone(0.05, 0.18, 4), mat("#d8b36a"));
          tassel.position.y = height + 0.06;
          plant.add(cob, husk, tassel);
        }
        break;
      }
      case "rice": {
        const color = ripe ? "#e2bf4f" : "#79b354";
        for (let i = 0; i < 6; i += 1) {
          const height = (ripe ? 0.62 : 0.45) + random() * 0.08;
          const stem = mesh(cylinder(0.012, 0.018, height, 3), mat(color));
          const a = (i / 6) * Math.PI * 2;
          stem.position.set(Math.cos(a) * 0.06, height / 2, Math.sin(a) * 0.06);
          stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
          plant.add(stem);
          if (ripe) {
            const grain = mesh(sphere(0.04, 5, 4), mat("#f1d36b"));
            grain.scale.set(0.7, 1.8, 0.7);
            grain.position.set(Math.cos(a) * 0.2, height - 0.02, Math.sin(a) * 0.2);
            plant.add(grain);
          }
        }
        break;
      }
      case "strawberry": {
        for (let i = 0; i < 3; i += 1) {
          const leafNode = mesh(sphere(0.13, 6, 4), mat("#3f8a3a"));
          leafNode.scale.set(1.2, 0.4, 1);
          const a = (i / 3) * Math.PI * 2;
          leafNode.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
          plant.add(leafNode);
        }
        const berries = ripe ? 4 : 2;
        for (let i = 0; i < berries; i += 1) {
          const berry = mesh(cone(0.06, 0.12, 6), mat(ripe ? "#df3646" : "#e8f0c9"));
          berry.rotation.x = Math.PI;
          const a = random() * Math.PI * 2;
          berry.position.set(Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2);
          plant.add(berry);
        }
        break;
      }
      case "pumpkin":
      case "watermelon": {
        for (let i = 0; i < 3; i += 1) {
          const leafNode = mesh(geo("vine-leaf", () => new THREE.DodecahedronGeometry(0.15, 0)), leaf);
          leafNode.scale.set(1.3, 0.35, 1.1);
          const a = (i / 3) * Math.PI * 2 + 0.6;
          leafNode.position.set(Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22);
          plant.add(leafNode);
        }
        const isPumpkin = crop === "pumpkin";
        const size = ripe ? 0.25 : 0.12;
        const fruit = mesh(sphere(size, 10, 7), mat(isPumpkin ? (ripe ? "#ef8a2a" : "#b9c25a") : ripe ? "#3d7c3a" : "#8fbf62"));
        fruit.scale.set(isPumpkin ? 1.1 : 1.25, isPumpkin ? 0.75 : 0.85, isPumpkin ? 1.1 : 0.9);
        fruit.position.y = size * 0.7;
        plant.add(fruit);
        if (ripe && isPumpkin) {
          const stem = mesh(cylinder(0.025, 0.035, 0.12, 5), mat("#6b8a3a"));
          stem.position.y = size * 1.4;
          plant.add(stem);
        }
        if (ripe && !isPumpkin) {
          const stripe = mesh(sphere(size * 1.01, 10, 7), mat("#5f9d4f", { opacity: 0.55 }));
          stripe.scale.set(1.27, 0.5, 0.92);
          stripe.position.y = size * 0.7;
          plant.add(stripe);
        }
        break;
      }
      case "sunflower": {
        const height = ripe ? 1.15 : 0.7;
        const stem = mesh(cylinder(0.03, 0.045, height, 5), mat("#5d9a3f"));
        stem.position.y = height / 2;
        plant.add(stem);
        for (const side of [-1, 1]) {
          const leafNode = mesh(sphere(0.11, 6, 4), leafLight);
          leafNode.scale.set(1.6, 0.3, 0.9);
          leafNode.position.set(side * 0.13, height * 0.45, 0);
          plant.add(leafNode);
        }
        const head = new THREE.Group();
        const petals = mesh(cylinder(ripe ? 0.24 : 0.12, ripe ? 0.24 : 0.12, 0.04, 10), mat(ripe ? "#f6c629" : "#a7cf6b"));
        petals.rotation.x = Math.PI / 2;
        head.add(petals);
        if (ripe) {
          const center = mesh(cylinder(0.12, 0.12, 0.06, 10), mat("#6b3f22"));
          center.rotation.x = Math.PI / 2;
          center.position.z = 0.02;
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

  /* ───────────── fish & litter ───────────── */
  interface FishView {
    group: THREE.Group;
    tail: THREE.Group;
    star: THREE.Sprite;
    phase: number;
    params: { ax: number; az: number; w1: number; w2: number; p1: number; p2: number; depth: number };
    scale: number;
    targetScale: number;
    mature: boolean;
  }
  const fishViews = new Map<string, FishView>();
  const trashViews = new Map<string, THREE.Group>();
  let hungry = false;

  function buildFish(fish: PondFish): FishView {
    const def = FISH_MAP[fish.species];
    const random = mulberry32(hashString(fish.id));
    const group = new THREE.Group();
    group.userData.hit = { kind: "fish", id: fish.id } satisfies SceneHit;
    const body = mesh(sphere(0.5, 12, 8), mat(def.color, { rough: 0.55 }), false);
    const round = fish.species === "puffer";
    body.scale.set(1, round ? 0.7 : 0.44, round ? 0.66 : 0.36);
    group.add(body);
    const tail = new THREE.Group();
    const fin = mesh(cone(0.26, 0.38, 4), mat(def.accent, { rough: 0.55 }), false);
    fin.rotation.z = Math.PI / 2;
    fin.scale.z = 0.35;
    fin.position.x = -0.17;
    tail.add(fin);
    tail.position.x = -0.46;
    group.add(tail);
    const dorsal = mesh(cone(0.12, 0.26, 4), mat(def.accent, { rough: 0.55 }), false);
    dorsal.scale.z = 0.3;
    dorsal.position.set(-0.05, round ? 0.33 : 0.22, 0);
    dorsal.rotation.z = 0.5;
    group.add(dorsal);
    if (fish.species === "koi" || fish.species === "goldfish") {
      for (const [x, s] of [[0.15, 0.17], [-0.18, 0.13]]) {
        const patch = mesh(sphere(s, 7, 5), mat(fish.species === "koi" ? def.accent : "#ffd29a", { rough: 0.55 }), false);
        patch.scale.set(1.2, 0.4, 0.9);
        patch.position.set(x, 0.15, 0);
        group.add(patch);
      }
    }
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(0.045, 6, 4), mat("#1d2420"), false);
      eye.position.set(0.32, 0.06, side * (round ? 0.3 : 0.15));
      group.add(eye);
    }
    // Generous invisible hit sphere: fish are small targets on a phone.
    const hitSphere = new THREE.Mesh(sphere(0.75, 8, 6), hiddenMaterial);
    group.add(hitSphere);
    const star = icon("star");
    star.scale.setScalar(0.62);
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
      params: {
        ax: 0.5 + random() * 0.28,
        az: 0.45 + random() * 0.25,
        w1: 0.16 + random() * 0.12,
        w2: 0.21 + random() * 0.16,
        p1: random() * 6.28,
        p2: random() * 6.28,
        depth: -0.02 + random() * 0.04,
      },
      scale: size,
      targetScale: size,
      mature: false,
    };
  }

  function buildTrash(item: PondTrash): THREE.Group {
    const group = new THREE.Group();
    group.userData.hit = { kind: "trash", id: item.id } satisfies SceneHit;
    if (item.kind === "leaf") {
      const leafNode = mesh(sphere(0.2, 6, 4), mat("#a0703a"), false);
      leafNode.scale.set(1.4, 0.15, 0.8);
      group.add(leafNode);
    } else if (item.kind === "bottle") {
      const bottle = mesh(cylinder(0.08, 0.08, 0.36, 7), mat("#a9dbe8", { rough: 0.2, opacity: 0.85 }), false);
      bottle.rotation.z = Math.PI / 2;
      const neck = mesh(cylinder(0.035, 0.05, 0.1, 6), mat("#a9dbe8", { rough: 0.2, opacity: 0.85 }), false);
      neck.rotation.z = Math.PI / 2;
      neck.position.x = 0.22;
      group.add(bottle, neck);
    } else {
      const can = mesh(cylinder(0.08, 0.08, 0.2, 8), mat("#c94a3a", { rough: 0.4 }), false);
      can.rotation.x = Math.PI / 2;
      group.add(can);
    }
    const hitSphere = new THREE.Mesh(sphere(0.5, 8, 6), hiddenMaterial);
    group.add(hitSphere);
    const [x, z] = pondPoint(item.x, item.z);
    group.position.set(x, WATER_Y + 0.02, z);
    group.rotation.y = hashString(item.id) % 6;
    world.add(group);
    return group;
  }

  function disposeObject(object: THREE.Object3D) {
    object.removeFromParent();
  }

  /* ───────────── selection marker ───────────── */
  const selector = new THREE.Group();
  const selectorMaterial = mat("#fff2a8", { emissive: "#ffe066" });
  for (const [x, z, w, d] of [[0, -0.98, 2.04, 0.1], [0, 0.98, 2.04, 0.1], [-0.98, 0, 0.1, 2.04], [0.98, 0, 0.1, 2.04]]) {
    const bar = mesh(box(w, 0.08, d), selectorMaterial, false);
    bar.position.set(x, 0.24, z);
    selector.add(bar);
  }
  selector.visible = false;
  world.add(selector);

  /* ───────────── state sync ───────────── */
  function update(game: GameState) {
    const now = clock.getElapsedTime();
    game.plots.forEach((plot, index) => {
      const key = plotKey(plot);
      const current = plotViews[index];
      if (current && current.key === key) return;
      if (current) disposeObject(current.group);
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
      disposeObject(view.group);
      disposeObject(view.star);
      fishViews.delete(id);
    }

    const trashIds = new Set(game.pond.trash.map((item) => item.id));
    for (const item of game.pond.trash) if (!trashViews.has(item.id)) trashViews.set(item.id, buildTrash(item));
    for (const [id, group] of trashViews) {
      if (trashIds.has(id)) continue;
      disposeObject(group);
      trashViews.delete(id);
    }
    hungry = game.pond.fish.length > 0 && game.pond.fedUntil <= game.lastTick;
    waterMaterial.color.set(game.pond.trash.length >= 4 ? "#8fb79a" : game.pond.trash.length >= 2 ? "#79bfa9" : "#67c3b8");
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
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(world.children, true);
    let fallback: SceneHit | null = null;
    for (const intersection of hits) {
      if (intersection.object.userData.icon) continue;
      const hit = findHit(intersection.object);
      if (!hit) continue;
      if (hit.kind === "fish" || hit.kind === "trash") return hit;
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
    if (hit) onHit(hit);
  }
  function onPointerCancel() {
    down = null;
  }
  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
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
  let visible = true;

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

  function render(time: number) {
    frame = window.requestAnimationFrame(render);
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    if (!visible || document.hidden) return;
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
    swaying.forEach((tree, index) => {
      tree.rotation.z = Math.sin(elapsed * 0.9 + index) * 0.03 * motion;
    });
    lilyPads.forEach((pad, index) => {
      pad.rotation.y = Math.sin(elapsed * 0.3 + index) * 0.2 * motion;
    });
    waterMaterial.opacity = 0.4 + Math.sin(elapsed * 1.6) * 0.04 * motion;

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

    renderer.render(scene, camera);
  }
  frame = window.requestAnimationFrame(render);

  return {
    update,
    setView,
    setSelectedPlot,
    dispose() {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((item: THREE.Material) => item.dispose());
        }
      });
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      iconMaterials.forEach((item) => item.dispose());
      textures.forEach((item) => item.dispose());
      hiddenMaterial.dispose();
      waterMaterial.dispose();
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
