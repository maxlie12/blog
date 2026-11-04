/**
 * Rod fishing at the river, as a pure state machine: the UI feeds it time and the player's
 * press, the scene draws it, and the engine (`landCatch` / `loseBait`) records the outcome.
 *
 * Cast → wait (small nibbles are not a bite) → bite (strike within BITE_WINDOW) → reel: holding
 * reels in but raises the line's tension, more so while the fish pulls; held in the red too long
 * the line snaps, left slack too long the fish swims off.
 */
import { WILD_FISHES, WILD_FISH_MAP, levelFromXp, mulberry32, type WildCatch } from "./engine.ts";

export type FishingPhase = "ready" | "waiting" | "bite" | "reeling" | "caught" | "spooked" | "late" | "snapped" | "slack";

export interface FishingState {
  phase: FishingPhase;
  /** Seconds in the current phase. */
  t: number;
  /** Where the float landed, in the fishing spot's own coordinates: along the river -1..1, out from the jetty 0..1. */
  at: [number, number] | null;
  /** Seconds into the wait when the real bite comes, and when the small nibbles come. */
  biteAt: number;
  nibbles: number[];
  catch: WildCatch | null;
  weight: number;
  /** 1 where the float landed … 0 landed at the jetty. */
  distance: number;
  /** 0 slack … 1 about to snap. */
  tension: number;
  /** How hard the fish pulls right now, 0..1. */
  pull: number;
  /** Seconds left in the current pull or rest. */
  pullLeft: number;
  /** Seconds spent in the red, and with a slack line. */
  strain: number;
  slack: number;
  seed: number;
}

export interface FishingInput {
  /** The press is down. */
  holding: boolean;
  /** A press started since the last step. */
  tapped: boolean;
}

/** Seconds the player has to strike once the float plunges. */
export const BITE_WINDOW = 1.1;
/** Tension at which the line starts to strain. */
export const RED_LINE = 0.85;
const SNAP_SECONDS = 0.55;
const SLACK_SECONDS = 2.5;
const BOOT_CHANCE = 0.05;

export const TERMINAL: FishingPhase[] = ["caught", "spooked", "late", "snapped", "slack"];

export function idleFishing(seed = 1): FishingState {
  return { phase: "ready", t: 0, at: null, biteAt: 0, nibbles: [], catch: null, weight: 0, distance: 1, tension: 0, pull: 0, pullLeft: 0, strain: 0, slack: 0, seed };
}

/** Which wild fish (or boot) will take this bait, weighted by chance among those unlocked at `xp`. */
export function rollCatch(xp: number, random: () => number): WildCatch {
  if (random() < BOOT_CHANCE) return "boot";
  const level = levelFromXp(xp);
  const open = WILD_FISHES.filter((fish) => fish.level <= level);
  const total = open.reduce((sum, fish) => sum + fish.chance, 0);
  let roll = random() * total;
  for (const fish of open) {
    roll -= fish.chance;
    if (roll < 0) return fish.id;
  }
  return open[0].id;
}

export function castLine(at: [number, number], xp: number, seed: number): FishingState {
  const random = mulberry32(seed);
  const caught = rollCatch(xp, random);
  const range = caught === "boot" ? [0.6, 0.9] : WILD_FISH_MAP[caught].weight;
  const biteAt = 2.4 + random() * 4.6;
  const nibbles: number[] = [];
  const count = Math.floor(random() * 3);
  for (let i = 0; i < count; i += 1) nibbles.push(0.8 + random() * Math.max(0.2, biteAt - 1.6));
  return {
    ...idleFishing(Math.floor(random() * 4294967296)),
    phase: "waiting",
    at,
    biteAt,
    nibbles: nibbles.sort((a, b) => a - b),
    catch: caught,
    weight: range[0] + random() * (range[1] - range[0]),
  };
}

/** True while a nibble is shaking the float (the UI and scene show a small dip). */
export function isNibbling(state: FishingState): boolean {
  return state.phase === "waiting" && state.nibbles.some((at) => state.t >= at && state.t < at + 0.25);
}

export function stepFishing(state: FishingState, dt: number, input: FishingInput): FishingState {
  const t = state.t + dt;
  switch (state.phase) {
    case "waiting":
      if (input.tapped) return { ...state, phase: "spooked", t: 0 };
      if (t >= state.biteAt) return { ...state, phase: "bite", t: 0 };
      return { ...state, t };
    case "bite":
      if (input.tapped) return { ...state, phase: "reeling", t: 0, tension: 0.3, distance: 1, pull: 0, pullLeft: 0.6 };
      if (t > BITE_WINDOW) return { ...state, phase: "late", t: 0 };
      return { ...state, t };
    case "reeling": {
      const strength = state.catch === "boot" || !state.catch ? 0.12 : WILD_FISH_MAP[state.catch].strength;
      const random = mulberry32(state.seed);
      let { pull, pullLeft } = state;
      pullLeft -= dt;
      if (pullLeft <= 0) {
        const resting = pull <= strength * 0.2;
        // Bursts of pulling with short rests between them.
        pull = resting ? strength * (0.6 + random() * 0.4) : strength * 0.15;
        pullLeft = resting ? 0.5 + random() * 0.7 : 0.5 + random() * 0.8;
      }
      const target = input.holding ? 0.2 + pull * 1.05 : pull * 0.3;
      const tension = state.tension + (target - state.tension) * Math.min(1, dt * 6);
      // Reeling gains line, slowly while the fish pulls; letting go gives some back.
      const distance = input.holding
        ? state.distance - dt * 0.21 * (1 - pull * 0.9)
        : Math.min(1, state.distance + dt * pull * 0.15);
      const strain = tension > RED_LINE ? state.strain + dt : Math.max(0, state.strain - dt * 1.2);
      const slack = !input.holding && tension < 0.1 ? state.slack + dt : 0;
      const seed = Math.floor(random() * 4294967296);
      const next = { ...state, t, pull, pullLeft, tension, distance: Math.max(0, distance), strain, slack, seed };
      if (strain > SNAP_SECONDS) return { ...next, phase: "snapped", t: 0 };
      if (slack > SLACK_SECONDS) return { ...next, phase: "slack", t: 0 };
      if (distance <= 0) return { ...next, phase: "caught", t: 0, tension: 0 };
      return next;
    }
    default:
      return { ...state, t };
  }
}
