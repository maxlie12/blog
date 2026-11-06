/**
 * Walking legs, a bending neck and swimming bodies for static models (the built-in ones and
 * Meshy's GLBs, which come without bones). Each leg is found from the mesh itself, the vertices
 * below the hip get a gait phase and a weight, and the vertex shader swings them, so a chicken
 * steps on two legs and a cow walks on four (diagonal pairs). The head and neck get a weight too,
 * so the animal lowers its head to eat while its body stays level. Fish bend in a travelling wave
 * from head to tail.
 */
import * as THREE from "three";

export type Gait = "biped" | "quadruped";

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * For positions in the animal's own frame (y up, feet at 0, facing +z), returns per vertex
 * [phase, weight]: phase 0 or π for the leg's place in the gait, weight 1 at the foot fading to 0
 * at the hip and away from the leg (so a belly or an udder between the legs stays still).
 */
export function legAttributes(positions: ArrayLike<number>, gait: Gait, hip: number): Float32Array {
  const count = positions.length / 3;
  const out = new Float32Array(count * 2);
  // The lower legs alone: where the columns are clearly separate.
  const core: [number, number][] = [];
  for (let i = 0; i < count; i += 1) if (positions[i * 3 + 1] < hip * 0.6) core.push([positions[i * 3], positions[i * 3 + 2]]);
  if (core.length < 8) return out;
  const k = gait === "biped" ? 2 : 4;
  const mean = core.reduce((sum, [x, z]) => [sum[0] + x / core.length, sum[1] + z / core.length], [0, 0]);
  const quadrant = ([x, z]: [number, number]) => (gait === "biped" ? (x < mean[0] ? 0 : 1) : (x < mean[0] ? 0 : 1) + (z < mean[1] ? 0 : 2));
  let centers: [number, number][] = Array.from({ length: k }, () => [0, 0]);
  let labels = core.map(quadrant);
  for (let round = 0; round < 10; round += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    core.forEach(([x, z], i) => {
      sums[labels[i]][0] += x;
      sums[labels[i]][1] += z;
      sums[labels[i]][2] += 1;
    });
    centers = sums.map(([x, z, n], c) => (n ? [x / n, z / n] : centers[c] ?? mean) as [number, number]);
    labels = core.map(([x, z]) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach(([cx, cz], c) => {
        const d = (x - cx) ** 2 + (z - cz) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      return best;
    });
  }
  // Leg thickness: how far the lower-leg points reach from their centre.
  const radius = centers.map((center, c) => {
    const distances = core.filter((_, i) => labels[i] === c).map(([x, z]) => Math.hypot(x - center[0], z - center[1])).sort((a, b) => a - b);
    return (distances[Math.floor(distances.length * 0.9)] ?? 0) + hip * 0.04;
  });
  const middle = centers.reduce((sum, [x, z]) => [sum[0] + x / k, sum[1] + z / k], [0, 0]);
  // Two legs alternate; four legs move in diagonal pairs (left front with right hind).
  const phase = centers.map(([x, z]) => {
    const left = x < middle[0];
    if (gait === "biped") return left ? 0 : Math.PI;
    const front = z > middle[1];
    return left === front ? 0 : Math.PI;
  });
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (y >= hip) continue;
    let best = 0;
    let bestD = Infinity;
    centers.forEach(([cx, cz], c) => {
      const d = Math.hypot(x - cx, z - cz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    });
    const weight = (1 - smooth(radius[best] * 1.15, radius[best] * 1.9, bestD)) * (1 - smooth(hip * 0.8, hip, y));
    out[i * 2] = phase[best];
    out[i * 2 + 1] = weight;
  }
  return out;
}

/**
 * Where an animal's neck starts, as shares of its body: `back` from the front of the body, `up`
 * from the feet. Only points above `low` (a share of the height) bend with the head, so the legs
 * and the chest under the neck stay put.
 */
export interface Neck {
  back: number;
  up: number;
  low: number;
}

/**
 * For positions in the animal's own frame (y up, feet at 0, facing +z), how much each vertex
 * follows the head (0 body … 1 head), and the neck pivot as [y, z]. The weight grows along the
 * neck, so it bends smoothly instead of breaking at one line.
 */
export function headAttributes(positions: ArrayLike<number>, neck: Neck): { weights: Float32Array; pivot: [number, number] } {
  const count = positions.length / 3;
  const weights = new Float32Array(count);
  let top = 0;
  let front = -Infinity;
  let back = Infinity;
  for (let i = 0; i < count; i += 1) {
    top = Math.max(top, positions[i * 3 + 1]);
    front = Math.max(front, positions[i * 3 + 2]);
    back = Math.min(back, positions[i * 3 + 2]);
  }
  if (count === 0) return { weights, pivot: [0, 0] };
  const length = front - back;
  const pivotZ = front - neck.back * length;
  const pivotY = neck.up * top;
  const low = neck.low * top;
  for (let i = 0; i < count; i += 1) {
    const y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    weights[i] = smooth(pivotZ - length * 0.06, pivotZ + length * 0.12, z) * smooth(low, low + top * 0.08, y);
  }
  return { weights, pivot: [pivotY, pivotZ] };
}

export interface AnimalUniforms {
  uStep: { value: number };
  uStride: { value: number };
  uHip: { value: number };
  uSwing: { value: number };
  /** How far the head turns down (radians) and sinks (scene units), and the neck pivot [y, z]. */
  uHead: { value: number };
  uDrop: { value: number };
  uNeck: { value: THREE.Vector2 };
}

export function animalUniforms(hip: number, swing: number): AnimalUniforms {
  return { uStep: { value: 0 }, uStride: { value: 0 }, uHip: { value: hip }, uSwing: { value: swing }, uHead: { value: 0 }, uDrop: { value: 0 }, uNeck: { value: new THREE.Vector2() } };
}

/**
 * A copy of `source` whose legs swing with this animal's step (each leg rotates forward and back
 * about its hip and the foot lifts while it swings forward) and whose head and neck turn down
 * about the neck pivot and sink (a long neck reaching down), normals turning with them. Needs the
 * `aLeg` and `aHead` attributes.
 */
export function animalMaterial(source: THREE.Material, uniforms: AnimalUniforms): THREE.Material {
  const material = source.clone();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aLeg;\nattribute float aHead;\nuniform float uStep;\nuniform float uStride;\nuniform float uHip;\nuniform float uSwing;\nuniform float uHead;\nuniform float uDrop;\nuniform vec2 uNeck;",
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        if (aHead > 0.0) {
          float headTurn = uHead * aHead;
          float headC = cos(headTurn), headS = sin(headTurn);
          objectNormal = vec3(objectNormal.x, objectNormal.y * headC - objectNormal.z * headS, objectNormal.y * headS + objectNormal.z * headC);
        }`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        if (aLeg.y > 0.0) {
          float legPhase = uStep + aLeg.x;
          float lever = max(0.0, uHip - transformed.y);
          transformed.z += sin(legPhase) * uStride * uSwing * lever * aLeg.y;
          transformed.y += max(0.0, cos(legPhase)) * uStride * uSwing * 0.35 * lever * aLeg.y;
        }
        if (aHead > 0.0) {
          float neckTurn = uHead * aHead;
          float neckC = cos(neckTurn), neckS = sin(neckTurn);
          vec2 fromNeck = vec2(transformed.y - uNeck.x, transformed.z - uNeck.y);
          transformed.y = uNeck.x + fromNeck.x * neckC - fromNeck.y * neckS;
          transformed.z = uNeck.y + fromNeck.x * neckS + fromNeck.y * neckC;
          transformed.y -= uDrop * aHead;
        }`,
      );
  };
  material.customProgramCacheKey = () => `farm-animal-${source.type}-${source.customProgramCacheKey()}`;
  return material;
}

export interface SwimUniforms {
  uSwim: { value: number };
  uSwimAmp: { value: number };
}

/**
 * A copy of `source` that bends a fish (facing +x, about one unit long) in a wave running from the
 * head to the tail; the tail swings the most.
 */
export function swimMaterial(source: THREE.Material, uniforms: SwimUniforms): THREE.Material {
  const material = source.clone();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwim;\nuniform float uSwimAmp;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          float back = clamp((0.3 - transformed.x) / 1.05, 0.0, 1.0);
          transformed.z += sin(uSwim + transformed.x * 4.5) * uSwimAmp * back * back;
        }`,
      );
  };
  material.customProgramCacheKey = () => `farm-swim-${source.type}-${source.customProgramCacheKey()}`;
  return material;
}
