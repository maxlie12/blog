/**
 * Làng Rêu (village builder): tools, vocabulary, stroke geometry helpers and save parsing.
 * Pure data and functions only — no React, DOM or three.js — so it is cheap to import and test.
 */

export const ISLAND_R = 14;
export const BUILD_R = 12.4;
export const STEP = 0.5;
export const SCENE_KEY = "village-scene-v1";
export const PROGRESS_KEY = "village-progress-v1";

export type Point = [number, number];
export interface Stroke { id: number; pts: Point[] }
export interface Placed { id: number; x: number; z: number; seed: number; r?: number }
export interface House { id: number; x: number; z: number; len: number; r: number; seed: number }
export interface Tree { id: number; x: number; z: number; s: number; k: 0 | 1; r: number }
export interface Pond { id: number; x: number; z: number; r: number; seed: number }
export interface VillageScene {
  paths: Stroke[];
  walls: Stroke[];
  fences: Stroke[];
  houses: House[];
  towers: Placed[];
  trees: Tree[];
  wells: Placed[];
  ponds: Pond[];
  mills: Placed[];
  lanterns: Placed[];
  sheep: Placed[];
}
export interface SavedScene { scene: VillageScene; idSeq: number }
export interface VillageProgress { unlocked: ToolId[]; learned: Record<string, { at: number; reviewed?: number }>; time: number }

export type ToolId =
  | "orbit" | "path" | "wall" | "house" | "tree"
  | "tower" | "fence" | "well" | "pond" | "windmill" | "lantern" | "sheep"
  | "erase";
export type WordId = "path" | "wall" | "house" | "tree" | "tower" | "fence" | "well" | "pond" | "windmill" | "lantern" | "sheep";

export interface ToolDef { id: ToolId; label: string; hint: string; word?: WordId }
export const TOOLS: ToolDef[] = [
  { id: "orbit", label: "Xoay", hint: "Kéo để xoay đảo. Hai ngón tay hoặc con lăn chuột để phóng to, thu nhỏ." },
  { id: "path", label: "Đường", word: "path", hint: "Kéo để vẽ đường đi. Đường đi xuyên qua tường sẽ thành cổng." },
  { id: "wall", label: "Tường", word: "wall", hint: "Kéo để xây tường. Tường cắt qua đường sẽ tự mở cổng vòm, góc gắt sẽ mọc tháp." },
  { id: "house", label: "Nhà", word: "house", hint: "Chạm để đặt nhà quay về phía đường, hoặc kéo để kéo dài ngôi nhà." },
  { id: "tree", label: "Cây", word: "tree", hint: "Chạm hoặc quét ngón tay để trồng cây." },
  { id: "tower", label: "Tháp", word: "tower", hint: "Chạm để dựng một ngọn tháp." },
  { id: "fence", label: "Rào", word: "fence", hint: "Kéo để dựng hàng rào gỗ." },
  { id: "well", label: "Giếng", word: "well", hint: "Chạm để đặt giếng nước." },
  { id: "pond", label: "Ao", word: "pond", hint: "Đặt ngón tay ở tâm rồi kéo ra để đào ao." },
  { id: "windmill", label: "Cối xay", word: "windmill", hint: "Chạm để dựng cối xay gió." },
  { id: "lantern", label: "Đèn", word: "lantern", hint: "Chạm để dựng đèn lồng. Kéo thanh giờ về đêm để thấy đèn sáng." },
  { id: "sheep", label: "Cừu", word: "sheep", hint: "Chạm để thả cừu. Chạm vào một con cừu để vuốt ve nó." },
  { id: "erase", label: "Xóa", hint: "Kéo qua thứ muốn xóa. Lỡ tay thì bấm Hoàn tác." },
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;
export const STARTER: ToolId[] = ["orbit", "path", "wall", "house", "tree", "erase"];

export interface WordDef { ipa: string; vi: string; sentence: string; viS: string; tip?: string }
export const WORDS: Record<WordId, WordDef> = {
  path: { ipa: "/pæθ/", vi: "lối đi, đường mòn", sentence: "A narrow ___ leads from the gate to the house.", viS: "Một lối đi hẹp dẫn từ cổng vào nhà." },
  wall: { ipa: "/wɔːl/", vi: "bức tường", sentence: "The old stone ___ keeps the wind out of the village.", viS: "Bức tường đá cũ chắn gió cho ngôi làng." },
  house: { ipa: "/haʊs/", vi: "ngôi nhà", sentence: "Their ___ has a blue roof and a small garden.", viS: "Nhà của họ có mái xanh và một khu vườn nhỏ." },
  tree: { ipa: "/triː/", vi: "cái cây", sentence: "We had lunch in the shade of a big ___.", viS: "Chúng tôi ăn trưa dưới bóng một cái cây lớn." },
  tower: { ipa: "/ˈtaʊ.ɚ/", vi: "ngọn tháp", sentence: "From the top of the ___, you can see the whole village.", viS: "Từ đỉnh tháp, bạn có thể nhìn thấy cả ngôi làng.", tip: "Hay đi cùng: bell tower (tháp chuông), watchtower (tháp canh)." },
  fence: { ipa: "/fens/", vi: "hàng rào", sentence: "We built a low ___ to keep the sheep in the field.", viS: "Chúng tôi dựng một hàng rào thấp để giữ cừu trong cánh đồng.", tip: "Thành ngữ: sit on the fence nghĩa là lưỡng lự, chưa chọn bên nào." },
  well: { ipa: "/wel/", vi: "giếng nước", sentence: "The villagers get fresh water from the old ___.", viS: "Dân làng lấy nước sạch từ cái giếng cũ.", tip: "well cũng là trạng từ “tốt, giỏi” (She sings well). Ở đây là danh từ “giếng”." },
  pond: { ipa: "/pɑːnd/", vi: "cái ao", sentence: "Ducks are swimming in the ___ behind the house.", viS: "Đàn vịt đang bơi trong cái ao sau nhà.", tip: "pond nhỏ hơn lake (hồ)." },
  windmill: { ipa: "/ˈwɪnd.mɪl/", vi: "cối xay gió", sentence: "The ___ turns slowly when the wind blows.", viS: "Cối xay gió quay chậm khi gió thổi.", tip: "Từ ghép: wind (gió) + mill (cối xay)." },
  lantern: { ipa: "/ˈlæn.tɚn/", vi: "đèn lồng", sentence: "She hung a ___ by the door so guests could find the way.", viS: "Cô ấy treo đèn lồng cạnh cửa để khách tìm được đường.", tip: "lantern là đèn có vỏ che, thường mang đi được; lamp là đèn nói chung." },
  sheep: { ipa: "/ʃiːp/", vi: "con cừu", sentence: "The ___ are eating grass near the river.", viS: "Đàn cừu đang ăn cỏ gần bờ sông.", tip: "Số nhiều vẫn là sheep: one sheep, two sheep." },
};
export const WORD_ORDER: WordId[] = ["path", "wall", "house", "tree", "tower", "fence", "well", "pond", "windmill", "lantern", "sheep"];
export const toolOfWord = (word: WordId) => TOOLS.find((t) => t.word === word) as ToolDef;

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
  return { paths: [], walls: [], fences: [], houses: [], towers: [], trees: [], wells: [], ponds: [], mills: [], lanterns: [], sheep: [] };
}

const MAX_ITEMS = 1500;
const finite = (...values: unknown[]) => values.every((v) => typeof v === "number" && Number.isFinite(v));
const onIsland = (x: number, z: number) => Math.hypot(x, z) <= 14;
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
  };
  const ids = Object.values(scene).flat().map((item) => item.id);
  const idSeq = Math.max(finite(value.idSeq) ? (value.idSeq as number) : 1, ...ids.map((id) => id + 1));
  return { scene, idSeq };
}

export function parseProgress(raw: string | null): VillageProgress {
  const fallback: VillageProgress = { unlocked: [...STARTER], learned: {}, time: 0.32 };
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
    return {
      unlocked: [...new Set([...STARTER, ...unlocked])],
      learned,
      time: finite(data.time) ? Math.min(1, Math.max(0, data.time as number)) : fallback.time,
    };
  } catch {
    return fallback;
  }
}

/** Case- and space-insensitive check for the typed answer in a lesson. */
export const isAnswer = (typed: string, word: WordId) => typed.trim().toLowerCase() === word;
