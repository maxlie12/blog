/**
 * Làng Rêu (village builder): tools, vocabulary, stroke geometry helpers and save parsing.
 * Pure data and functions only — no React, DOM or three.js — so it is cheap to import and test.
 */

import { CHAT } from "./talk.ts";
import { PARTS, RESIDENTS, VERBS } from "./vocab.ts";

export const ISLAND_R = 32;
export const BUILD_R = 30.4;
export const STEP = 0.5;
export const SCENE_KEY = "village-scene-v1";
export const PROGRESS_KEY = "village-progress-v1";

/** Pieces stored in the generic `props` list (everything added after the first 13 tools). */
export const PROP_KINDS = [
  "barn", "chapel", "stall", "tent", "lighthouse", "gazebo", "bakery", "pagoda", "hut", "treehouse", "castle",
  "bush", "flower", "blossom", "sunflower", "mushroom", "rock", "log", "stump", "garden", "pumpkin", "haystack", "bamboo", "palm", "fern", "cactus",
  "fountain", "boat", "pier", "lotus", "raft",
  "bench", "signpost", "cart", "barrel", "crate", "flag", "statue", "scarecrow", "swing", "campfire", "beehive", "woodpile", "mailbox", "ball",
  "kite", "bicycle", "umbrella", "table", "ladder", "wheelbarrow", "seesaw", "slide", "snowman", "birdhouse", "lamppost",
  "chicken", "duck", "cow", "horse", "pig", "dog", "cat", "rabbit", "buffalo", "goat", "goose", "frog", "fish",
  "farmer", "baker", "fisherman", "shepherd", "woodcutter", "postman", "musician", "child", "knight",
] as const;
export type PropKind = (typeof PROP_KINDS)[number];
export type StrokeTool = "path" | "wall" | "fence" | "hedge" | "stream";
export type ToolId = "orbit" | "look" | "hand" | "erase" | "house" | "tree" | "tower" | "well" | "pond" | "windmill" | "lantern" | "sheep" | StrokeTool | PropKind;
export type WordId = Exclude<ToolId, "orbit" | "look" | "hand" | "erase">;
export type Category = "build" | "nature" | "water" | "decor" | "animals" | "people";
/** How a tool is used: drag a line, tap once, brush (scatter while dragging), or its own gesture. */
export type Place = "orbit" | "look" | "hand" | "erase" | "stroke" | "house" | "pond" | "brush" | "tap";

export type Point = [number, number];
export interface Stroke { id: number; pts: Point[] }
export interface Placed { id: number; x: number; z: number; seed: number; r?: number }
export interface House { id: number; x: number; z: number; len: number; r: number; seed: number }
export interface Tree { id: number; x: number; z: number; s: number; k: 0 | 1; r: number }
export interface Pond { id: number; x: number; z: number; r: number; seed: number }
export interface Prop { id: number; kind: PropKind; x: number; z: number; r: number; seed: number }
export interface VillageScene {
  paths: Stroke[];
  walls: Stroke[];
  fences: Stroke[];
  hedges: Stroke[];
  streams: Stroke[];
  houses: House[];
  towers: Placed[];
  trees: Tree[];
  wells: Placed[];
  ponds: Pond[];
  mills: Placed[];
  lanterns: Placed[];
  sheep: Placed[];
  props: Prop[];
}
export interface SavedScene { scene: VillageScene; idSeq: number }
/**
 * `seen` holds discovery words (verbs, parts, villagers) found with the Look tool, by vocab key.
 * `review` holds each practised word's next due time and how many right answers in a row
 * (keys `word:<id>` or vocab keys); words without an entry are due the day after they were met.
 */
export interface VillageProgress {
  unlocked: ToolId[];
  learned: Record<string, { at: number; reviewed?: number }>;
  seen: Record<string, number>;
  review: Record<string, { due: number; step: number }>;
  time: number;
  /** How the day passes: set by hand, a fast day (see FAST_DAY_SECONDS) or the device's clock. */
  clock: ClockMode;
  /** The hour of the fast day, so it carries on where it stopped. */
  hour: number;
  /** Graphics level, or "auto" to let the device decide. */
  quality: QualityChoice;
  /** Fixed weather, or "auto" for weather that changes now and then. */
  weather: Weather;
}

export type Weather = "auto" | "clear" | "cloudy" | "rain";
const WEATHERS: Weather[] = ["auto", "clear", "cloudy", "rain"];

export type Quality = "low" | "medium" | "high";
export type QualityChoice = "auto" | Quality;
const QUALITY_CHOICES: QualityChoice[] = ["auto", "low", "medium", "high"];
/** What each graphics level turns on. `shadows` is the shadow map size (0 = none). */
export const QUALITY: Record<Quality, { dpr: number; shadows: number; tufts: number; flowers: number; post: boolean; smoke: number; rain: number }> = {
  low: { dpr: 1, shadows: 0, tufts: 700, flowers: 0, post: false, smoke: 0, rain: 700 },
  medium: { dpr: 1.5, shadows: 2048, tufts: 1300, flowers: 260, post: false, smoke: 120, rain: 1400 },
  high: { dpr: 2, shadows: 4096, tufts: 2400, flowers: 650, post: true, smoke: 240, rain: 2400 },
};
/** A starting level from what the device reports: software rendering is slow, phones are mid. */
export function autoQuality(d: { renderer: string; cores: number; memory?: number; coarse: boolean; minSide: number }): Quality {
  if (/swiftshader|llvmpipe|software|softpipe/i.test(d.renderer)) return "low";
  if ((d.memory ?? 8) < 4 || d.cores <= 2) return "low";
  if (d.coarse || d.minSide < 700) return d.cores >= 6 ? "medium" : "low";
  return d.cores >= 6 ? "high" : "medium";
}
export const lowerQuality = (q: Quality): Quality => (q === "high" ? "medium" : "low");
export type ClockMode = "manual" | "fast" | "real";
const CLOCK_MODES: ClockMode[] = ["manual", "fast", "real"];
/** One village day in fast mode lasts this many real seconds. */
export const FAST_DAY_SECONDS = 360;
/** Scene time (0 morning, 0.4 noon, 0.72 sunset, 1 night) by hour; at dawn it runs back from night. */
const DAY_KEYS: [number, number][] = [[0, 1], [4.5, 1], [6, 0], [12, 0.4], [16, 0.55], [18, 0.72], [19.5, 0.9], [21, 1], [24, 1]];
export function hourToTime(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < DAY_KEYS.length; i += 1) {
    const [h1, t1] = DAY_KEYS[i];
    if (h <= h1) {
      const [h0, t0] = DAY_KEYS[i - 1];
      return t0 + ((t1 - t0) * (h - h0)) / (h1 - h0);
    }
  }
  return 1;
}
export const clockLabel = (hour: number) => {
  const m = Math.floor((((hour % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export interface ToolDef {
  id: ToolId;
  label: string;
  hint: string;
  cat: Category | null;
  place: Place;
  /** Footprint radius, used for erasing and for keeping grass and trees off the piece. */
  size: number;
  /** Turns its front towards the nearest path when placed. */
  face?: boolean;
  animal?: boolean;
  /** What an animal says when petted. */
  sound?: string;
  person?: boolean;
  /** How the piece is named in a Vietnamese sentence (“bác nông dân”). */
  viWho?: string;
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "build", label: "Xây dựng" },
  { id: "nature", label: "Cây & hoa" },
  { id: "water", label: "Nước" },
  { id: "decor", label: "Trang trí" },
  { id: "animals", label: "Con vật" },
  { id: "people", label: "Người" },
];

const tap = (label: string, cat: Category, size: number, hint: string, extra: Partial<ToolDef> = {}) => ({ label, cat, size, hint, place: "tap" as const, ...extra });
const brush = (label: string, size: number, hint: string) => ({ label, cat: "nature" as const, size, hint, place: "brush" as const });
const animal = (label: string, size: number, sound: string) => ({
  label, cat: "animals" as const, size, place: "tap" as const, animal: true, sound,
  hint: `Chạm để thả ${label.toLowerCase()}. Chạm vào một con vật để vuốt ve: “${sound}”`,
});

const person = (label: string, viWho: string, hint: string) => ({ label, viWho, hint, cat: "people" as const, size: 0.3, place: "tap" as const, person: true });

const DEFS: Record<ToolId, Omit<ToolDef, "id">> = {
  look: { label: "Xem", cat: null, place: "look", size: 0, hint: "Chạm vào người, con vật hay công trình để xem họ đang làm gì và tên từng bộ phận bằng tiếng Anh." },
  orbit: { label: "Xoay", cat: null, place: "orbit", size: 0, hint: "Kéo để xoay đảo, chạm một điểm để đưa khung nhìn tới đó. Hai ngón tay hoặc con lăn chuột để dời và phóng to." },
  hand: { label: "Tay", cat: null, place: "hand", size: 0, hint: "Kéo bóng, thùng, bí ngô hay thuyền rồi thả tay để ném. Chạm cỏ để thổi gió nhỏ, chạm con vật để vuốt ve, chạm người để chào." },
  erase: { label: "Xóa", cat: null, place: "erase", size: 0, hint: "Kéo qua thứ muốn xóa. Lỡ tay thì bấm Hoàn tác." },

  path: { label: "Đường", cat: "build", place: "stroke", size: 0, hint: "Kéo để vẽ đường đi. Đường xuyên qua tường thành cổng, băng qua suối thành cầu." },
  wall: { label: "Tường", cat: "build", place: "stroke", size: 0, hint: "Kéo để xây tường. Tường cắt qua đường sẽ tự mở cổng vòm, góc gắt sẽ mọc tháp." },
  house: { label: "Nhà", cat: "build", place: "house", size: 0, hint: "Chạm để đặt nhà quay về phía đường, hoặc kéo để kéo dài ngôi nhà." },
  tower: tap("Tháp", "build", 1, "Chạm để dựng một ngọn tháp."),
  fence: { label: "Rào", cat: "build", place: "stroke", size: 0, hint: "Kéo để dựng hàng rào gỗ." },
  windmill: tap("Cối xay", "build", 1.1, "Chạm để dựng cối xay gió."),
  barn: tap("Nhà kho", "build", 1.9, "Chạm để dựng nhà kho đỏ; cửa lớn quay về phía đường.", { face: true }),
  chapel: tap("Nhà nguyện", "build", 2, "Chạm để dựng nhà nguyện có gác chuông.", { face: true }),
  stall: tap("Sạp hàng", "build", 1.2, "Chạm để dựng sạp hàng có mái sọc, quay ra đường.", { face: true }),
  tent: tap("Lều", "build", 1.2, "Chạm để dựng lều cắm trại.", { face: true }),
  lighthouse: tap("Hải đăng", "build", 1.3, "Chạm để dựng hải đăng. Ban đêm đèn trên đỉnh sẽ sáng."),
  gazebo: tap("Chòi", "build", 1.5, "Chạm để dựng chòi nghỉ sáu cột."),
  bakery: tap("Tiệm bánh", "build", 1.6, "Chạm để dựng tiệm bánh, cửa quay ra đường. Chú thợ bánh sẽ ra đây nướng bánh.", { face: true }),
  pagoda: tap("Chùa", "build", 1.7, "Chạm để dựng ngôi chùa hai tầng mái có chuông.", { face: true }),
  hut: tap("Chòi tranh", "build", 1.2, "Chạm để dựng túp lều tròn mái rơm.", { face: true }),
  treehouse: tap("Nhà trên cây", "build", 1.3, "Chạm để dựng nhà trên cây có thang; trẻ con sẽ trèo lên chơi."),
  castle: tap("Lâu đài", "build", 2.7, "Chạm để xây lâu đài có tháp, tường răng cưa và cầu kéo; cổng quay ra đường. Mời hiệp sĩ đến canh cổng.", { face: true }),

  tree: { label: "Cây", cat: "nature", place: "brush", size: 0.6, hint: "Chạm hoặc quét ngón tay để trồng cây." },
  hedge: { label: "Rào cây", cat: "nature", place: "stroke", size: 0, hint: "Kéo để trồng một hàng rào cây xanh." },
  bush: brush("Bụi cây", 0.55, "Chạm hoặc quét để trồng bụi cây."),
  flower: brush("Hoa", 0.35, "Chạm hoặc quét để rải hoa."),
  blossom: brush("Cây hoa", 0.9, "Chạm hoặc quét để trồng cây trổ hoa hồng."),
  sunflower: brush("Hướng dương", 0.4, "Chạm hoặc quét để trồng hướng dương."),
  mushroom: brush("Nấm", 0.35, "Chạm hoặc quét để mọc nấm."),
  rock: brush("Đá", 0.6, "Chạm hoặc quét để đặt đá."),
  log: tap("Khúc gỗ", "nature", 0.7, "Chạm để đặt một khúc gỗ."),
  stump: tap("Gốc cây", "nature", 0.45, "Chạm để đặt gốc cây."),
  garden: tap("Vườn rau", "nature", 1.6, "Chạm để làm luống rau cạnh đường.", { face: true }),
  pumpkin: brush("Bí ngô", 0.4, "Chạm hoặc quét để trồng bí ngô. Dùng Tay để lăn chúng."),
  haystack: tap("Đống rơm", "nature", 0.8, "Chạm để chất đống rơm."),
  bamboo: brush("Tre", 0.5, "Chạm hoặc quét để trồng bụi tre."),
  palm: brush("Dừa", 0.7, "Chạm hoặc quét để trồng cây dừa."),
  fern: brush("Dương xỉ", 0.45, "Chạm hoặc quét để trồng dương xỉ."),
  cactus: brush("Xương rồng", 0.4, "Chạm hoặc quét để trồng xương rồng."),

  pond: { label: "Ao", cat: "water", place: "pond", size: 0, hint: "Đặt ngón tay ở tâm rồi kéo ra để đào ao." },
  stream: { label: "Suối", cat: "water", place: "stroke", size: 0, hint: "Kéo để vẽ suối. Đường đi băng qua suối sẽ tự có cầu gỗ." },
  well: tap("Giếng", "water", 0.8, "Chạm để đặt giếng nước."),
  fountain: tap("Đài nước", "water", 1.3, "Chạm để đặt đài phun nước."),
  boat: tap("Thuyền", "water", 1.1, "Chạm để đặt thuyền. Thả xuống suối thì thuyền trôi theo dòng; dùng Tay để kéo."),
  pier: tap("Cầu tàu", "water", 1.2, "Chạm ở bờ ao hay suối: cầu tàu tự chìa ra mặt nước. Ông ngư dân thích ra đây câu."),
  lotus: { label: "Sen", cat: "water", place: "brush", size: 0.4, hint: "Chạm hoặc quét trên mặt ao, mặt suối để thả sen." },
  raft: tap("Bè", "water", 0.9, "Chạm để đặt bè tre. Thả xuống nước thì bè trôi; dùng Tay để kéo."),

  lantern: tap("Đèn", "decor", 0.3, "Chạm để dựng đèn lồng. Kéo thanh giờ về đêm để thấy đèn sáng."),
  bench: tap("Ghế", "decor", 0.7, "Chạm để đặt ghế băng quay ra đường.", { face: true }),
  signpost: tap("Biển chỉ", "decor", 0.35, "Chạm để cắm cột biển chỉ đường."),
  cart: tap("Xe kéo", "decor", 0.9, "Chạm để đặt xe kéo chở táo.", { face: true }),
  barrel: tap("Thùng tròn", "decor", 0.45, "Chạm để đặt thùng gỗ tròn. Dùng Tay để đẩy."),
  crate: tap("Thùng thưa", "decor", 0.45, "Chạm để đặt thùng gỗ thưa. Dùng Tay để đẩy."),
  flag: tap("Cờ", "decor", 0.3, "Chạm để cắm cờ."),
  statue: tap("Tượng", "decor", 0.6, "Chạm để dựng tượng đá.", { face: true }),
  scarecrow: tap("Bù nhìn", "decor", 0.5, "Chạm để dựng bù nhìn, hợp đặt cạnh vườn rau."),
  swing: tap("Xích đu", "decor", 0.9, "Chạm để dựng xích đu."),
  campfire: tap("Lửa trại", "decor", 0.6, "Chạm để nhóm lửa trại. Ban đêm lửa sáng rực."),
  beehive: tap("Tổ ong", "decor", 0.4, "Chạm để đặt tổ ong, hợp cạnh hoa."),
  woodpile: tap("Đống củi", "decor", 0.7, "Chạm để chất đống củi."),
  mailbox: tap("Hộp thư", "decor", 0.3, "Chạm để cắm hộp thư cạnh đường.", { face: true }),
  ball: tap("Bóng", "decor", 0.3, "Chạm để thả quả bóng. Dùng Tay để ném; chó sẽ chạy theo."),
  kite: tap("Diều", "decor", 0.4, "Chạm để cắm một con diều bay trong gió. Em bé sẽ ra thả diều."),
  bicycle: tap("Xe đạp", "decor", 0.6, "Chạm để dựng xe đạp cạnh đường.", { face: true }),
  umbrella: tap("Ô che", "decor", 0.9, "Chạm để cắm ô che nắng; người làng sẽ ra nghỉ dưới ô."),
  table: tap("Bàn", "decor", 0.9, "Chạm để đặt bàn ăn ngoài trời; người làng sẽ ra ăn trưa."),
  ladder: tap("Thang", "decor", 0.4, "Chạm để dựng một chiếc thang chữ A."),
  wheelbarrow: tap("Xe cút kít", "decor", 0.7, "Chạm để đặt xe cút kít chở bí ngô.", { face: true }),
  seesaw: tap("Bập bênh", "decor", 1.1, "Chạm để đặt bập bênh cho trẻ con chơi."),
  slide: tap("Cầu trượt", "decor", 1.1, "Chạm để đặt cầu trượt cho trẻ con chơi."),
  snowman: tap("Người tuyết", "decor", 0.5, "Chạm để đắp người tuyết.", { face: true }),
  birdhouse: tap("Tổ chim", "decor", 0.3, "Chạm để cắm tổ chim bằng gỗ."),
  lamppost: tap("Cột đèn", "decor", 0.3, "Chạm để dựng cột đèn đường. Ban đêm đèn sáng."),

  sheep: animal("Cừu", 0.5, "Be-e-e!"),
  chicken: animal("Gà", 0.3, "Cục tác!"),
  duck: animal("Vịt", 0.3, "Quạc quạc!"),
  cow: animal("Bò", 0.8, "Ụm bò!"),
  horse: animal("Ngựa", 0.8, "Hí hí!"),
  pig: animal("Lợn", 0.5, "Ụt ịt!"),
  dog: animal("Chó", 0.4, "Gâu gâu!"),
  cat: animal("Mèo", 0.3, "Meo meo!"),
  rabbit: animal("Thỏ", 0.3, "Thỏ dụi mũi vào tay bạn."),
  buffalo: animal("Trâu", 0.9, "Nghé ọ!"),
  goat: animal("Dê", 0.45, "Be be!"),
  goose: animal("Ngỗng", 0.35, "Quác quác!"),
  frog: animal("Ếch", 0.2, "Ộp ộp!"),
  fish: { ...animal("Cá", 0.25, "Tõm!"), place: "brush", hint: "Chạm hoặc quét trên ao, suối để thả cá. Cá bơi quanh và thỉnh thoảng nhảy lên; dùng Tay chạm vào cá để cá nhảy." },

  farmer: person("Nông dân", "bác nông dân", "Chạm để mời bác nông dân đến làng. Bác tưới vườn rau, hái bí ngô."),
  baker: person("Thợ bánh", "chú thợ bánh", "Chạm để mời chú thợ bánh. Có sạp hàng thì chú ra sạp bán bánh."),
  fisherman: person("Ngư dân", "ông ngư dân", "Chạm để mời ông ngư dân. Ông ra ao hoặc suối gần nhất để câu cá."),
  shepherd: person("Chăn cừu", "anh chăn cừu", "Chạm để mời anh chăn cừu. Anh đi theo đàn cừu gần nhất."),
  woodcutter: person("Tiều phu", "chú tiều phu", "Chạm để mời chú tiều phu. Chú bổ củi ở đống củi, khúc gỗ hay gốc cây."),
  postman: person("Đưa thư", "chú đưa thư", "Chạm để mời chú đưa thư. Chú đi lần lượt tới từng hộp thư."),
  musician: person("Nhạc công", "anh nhạc công", "Chạm để mời anh nhạc công. Anh đàn bên lửa trại, đài nước hay chòi nghỉ."),
  child: person("Em bé", "em bé", "Chạm để thêm một em bé. Em đá bóng, chơi xích đu, chạy nhảy khắp nơi."),
  knight: person("Hiệp sĩ", "chàng hiệp sĩ", "Chạm để mời một hiệp sĩ. Có lâu đài thì hiệp sĩ canh cổng và đi tuần quanh tường; không có thì tuần tra quanh làng."),
};

export const TOOLS: ToolDef[] = (Object.keys(DEFS) as ToolId[]).map((id) => ({ id, ...DEFS[id] }));
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;
export const STARTER: ToolId[] = ["orbit", "look", "hand", "path", "wall", "house", "tree", "erase"];
export const isPropKind = (value: unknown): value is PropKind => typeof value === "string" && (PROP_KINDS as readonly string[]).includes(value);
/** Brushed plants are drawn as instanced meshes, so thousands stay cheap. */
export const INSTANCED: PropKind[] = ["bush", "flower", "blossom", "sunflower", "mushroom", "rock", "bamboo", "palm", "fern", "cactus", "lotus", "kite"];

export interface WordDef { ipa: string; vi: string; sentence: string; viS: string; tip?: string }
const w = (ipa: string, vi: string, sentence: string, viS: string, tip?: string): WordDef => ({ ipa, vi, sentence, viS, ...(tip ? { tip } : {}) });
export const WORDS: Record<WordId, WordDef> = {
  path: w("/pæθ/", "lối đi, đường mòn", "A narrow ___ leads from the gate to the house.", "Một lối đi hẹp dẫn từ cổng vào nhà."),
  wall: w("/wɔːl/", "bức tường", "The old stone ___ keeps the wind out of the village.", "Bức tường đá cũ chắn gió cho ngôi làng."),
  house: w("/haʊs/", "ngôi nhà", "Their ___ has a blue roof and a small garden.", "Nhà của họ có mái xanh và một khu vườn nhỏ."),
  tower: w("/ˈtaʊ.ɚ/", "ngọn tháp", "From the top of the ___, you can see the whole village.", "Từ đỉnh tháp, bạn có thể nhìn thấy cả ngôi làng.", "Hay đi cùng: bell tower (tháp chuông), watchtower (tháp canh)."),
  fence: w("/fens/", "hàng rào", "We built a low ___ to keep the sheep in the field.", "Chúng tôi dựng một hàng rào thấp để giữ cừu trong cánh đồng.", "Thành ngữ: sit on the fence nghĩa là lưỡng lự, chưa chọn bên nào."),
  windmill: w("/ˈwɪnd.mɪl/", "cối xay gió", "The ___ turns slowly when the wind blows.", "Cối xay gió quay chậm khi gió thổi.", "Từ ghép: wind (gió) + mill (cối xay)."),
  barn: w("/bɑːrn/", "nhà kho (ở nông trại)", "The farmer keeps the hay and the cows in the old red ___.", "Bác nông dân cất rơm và nhốt bò trong nhà kho đỏ cũ.", "barn là nhà kho ở nông trại, chứa cỏ khô, nông cụ hoặc vật nuôi."),
  chapel: w("/ˈtʃæp.əl/", "nhà nguyện", "On Sunday morning, the bell rang in the little ___.", "Sáng Chủ nhật, chuông ngân vang trong nhà nguyện nhỏ.", "chapel nhỏ hơn church (nhà thờ)."),
  stall: w("/stɑːl/", "sạp hàng, quầy hàng", "She sells fresh bread at a ___ in the market.", "Cô ấy bán bánh mì tươi ở một sạp hàng ngoài chợ.", "market stall là sạp ở chợ; food stall là quầy đồ ăn."),
  tent: w("/tent/", "cái lều", "We put up a ___ by the lake and slept under the stars.", "Chúng tôi dựng lều bên hồ và ngủ dưới bầu trời sao.", "put up a tent là dựng lều; take down a tent là dỡ lều."),
  lighthouse: w("/ˈlaɪt.haʊs/", "ngọn hải đăng", "The light from the ___ helps ships find their way at night.", "Ánh sáng từ ngọn hải đăng giúp tàu thuyền tìm đường ban đêm.", "Từ ghép: light (ánh sáng) + house (ngôi nhà)."),
  gazebo: w("/ɡəˈziː.boʊ/", "chòi nghỉ trong vườn", "We drank tea in the ___ at the end of the garden.", "Chúng tôi uống trà trong chòi nghỉ ở cuối vườn."),
  bakery: w("/ˈbeɪ.kɚ.i/", "tiệm bánh", "The ___ smells of fresh bread every morning.", "Tiệm bánh thơm mùi bánh mì mới mỗi sáng.", "baker (thợ bánh) + y → bakery (tiệm bánh)."),
  pagoda: w("/pəˈɡoʊ.də/", "ngôi chùa", "We heard the bell ring at the old ___.", "Chúng tôi nghe tiếng chuông ngân ở ngôi chùa cổ.", "Chùa Một Cột trong tiếng Anh là One Pillar Pagoda."),
  hut: w("/hʌt/", "túp lều, chòi tranh", "The fisherman lives in a small ___ by the river.", "Ông ngư dân sống trong một túp lều nhỏ bên sông."),
  castle: w("/ˈkæs.əl/", "lâu đài", "The king and queen live in a big stone ___.", "Nhà vua và hoàng hậu sống trong một lâu đài đá lớn.", "Chữ t trong castle không đọc: /ˈkæs.əl/."),
  treehouse: w("/ˈtriː.haʊs/", "nhà trên cây", "The children climb up to their ___ after school.", "Bọn trẻ trèo lên nhà trên cây sau giờ học.", "Từ ghép: tree (cây) + house (nhà)."),

  tree: w("/triː/", "cái cây", "We had lunch in the shade of a big ___.", "Chúng tôi ăn trưa dưới bóng một cái cây lớn."),
  hedge: w("/hedʒ/", "hàng rào cây xanh", "A tall ___ separates our garden from the road.", "Một hàng rào cây cao ngăn vườn nhà tôi với con đường."),
  bush: w("/bʊʃ/", "bụi cây", "The cat is hiding behind the ___.", "Con mèo đang trốn sau bụi cây.", "Thành ngữ: beat around the bush nghĩa là nói vòng vo."),
  flower: w("/ˈflaʊ.ɚ/", "bông hoa", "He picked a red ___ for his mother.", "Cậu ấy hái một bông hoa đỏ tặng mẹ.", "flower và flour (bột mì) đọc giống nhau."),
  blossom: w("/ˈblɑː.səm/", "hoa (của cây), cây trổ hoa", "In spring, the trees are covered in pink ___.", "Vào mùa xuân, cây phủ đầy hoa màu hồng.", "cherry blossom là hoa anh đào."),
  sunflower: w("/ˈsʌnˌflaʊ.ɚ/", "hoa hướng dương", "A tall ___ turns its face to the sun.", "Cây hướng dương cao quay mặt về phía mặt trời.", "Từ ghép: sun (mặt trời) + flower (hoa)."),
  mushroom: w("/ˈmʌʃ.ruːm/", "cây nấm", "Don't eat a wild ___ unless you know it is safe.", "Đừng ăn nấm dại trừ khi bạn biết chắc nó an toàn."),
  rock: w("/rɑːk/", "tảng đá", "The children sat on a big ___ by the river.", "Bọn trẻ ngồi trên một tảng đá lớn bên sông.", "rock thường là tảng đá lớn; stone hay chỉ hòn đá nhỏ hoặc chất liệu đá."),
  log: w("/lɑːɡ/", "khúc gỗ", "He put another ___ on the fire to keep us warm.", "Anh ấy cho thêm một khúc gỗ vào lửa để giữ ấm cho chúng tôi.", "log in là đăng nhập; log cũng là nhật ký ghi lại sự việc."),
  stump: w("/stʌmp/", "gốc cây", "After the storm, only a ___ was left where the old tree stood.", "Sau cơn bão, chỉ còn một gốc cây ở chỗ cây cổ thụ từng đứng."),
  garden: w("/ˈɡɑːr.dən/", "khu vườn", "We grow carrots and lettuce in our small ___.", "Chúng tôi trồng cà rốt và rau diếp trong khu vườn nhỏ.", "vegetable garden là vườn rau; flower garden là vườn hoa."),
  pumpkin: w("/ˈpʌmp.kɪn/", "quả bí ngô", "In autumn, she makes soup from a big orange ___.", "Mùa thu, cô ấy nấu súp từ một quả bí ngô to màu cam."),
  haystack: w("/ˈheɪ.stæk/", "đống rơm, đống cỏ khô", "The farmer made a ___ to feed the animals in winter.", "Bác nông dân chất một đống cỏ khô để cho vật nuôi ăn vào mùa đông.", "Thành ngữ: look for a needle in a haystack nghĩa là mò kim đáy bể."),
  bamboo: w("/bæmˈbuː/", "cây tre", "The ___ by the village gate grows very fast.", "Bụi tre ở cổng làng mọc rất nhanh.", "Lũy tre làng: a bamboo hedge around the village."),
  palm: w("/pɑːm/", "cây dừa, cây cọ", "We sat in the shade of a tall ___ tree.", "Chúng tôi ngồi dưới bóng một cây dừa cao.", "Chữ l trong palm không đọc. palm còn nghĩa là lòng bàn tay."),
  fern: w("/fɝːn/", "cây dương xỉ", "A green ___ grows in the shade under the trees.", "Một cây dương xỉ xanh mọc trong bóng râm dưới tán cây."),
  cactus: w("/ˈkæk.təs/", "cây xương rồng", "Don't touch the ___; it has sharp thorns.", "Đừng chạm vào cây xương rồng, nó có gai nhọn.", "Số nhiều: cacti hoặc cactuses."),

  pond: w("/pɑːnd/", "cái ao", "Ducks are swimming in the ___ behind the house.", "Đàn vịt đang bơi trong cái ao sau nhà.", "pond nhỏ hơn lake (hồ)."),
  stream: w("/striːm/", "con suối", "The water in the ___ is cold and clear.", "Nước trong con suối lạnh và trong vắt.", "stream nhỏ hơn river (sông). Đường đi băng qua suối sẽ có bridge (cây cầu)."),
  well: w("/wel/", "giếng nước", "The villagers get fresh water from the old ___.", "Dân làng lấy nước sạch từ cái giếng cũ.", "well cũng là trạng từ “tốt, giỏi” (She sings well). Ở đây là danh từ “giếng”."),
  fountain: w("/ˈfaʊn.tən/", "đài phun nước", "People throw coins into the ___ and make a wish.", "Mọi người ném đồng xu vào đài phun nước và ước một điều."),
  boat: w("/boʊt/", "con thuyền", "We took a small ___ across the lake.", "Chúng tôi đi một chiếc thuyền nhỏ qua hồ.", "boat là thuyền nhỏ; ship là tàu lớn."),
  pier: w("/pɪr/", "cầu tàu, bến gỗ", "The boat is tied to the wooden ___.", "Chiếc thuyền được buộc vào cầu tàu bằng gỗ."),
  lotus: w("/ˈloʊ.t̬əs/", "hoa sen", "A pink ___ is blooming in the pond.", "Một bông sen hồng đang nở trong ao.", "Hoa sen thường được xem là quốc hoa của Việt Nam."),
  raft: w("/ræft/", "cái bè", "They floated down the river on a bamboo ___.", "Họ thả trôi xuôi dòng sông trên một chiếc bè tre."),

  lantern: w("/ˈlæn.tɚn/", "đèn lồng", "She hung a ___ by the door so guests could find the way.", "Cô ấy treo đèn lồng cạnh cửa để khách tìm được đường.", "lantern là đèn có vỏ che, thường mang đi được; lamp là đèn nói chung."),
  bench: w("/bentʃ/", "ghế băng, ghế dài", "Grandpa likes to sit on the ___ and feed the birds.", "Ông thích ngồi trên ghế băng và cho chim ăn."),
  signpost: w("/ˈsaɪn.poʊst/", "cột biển chỉ đường", "The ___ says the village is two kilometers away.", "Cột biển chỉ đường ghi rằng ngôi làng cách đây hai cây số.", "Từ ghép: sign (biển báo) + post (cột)."),
  cart: w("/kɑːrt/", "xe kéo, xe đẩy", "The horse pulled a ___ full of apples.", "Con ngựa kéo một chiếc xe đầy táo.", "shopping cart là xe đẩy ở siêu thị."),
  barrel: w("/ˈber.əl/", "thùng gỗ tròn", "The old ___ is full of rainwater.", "Cái thùng gỗ tròn cũ đầy nước mưa."),
  crate: w("/kreɪt/", "thùng gỗ thưa", "They packed the oranges into a wooden ___.", "Họ xếp cam vào một thùng gỗ thưa."),
  flag: w("/flæɡ/", "lá cờ", "A colorful ___ is flying on top of the tower.", "Một lá cờ sặc sỡ đang bay trên đỉnh tháp."),
  statue: w("/ˈstætʃ.uː/", "bức tượng", "There is a stone ___ of a famous poet in the square.", "Có một bức tượng đá của một nhà thơ nổi tiếng ở quảng trường."),
  scarecrow: w("/ˈsker.kroʊ/", "bù nhìn", "The farmer put a ___ in the field to keep the birds away.", "Bác nông dân dựng bù nhìn trên đồng để đuổi chim.", "Từ ghép: scare (làm sợ) + crow (con quạ)."),
  swing: w("/swɪŋ/", "cái xích đu", "The kids took turns on the ___ under the tree.", "Bọn trẻ thay phiên nhau chơi xích đu dưới gốc cây.", "swing cũng là động từ “đung đưa”."),
  campfire: w("/ˈkæmp.faɪr/", "lửa trại", "We sang songs around the ___.", "Chúng tôi hát quanh đống lửa trại."),
  beehive: w("/ˈbiː.haɪv/", "tổ ong", "Hundreds of bees live in the ___ near the flowers.", "Hàng trăm con ong sống trong tổ ong gần những bông hoa.", "Từ ghép: bee (con ong) + hive (tổ)."),
  woodpile: w("/ˈwʊd.paɪl/", "đống củi", "He took some wood from the ___ to light the stove.", "Anh ấy lấy ít củi từ đống củi để nhóm bếp."),
  mailbox: w("/ˈmeɪl.bɑːks/", "hộp thư", "There's a letter for you in the ___.", "Có một lá thư cho bạn trong hộp thư.", "Anh-Anh hay nói letterbox hoặc postbox."),
  ball: w("/bɑːl/", "quả bóng", "The dog ran across the field to catch the ___.", "Con chó chạy băng qua cánh đồng để bắt quả bóng.", "Thành ngữ: on the ball nghĩa là nhanh nhạy, nắm bắt tốt."),
  kite: w("/kaɪt/", "con diều", "The boy is flying a ___ in the windy field.", "Cậu bé đang thả diều trên cánh đồng lộng gió.", "fly a kite: thả diều."),
  bicycle: w("/ˈbaɪ.sə.kəl/", "xe đạp", "She rides her ___ to the market.", "Cô ấy đạp xe ra chợ.", "Nói ngắn là bike."),
  umbrella: w("/ʌmˈbrel.ə/", "cái ô, cái dù", "Take an ___; it might rain.", "Mang theo ô nhé, trời có thể mưa.", "Bắt đầu bằng nguyên âm nên đi với an: an umbrella."),
  table: w("/ˈteɪ.bəl/", "cái bàn", "Lunch is ready on the ___.", "Bữa trưa đã dọn sẵn trên bàn."),
  ladder: w("/ˈlæd.ɚ/", "cái thang", "He climbed the ___ to fix the roof.", "Anh ấy trèo thang lên sửa mái nhà."),
  wheelbarrow: w("/ˈwiːlˌber.oʊ/", "xe cút kít", "The farmer pushes a ___ full of pumpkins.", "Bác nông dân đẩy xe cút kít đầy bí ngô.", "wheel (bánh xe) + barrow (xe đẩy)."),
  seesaw: w("/ˈsiː.sɑː/", "cái bập bênh", "Two kids go up and down on the ___.", "Hai đứa trẻ lên xuống trên chiếc bập bênh."),
  slide: w("/slaɪd/", "cầu trượt", "The children go down the ___ one by one.", "Bọn trẻ lần lượt trượt xuống cầu trượt.", "slide cũng là động từ: trượt."),
  snowman: w("/ˈsnoʊ.mæn/", "người tuyết", "We made a ___ with a carrot nose.", "Chúng tôi đắp người tuyết có cái mũi bằng cà rốt.", "snow (tuyết) + man (người)."),
  birdhouse: w("/ˈbɝːd.haʊs/", "tổ chim bằng gỗ", "A little bird lives in the ___ on the post.", "Một chú chim nhỏ sống trong tổ chim gỗ trên cột."),
  lamppost: w("/ˈlæmp.poʊst/", "cột đèn đường", "The ___ lights up the street at night.", "Cột đèn chiếu sáng con đường vào ban đêm.", "lamp (đèn) + post (cột)."),

  sheep: w("/ʃiːp/", "con cừu", "The ___ are eating grass near the river.", "Đàn cừu đang ăn cỏ gần bờ sông.", "Số nhiều vẫn là sheep: one sheep, two sheep."),
  chicken: w("/ˈtʃɪk.ɪn/", "con gà", "The ___ lays an egg every morning.", "Con gà đẻ một quả trứng mỗi sáng.", "chicken vừa là con gà vừa là thịt gà."),
  duck: w("/dʌk/", "con vịt", "A mother ___ walked to the pond with her babies.", "Một con vịt mẹ dẫn đàn con ra ao.", "duck cũng là động từ “cúi né”: Duck! nghĩa là Cúi xuống!"),
  cow: w("/kaʊ/", "con bò", "The ___ gives us fresh milk every day.", "Con bò cho chúng ta sữa tươi mỗi ngày."),
  horse: w("/hɔːrs/", "con ngựa", "She rides her ___ along the beach.", "Cô ấy cưỡi ngựa dọc bờ biển."),
  pig: w("/pɪɡ/", "con lợn, con heo", "The little ___ is rolling in the mud.", "Chú lợn con đang lăn trong bùn."),
  dog: w("/dɑːɡ/", "con chó", "Our ___ barks when someone knocks on the door.", "Con chó nhà tôi sủa khi có người gõ cửa."),
  cat: w("/kæt/", "con mèo", "The ___ is sleeping in the sun by the window.", "Con mèo đang ngủ dưới nắng bên cửa sổ."),
  rabbit: w("/ˈræb.ɪt/", "con thỏ", "The ___ has long ears and a short, fluffy tail.", "Con thỏ có đôi tai dài và cái đuôi ngắn, xù."),
  buffalo: w("/ˈbʌf.ə.loʊ/", "con trâu", "The ___ helps the farmer in the rice field.", "Con trâu giúp bác nông dân trên ruộng lúa.", "Trâu nước là water buffalo."),
  goat: w("/ɡoʊt/", "con dê", "The ___ likes to climb on rocks.", "Con dê thích trèo lên đá."),
  goose: w("/ɡuːs/", "con ngỗng", "A white ___ is swimming in the pond.", "Một con ngỗng trắng đang bơi trong ao.", "Số nhiều bất quy tắc: geese /ɡiːs/."),
  frog: w("/frɑːɡ/", "con ếch", "The little ___ jumps into the water.", "Chú ếch nhỏ nhảy xuống nước."),
  fish: w("/fɪʃ/", "con cá", "A little ___ is swimming in the river.", "Một chú cá nhỏ đang bơi trong sông.", "Số nhiều thường vẫn là fish: one fish, two fish."),

  farmer: w("/ˈfɑːr.mɚ/", "nông dân", "The ___ gets up early to work in the fields.", "Người nông dân dậy sớm để làm việc ngoài đồng."),
  baker: w("/ˈbeɪ.kɚ/", "thợ làm bánh", "The ___ makes fresh bread every morning.", "Người thợ làm bánh làm bánh mì tươi mỗi sáng.", "bake (nướng bánh) + -er thành baker; tiệm bánh là bakery."),
  fisherman: w("/ˈfɪʃ.ɚ.mən/", "ngư dân, người câu cá", "The old ___ caught a big fish in the lake.", "Ông ngư dân già câu được một con cá lớn ở hồ.", "Số nhiều là fishermen."),
  shepherd: w("/ˈʃep.ɚd/", "người chăn cừu", "The ___ takes the sheep up the hill.", "Người chăn cừu dẫn đàn cừu lên đồi.", "Chữ h trong shepherd không đọc: /ˈʃep.ɚd/."),
  woodcutter: w("/ˈwʊdˌkʌt̬.ɚ/", "tiều phu, người đốn củi", "The ___ went into the forest with his axe.", "Chú tiều phu vào rừng với cái rìu.", "Từ ghép: wood (gỗ) + cutter (người cắt)."),
  postman: w("/ˈpoʊst.mən/", "người đưa thư", "The ___ brings our letters every afternoon.", "Chú đưa thư mang thư đến cho chúng tôi mỗi chiều.", "Anh-Mỹ hay nói mail carrier."),
  musician: w("/mjuːˈzɪʃ.ən/", "nhạc công", "A ___ played a song by the fire.", "Một nhạc công chơi một bài hát bên đống lửa.", "music (âm nhạc) + -ian chỉ người làm nghề đó."),
  knight: w("/naɪt/", "hiệp sĩ", "The brave ___ rode his horse to the castle.", "Chàng hiệp sĩ dũng cảm cưỡi ngựa đến lâu đài.", "Chữ k không đọc: knight đọc giống night (ban đêm)."),
  child: w("/tʃaɪld/", "đứa trẻ", "The ___ is laughing on the swing.", "Đứa trẻ đang cười trên xích đu.", "Số nhiều bất quy tắc: children /ˈtʃɪl.drən/."),
};
/** Words in dock order: grouped by category. */
export const WORD_ORDER = TOOLS.filter((t) => t.cat).map((t) => t.id as WordId);
export const toolOfWord = (word: WordId) => TOOL[word];
export const wordsIn = (cat: Category) => WORD_ORDER.filter((word) => TOOL[word].cat === cat);

/** How a piece is named in a Vietnamese sentence: “con chó”, “bác nông dân”. */
export const viWho = (word: WordId) => TOOL[word].viWho ?? WORDS[word].vi.split(",")[0].trim();
const isVocabKey = (key: string) => {
  const [kind, id] = key.split(":");
  return (kind === "verb" && id in VERBS) || (kind === "part" && id in PARTS) || (kind === "noun" && id in RESIDENTS) || (kind === "chat" && id in CHAT);
};

/* ---------- geometry helpers ---------- */

export const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lineLength = (pts: Point[]) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);
export const round2 = (pts: Point[]): Point[] => pts.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash2 = (x: number, z: number) => (Math.imul(Math.round(x * 97), 73856093) ^ Math.imul(Math.round(z * 97), 19349663)) >>> 0;

/** Corner-cutting smoothing; keeps both end points so walls still meet where they were drawn. */
export function chaikin(pts: Point[], iterations: number): Point[] {
  let out = pts;
  for (let k = 0; k < iterations; k += 1) {
    if (out.length < 3) return out;
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i += 1) {
      const [ax, az] = out[i], [bx, bz] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** Points every `step` along the line, plus the exact end point. */
export function resample(pts: Point[], step: number): Point[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const out: Point[] = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i], b = pts[i + 1];
    const len = dist(a, b);
    let t = step - carry;
    while (t <= len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
      t += step;
    }
    carry = len - (t - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.35) out.push([last[0], last[1]]);
  else out[out.length - 1] = [last[0], last[1]];
  return out;
}

export function clampToIsland([x, z]: Point): Point {
  const r = Math.hypot(x, z);
  return r > BUILD_R ? [(x / r) * BUILD_R, (z / r) * BUILD_R] : [x, z];
}

/* ---------- saves ---------- */

export function emptyScene(): VillageScene {
  return { paths: [], walls: [], fences: [], hedges: [], streams: [], houses: [], towers: [], trees: [], wells: [], ponds: [], mills: [], lanterns: [], sheep: [], props: [] };
}

const MAX_ITEMS = 3000;
const finite = (...values: unknown[]) => values.every((v) => typeof v === "number" && Number.isFinite(v));
const onIsland = (x: number, z: number) => Math.hypot(x, z) <= ISLAND_R;
const records = (value: unknown) =>
  (Array.isArray(value) ? value : []).filter((item): item is Record<string, unknown> => !!item && typeof item === "object").slice(0, MAX_ITEMS);

function strokes(value: unknown): Stroke[] {
  return records(value).flatMap((item) => {
    if (!finite(item.id) || !Array.isArray(item.pts)) return [];
    const pts = item.pts.filter((p): p is Point => Array.isArray(p) && p.length === 2 && finite(p[0], p[1]) && onIsland(p[0], p[1])).slice(0, 4000);
    return pts.length >= 2 ? [{ id: item.id as number, pts }] : [];
  });
}
function placed(value: unknown): Placed[] {
  return records(value).flatMap((o) =>
    finite(o.id, o.x, o.z, o.seed) && onIsland(o.x as number, o.z as number)
      ? [{ id: o.id as number, x: o.x as number, z: o.z as number, seed: o.seed as number, ...(finite(o.r) ? { r: o.r as number } : {}) }]
      : []);
}

/** Validates a stored scene; anything malformed is dropped rather than trusted. */
export function parseSavedScene(raw: string | null): SavedScene | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.v !== 1 || !value.scene || typeof value.scene !== "object") return null;
  const s = value.scene as Record<string, unknown>;
  const scene: VillageScene = {
    paths: strokes(s.paths),
    walls: strokes(s.walls),
    fences: strokes(s.fences),
    hedges: strokes(s.hedges),
    streams: strokes(s.streams),
    houses: records(s.houses).flatMap((h) =>
      finite(h.id, h.x, h.z, h.len, h.r, h.seed) && onIsland(h.x as number, h.z as number)
        ? [{ id: h.id as number, x: h.x as number, z: h.z as number, len: Math.min(4.4, Math.max(1.2, h.len as number)), r: h.r as number, seed: h.seed as number }]
        : []),
    towers: placed(s.towers),
    trees: records(s.trees).flatMap((t) =>
      finite(t.id, t.x, t.z, t.s, t.r) && onIsland(t.x as number, t.z as number)
        ? [{ id: t.id as number, x: t.x as number, z: t.z as number, s: Math.min(1.6, Math.max(0.4, t.s as number)), k: t.k === 1 ? 1 : 0, r: t.r as number } satisfies Tree]
        : []),
    wells: placed(s.wells),
    ponds: records(s.ponds).flatMap((p) =>
      finite(p.id, p.x, p.z, p.r, p.seed) && onIsland(p.x as number, p.z as number)
        ? [{ id: p.id as number, x: p.x as number, z: p.z as number, r: Math.min(3.4, Math.max(0.9, p.r as number)), seed: p.seed as number }]
        : []),
    mills: placed(s.mills),
    lanterns: placed(s.lanterns),
    sheep: placed(s.sheep),
    props: records(s.props).flatMap((o) =>
      isPropKind(o.kind) && finite(o.id, o.x, o.z, o.r, o.seed) && onIsland(o.x as number, o.z as number)
        ? [{ id: o.id as number, kind: o.kind, x: o.x as number, z: o.z as number, r: o.r as number, seed: o.seed as number }]
        : []),
  };
  const ids = Object.values(scene).flat().map((item) => item.id);
  const idSeq = Math.max(finite(value.idSeq) ? (value.idSeq as number) : 1, ...ids.map((id) => id + 1));
  return { scene, idSeq };
}

export function parseProgress(raw: string | null): VillageProgress {
  const fallback: VillageProgress = { unlocked: [...STARTER], learned: {}, seen: {}, review: {}, time: 0.32, clock: "manual", hour: 9, quality: "auto", weather: "auto" };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const unlocked = Array.isArray(data.unlocked) ? data.unlocked.filter((t): t is ToolId => typeof t === "string" && t in TOOL) : [];
    const learned: VillageProgress["learned"] = {};
    if (data.learned && typeof data.learned === "object") {
      for (const [word, entry] of Object.entries(data.learned as Record<string, unknown>)) {
        if (!(word in WORDS) || !entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (finite(e.at)) learned[word] = { at: e.at as number, ...(finite(e.reviewed) ? { reviewed: e.reviewed as number } : {}) };
      }
    }
    const seen: VillageProgress["seen"] = {};
    if (data.seen && typeof data.seen === "object") {
      for (const [key, at] of Object.entries(data.seen as Record<string, unknown>)) if (isVocabKey(key) && finite(at)) seen[key] = at as number;
    }
    const review: VillageProgress["review"] = {};
    if (data.review && typeof data.review === "object") {
      for (const [key, entry] of Object.entries(data.review as Record<string, unknown>)) {
        const e = entry as Record<string, unknown> | null;
        const known = key.startsWith("word:") ? key.slice(5) in WORDS : isVocabKey(key);
        if (known && e && finite(e.due) && finite(e.step)) review[key] = { due: e.due as number, step: Math.max(0, Math.floor(e.step as number)) };
      }
    }
    return {
      unlocked: [...new Set([...STARTER, ...unlocked])],
      learned,
      seen,
      review,
      time: finite(data.time) ? Math.min(1, Math.max(0, data.time as number)) : fallback.time,
      clock: CLOCK_MODES.includes(data.clock as ClockMode) ? (data.clock as ClockMode) : "manual",
      hour: finite(data.hour) ? (((data.hour as number) % 24) + 24) % 24 : fallback.hour,
      quality: QUALITY_CHOICES.includes(data.quality as QualityChoice) ? (data.quality as QualityChoice) : "auto",
      weather: WEATHERS.includes(data.weather as Weather) ? (data.weather as Weather) : "auto",
    };
  } catch {
    return fallback;
  }
}

/** Case- and space-insensitive check for the typed answer in a lesson. */
export const isAnswer = (typed: string, word: WordId) => typed.trim().toLowerCase() === word;
