import assert from "node:assert/strict";
import test from "node:test";
import { legAttributes } from "./farm/legs.ts";

/** Vertical columns of points at the given (x, z), from the ground up to `top`. */
function columns(feet: [number, number][], top: number, extra: [number, number, number][] = []): number[] {
  const points: number[] = [];
  for (const [x, z] of feet) {
    for (let y = 0; y <= top; y += top / 10) {
      for (const [dx, dz] of [[0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]]) points.push(x + dx, y, z + dz);
    }
  }
  for (const point of extra) points.push(...point);
  return points;
}

test("legs: two legs step in turn; the body above the hip stays still", () => {
  const positions = columns([[-0.1, 0], [0.1, 0]], 0.5, [[0, 0.6, 0]]);
  const legs = legAttributes(positions, "biped", 0.3);
  const foot = (x: number) => {
    const i = positions.findIndex((value, k) => k % 3 === 0 && Math.abs(value - x - 0.01) < 1e-9 && positions[k + 1] === 0) / 3;
    return { phase: legs[i * 2], weight: legs[i * 2 + 1] };
  };
  assert.ok(foot(-0.1).weight > 0.9 && foot(0.1).weight > 0.9, "feet swing fully");
  assert.ok(Math.abs(Math.abs(foot(-0.1).phase - foot(0.1).phase) - Math.PI) < 1e-6, "left and right alternate");
  assert.equal(legs[(positions.length / 3 - 1) * 2 + 1], 0, "the body point does not move");
});

test("legs: four legs move in diagonal pairs and an udder between them stays still", () => {
  const feet: [number, number][] = [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]];
  const positions = columns(feet, 0.3, [[0, 0.2, -0.3]]);
  const legs = legAttributes(positions, "quadruped", 0.32);
  const perLeg = (positions.length / 3 - 1) / 4;
  const phase = feet.map((_, leg) => legs[leg * perLeg * 2]);
  assert.equal(phase[0], phase[3], "left front with right hind");
  assert.equal(phase[1], phase[2], "right front with left hind");
  assert.notEqual(phase[0], phase[1]);
  assert.equal(legs[(positions.length / 3 - 1) * 2 + 1], 0, "the udder does not swing");
});
