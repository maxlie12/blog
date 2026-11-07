/**
 * The farm's people as numbers: body sizes, and poses for walking, each chore and each moment of
 * fishing. A pose turns the joints of a small jointed body (hips, waist, neck, shoulders, hips);
 * the scene builds the body and applies the pose. Angles are in radians; arms and legs swing
 * forward for positive values, the body leans forward for positive `lean`.
 */
import type { FishingState } from "./fishing.ts";
import type { ChoreKind } from "./chores.ts";

/** Body sizes in scene units (a person stands about 0.9 tall in a conical hat). */
export const BODY_SIZE = {
  hip: 0.31,
  leg: 0.29,
  legApart: 0.065,
  waist: 0.02,
  neck: 0.25,
  shoulder: 0.22,
  shoulderApart: 0.13,
  arm: 0.24,
  head: 0.1,
};

export interface Pose {
  /** Hips up or down (scene units). */
  lift: number;
  lean: number;
  /** The upper body turning about the waist (left is positive). */
  twist: number;
  nod: number;
  turn: number;
  /** [forward, outward] for each arm. */
  armL: [number, number];
  armR: [number, number];
  legL: number;
  legR: number;
  /** An extra angle for the tool in hand: a watering can tipping, a rod lifting. */
  tool: number;
}

export const REST: Pose = { lift: 0, lean: 0.03, twist: 0, nod: 0, turn: 0, armL: [0.05, 0.1], armR: [0.05, 0.1], legL: 0, legR: 0, tool: 0 };

export function mixPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const m = (x: number, y: number) => x + (y - x) * k;
  return {
    lift: m(a.lift, b.lift), lean: m(a.lean, b.lean), twist: m(a.twist, b.twist), nod: m(a.nod, b.nod), turn: m(a.turn, b.turn),
    armL: [m(a.armL[0], b.armL[0]), m(a.armL[1], b.armL[1])], armR: [m(a.armR[0], b.armR[0]), m(a.armR[1], b.armR[1])],
    legL: m(a.legL, b.legL), legR: m(a.legR, b.legR), tool: m(a.tool, b.tool),
  };
}

const with_ = (changes: Partial<Pose>, base: Pose = REST): Pose => ({ ...base, ...changes });
const smooth = (t: number) => t * t * (3 - 2 * t);

/* ───────────── walking ───────────── */
/** How far each leg swings either way: a walk and a hurry. */
export const STRIDE = { walk: 0.42, hurry: 0.6 };
export const SPEED = { walk: 1.25, hurry: 2.6 };

/** How far the body moves during one step (one leg swinging from front to back while planted). */
export function stepLength(swing: number): number {
  return 2 * BODY_SIZE.leg * Math.sin(swing);
}

/** The walk cycle's phase advance for a distance walked, so planted feet do not slide. */
export function phaseFor(distance: number, swing: number): number {
  return (distance * Math.PI) / stepLength(swing);
}

/**
 * A leg's swing at a phase of the walk cycle. While the foot is down (the first half from a
 * quarter turn) it moves back at an even pace, matching the body, so it stays planted; then it
 * swings forward again smoothly.
 */
export function legSwing(phase: number, swing: number): number {
  const half = BODY_SIZE.leg * Math.sin(swing);
  const p = (((phase - Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const offset = p < Math.PI ? half * (1 - (2 * p) / Math.PI) : -half * Math.cos(p - Math.PI);
  return Math.asin(offset / BODY_SIZE.leg);
}

/** Walking (`hurry` 0) or hurrying (1) at a phase of the cycle; `hands` keeps both hands on a carried load. */
export function walkPose(phase: number, hurry: number, hands = false, motion = 1): Pose {
  const swing = STRIDE.walk + (STRIDE.hurry - STRIDE.walk) * hurry;
  const legL = legSwing(phase, swing);
  const legR = legSwing(phase + Math.PI, swing);
  const arm = hands ? 0 : legL * (0.85 + hurry * 0.4);
  const carry = hands ? 0.75 : 0;
  return {
    ...REST,
    lift: -Math.abs(Math.cos(phase)) * 0.012 * motion + 0.006,
    lean: 0.05 + hurry * 0.14,
    twist: Math.sin(phase) * 0.07 * motion,
    armL: [carry - arm, 0.1],
    armR: [carry + arm, 0.1],
    legL,
    legR,
  };
}

/* ───────────── chores ───────────── */
export type Tool = "none" | "hoe" | "can" | "pouch" | "basket" | "net" | "sack" | "bucket" | "rod";
type Motion = "hoe" | "water" | "scatter" | "bend" | "shake" | "net" | "pour";

/** Each chore: how it is acted out, with which tool, for how long (seconds). */
export const CHORE_ACTS: Record<ChoreKind, { motion: Motion; tool: Tool; seconds: number }> = {
  hoe: { motion: "hoe", tool: "hoe", seconds: 1.5 },
  sow: { motion: "scatter", tool: "pouch", seconds: 1.3 },
  water: { motion: "water", tool: "can", seconds: 1.5 },
  weed: { motion: "bend", tool: "none", seconds: 1.2 },
  bug: { motion: "bend", tool: "none", seconds: 1.0 },
  fertilize: { motion: "scatter", tool: "pouch", seconds: 1.3 },
  harvest: { motion: "bend", tool: "basket", seconds: 1.4 },
  dig: { motion: "hoe", tool: "hoe", seconds: 1.5 },
  plantTree: { motion: "bend", tool: "none", seconds: 1.3 },
  waterTree: { motion: "water", tool: "can", seconds: 1.5 },
  shake: { motion: "shake", tool: "none", seconds: 1.4 },
  fellTree: { motion: "hoe", tool: "hoe", seconds: 1.5 },
  feedFish: { motion: "scatter", tool: "pouch", seconds: 1.3 },
  skim: { motion: "net", tool: "net", seconds: 1.5 },
  netFish: { motion: "net", tool: "net", seconds: 1.6 },
  stockFish: { motion: "pour", tool: "bucket", seconds: 1.3 },
  stackFeed: { motion: "bend", tool: "sack", seconds: 1.0 },
  pour: { motion: "pour", tool: "sack", seconds: 1.3 },
  collect: { motion: "bend", tool: "basket", seconds: 1.1 },
  newAnimal: { motion: "bend", tool: "none", seconds: 1.1 },
  incubator: { motion: "bend", tool: "none", seconds: 1.3 },
};

/** Tools carried in both hands, held in front while walking. */
export const TWO_HANDED: Tool[] = ["sack", "bucket", "basket", "net"];

/** Key poses of each motion at times 0..1; every motion starts and ends at rest. */
const MOTIONS: Record<Motion, [number, Partial<Pose>][]> = {
  hoe: [
    [0, {}],
    [0.18, { armL: [2.5, 0.05], armR: [2.6, 0.05], lean: -0.12, tool: -0.4 }],
    [0.36, { armL: [0.95, 0.05], armR: [1.0, 0.05], lean: 0.5, tool: 0.3 }],
    [0.54, { armL: [2.4, 0.05], armR: [2.5, 0.05], lean: -0.08, tool: -0.4 }],
    [0.72, { armL: [0.95, 0.05], armR: [1.0, 0.05], lean: 0.5, tool: 0.3 }],
    [1, {}],
  ],
  water: [
    [0, {}],
    [0.2, { armR: [1.3, 0.2], lean: 0.16 }],
    [0.4, { armR: [1.4, 0.2], lean: 0.22, tool: 0.9 }],
    [0.8, { armR: [1.4, 0.2], lean: 0.22, tool: 1.0 }],
    [1, {}],
  ],
  scatter: [
    [0, {}],
    [0.15, { armL: [1.1, -0.25], armR: [0.5, 0.2], lean: 0.12 }],
    [0.35, { armL: [1.1, -0.25], armR: [1.4, 0.75], lean: 0.18, twist: -0.2 }],
    [0.5, { armL: [1.1, -0.25], armR: [0.5, 0.2], lean: 0.12, twist: 0.1 }],
    [0.7, { armL: [1.1, -0.25], armR: [1.4, 0.75], lean: 0.18, twist: -0.2 }],
    [1, {}],
  ],
  bend: [
    [0, {}],
    [0.28, { lean: 1.05, lift: -0.05, nod: 0.25, armL: [0.55, 0.15], armR: [0.65, 0.1] }],
    [0.48, { lean: 1.1, lift: -0.05, nod: 0.3, armL: [0.75, 0.12], armR: [0.45, 0.1] }],
    [0.68, { lean: 1.05, lift: -0.05, nod: 0.25, armL: [0.5, 0.15], armR: [0.75, 0.1] }],
    [1, {}],
  ],
  shake: [
    [0, {}],
    [0.18, { armL: [1.45, 0.05], armR: [1.45, 0.05], lean: 0.22 }],
    [0.32, { armL: [1.45, 0.05], armR: [1.45, 0.05], lean: 0.3, twist: 0.14 }],
    [0.46, { armL: [1.45, 0.05], armR: [1.45, 0.05], lean: 0.14, twist: -0.14 }],
    [0.6, { armL: [1.45, 0.05], armR: [1.45, 0.05], lean: 0.3, twist: 0.14 }],
    [0.74, { armL: [1.45, 0.05], armR: [1.45, 0.05], lean: 0.14, twist: -0.1 }],
    [1, {}],
  ],
  net: [
    [0, {}],
    [0.2, { armL: [1.3, -0.05], armR: [1.0, 0.05], lean: 0.15, twist: 0.35, tool: 0.2 }],
    [0.55, { armL: [1.3, -0.05], armR: [1.0, 0.05], lean: 0.3, twist: -0.35, tool: 0.35 }],
    [0.8, { armL: [1.7, -0.05], armR: [1.5, 0.05], lean: -0.05, twist: 0, tool: -0.3 }],
    [1, {}],
  ],
  pour: [
    [0, {}],
    [0.25, { armL: [1.2, -0.08], armR: [1.2, -0.08], lean: 0.1 }],
    [0.55, { armL: [1.75, -0.08], armR: [1.75, -0.08], lean: 0.28, tool: 1.1 }],
    [0.8, { armL: [1.7, -0.08], armR: [1.7, -0.08], lean: 0.25, tool: 1.15 }],
    [1, {}],
  ],
};

function keyframes(frames: [number, Partial<Pose>][], t: number, base: Pose): Pose {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 0; i < frames.length - 1; i += 1) {
    const [t0, p0] = frames[i];
    const [t1, p1] = frames[i + 1];
    if (u <= t1) return mixPose(with_(p0, base), with_(p1, base), smooth((u - t0) / (t1 - t0 || 1)));
  }
  return with_(frames[frames.length - 1][1], base);
}

/** The pose `t` (0..1) of the way through a chore. A carried two-handed tool stays in front. */
export function chorePose(kind: ChoreKind, t: number): Pose {
  return keyframes(MOTIONS[CHORE_ACTS[kind].motion], t, REST);
}

/* ───────────── idle moments (helpers and the farmer between chores) ───────────── */
export type Idle = "tend" | "look" | "wipe" | "stretch";
const IDLES: Record<Idle, [number, Partial<Pose>][]> = {
  tend: MOTIONS.bend,
  look: [[0, {}], [0.3, { turn: 0.55, nod: -0.08 }], [0.7, { turn: -0.45, nod: -0.05 }], [1, {}]],
  wipe: [[0, {}], [0.35, { armR: [2.25, 0.45], nod: -0.12 }], [0.65, { armR: [2.2, 0.25], nod: -0.1 }], [1, {}]],
  stretch: [[0, {}], [0.4, { armL: [2.9, 0.2], armR: [2.9, 0.2], lean: -0.15, nod: -0.2 }], [0.7, { armL: [2.8, 0.25], armR: [2.8, 0.25], lean: -0.1 }], [1, {}]],
};
export const IDLE_SECONDS: Record<Idle, number> = { tend: 2.2, look: 2.4, wipe: 1.6, stretch: 1.8 };

export function idlePose(kind: Idle, t: number): Pose {
  return keyframes(IDLES[kind], t, REST);
}

/** Standing still: breathing and, now and then, a glance. */
export function standPose(time: number, motion = 1): Pose {
  return with_({ lean: 0.03 + Math.sin(time * 1.7) * 0.012 * motion, armL: [0.05, 0.1 + Math.sin(time * 1.7) * 0.02 * motion], armR: [0.05, 0.1 + Math.sin(time * 1.7 + 0.4) * 0.02 * motion] });
}

/* ───────────── fishing ───────────── */
/** Sitting at the end of the jetty, legs over the water. */
export const SITTING: Pose = with_({ lift: -BODY_SIZE.hip + 0.06, lean: 0.06, legL: 1.25, legR: 1.15, armL: [0.85, -0.12], armR: [0.95, 0.1], tool: 0 });

/** Seconds the angler takes to settle at a catch or a miss. */
export const CATCH_SECONDS = 1.7;

/**
 * Sitting with the rod. `tool` is how far the rod is raised from its resting tilt. Casting swings
 * it back then forward as the float flies (the first 0.35 s of waiting), a bite leans in, reeling
 * leans back with the tension while one hand winds, a catch lifts the fish and swings it to the
 * basket on the angler's right, a miss gets a shake of the head.
 */
export function fishingPose(state: Pick<FishingState, "phase" | "t" | "tension" | "pull">, time: number, nibbling: boolean, motion = 1): Pose {
  const { phase, t } = state;
  if (phase === "waiting" && t < 0.35) {
    return keyframes([
      [0, {}],
      [0.3, { armR: [2.5, 0.1], armL: [2.2, -0.12], lean: -0.12, tool: 1.15 }],
      [1, { armR: [0.9, 0.1], armL: [0.8, -0.12], lean: 0.12, tool: -0.25 }],
    ], t / 0.35, SITTING);
  }
  if (phase === "waiting") return with_({ lean: 0.06 + (nibbling ? 0.1 : 0), nod: nibbling ? 0.12 : 0.04, tool: Math.sin(time * 1.3) * 0.02 * motion }, SITTING);
  if (phase === "bite") return with_({ lean: 0.26, nod: 0.16, armR: [1.1, 0.1], armL: [1.0, -0.12], tool: 0.05 }, SITTING);
  if (phase === "reeling") {
    const wind = time * 9;
    return with_({
      lean: -0.05 - state.tension * 0.3,
      nod: -0.05,
      armR: [1.15 + state.tension * 0.35, 0.1],
      armL: [0.75 + Math.sin(wind) * 0.18 * motion, -0.12 + Math.cos(wind) * 0.12 * motion],
      tool: 0.25 + state.tension * 0.35 + state.pull * 0.1 * Math.sin(time * 23) * motion,
    }, SITTING);
  }
  if (phase === "caught") {
    return keyframes([
      [0, { armR: [1.2, 0.1], armL: [0.9, -0.12], tool: 0.3 }],
      [0.4, { armR: [2.1, 0.1], armL: [1.9, -0.12], lean: -0.15, tool: 0.9 }],
      [0.7, { armR: [1.6, 0.55], armL: [1.2, -0.05], twist: -0.55, turn: -0.4, tool: 0.6 }],
      [1, {}],
    ], t / CATCH_SECONDS, SITTING);
  }
  if (phase === "late" || phase === "slack" || phase === "spooked" || phase === "snapped") {
    const k = Math.min(1, t / 0.9);
    return with_({ turn: Math.sin(k * Math.PI * 3) * 0.38 * (1 - k) * (motion || 0.4), lean: -0.04, nod: 0.08 * (1 - k) }, SITTING);
  }
  return SITTING;
}
