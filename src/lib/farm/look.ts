/**
 * The farm's cozy look, kept apart from the models in scene.ts: a gradient sky, grass tufts and
 * wild flowers as one instanced mesh each, a wind patch that sways them and the baked foliage,
 * and the High preset's post-processing (bloom on lanterns, a miniature blur at the edges and a
 * soft vignette).
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
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#86bde6");
    gradient.addColorStop(0.5, "#bcdcec");
    gradient.addColorStop(1, "#e9f2e4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
