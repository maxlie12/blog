/**
 * Where everything in the ranch sits (world units, x to the east, z to the south). The ranch is a
 * poultry yard (chickens and ducks, with the hen house and a duck pond), a sheep pen and a cow
 * pen around a middle lane. Pens start small and grow with each capacity upgrade; their
 * buildings sit in the part that is there from the start.
 */
import type { AnimalId } from "./engine";

export type PenId = "poultry" | "sheep" | "cow";

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The whole ranch at full size, and the middle lane down its centre. */
export const RANCH_BOUNDS: Rect = { x0: -3.5, x1: 5.4, z0: 6.2, z1: 13.4 };
export const LANE: Rect = { x0: 0.2, x1: 2.0, z0: 6.2, z1: 13.4 };

/** Each pen at the first level and at full size; the side against the lane and the back stay put. */
const PEN_GROWTH: Record<PenId, { small: Rect; full: Rect }> = {
  poultry: { small: { x0: -2.6, x1: 0.2, z0: 6.2, z1: 9.2 }, full: { x0: -3.5, x1: 0.2, z0: 6.2, z1: 9.6 } },
  sheep: { small: { x0: -2.6, x1: 0.2, z0: 9.95, z1: 12.4 }, full: { x0: -3.5, x1: 0.2, z0: 9.95, z1: 13.4 } },
  cow: { small: { x0: 2.0, x1: 4.3, z0: 6.2, z1: 11.2 }, full: { x0: 2.0, x1: 5.4, z0: 6.2, z1: 13.4 } },
};

/** The highest capacity level (index into the capacity upgrades). */
export const TOP_LEVEL = 3;

export const PEN_OF: Record<AnimalId, PenId> = { chicken: "poultry", duck: "poultry", sheep: "sheep", cow: "cow" };

export function penRect(pen: PenId, level: number): Rect {
  const t = Math.min(1, Math.max(0, level / TOP_LEVEL));
  const { small, full } = PEN_GROWTH[pen];
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { x0: mix(small.x0, full.x0), x1: mix(small.x1, full.x1), z0: mix(small.z0, full.z0), z1: mix(small.z1, full.z1) };
}

/** The small duck pond in the poultry yard: centre and radii. */
export const DUCK_POND = { x: -0.8, z: 8.4, rx: 0.64, rz: 0.43 };

/** Buildings and fixtures, as rectangles on the ground (centre ± half size). */
export const FIXTURES: Record<string, { pen: PenId | "lane"; x: number; z: number; hx: number; hz: number }> = {
  henHouse: { pen: "poultry", x: -1.85, z: 6.72, hx: 0.52, hz: 0.38 },
  poultryTrough: { pen: "poultry", x: -0.35, z: 6.68, hx: 0.25, hz: 0.17 },
  sheepShelter: { pen: "sheep", x: -1.9, z: 10.4, hx: 0.55, hz: 0.32 },
  sheepTrough: { pen: "sheep", x: -0.36, z: 10.55, hx: 0.2, hz: 0.38 },
  cowShed: { pen: "cow", x: 3.3, z: 6.85, hx: 0.75, hz: 0.45 },
  cowTrough: { pen: "cow", x: 2.42, z: 8.7, hx: 0.22, hz: 0.5 },
  pump: { pen: "lane", x: 1.55, z: 8.2, hx: 0.2, hz: 0.2 },
  feedStore: { pen: "lane", x: 1.05, z: 6.85, hx: 0.45, hz: 0.3 },
  incubator: { pen: "lane", x: 1.1, z: 12.6, hx: 0.6, hz: 0.5 },
};

/** The trough each pen's animals eat from. */
export const TROUGH_OF: Record<PenId, keyof typeof FIXTURES> = { poultry: "poultryTrough", sheep: "sheepTrough", cow: "cowTrough" };

export function inside(rect: Rect, x: number, z: number, margin = 0): boolean {
  return x >= rect.x0 + margin && x <= rect.x1 - margin && z >= rect.z0 + margin && z <= rect.z1 - margin;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}

export function fixtureRect(name: keyof typeof FIXTURES): Rect {
  const item = FIXTURES[name];
  return { x0: item.x - item.hx, x1: item.x + item.hx, z0: item.z - item.hz, z1: item.z + item.hz };
}

/** Whether a point is in the duck pond (with `grow` added to its radii). */
export function inDuckPond(x: number, z: number, grow = 0): boolean {
  const dx = (x - DUCK_POND.x) / (DUCK_POND.rx + grow);
  const dz = (z - DUCK_POND.z) / (DUCK_POND.rz + grow);
  return dx * dx + dz * dz <= 1;
}

/** Room an animal of each pen keeps from fences and buildings (birds are small, cows are not). */
export const PEN_ROOM: Record<PenId, number> = { poultry: 0.2, sheep: 0.32, cow: 0.42 };

/** Whether a point is free for an animal to stand: inside its pen, off buildings and (unless swimming) out of the pond. */
export function walkable(pen: PenId, level: number, x: number, z: number, swimming = false): boolean {
  const room = PEN_ROOM[pen];
  if (!inside(penRect(pen, level), x, z, room)) return false;
  for (const [name, item] of Object.entries(FIXTURES)) {
    if (item.pen !== pen) continue;
    const rect = fixtureRect(name as keyof typeof FIXTURES);
    if (inside({ x0: rect.x0 - room, x1: rect.x1 + room, z0: rect.z0 - room, z1: rect.z1 + room }, x, z)) return false;
  }
  if (pen === "poultry" && !swimming && inDuckPond(x, z, 0.12)) return false;
  return true;
}
