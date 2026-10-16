/**
 * Learning Farm game engine: pure data + state transitions, no React, no DOM, no three.js.
 *
 * Time is real wall-clock time. Every transition takes `now` (ms) and, where randomness is
 * involved, a numeric seed, so the same inputs always produce the same state (React may run a
 * reducer twice in development).
 */

export type CropId =
  | "cabbage"
  | "carrot"
  | "tomato"
  | "corn"
  | "rice"
  | "strawberry"
  | "pumpkin"
  | "sunflower"
  | "watermelon";

export type FishId = "tilapia" | "carp" | "puffer" | "goldfish" | "koi" | "sturgeon";

export interface CropDef {
  id: CropId;
  name: string;
  emoji: string;
  level: number;
  seedPrice: number;
  growSeconds: number;
  yield: number;
  sellPrice: number;
  xp: number;
}

export interface FishDef {
  id: FishId;
  name: string;
  emoji: string;
  level: number;
  fryPrice: number;
  growSeconds: number;
  sellPrice: number;
  xp: number;
  color: string;
  accent: string;
}

export const CROPS: CropDef[] = [
  { id: "cabbage", name: "Rau cải", emoji: "🥬", level: 1, seedPrice: 4, growSeconds: 60, yield: 4, sellPrice: 2, xp: 2 },
  { id: "carrot", name: "Cà rốt", emoji: "🥕", level: 1, seedPrice: 10, growSeconds: 180, yield: 5, sellPrice: 4, xp: 4 },
  { id: "tomato", name: "Cà chua", emoji: "🍅", level: 2, seedPrice: 18, growSeconds: 360, yield: 6, sellPrice: 6, xp: 7 },
  { id: "corn", name: "Ngô", emoji: "🌽", level: 3, seedPrice: 26, growSeconds: 600, yield: 6, sellPrice: 9, xp: 10 },
  { id: "rice", name: "Lúa", emoji: "🌾", level: 4, seedPrice: 32, growSeconds: 900, yield: 8, sellPrice: 8, xp: 13 },
  { id: "strawberry", name: "Dâu tây", emoji: "🍓", level: 5, seedPrice: 45, growSeconds: 1500, yield: 8, sellPrice: 11, xp: 18 },
  { id: "pumpkin", name: "Bí ngô", emoji: "🎃", level: 6, seedPrice: 60, growSeconds: 2400, yield: 4, sellPrice: 32, xp: 24 },
  { id: "sunflower", name: "Hướng dương", emoji: "🌻", level: 7, seedPrice: 80, growSeconds: 3600, yield: 6, sellPrice: 27, xp: 32 },
  { id: "watermelon", name: "Dưa hấu", emoji: "🍉", level: 8, seedPrice: 120, growSeconds: 7200, yield: 4, sellPrice: 62, xp: 50 },
];

export const FISHES: FishDef[] = [
  { id: "tilapia", name: "Cá rô phi", emoji: "🐟", level: 1, fryPrice: 15, growSeconds: 300, sellPrice: 36, xp: 5, color: "#8fa6ad", accent: "#55707a" },
  { id: "carp", name: "Cá chép", emoji: "🎏", level: 2, fryPrice: 30, growSeconds: 720, sellPrice: 72, xp: 10, color: "#d99a3e", accent: "#b25a2a" },
  { id: "puffer", name: "Cá nóc", emoji: "🐡", level: 3, fryPrice: 45, growSeconds: 1200, sellPrice: 108, xp: 14, color: "#e9d57c", accent: "#7d8c4b" },
  { id: "goldfish", name: "Cá vàng", emoji: "🐠", level: 4, fryPrice: 60, growSeconds: 1800, sellPrice: 145, xp: 18, color: "#f28d34", accent: "#fff0d2" },
  { id: "koi", name: "Cá koi", emoji: "🐟", level: 6, fryPrice: 120, growSeconds: 3600, sellPrice: 300, xp: 34, color: "#fbf5ea", accent: "#df432d" },
  { id: "sturgeon", name: "Cá tầm", emoji: "🦈", level: 8, fryPrice: 250, growSeconds: 7200, sellPrice: 620, xp: 68, color: "#5b6a7e", accent: "#cdd5de" },
];

export type AnimalId = "chicken" | "duck" | "sheep" | "cow";
export type ProductId = "egg" | "duckEgg" | "wool" | "milk";
export type WorkshopId = "saltery" | "bakery" | "loom" | "dairy";
export type GoodId = "saltedEgg" | "cake" | "scarf" | "cheese";

export interface AnimalDef {
  id: AnimalId;
  name: string;
  emoji: string;
  level: number;
  price: number;
  product: ProductId;
  cycleSeconds: number;
  xp: number;
  color: string;
  accent: string;
}

export interface ProductDef {
  id: ProductId | GoodId;
  name: string;
  emoji: string;
  sellPrice: number;
}

export interface WorkshopDef {
  id: WorkshopId;
  name: string;
  level: number;
  buildCost: number;
  inputs: { products?: Partial<Record<ProductId, number>>; crops?: Partial<Record<CropId, number>> };
  output: GoodId;
  seconds: number;
  xp: number;
  roof: string;
}

export const ANIMALS: AnimalDef[] = [
  { id: "chicken", name: "Gà", emoji: "🐔", level: 1, price: 60, product: "egg", cycleSeconds: 90, xp: 2, color: "#fbf6ec", accent: "#d8432f" },
  { id: "duck", name: "Vịt", emoji: "🦆", level: 2, price: 90, product: "duckEgg", cycleSeconds: 150, xp: 3, color: "#f6f1e3", accent: "#f0a030" },
  { id: "sheep", name: "Cừu", emoji: "🐑", level: 4, price: 220, product: "wool", cycleSeconds: 360, xp: 6, color: "#f4f1ea", accent: "#3d3a36" },
  { id: "cow", name: "Bò", emoji: "🐄", level: 5, price: 320, product: "milk", cycleSeconds: 480, xp: 8, color: "#fbfaf6", accent: "#2f2b28" },
];

export const PRODUCTS: (ProductDef & { id: ProductId })[] = [
  { id: "egg", name: "Trứng gà", emoji: "🥚", sellPrice: 6 },
  { id: "duckEgg", name: "Trứng vịt", emoji: "🥚", sellPrice: 9 },
  { id: "wool", name: "Len cừu", emoji: "🧶", sellPrice: 22 },
  { id: "milk", name: "Sữa bò", emoji: "🥛", sellPrice: 30 },
];

export const GOODS: (ProductDef & { id: GoodId })[] = [
  { id: "saltedEgg", name: "Hũ trứng muối", emoji: "🏺", sellPrice: 42 },
  { id: "cake", name: "Bánh bông lan", emoji: "🍰", sellPrice: 40 },
  { id: "scarf", name: "Khăn len", emoji: "🧣", sellPrice: 70 },
  { id: "cheese", name: "Phô mai", emoji: "🧀", sellPrice: 85 },
];

export const WORKSHOPS: WorkshopDef[] = [
  { id: "saltery", name: "Lò trứng muối", level: 3, buildCost: 150, inputs: { products: { duckEgg: 3 } }, output: "saltedEgg", seconds: 150, xp: 8, roof: "#5d8a9b" },
  { id: "bakery", name: "Lò bánh", level: 4, buildCost: 200, inputs: { products: { egg: 2 }, crops: { rice: 1 } }, output: "cake", seconds: 120, xp: 7, roof: "#d9774a" },
  { id: "loom", name: "Xưởng dệt", level: 5, buildCost: 280, inputs: { products: { wool: 2 } }, output: "scarf", seconds: 200, xp: 10, roof: "#8a6bb5" },
  { id: "dairy", name: "Xưởng phô mai", level: 6, buildCost: 350, inputs: { products: { milk: 2 } }, output: "cheese", seconds: 240, xp: 12, roof: "#e3b53c" },
];

/** Feed bags the mill makes from one unit of each crop. Grains make the most. */
export const MILL_YIELD: Record<CropId, number> = {
  cabbage: 1,
  carrot: 1,
  tomato: 1,
  corn: 3,
  rice: 3,
  strawberry: 1,
  pumpkin: 4,
  sunflower: 3,
  watermelon: 4,
};

export const ANIMAL_MAP = Object.fromEntries(ANIMALS.map((item) => [item.id, item])) as Record<AnimalId, AnimalDef>;
export const PRODUCT_MAP = Object.fromEntries(PRODUCTS.map((item) => [item.id, item])) as Record<ProductId, ProductDef>;
export const GOOD_MAP = Object.fromEntries(GOODS.map((item) => [item.id, item])) as Record<GoodId, ProductDef>;
export const WORKSHOP_MAP = Object.fromEntries(WORKSHOPS.map((item) => [item.id, item])) as Record<WorkshopId, WorkshopDef>;

export const CROP_MAP = Object.fromEntries(CROPS.map((crop) => [crop.id, crop])) as Record<CropId, CropDef>;
export const FISH_MAP = Object.fromEntries(FISHES.map((fish) => [fish.id, fish])) as Record<FishId, FishDef>;

export const ITEMS = {
  fertilizer: { name: "Phân bón", emoji: "✨", price: 25, note: "Rút ngắn 30% thời gian còn lại của một vụ (mỗi vụ một lần)." },
  fishFood: { name: "Cám cá", emoji: "🍞", price: 8, note: "Một lần cho ăn giữ cả ao no trong 20 phút." },
  feed: { name: "Thức ăn gia súc", emoji: "🥣", price: 3, note: "Vật nuôi tự ăn từ máng: mỗi phần đổi lấy một lượt ra sản phẩm. Xay từ nông sản thì rẻ hơn." },
} as const;
export type ItemId = keyof typeof ITEMS;

export const PLOT_COUNT = 12;
export const PLOT_COLUMNS = 4;
export const STARTING_PLOTS = 6;
/** Cost and level to unlock the 7th, 8th … 12th plot, in that order. */
export const PLOT_UNLOCKS = [
  { cost: 60, level: 2 },
  { cost: 100, level: 2 },
  { cost: 160, level: 3 },
  { cost: 240, level: 4 },
  { cost: 340, level: 5 },
  { cost: 480, level: 6 },
];
export const POND_CAPACITIES = [4, 6, 8, 10, 12];
/** Cost and level to move from capacity index i to i + 1. */
export const POND_UPGRADES = [
  { cost: 120, level: 2 },
  { cost: 260, level: 4 },
  { cost: 450, level: 6 },
  { cost: 700, level: 8 },
];

export const RANCH_CAPACITIES = [4, 6, 8, 10];
/** Cost and level to move the pasture from capacity index i to i + 1. */
export const RANCH_UPGRADES = [
  { cost: 150, level: 3 },
  { cost: 300, level: 5 },
  { cost: 500, level: 7 },
];
export const MAX_DROPS = 24;
export const TRUCK = { capacity: 20, tripSeconds: 90, bonus: 1.2 };

export const FEED_DURATION_MS = 20 * 60 * 1000;
export const HUNGRY_GROWTH = 0.35;
export const THIRSTY_GROWTH = 0.5;
export const MAX_TRASH = 6;
export const FEATURED_BONUS = 1.25;
const MAX_OFFLINE_MS = 14 * 24 * 60 * 60 * 1000;

export type PlotStatus = "locked" | "wild" | "tilled" | "growing" | "withered";

export interface Plot {
  status: PlotStatus;
  crop: CropId | null;
  /** Seconds of effective growth accumulated (thirst slows it down). */
  growth: number;
  thirsty: boolean;
  weeds: number;
  bugs: number;
  fertilized: boolean;
}

export interface PondFish {
  id: string;
  species: FishId;
  growth: number;
}

export type TrashKind = "leaf" | "bottle" | "can";
export interface PondTrash {
  id: string;
  kind: TrashKind;
  /** Position inside the pond ellipse, both in -1..1. */
  x: number;
  z: number;
}

export interface RanchAnimal {
  id: string;
  species: AnimalId;
  /** Seconds into the current production cycle; only advances while `fed`. */
  progress: number;
  fed: boolean;
}

export interface RanchDrop {
  id: string;
  product: ProductId;
  /** Position inside the pasture, both in -1..1. */
  x: number;
  z: number;
}

export interface WorkshopState {
  /** Seconds into the running batch, or null when idle. */
  progress: number | null;
  ready: number;
}

export interface TruckTrip {
  departAt: number;
  returnAt: number;
  value: number;
  items: number;
}

export type GoodsKind = "crop" | "fish" | "product" | "good";

export interface GameState {
  version: 1;
  createdAt: number;
  lastTick: number;
  coins: number;
  xp: number;
  plots: Plot[];
  pond: {
    capacityLevel: number;
    fedUntil: number;
    fish: PondFish[];
    trash: PondTrash[];
  };
  ranch: {
    capacityLevel: number;
    animals: RanchAnimal[];
    drops: RanchDrop[];
    workshops: Partial<Record<WorkshopId, WorkshopState>>;
    truck: TruckTrip | null;
  };
  seeds: Partial<Record<CropId, number>>;
  items: Record<ItemId, number>;
  barn: {
    crops: Partial<Record<CropId, number>>;
    fish: Partial<Record<FishId, number>>;
    products: Partial<Record<ProductId, number>>;
    goods: Partial<Record<GoodId, number>>;
  };
  lastDailyBonus: string | null;
  lastStudyReward: string | null;
  stats: { harvested: number; fishCaught: number; earned: number };
  nextId: number;
}

export type Tone = "good" | "warn" | "info";
export interface ActionResult {
  game: GameState;
  ok: boolean;
  message: string;
  tone: Tone;
}

/* ───────────────────────── helpers ───────────────────────── */

const VN_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) in Vietnam time — used for daily rewards and daily prices. */
export function dateKeyVN(ms: number): string {
  return VN_DATE.format(new Date(ms));
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Total XP needed to reach `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  return 25 * (level - 1) * level;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return { level, into: xp - floor, needed: ceiling - floor, ratio: (xp - floor) / (ceiling - floor) };
}

export function isRipe(plot: Plot): boolean {
  return plot.status === "growing" && plot.crop !== null && plot.growth >= CROP_MAP[plot.crop].growSeconds;
}

/** 0 = just sown, 1 = sprout, 2 = growing, 3 = ripe. */
export function cropStage(plot: Plot): 0 | 1 | 2 | 3 {
  if (plot.status !== "growing" || !plot.crop) return 0;
  const ratio = plot.growth / CROP_MAP[plot.crop].growSeconds;
  if (ratio >= 1) return 3;
  if (ratio < 0.12) return 0;
  if (ratio < 0.45) return 1;
  return 2;
}

/** Wall-clock seconds left, assuming the plot's current condition persists. */
export function plotSecondsLeft(plot: Plot): number {
  if (plot.status !== "growing" || !plot.crop) return 0;
  const left = Math.max(0, CROP_MAP[plot.crop].growSeconds - plot.growth);
  return left / (plot.thirsty ? THIRSTY_GROWTH : 1);
}

export function harvestYield(plot: Plot): { amount: number; lost: number } {
  if (!plot.crop) return { amount: 0, lost: 0 };
  const base = CROP_MAP[plot.crop].yield;
  const amount = Math.max(Math.ceil(base / 2), base - plot.weeds - plot.bugs);
  return { amount, lost: base - amount };
}

export function waterQuality(trashCount: number): number {
  return Math.max(0.4, 1 - 0.12 * trashCount);
}

export function fishRate(game: GameState, now: number): number {
  const fed = game.pond.fedUntil > now ? 1 : HUNGRY_GROWTH;
  return fed * waterQuality(game.pond.trash.length);
}

export function isFishMature(fish: PondFish): boolean {
  return fish.growth >= FISH_MAP[fish.species].growSeconds;
}

export function fishSecondsLeft(game: GameState, fish: PondFish, now: number): number {
  const left = Math.max(0, FISH_MAP[fish.species].growSeconds - fish.growth);
  return left / fishRate(game, now);
}

export function pondCapacity(game: GameState): number {
  return POND_CAPACITIES[Math.min(game.pond.capacityLevel, POND_CAPACITIES.length - 1)];
}

export function unlockedPlotCount(game: GameState): number {
  return game.plots.filter((plot) => plot.status !== "locked").length;
}

export function nextPlotUnlock(game: GameState) {
  return PLOT_UNLOCKS[unlockedPlotCount(game) - STARTING_PLOTS] ?? null;
}

export function nextPondUpgrade(game: GameState) {
  return POND_UPGRADES[game.pond.capacityLevel] ?? null;
}

/** Today's featured goods sell for 25% more. Same for everyone on the same Vietnam date. */
export function featuredToday(dateKey: string): { crop: CropId; fish: FishId } {
  const hash = hashString(`farm:${dateKey}`);
  return { crop: CROPS[hash % CROPS.length].id, fish: FISHES[(hash >>> 8) % FISHES.length].id };
}

export function cropSellPrice(crop: CropId, dateKey: string): number {
  const base = CROP_MAP[crop].sellPrice;
  return featuredToday(dateKey).crop === crop ? Math.round(base * FEATURED_BONUS) : base;
}

export function fishSellPrice(fish: FishId, dateKey: string): number {
  const base = FISH_MAP[fish].sellPrice;
  return featuredToday(dateKey).fish === fish ? Math.round(base * FEATURED_BONUS) : base;
}

export function ranchCapacity(game: GameState): number {
  return RANCH_CAPACITIES[Math.min(game.ranch.capacityLevel, RANCH_CAPACITIES.length - 1)];
}

export function nextRanchUpgrade(game: GameState) {
  return RANCH_UPGRADES[game.ranch.capacityLevel] ?? null;
}

/** Wall-clock seconds until this animal's next product, or null if it is waiting for feed. */
export function animalSecondsLeft(game: GameState, animal: RanchAnimal): number | null {
  if (!animal.fed && (game.items.feed < 1 || game.ranch.drops.length >= MAX_DROPS)) return null;
  return Math.max(0, ANIMAL_MAP[animal.species].cycleSeconds - animal.progress);
}

export function unitPrice(kind: GoodsKind, id: string, dateKey: string): number {
  if (kind === "crop") return cropSellPrice(id as CropId, dateKey);
  if (kind === "fish") return fishSellPrice(id as FishId, dateKey);
  if (kind === "product") return PRODUCT_MAP[id as ProductId].sellPrice;
  return GOOD_MAP[id as GoodId].sellPrice;
}

export interface StockEntry {
  key: string;
  kind: GoodsKind;
  id: string;
  name: string;
  emoji: string;
  owned: number;
  price: number;
  featured: boolean;
}

/** Everything in the barn, in display order, with today's on-the-spot price. */
export function barnEntries(game: GameState, dateKey: string): StockEntry[] {
  const featured = featuredToday(dateKey);
  const entries: StockEntry[] = [];
  const push = (kind: GoodsKind, id: string, name: string, emoji: string, owned: number | undefined, isFeatured = false) => {
    if (!owned || owned < 1) return;
    entries.push({ key: `${kind}:${id}`, kind, id, name, emoji, owned, price: unitPrice(kind, id, dateKey), featured: isFeatured });
  };
  for (const good of GOODS) push("good", good.id, good.name, good.emoji, game.barn.goods[good.id]);
  for (const product of PRODUCTS) push("product", product.id, product.name, product.emoji, game.barn.products[product.id]);
  for (const fish of FISHES) push("fish", fish.id, fish.name, fish.emoji, game.barn.fish[fish.id], featured.fish === fish.id);
  for (const crop of CROPS) push("crop", crop.id, crop.name, crop.emoji, game.barn.crops[crop.id], featured.crop === crop.id);
  return entries;
}

function barnBucket(kind: GoodsKind): keyof GameState["barn"] {
  return kind === "crop" ? "crops" : kind === "fish" ? "fish" : kind === "product" ? "products" : "goods";
}

function barnCount(game: GameState, kind: GoodsKind, id: string): number {
  return (game.barn[barnBucket(kind)] as Record<string, number | undefined>)[id] ?? 0;
}

function changeBarn(game: GameState, kind: GoodsKind, id: string, delta: number): GameState {
  const bucket = barnBucket(kind);
  const current = game.barn[bucket] as Record<string, number | undefined>;
  return { ...game, barn: { ...game.barn, [bucket]: { ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) } } };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return `${total} giây`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} giờ ${String(minutes).padStart(2, "0")} phút`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function emptyPlot(status: PlotStatus): Plot {
  return { status, crop: null, growth: 0, thirsty: false, weeds: 0, bugs: 0, fertilized: false };
}

function fail(game: GameState, message: string, tone: Tone = "warn"): ActionResult {
  return { game, ok: false, message, tone };
}

/** Adds XP (and the level-up coin bonus) and describes any level-up in `suffix`. */
function gainXp(game: GameState, amount: number): { game: GameState; suffix: string } {
  const before = levelFromXp(game.xp);
  const xp = game.xp + amount;
  const after = levelFromXp(xp);
  if (after === before) return { game: { ...game, xp }, suffix: "" };
  let bonus = 0;
  for (let level = before + 1; level <= after; level += 1) bonus += level * 15;
  const unlocked = [
    ...CROPS.filter((crop) => crop.level > before && crop.level <= after).map((crop) => `${crop.emoji} ${crop.name}`),
    ...FISHES.filter((fish) => fish.level > before && fish.level <= after).map((fish) => `${fish.emoji} ${fish.name}`),
  ];
  const unlockedText = unlocked.length ? ` Mở khóa: ${unlocked.join(", ")}.` : "";
  return {
    game: { ...game, xp, coins: game.coins + bonus },
    suffix: ` 🎉 Lên cấp ${after}! +${bonus} xu.${unlockedText}`,
  };
}

function withPlot(game: GameState, index: number, plot: Plot): GameState {
  const plots = game.plots.slice();
  plots[index] = plot;
  return { ...game, plots };
}

function getPlot(game: GameState, index: number): Plot | null {
  return Number.isInteger(index) && index >= 0 && index < game.plots.length ? game.plots[index] : null;
}

/* ───────────────────────── creation & time ───────────────────────── */

export function createGame(now: number): GameState {
  return {
    version: 1,
    createdAt: now,
    lastTick: now,
    coins: 150,
    xp: 0,
    plots: Array.from({ length: PLOT_COUNT }, (_, index) => emptyPlot(index < STARTING_PLOTS ? "tilled" : "locked")),
    pond: {
      capacityLevel: 0,
      fedUntil: now + FEED_DURATION_MS,
      fish: [{ id: "f1", species: "tilapia", growth: 0 }],
      trash: [],
    },
    ranch: createRanch(),
    seeds: { cabbage: 4, carrot: 2 },
    items: { fertilizer: 1, fishFood: 3, feed: 6 },
    barn: { crops: {}, fish: {}, products: {}, goods: {} },
    lastDailyBonus: null,
    lastStudyReward: null,
    stats: { harvested: 0, fishCaught: 0, earned: 0 },
    nextId: 2,
  };
}

function createRanch(): GameState["ranch"] {
  return {
    capacityLevel: 0,
    animals: [{ id: "a1", species: "chicken", progress: 0, fed: false }],
    drops: [],
    workshops: {},
    truck: null,
  };
}

/**
 * Advances growth, weeds, pests, thirst, hunger and pond litter from `game.lastTick` to `now`,
 * in steps of at most one minute so random events keep the same per-minute odds whether the
 * page was open the whole time or closed for days.
 */
export function advance(game: GameState, now: number, seed: number): GameState {
  const elapsed = Math.min(MAX_OFFLINE_MS, now - game.lastTick);
  if (elapsed <= 0) return elapsed < 0 ? { ...game, lastTick: now } : game;
  const random = mulberry32(seed);
  const plots = game.plots.map((plot) => ({ ...plot }));
  const fish = game.pond.fish.map((item) => ({ ...item }));
  const trash = game.pond.trash.slice();
  const animals = game.ranch.animals.map((item) => ({ ...item }));
  const drops = game.ranch.drops.slice();
  const workshops: GameState["ranch"]["workshops"] = {};
  for (const id of Object.keys(game.ranch.workshops) as WorkshopId[]) {
    const state = game.ranch.workshops[id];
    if (state) workshops[id] = { ...state };
  }
  let feed = game.items.feed;
  let nextId = game.nextId;
  let clock = now - elapsed;
  let remaining = elapsed / 1000;

  while (remaining > 0) {
    const step = Math.min(60, remaining);
    remaining -= step;
    const perMinute = step / 60;

    for (const plot of plots) {
      if (plot.status !== "growing" || !plot.crop) continue;
      const grow = CROP_MAP[plot.crop].growSeconds;
      if (plot.growth >= grow) continue;
      plot.growth = Math.min(grow, plot.growth + step * (plot.thirsty ? THIRSTY_GROWTH : 1));
      if (plot.growth >= grow || plot.growth < grow * 0.12) continue;
      if (!plot.thirsty && random() < 0.05 * perMinute) plot.thirsty = true;
      if (plot.weeds < 2 && random() < 0.035 * perMinute) plot.weeds += 1;
      if (plot.bugs < 2 && random() < 0.03 * perMinute) plot.bugs += 1;
    }

    if (fish.length > 0) {
      const fedSeconds = Math.max(0, Math.min(step, (game.pond.fedUntil - clock) / 1000));
      const effective = (fedSeconds + (step - fedSeconds) * HUNGRY_GROWTH) * waterQuality(trash.length);
      for (const item of fish) {
        const grow = FISH_MAP[item.species].growSeconds;
        if (item.growth < grow) item.growth = Math.min(grow, item.growth + effective);
      }
      if (trash.length < MAX_TRASH && random() < Math.min(0.3, 0.025 * fish.length) * perMinute) {
        const radius = Math.sqrt(random()) * 0.78;
        const angle = random() * Math.PI * 2;
        const kinds: TrashKind[] = ["leaf", "leaf", "bottle", "can"];
        trash.push({
          id: `t${nextId}`,
          kind: kinds[Math.floor(random() * kinds.length)],
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
        });
        nextId += 1;
      }
    }
    for (const animal of animals) {
      const def = ANIMAL_MAP[animal.species];
      let left = step;
      while (left > 0) {
        if (!animal.fed) {
          if (feed < 1 || drops.length >= MAX_DROPS) break;
          feed -= 1;
          animal.fed = true;
        }
        const need = def.cycleSeconds - animal.progress;
        if (left < need) {
          animal.progress += left;
          left = 0;
        } else {
          left -= need;
          animal.progress = 0;
          animal.fed = false;
          drops.push({ id: `d${nextId}`, product: def.product, x: random() * 1.7 - 0.85, z: random() * 1.5 - 0.75 });
          nextId += 1;
        }
      }
    }

    for (const id of Object.keys(workshops) as WorkshopId[]) {
      const state = workshops[id];
      if (!state || state.progress === null) continue;
      state.progress += step;
      if (state.progress >= WORKSHOP_MAP[id].seconds) {
        state.progress = null;
        state.ready += 1;
      }
    }
    clock += step * 1000;
  }

  let coins = game.coins;
  let stats = game.stats;
  let truck = game.ranch.truck;
  if (truck && now >= truck.returnAt) {
    coins += truck.value;
    stats = { ...stats, earned: stats.earned + truck.value };
    truck = null;
  }

  return {
    ...game,
    coins,
    stats,
    plots,
    pond: { ...game.pond, fish, trash },
    ranch: { ...game.ranch, animals, drops, workshops, truck },
    items: { ...game.items, feed },
    nextId,
    lastTick: now,
  };
}

/* ───────────────────────── farm actions ───────────────────────── */

export function hoe(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot) return fail(game, "Không tìm thấy ô đất.");
  if (plot.status === "locked") return fail(game, "Ô này chưa mở. Mở rộng đất trước đã.");
  if (plot.status === "growing") return fail(game, "Ô đang có cây — thu hoạch xong mới cuốc lại.");
  if (plot.status === "tilled") return fail(game, "Đất đã tơi xốp, gieo hạt được rồi.", "info");
  const xp = plot.status === "wild" ? 2 : 1;
  const next = gainXp(withPlot(game, index, emptyPlot("tilled")), xp);
  return { game: next.game, ok: true, message: `⛏️ Đã cuốc đất · +${xp} XP.${next.suffix}`, tone: "good" };
}

export function plant(game: GameState, index: number, crop: CropId): ActionResult {
  const plot = getPlot(game, index);
  const def = CROP_MAP[crop];
  if (!plot || !def) return fail(game, "Không gieo được.");
  if (plot.status === "locked") return fail(game, "Ô này chưa mở.");
  if (plot.status === "growing") return fail(game, "Ô này đang có cây rồi.", "info");
  if (plot.status !== "tilled") return fail(game, "Cuốc đất trước rồi mới gieo được.");
  if (levelFromXp(game.xp) < def.level) return fail(game, `${def.name} cần cấp ${def.level}.`);
  const owned = game.seeds[crop] ?? 0;
  if (owned < 1) return fail(game, `Hết hạt ${def.name}. Mua thêm ở cửa hàng nhé.`);
  const seeded = withPlot(
    { ...game, seeds: { ...game.seeds, [crop]: owned - 1 } },
    index,
    { ...emptyPlot("growing"), crop },
  );
  const next = gainXp(seeded, 1);
  return { game: next.game, ok: true, message: `🌱 Đã gieo ${def.emoji} ${def.name} · chín sau ${formatDuration(def.growSeconds)}.${next.suffix}`, tone: "good" };
}

export function water(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || plot.status !== "growing") return fail(game, "Chỉ tưới ô đang có cây.", "info");
  if (!plot.thirsty) return fail(game, "Đất còn ẩm, chưa cần tưới.", "info");
  const next = gainXp(withPlot(game, index, { ...plot, thirsty: false }), 2);
  return { game: next.game, ok: true, message: `💧 Đã tưới · cây lớn lại bình thường · +2 XP.${next.suffix}`, tone: "good" };
}

export function pullWeed(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || plot.weeds < 1) return fail(game, "Ô này không có cỏ dại.", "info");
  const next = gainXp(withPlot(game, index, { ...plot, weeds: plot.weeds - 1 }), 2);
  return { game: next.game, ok: true, message: `🌿 Đã nhổ cỏ · +2 XP.${next.suffix}`, tone: "good" };
}

export function catchBug(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || plot.bugs < 1) return fail(game, "Ô này không có sâu.", "info");
  const next = gainXp(withPlot(game, index, { ...plot, bugs: plot.bugs - 1 }), 2);
  return { game: next.game, ok: true, message: `🐛 Đã bắt sâu · +2 XP.${next.suffix}`, tone: "good" };
}

export function fertilize(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || plot.status !== "growing" || !plot.crop) return fail(game, "Chỉ bón phân cho ô đang có cây.", "info");
  if (isRipe(plot)) return fail(game, "Cây đã chín, thu hoạch luôn thôi.", "info");
  if (plot.fertilized) return fail(game, "Vụ này đã bón phân rồi.", "info");
  if (game.items.fertilizer < 1) return fail(game, "Hết phân bón. Mua ở cửa hàng hoặc nhận quà học tập.");
  const grow = CROP_MAP[plot.crop].growSeconds;
  const growth = plot.growth + (grow - plot.growth) * 0.3;
  const next = withPlot(
    { ...game, items: { ...game.items, fertilizer: game.items.fertilizer - 1 } },
    index,
    { ...plot, growth, fertilized: true },
  );
  return { game: next, ok: true, message: `✨ Đã bón phân · còn khoảng ${formatDuration(plotSecondsLeft({ ...plot, growth }))}.`, tone: "good" };
}

export function harvest(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || !isRipe(plot) || !plot.crop) {
    if (plot?.status === "growing" && plot.crop) {
      return fail(game, `${CROP_MAP[plot.crop].name} chưa chín · còn ${formatDuration(plotSecondsLeft(plot))}.`, "info");
    }
    return fail(game, "Không có gì để thu hoạch.", "info");
  }
  const def = CROP_MAP[plot.crop];
  const { amount, lost } = harvestYield(plot);
  const stored = {
    ...game,
    barn: { ...game.barn, crops: { ...game.barn.crops, [def.id]: (game.barn.crops[def.id] ?? 0) + amount } },
    stats: { ...game.stats, harvested: game.stats.harvested + amount },
  };
  const next = gainXp(withPlot(stored, index, emptyPlot("withered")), def.xp);
  const lostText = lost > 0 ? ` (mất ${lost} vì cỏ/sâu)` : "";
  return { game: next.game, ok: true, message: `🧺 +${amount} ${def.emoji} ${def.name}${lostText} · +${def.xp} XP.${next.suffix}`, tone: "good" };
}

export function unlockPlot(game: GameState, index: number): ActionResult {
  const plot = getPlot(game, index);
  if (!plot || plot.status !== "locked") return fail(game, "Ô này đã mở rồi.", "info");
  const unlock = nextPlotUnlock(game);
  if (!unlock) return fail(game, "Đã mở hết đất.", "info");
  if (levelFromXp(game.xp) < unlock.level) return fail(game, `Cần cấp ${unlock.level} để mở thêm đất.`);
  if (game.coins < unlock.cost) return fail(game, `Cần ${unlock.cost} xu để mở ô đất này.`);
  const next = withPlot({ ...game, coins: game.coins - unlock.cost }, index, emptyPlot("wild"));
  return { game: next, ok: true, message: `🧱 Đã mở ô đất mới (−${unlock.cost} xu). Cuốc cỏ để bắt đầu trồng.`, tone: "good" };
}

/* ───────────────────────── pond actions ───────────────────────── */

export function buyFry(game: GameState, species: FishId): ActionResult {
  const def = FISH_MAP[species];
  if (!def) return fail(game, "Không có loại cá này.");
  if (levelFromXp(game.xp) < def.level) return fail(game, `${def.name} cần cấp ${def.level}.`);
  if (game.pond.fish.length >= pondCapacity(game)) return fail(game, "Ao đã đầy. Vớt cá lớn hoặc nâng cấp ao.");
  if (game.coins < def.fryPrice) return fail(game, `Cần ${def.fryPrice} xu để mua ${def.name}.`);
  const fish = { id: `f${game.nextId}`, species, growth: 0 };
  const next = gainXp(
    { ...game, coins: game.coins - def.fryPrice, nextId: game.nextId + 1, pond: { ...game.pond, fish: [...game.pond.fish, fish] } },
    1,
  );
  return { game: next.game, ok: true, message: `🐣 Đã thả ${def.emoji} ${def.name} giống · lớn sau ${formatDuration(def.growSeconds)} nếu được cho ăn.${next.suffix}`, tone: "good" };
}

export function feedFish(game: GameState, now: number): ActionResult {
  if (game.pond.fish.length === 0) return fail(game, "Ao chưa có cá để cho ăn.", "info");
  if (game.pond.fedUntil - now > FEED_DURATION_MS / 2) return fail(game, "Cá vẫn còn no, để lát nữa hãy cho ăn.", "info");
  if (game.items.fishFood < 1) return fail(game, "Hết cám cá. Mua ở cửa hàng nhé.");
  const next = gainXp(
    {
      ...game,
      items: { ...game.items, fishFood: game.items.fishFood - 1 },
      pond: { ...game.pond, fedUntil: Math.max(now, game.pond.fedUntil) + FEED_DURATION_MS },
    },
    1,
  );
  return { game: next.game, ok: true, message: `🍞 Cả ao đã no · thêm 20 phút lớn nhanh.${next.suffix}`, tone: "good" };
}

export function removeTrash(game: GameState, id: string): ActionResult {
  if (!game.pond.trash.some((item) => item.id === id)) return fail(game, "Rác đã được vớt.", "info");
  const next = gainXp({ ...game, pond: { ...game.pond, trash: game.pond.trash.filter((item) => item.id !== id) } }, 2);
  return { game: next.game, ok: true, message: `🧹 Đã vớt rác · nước sạch hơn · +2 XP.${next.suffix}`, tone: "good" };
}

export function clearTrash(game: GameState): ActionResult {
  const count = game.pond.trash.length;
  if (count === 0) return fail(game, "Mặt ao đang sạch.", "info");
  const next = gainXp({ ...game, pond: { ...game.pond, trash: [] } }, count * 2);
  return { game: next.game, ok: true, message: `🧹 Vớt ${count} mẩu rác · nước trong lại · +${count * 2} XP.${next.suffix}`, tone: "good" };
}

export function catchFish(game: GameState, id: string, now: number): ActionResult {
  const fish = game.pond.fish.find((item) => item.id === id);
  if (!fish) return fail(game, "Con cá này không còn trong ao.", "info");
  const def = FISH_MAP[fish.species];
  if (!isFishMature(fish)) {
    const hungry = game.pond.fedUntil <= now ? " · đang đói" : "";
    return fail(game, `${def.emoji} ${def.name} chưa lớn · còn khoảng ${formatDuration(fishSecondsLeft(game, fish, now))}${hungry}.`, "info");
  }
  const stored = {
    ...game,
    pond: { ...game.pond, fish: game.pond.fish.filter((item) => item.id !== id) },
    barn: { ...game.barn, fish: { ...game.barn.fish, [def.id]: (game.barn.fish[def.id] ?? 0) + 1 } },
    stats: { ...game.stats, fishCaught: game.stats.fishCaught + 1 },
  };
  const next = gainXp(stored, def.xp);
  return { game: next.game, ok: true, message: `🎣 Vớt được ${def.emoji} ${def.name} · +${def.xp} XP.${next.suffix}`, tone: "good" };
}

export function catchAllMature(game: GameState): ActionResult {
  const mature = game.pond.fish.filter(isFishMature);
  if (mature.length === 0) return fail(game, "Chưa có cá nào đủ lớn.", "info");
  const barnFish = { ...game.barn.fish };
  let xp = 0;
  for (const fish of mature) {
    barnFish[fish.species] = (barnFish[fish.species] ?? 0) + 1;
    xp += FISH_MAP[fish.species].xp;
  }
  const stored = {
    ...game,
    pond: { ...game.pond, fish: game.pond.fish.filter((fish) => !isFishMature(fish)) },
    barn: { ...game.barn, fish: barnFish },
    stats: { ...game.stats, fishCaught: game.stats.fishCaught + mature.length },
  };
  const next = gainXp(stored, xp);
  return { game: next.game, ok: true, message: `🎣 Vớt ${mature.length} cá lớn vào kho · +${xp} XP.${next.suffix}`, tone: "good" };
}

export function upgradePond(game: GameState): ActionResult {
  const upgrade = nextPondUpgrade(game);
  if (!upgrade) return fail(game, "Ao đã rộng nhất rồi.", "info");
  if (levelFromXp(game.xp) < upgrade.level) return fail(game, `Cần cấp ${upgrade.level} để mở rộng ao.`);
  if (game.coins < upgrade.cost) return fail(game, `Cần ${upgrade.cost} xu để mở rộng ao.`);
  const capacityLevel = game.pond.capacityLevel + 1;
  return {
    game: { ...game, coins: game.coins - upgrade.cost, pond: { ...game.pond, capacityLevel } },
    ok: true,
    message: `🏞️ Ao rộng hơn · nuôi được ${POND_CAPACITIES[capacityLevel]} con.`,
    tone: "good",
  };
}

/* ───────────────────────── shop & barn ───────────────────────── */

export function buySeeds(game: GameState, crop: CropId, quantity: number): ActionResult {
  const def = CROP_MAP[crop];
  const qty = Math.max(1, Math.floor(quantity));
  if (!def) return fail(game, "Không có loại hạt này.");
  if (levelFromXp(game.xp) < def.level) return fail(game, `${def.name} mở ở cấp ${def.level}.`);
  const cost = def.seedPrice * qty;
  if (game.coins < cost) return fail(game, `Cần ${cost} xu cho ${qty} hạt ${def.name}.`);
  return {
    game: { ...game, coins: game.coins - cost, seeds: { ...game.seeds, [crop]: (game.seeds[crop] ?? 0) + qty } },
    ok: true,
    message: `🛒 Mua ${qty} hạt ${def.emoji} ${def.name} (−${cost} xu).`,
    tone: "good",
  };
}

export function buyItem(game: GameState, item: ItemId, quantity: number): ActionResult {
  const def = ITEMS[item];
  const qty = Math.max(1, Math.floor(quantity));
  const cost = def.price * qty;
  if (game.coins < cost) return fail(game, `Cần ${cost} xu cho ${qty} ${def.name.toLowerCase()}.`);
  return {
    game: { ...game, coins: game.coins - cost, items: { ...game.items, [item]: game.items[item] + qty } },
    ok: true,
    message: `🛒 Mua ${qty} ${def.emoji} ${def.name} (−${cost} xu).`,
    tone: "good",
  };
}

export function sellGoods(game: GameState, kind: GoodsKind, id: string, quantity: number, dateKey: string): ActionResult {
  const owned = barnCount(game, kind, id);
  const qty = Math.min(owned, Math.max(1, Math.floor(quantity)));
  if (qty < 1) return fail(game, "Kho không còn hàng này.", "info");
  const earned = unitPrice(kind, id, dateKey) * qty;
  const entry = barnEntries(game, dateKey).find((item) => item.key === `${kind}:${id}`);
  const next = changeBarn(game, kind, id, -qty);
  return {
    game: { ...next, coins: next.coins + earned, stats: { ...next.stats, earned: next.stats.earned + earned } },
    ok: true,
    message: `💰 Bán ${qty} ${entry?.emoji ?? ""} ${entry?.name ?? ""} · +${earned} xu.`,
    tone: "good",
  };
}

export function barnValue(game: GameState, dateKey: string): number {
  return barnEntries(game, dateKey).reduce((sum, entry) => sum + entry.owned * entry.price, 0);
}

export function sellAll(game: GameState, dateKey: string): ActionResult {
  const earned = barnValue(game, dateKey);
  if (earned === 0) return fail(game, "Kho đang trống.", "info");
  return {
    game: {
      ...game,
      coins: game.coins + earned,
      barn: { crops: {}, fish: {}, products: {}, goods: {} },
      stats: { ...game.stats, earned: game.stats.earned + earned },
    },
    ok: true,
    message: `💰 Bán hết hàng trong kho · +${earned} xu.`,
    tone: "good",
  };
}

/* ───────────────────────── ranch ───────────────────────── */

export function buyAnimal(game: GameState, species: AnimalId): ActionResult {
  const def = ANIMAL_MAP[species];
  if (!def) return fail(game, "Không có loại vật nuôi này.");
  if (levelFromXp(game.xp) < def.level) return fail(game, `${def.name} mở ở cấp ${def.level}.`);
  if (game.ranch.animals.length >= ranchCapacity(game)) return fail(game, "Chuồng đã đầy. Mở rộng trang trại ở chợ.");
  if (game.coins < def.price) return fail(game, `Cần ${def.price} xu để mua ${def.name.toLowerCase()}.`);
  const animal: RanchAnimal = { id: `a${game.nextId}`, species, progress: 0, fed: false };
  const next = gainXp(
    { ...game, coins: game.coins - def.price, nextId: game.nextId + 1, ranch: { ...game.ranch, animals: [...game.ranch.animals, animal] } },
    2,
  );
  const hint = game.items.feed < 1 ? " Máng đang trống — xay hoặc mua thức ăn nhé." : "";
  return { game: next.game, ok: true, message: `${def.emoji} Đã thả ${def.name.toLowerCase()} vào trang trại.${hint}${next.suffix}`, tone: "good" };
}

export function collectDrop(game: GameState, id: string): ActionResult {
  const drop = game.ranch.drops.find((item) => item.id === id);
  if (!drop) return fail(game, "Đã nhặt rồi.", "info");
  const def = PRODUCT_MAP[drop.product];
  const stored = changeBarn({ ...game, ranch: { ...game.ranch, drops: game.ranch.drops.filter((item) => item.id !== id) } }, "product", drop.product, 1);
  const next = gainXp(stored, 1);
  return { game: next.game, ok: true, message: `${def.emoji} +1 ${def.name} · +1 XP.${next.suffix}`, tone: "good" };
}

export function collectAllDrops(game: GameState): ActionResult {
  const drops = game.ranch.drops;
  if (drops.length === 0) return fail(game, "Chưa có gì để nhặt.", "info");
  let next: GameState = { ...game, ranch: { ...game.ranch, drops: [] } };
  for (const drop of drops) next = changeBarn(next, "product", drop.product, 1);
  const result = gainXp(next, drops.length);
  return { game: result.game, ok: true, message: `🧺 Nhặt ${drops.length} sản phẩm vào kho · +${drops.length} XP.${result.suffix}`, tone: "good" };
}

export function millCrop(game: GameState, crop: CropId, quantity: number): ActionResult {
  const def = CROP_MAP[crop];
  const owned = game.barn.crops[crop] ?? 0;
  const qty = Math.min(owned, Math.max(1, Math.floor(quantity)));
  if (!def || qty < 1) return fail(game, "Kho không còn nông sản này.", "info");
  const bags = MILL_YIELD[crop] * qty;
  const next = changeBarn({ ...game, items: { ...game.items, feed: game.items.feed + bags } }, "crop", crop, -qty);
  return { game: next, ok: true, message: `⚙️ Xay ${qty} ${def.emoji} → +${bags} 🥣 thức ăn.`, tone: "good" };
}

export function upgradeRanch(game: GameState): ActionResult {
  const upgrade = nextRanchUpgrade(game);
  if (!upgrade) return fail(game, "Trang trại đã rộng nhất rồi.", "info");
  if (levelFromXp(game.xp) < upgrade.level) return fail(game, `Cần cấp ${upgrade.level} để mở rộng chuồng.`);
  if (game.coins < upgrade.cost) return fail(game, `Cần ${upgrade.cost} xu để mở rộng chuồng.`);
  const capacityLevel = game.ranch.capacityLevel + 1;
  return {
    game: { ...game, coins: game.coins - upgrade.cost, ranch: { ...game.ranch, capacityLevel } },
    ok: true,
    message: `🏡 Chuồng rộng hơn · nuôi được ${RANCH_CAPACITIES[capacityLevel]} con.`,
    tone: "good",
  };
}

export function workshopInputsText(def: WorkshopDef): string {
  const parts: string[] = [];
  for (const [id, qty] of Object.entries(def.inputs.products ?? {})) parts.push(`${qty} ${PRODUCT_MAP[id as ProductId].name.toLowerCase()}`);
  for (const [id, qty] of Object.entries(def.inputs.crops ?? {})) parts.push(`${qty} ${CROP_MAP[id as CropId].name.toLowerCase()}`);
  return parts.join(" + ");
}

export function canStartWorkshop(game: GameState, id: WorkshopId): boolean {
  const def = WORKSHOP_MAP[id];
  const state = game.ranch.workshops[id];
  if (!state || state.progress !== null) return false;
  for (const [product, qty] of Object.entries(def.inputs.products ?? {})) if (barnCount(game, "product", product) < (qty ?? 0)) return false;
  for (const [crop, qty] of Object.entries(def.inputs.crops ?? {})) if (barnCount(game, "crop", crop) < (qty ?? 0)) return false;
  return true;
}

export function buildWorkshop(game: GameState, id: WorkshopId): ActionResult {
  const def = WORKSHOP_MAP[id];
  if (!def) return fail(game, "Không có xưởng này.");
  if (game.ranch.workshops[id]) return fail(game, `${def.name} đã xây rồi.`, "info");
  if (levelFromXp(game.xp) < def.level) return fail(game, `${def.name} mở ở cấp ${def.level}.`);
  if (game.coins < def.buildCost) return fail(game, `Cần ${def.buildCost} xu để xây ${def.name.toLowerCase()}.`);
  const next = gainXp(
    { ...game, coins: game.coins - def.buildCost, ranch: { ...game.ranch, workshops: { ...game.ranch.workshops, [id]: { progress: null, ready: 0 } } } },
    5,
  );
  return { game: next.game, ok: true, message: `🔨 Đã xây ${def.name.toLowerCase()} · +5 XP.${next.suffix}`, tone: "good" };
}

export function startWorkshop(game: GameState, id: WorkshopId): ActionResult {
  const def = WORKSHOP_MAP[id];
  const state = game.ranch.workshops[id];
  if (!def || !state) return fail(game, "Xây xưởng trước đã.", "info");
  if (state.progress !== null) return fail(game, `${def.name} đang chạy.`, "info");
  if (!canStartWorkshop(game, id)) return fail(game, `Cần ${workshopInputsText(def)} trong kho.`);
  let next = game;
  for (const [product, qty] of Object.entries(def.inputs.products ?? {})) next = changeBarn(next, "product", product, -(qty ?? 0));
  for (const [crop, qty] of Object.entries(def.inputs.crops ?? {})) next = changeBarn(next, "crop", crop, -(qty ?? 0));
  next = { ...next, ranch: { ...next.ranch, workshops: { ...next.ranch.workshops, [id]: { ...state, progress: 0 } } } };
  const good = GOOD_MAP[def.output];
  return { game: next, ok: true, message: `🏭 ${def.name} bắt đầu làm ${good.emoji} ${good.name.toLowerCase()} · xong sau ${formatDuration(def.seconds)}.`, tone: "good" };
}

export function collectWorkshop(game: GameState, id: WorkshopId): ActionResult {
  const def = WORKSHOP_MAP[id];
  const state = game.ranch.workshops[id];
  if (!def || !state || state.ready < 1) return fail(game, "Chưa có thành phẩm.", "info");
  const good = GOOD_MAP[def.output];
  const stored = changeBarn(
    { ...game, ranch: { ...game.ranch, workshops: { ...game.ranch.workshops, [id]: { ...state, ready: 0 } } } },
    "good",
    def.output,
    state.ready,
  );
  const next = gainXp(stored, def.xp * state.ready);
  return { game: next.game, ok: true, message: `${good.emoji} +${state.ready} ${good.name} vào kho · +${def.xp * state.ready} XP.${next.suffix}`, tone: "good" };
}

/** Truck price for a cart: on-the-spot price plus the city bonus. */
export function truckValue(game: GameState, cart: Record<string, number>, dateKey: string): { value: number; items: number } {
  let value = 0;
  let items = 0;
  for (const entry of barnEntries(game, dateKey)) {
    const qty = Math.min(entry.owned, Math.max(0, Math.floor(cart[entry.key] ?? 0)));
    value += qty * entry.price;
    items += qty;
  }
  return { value: Math.round(value * TRUCK.bonus), items };
}

export function sendTruck(game: GameState, cart: Record<string, number>, now: number, dateKey: string): ActionResult {
  if (game.ranch.truck) return fail(game, "Xe tải đang chạy, chờ xe về đã.", "info");
  const { value, items } = truckValue(game, cart, dateKey);
  if (items < 1) return fail(game, "Chất ít nhất một món lên xe.", "info");
  if (items > TRUCK.capacity) return fail(game, `Xe chỉ chở được ${TRUCK.capacity} món mỗi chuyến.`);
  let next = game;
  for (const entry of barnEntries(game, dateKey)) {
    const qty = Math.min(entry.owned, Math.max(0, Math.floor(cart[entry.key] ?? 0)));
    if (qty > 0) next = changeBarn(next, entry.kind, entry.id, -qty);
  }
  next = { ...next, ranch: { ...next.ranch, truck: { departAt: now, returnAt: now + TRUCK.tripSeconds * 1000, value, items } } };
  const result = gainXp(next, Math.ceil(items / 2));
  return {
    game: result.game,
    ok: true,
    message: `🚚 Xe chở ${items} món lên phố · về sau ${formatDuration(TRUCK.tripSeconds)} với ${value} xu.${result.suffix}`,
    tone: "good",
  };
}

/* ───────────────────────── rewards ───────────────────────── */

export const DAILY_BONUS = { coins: 30, fishFood: 2 };
export const STUDY_REWARD = { coins: 50, fertilizer: 1, revisionFertilizer: 1 };

export function claimDailyBonus(game: GameState, dateKey: string): ActionResult {
  if (game.lastDailyBonus === dateKey) return fail(game, "Hôm nay đã nhận quà ghé thăm rồi.", "info");
  return {
    game: {
      ...game,
      coins: game.coins + DAILY_BONUS.coins,
      items: { ...game.items, fishFood: game.items.fishFood + DAILY_BONUS.fishFood },
      lastDailyBonus: dateKey,
    },
    ok: true,
    message: `🎁 Quà ghé thăm: +${DAILY_BONUS.coins} xu, +${DAILY_BONUS.fishFood} cám cá.`,
    tone: "good",
  };
}

/**
 * Reward for practice saved on this device today. It only reads local drafts, so it is a
 * motivation nudge — it never marks a lesson complete or changes reviewed progress.
 */
export function claimStudyReward(
  game: GameState,
  dateKey: string,
  practice: { draft: boolean; revision: boolean },
): ActionResult {
  if (game.lastStudyReward === dateKey) return fail(game, "Hôm nay đã nhận quà học tập rồi.", "info");
  if (!practice.draft) return fail(game, "Lưu một bài luyện hôm nay (trên thiết bị này) để nhận quà học tập.", "info");
  const fertilizer = STUDY_REWARD.fertilizer + (practice.revision ? STUDY_REWARD.revisionFertilizer : 0);
  return {
    game: {
      ...game,
      coins: game.coins + STUDY_REWARD.coins,
      items: { ...game.items, fertilizer: game.items.fertilizer + fertilizer },
      lastStudyReward: dateKey,
    },
    ok: true,
    message: `📚 Quà học tập: +${STUDY_REWARD.coins} xu, +${fertilizer} phân bón.`,
    tone: "good",
  };
}

/* ───────────────────────── persistence ───────────────────────── */

export const SAVE_KEY = "learning-farm-game-v1";

const PLOT_STATUSES: PlotStatus[] = ["locked", "wild", "tilled", "growing", "withered"];
const TRASH_KINDS: TrashKind[] = ["leaf", "bottle", "can"];
const ANIMAL_IDS = ANIMALS.map((item) => item.id);
const PRODUCT_IDS = PRODUCTS.map((item) => item.id);
const GOOD_IDS = GOODS.map((item) => item.id);
const WORKSHOP_IDS = WORKSHOPS.map((item) => item.id);

function parseRanch(value: unknown, now: number): GameState["ranch"] {
  if (!value || typeof value !== "object") return createRanch();
  const source = value as Record<string, unknown>;
  const capacityLevel = Math.floor(num(source.capacityLevel, 0, 0, RANCH_CAPACITIES.length - 1));
  const animals = (Array.isArray(source.animals) ? source.animals : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string" && ANIMAL_IDS.includes(item.species as AnimalId))
    .slice(0, RANCH_CAPACITIES[capacityLevel])
    .map((item) => ({
      id: item.id as string,
      species: item.species as AnimalId,
      progress: num(item.progress, 0, 0, ANIMAL_MAP[item.species as AnimalId].cycleSeconds),
      fed: item.fed === true,
    }));
  const drops = (Array.isArray(source.drops) ? source.drops : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string" && PRODUCT_IDS.includes(item.product as ProductId))
    .slice(0, MAX_DROPS)
    .map((item) => ({ id: item.id as string, product: item.product as ProductId, x: num(item.x, 0, -1, 1), z: num(item.z, 0, -1, 1) }));
  const workshops: GameState["ranch"]["workshops"] = {};
  const workshopSource = (source.workshops && typeof source.workshops === "object" ? source.workshops : {}) as Record<string, unknown>;
  for (const id of WORKSHOP_IDS) {
    const item = workshopSource[id] as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") continue;
    workshops[id] = {
      progress: typeof item.progress === "number" && Number.isFinite(item.progress) ? num(item.progress, 0, 0, WORKSHOP_MAP[id].seconds) : null,
      ready: Math.floor(num(item.ready, 0, 0, 99)),
    };
  }
  const truckSource = source.truck as Record<string, unknown> | null | undefined;
  const truck =
    truckSource && typeof truckSource === "object" && typeof truckSource.returnAt === "number"
      ? {
          departAt: num(truckSource.departAt, now),
          returnAt: num(truckSource.returnAt, now),
          value: Math.floor(num(truckSource.value, 0, 0, 1_000_000)),
          items: Math.floor(num(truckSource.items, 0, 0, TRUCK.capacity)),
        }
      : null;
  return { capacityLevel, animals, drops, workshops, truck };
}

function num(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function counts<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {};
  if (!value || typeof value !== "object") return result;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const amount = num(record[key], 0);
    if (amount > 0) result[key] = Math.floor(amount);
  }
  return result;
}

/** Validates a saved game; anything malformed is repaired or dropped rather than trusted. */
export function parseSave(raw: string | null, now: number): GameState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.plots)) return null;
  const fresh = createGame(now);
  const cropIds = CROPS.map((crop) => crop.id);
  const fishIds = FISHES.map((fish) => fish.id);

  const plots = fresh.plots.map((fallback, index) => {
    const source = (value.plots as unknown[])[index] as Record<string, unknown> | undefined;
    if (!source || typeof source !== "object") return fallback;
    const status = PLOT_STATUSES.includes(source.status as PlotStatus) ? (source.status as PlotStatus) : fallback.status;
    const crop = cropIds.includes(source.crop as CropId) ? (source.crop as CropId) : null;
    if (status === "growing" && !crop) return emptyPlot("tilled");
    return {
      status,
      crop: status === "growing" ? crop : null,
      growth: status === "growing" && crop ? num(source.growth, 0, 0, CROP_MAP[crop].growSeconds) : 0,
      thirsty: source.thirsty === true,
      weeds: Math.floor(num(source.weeds, 0, 0, 2)),
      bugs: Math.floor(num(source.bugs, 0, 0, 2)),
      fertilized: source.fertilized === true,
    } satisfies Plot;
  });

  const pondSource = (value.pond && typeof value.pond === "object" ? value.pond : {}) as Record<string, unknown>;
  const capacityLevel = Math.floor(num(pondSource.capacityLevel, 0, 0, POND_CAPACITIES.length - 1));
  const fish = (Array.isArray(pondSource.fish) ? pondSource.fish : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string" && fishIds.includes(item.species as FishId))
    .slice(0, POND_CAPACITIES[capacityLevel])
    .map((item) => ({
      id: item.id as string,
      species: item.species as FishId,
      growth: num(item.growth, 0, 0, FISH_MAP[item.species as FishId].growSeconds),
    }));
  const trash = (Array.isArray(pondSource.trash) ? pondSource.trash : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string" && TRASH_KINDS.includes(item.kind as TrashKind))
    .slice(0, MAX_TRASH)
    .map((item) => ({ id: item.id as string, kind: item.kind as TrashKind, x: num(item.x, 0, -1, 1), z: num(item.z, 0, -1, 1) }));

  const items = (value.items && typeof value.items === "object" ? value.items : {}) as Record<string, unknown>;
  const barn = (value.barn && typeof value.barn === "object" ? value.barn : {}) as Record<string, unknown>;
  const stats = (value.stats && typeof value.stats === "object" ? value.stats : {}) as Record<string, unknown>;
  const lastTick = num(value.lastTick, now, 0, now);

  return {
    version: 1,
    createdAt: num(value.createdAt, now, 0, now),
    lastTick,
    coins: Math.floor(num(value.coins, fresh.coins)),
    xp: Math.floor(num(value.xp, 0)),
    plots,
    pond: { capacityLevel, fedUntil: num(pondSource.fedUntil, 0), fish, trash },
    ranch: parseRanch(value.ranch, now),
    seeds: counts(value.seeds, cropIds),
    items: {
      fertilizer: Math.floor(num(items.fertilizer, 0)),
      fishFood: Math.floor(num(items.fishFood, 0)),
      // Saves from before the ranch existed get the same starter feed as a new farm.
      feed: Math.floor(num(items.feed, value.ranch ? 0 : 6)),
    },
    barn: {
      crops: counts(barn.crops, cropIds),
      fish: counts(barn.fish, fishIds),
      products: counts(barn.products, PRODUCT_IDS),
      goods: counts(barn.goods, GOOD_IDS),
    },
    lastDailyBonus: typeof value.lastDailyBonus === "string" ? value.lastDailyBonus : null,
    lastStudyReward: typeof value.lastStudyReward === "string" ? value.lastStudyReward : null,
    stats: {
      harvested: Math.floor(num(stats.harvested, 0)),
      fishCaught: Math.floor(num(stats.fishCaught, 0)),
      earned: Math.floor(num(stats.earned, 0)),
    },
    nextId: Math.floor(num(value.nextId, 1000, 1)),
  };
}

/** Summary of what changed while the player was away, for a welcome-back message. */
export function describeAway(before: GameState, after: GameState): string | null {
  const ripeBefore = before.plots.filter(isRipe).length;
  const ripeAfter = after.plots.filter(isRipe).length;
  const fishBefore = before.pond.fish.filter(isFishMature).length;
  const fishAfter = after.pond.fish.filter(isFishMature).length;
  const parts: string[] = [];
  if (ripeAfter > ripeBefore) parts.push(`${ripeAfter - ripeBefore} ô đã chín`);
  if (fishAfter > fishBefore) parts.push(`${fishAfter - fishBefore} cá đã lớn`);
  const problems = after.plots.filter((plot) => plot.thirsty || plot.weeds > 0 || plot.bugs > 0).length;
  if (problems > 0) parts.push(`${problems} ô cần chăm`);
  if (after.pond.trash.length > before.pond.trash.length) parts.push(`ao có ${after.pond.trash.length} mẩu rác`);
  const newDrops = after.ranch.drops.length - before.ranch.drops.length;
  if (newDrops > 0) parts.push(`${newDrops} sản phẩm chờ nhặt ở trang trại`);
  const readyGoods = Object.values(after.ranch.workshops).reduce((sum, item) => sum + (item?.ready ?? 0), 0);
  const readyBefore = Object.values(before.ranch.workshops).reduce((sum, item) => sum + (item?.ready ?? 0), 0);
  if (readyGoods > readyBefore) parts.push(`xưởng có ${readyGoods} thành phẩm`);
  if (before.ranch.truck && !after.ranch.truck) parts.push(`xe tải đã về với ${before.ranch.truck.value} xu`);
  if (after.ranch.animals.length > 0 && after.items.feed < 1 && after.ranch.animals.every((item) => !item.fed)) parts.push("máng ăn đã hết");
  return parts.length ? `Chào mừng trở lại! ${parts.join(" · ")}.` : null;
}
