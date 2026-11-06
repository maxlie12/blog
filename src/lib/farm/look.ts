/**
 * The farm's cozy look, kept apart from the models in scene.ts: a gradient sky, grass tufts and
 * wild flowers as one instanced mesh each, a wind patch that sways them and the baked foliage,
 * the season's colour on grass and leaves, the sky and stars for each hour, and the High preset's
 * post-processing (bloom on lanterns, a miniature blur at the edges and a soft vignette).
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { HorizontalTiltShiftShader } from "three/examples/jsm/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/examples/jsm/shaders/VerticalTiltShiftShader.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";

/** A vertical gradient drawn behind everything (screen-aligned with the orthographic camera). */
export function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  paintSky(texture, [new THREE.Color("#86bde6"), new THREE.Color("#bcdcec"), new THREE.Color("#e9f2e4")]);
  return texture;
}

/** Repaints the sky gradient: top, middle and horizon colours. */
export function paintSky(texture: THREE.CanvasTexture, [top, middle, horizon]: THREE.Color[]) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, `#${top.getHexString()}`);
  gradient.addColorStop(0.5, `#${middle.getHexString()}`);
  gradient.addColorStop(1, `#${horizon.getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  texture.needsUpdate = true;
}

/**
 * The look of each part of the day: sky (top, middle, horizon), fog, sun and sky light. Keys are
 * hours; `lightAt` blends between them.
 */
const DAY_KEYS: { hour: number; sky: string[]; fog: string; sun: string; sunPower: number; skyLight: string; groundLight: string; skyPower: number }[] = [
  { hour: 0, sky: ["#0b1430", "#1a2850", "#33456e"], fog: "#1c2846", sun: "#a9bcff", sunPower: 0.95, skyLight: "#5468a0", groundLight: "#24322f", skyPower: 0.85 },
  { hour: 4.5, sky: ["#0f1a3a", "#24335e", "#46557c"], fog: "#25314f", sun: "#aebfff", sunPower: 0.9, skyLight: "#586ca2", groundLight: "#26342f", skyPower: 0.85 },
  { hour: 6, sky: ["#6a7fbf", "#f0a98a", "#ffd9a8"], fog: "#e9c3a6", sun: "#ffb27a", sunPower: 2.1, skyLight: "#c9c8ea", groundLight: "#6a6f4a", skyPower: 1.1 },
  { hour: 8, sky: ["#86bde6", "#bcdcec", "#e9f2e4"], fog: "#dcebe6", sun: "#ffe4b0", sunPower: 3.6, skyLight: "#d9ecff", groundLight: "#6f8f4f", skyPower: 1.55 },
  { hour: 16.5, sky: ["#86bde6", "#bcdcec", "#e9f2e4"], fog: "#dcebe6", sun: "#ffe4b0", sunPower: 3.6, skyLight: "#d9ecff", groundLight: "#6f8f4f", skyPower: 1.55 },
  { hour: 18.5, sky: ["#4f5f9f", "#ee9a72", "#ffc98c"], fog: "#e8b896", sun: "#ff9a5a", sunPower: 2.0, skyLight: "#c4b4d8", groundLight: "#5f5a40", skyPower: 1.0 },
  { hour: 20, sky: ["#1a2450", "#3a3f72", "#6a5a7e"], fog: "#3a3a5a", sun: "#aebfff", sunPower: 1.0, skyLight: "#5a6aa0", groundLight: "#26342f", skyPower: 0.9 },
  { hour: 24, sky: ["#0b1430", "#1a2850", "#33456e"], fog: "#1c2846", sun: "#a9bcff", sunPower: 0.95, skyLight: "#5468a0", groundLight: "#24322f", skyPower: 0.85 },
];

export interface DayLight {
  sky: THREE.Color[];
  fog: THREE.Color;
  sun: THREE.Color;
  sunPower: number;
  skyLight: THREE.Color;
  groundLight: THREE.Color;
  skyPower: number;
}

/** The blended look for an hour of the day (0 … 24). */
export function lightAt(hour: number): DayLight {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1].hour <= h) i += 1;
  const a = DAY_KEYS[i], b = DAY_KEYS[i + 1];
  const t = (h - a.hour) / Math.max(1e-6, b.hour - a.hour);
  const mix = (x: string, y: string) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    sky: a.sky.map((color, k) => mix(color, b.sky[k])),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    sunPower: a.sunPower + (b.sunPower - a.sunPower) * t,
    skyLight: mix(a.skyLight, b.skyLight),
    groundLight: mix(a.groundLight, b.groundLight),
    skyPower: a.skyPower + (b.skyPower - a.skyPower) * t,
  };
}

/** Faint stars scattered behind the island, shown at night. */
export function starField(count: number, place: (random: () => number) => THREE.Vector3): THREE.Points {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) positions.set(place(random).toArray(), i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: "#fff6dc", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  return new THREE.Points(geometry, material);
}

/**
 * Season colour for grass, leaves and the grassy ground. Only green surfaces are tinted (soil,
 * wood and roofs keep their colour): fresh in spring, none in summer, orange in autumn and
 * frosted pale in winter. `uSeasonMix` blends towards it; `uSeasonGain` sets how light it is.
 */
export const season = { uSeasonTint: { value: new THREE.Color() }, uSeasonMix: { value: 0 }, uSeasonGain: { value: 1.7 } };

export const SEASON_LOOK: Record<string, { tint: string; mix: number; gain: number }> = {
  spring: { tint: "#c4f08c", mix: 0.22, gain: 1.75 },
  summer: { tint: "#ffffff", mix: 0, gain: 1.7 },
  autumn: { tint: "#ff8f2e", mix: 0.62, gain: 1.65 },
  winter: { tint: "#eef4ff", mix: 0.58, gain: 2.25 },
};

/** Adds the season tint to a material, `strength` 0 … 1, keeping any earlier shader patch. */
export function addSeason(material: THREE.Material, strength: number) {
  const before = material.onBeforeCompile;
  const beforeKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.uSeasonTint = season.uSeasonTint;
    shader.uniforms.uSeasonMix = season.uSeasonMix;
    shader.uniforms.uSeasonGain = season.uSeasonGain;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSeasonTint;\nuniform float uSeasonMix;\nuniform float uSeasonGain;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float greenness = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 5.0, 0.0, 1.0);
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, uSeasonTint * lum * uSeasonGain, greenness * uSeasonMix * ${strength.toFixed(2)});
        }`,
      );
  };
  material.customProgramCacheKey = () => `${beforeKey}-season-${strength}`;
}

/** Shared wind clock; `uWind` is 0 with reduced motion. */
export const wind = { uTime: { value: 0 }, uWind: { value: 1 } };

/**
 * Sways a material's vertices in a slow gusting wind. Instanced tufts bend by their local height;
 * baked foliage moves by its `aSway` attribute (0 trunks … 1 leaf tips). The phase follows the
 * world position so neighbouring plants move together.
 */
export function addWind(material: THREE.Material, mode: "instanced" | "baked", amount: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.uniforms.uWind = wind.uWind;
    const root = mode === "instanced"
      ? "vec3 swayRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float swayWeight = max(position.y, 0.0) * position.y * 9.0;"
      : "vec3 swayRoot = (modelMatrix * vec4(position, 1.0)).xyz; float swayWeight = aSway;";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nuniform float uWind;\n${mode === "baked" ? "attribute float aSway;" : ""}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          ${root}
          float swayPhase = uTime * 1.6 + swayRoot.x * 0.35 + swayRoot.z * 0.22;
          float gust = sin(swayPhase) * 0.65 + sin(swayPhase * 2.7 + 1.3) * 0.25 + 0.35;
          transformed.x += gust * swayWeight * uWind * ${amount.toFixed(3)};
          transformed.z += sin(swayPhase * 0.7 + 2.0) * swayWeight * uWind * ${(amount * 0.45).toFixed(3)};
        }`,
      );
  };
  material.customProgramCacheKey = () => `farm-wind-${mode}-${amount}`;
}

/** A tuft of five curved blades, dark at the root and light at the tip, about 0.3 tall. */
export function tuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const root = new THREE.Color("#4a7a34");
  const mid = new THREE.Color("#77ab4b");
  const tip = new THREE.Color("#a8d468");
  const blades = 5;
  for (let i = 0; i < blades; i += 1) {
    const angle = (i / blades) * Math.PI * 2 + i * 0.7;
    const lean = 0.06 + (i % 3) * 0.035;
    const height = 0.13 + ((i * 7) % 5) * 0.025;
    const width = 0.04;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    // Blade across direction (perpendicular to the lean in the ground plane).
    const ax = -dz * width, az = dx * width;
    const base: [number, number, number] = [dx * 0.03, 0, dz * 0.03];
    const midPoint: [number, number, number] = [base[0] + dx * lean * 0.45, height * 0.55, base[2] + dz * lean * 0.45];
    const top: [number, number, number] = [base[0] + dx * lean, height, base[2] + dz * lean];
    const quad = [
      [base[0] - ax, base[1], base[2] - az], [base[0] + ax, base[1], base[2] + az], [midPoint[0] + ax * 0.6, midPoint[1], midPoint[2] + az * 0.6],
      [base[0] - ax, base[1], base[2] - az], [midPoint[0] + ax * 0.6, midPoint[1], midPoint[2] + az * 0.6], [midPoint[0] - ax * 0.6, midPoint[1], midPoint[2] - az * 0.6],
      [midPoint[0] - ax * 0.6, midPoint[1], midPoint[2] - az * 0.6], [midPoint[0] + ax * 0.6, midPoint[1], midPoint[2] + az * 0.6], top,
    ];
    const shades = [root, root, mid, root, mid, mid, mid, mid, tip];
    quad.forEach((vertex, k) => {
      positions.push(...vertex);
      colors.push(shades[k].r, shades[k].g, shades[k].b);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  // Light the blades like the ground they grow from, so they never turn dark side-on.
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(positions.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  return geometry;
}

/** A small five-petal flower on a short stem; the instance colour tints the petals. */
export function flowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const push = (x: number, y: number, z: number, c: THREE.Color) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
  };
  const stem = new THREE.Color("#4f8a3a");
  const petal = new THREE.Color("#ffffff");
  const heart = new THREE.Color("#ffd75e");
  const height = 0.2;
  push(-0.012, 0, 0, stem);
  push(0.012, 0, 0, stem);
  push(0, height, 0, stem);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const b = a + 0.9;
    const c = a - 0.9 + (Math.PI * 2) / 5;
    push(0, height, 0, petal);
    push(Math.cos(a + 0.45) * 0.075, height + 0.012, Math.sin(a + 0.45) * 0.075, petal);
    push(Math.cos(b - 0.35) * 0.045, height + 0.008, Math.sin(b - 0.35) * 0.045, petal);
    push(0, height, 0, petal);
    push(Math.cos(c) * 0.045, height + 0.008, Math.sin(c) * 0.045, petal);
    push(Math.cos(a + 0.45) * 0.075, height + 0.012, Math.sin(a + 0.45) * 0.075, petal);
  }
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    push(0, height + 0.02, 0, heart);
    push(Math.cos(a) * 0.022, height + 0.014, Math.sin(a) * 0.022, heart);
    push(Math.cos(a + Math.PI / 2) * 0.022, height + 0.014, Math.sin(a + Math.PI / 2) * 0.022, heart);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(positions.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  return geometry;
}

/**
 * High preset only: renders into a multisampled HDR target so lanterns can glow, then blurs the
 * top and bottom edges like a tilt-shift photo of a model and darkens the corners a little.
 */
export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.92);
  composer.addPass(bloom);
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = 1.0;
  vignette.uniforms.darkness.value = 0.9;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  return {
    composer,
    setSize(width: number, height: number, dpr: number) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
      // The blur grows towards the top and bottom; the middle stays sharp for tapping.
      tiltH.uniforms.h.value = 0.8 / (width * dpr);
      tiltV.uniforms.v.value = 0.8 / (height * dpr);
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      target.dispose();
    },
  };
}
export type FarmPost = ReturnType<typeof makePost>;
