/**
 * Looks for Làng Rêu: rippling water with foam and sun glints, a gradient sky with sun and moon,
 * rain, chimney smoke, and the High-quality post-processing (bloom, tilt-shift, vignette).
 * Each builder returns three.js objects the scene owns and updates; nothing here keeps state of
 * its own beyond what it returns.
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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Point } from "./data";

const NOISE = /* glsl */ `
  float vgHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vgNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(vgHash(i), vgHash(i + vec2(1.0, 0.0)), f.x), mix(vgHash(i + vec2(0.0, 1.0)), vgHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

/* ───────────── water ───────────── */

/** Uniforms the scene sets from the time of day and the weather. */
export function waterUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
    uSunColor: { value: new THREE.Color("#fff3dc") },
    uSky: { value: new THREE.Color("#cfe3ea") },
    uDeep: { value: new THREE.Color("#2f7f8f") },
    uShallow: { value: new THREE.Color("#6cc3cf") },
    uFoam: { value: new THREE.Color("#f4fbfb") },
    uLight: { value: 1 },
    uRain: { value: 0 },
    uMotion: { value: 1 },
  };
}
export type WaterUniforms = ReturnType<typeof waterUniforms>;

/**
 * Water that ripples (two layers of moving noise bend the normal), flows along `aFlow`, mixes the
 * sky in at grazing angles, glints where the sun reflects, and foams where `aSide` nears ±1 (the bank).
 */
export function waterMaterial(uniforms: WaterUniforms, alpha: [number, number] = [0.8, 0.96]) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, ...uniforms },
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aSide;
      attribute vec2 aFlow;
      varying vec3 vWorld;
      varying float vSide;
      varying vec2 vFlow;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vSide = aSide;
        vFlow = aFlow;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLight, uRain, uMotion;
      uniform vec3 uSunDir, uSunColor, uSky, uDeep, uShallow, uFoam;
      varying vec3 vWorld;
      varying float vSide;
      varying vec2 vFlow;
      #include <fog_pars_fragment>
      ${NOISE}
      float vgHeight(vec2 p, float t) { return vgNoise(p * 1.4 + t * 0.3) * 0.6 + vgNoise(p * 3.3 - t * 0.45) * 0.4; }
      void main() {
        float t = uTime * uMotion;
        vec2 p = vWorld.xz - vFlow * t * 1.3;
        float e = 0.07, h = vgHeight(p, t);
        vec3 n = normalize(vec3((h - vgHeight(p + vec2(e, 0.0), t)) * 1.8, 1.0, (h - vgHeight(p + vec2(0.0, e), t)) * 1.8));
        // Rain: short-lived rings on a grid of random drops.
        if (uRain > 0.01) {
          vec2 cell = floor(vWorld.xz * 2.2), f = fract(vWorld.xz * 2.2) - 0.5;
          float life = fract(t * 0.9 + vgHash(cell));
          vec2 o = vec2(vgHash(cell + 3.1), vgHash(cell + 7.7)) - 0.5;
          float d = length(f - o * 0.5);
          float ring = smoothstep(0.05, 0.0, abs(d - life * 0.45)) * (1.0 - life) * uRain;
          n = normalize(n + vec3((f - o * 0.5) * ring * 3.0, 0.0).xzy);
        }
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        float edge = abs(vSide);
        vec3 col = mix(uDeep, uShallow, smoothstep(0.25, 1.0, edge)) * uLight;
        col = mix(col, uSky, clamp(fres * 0.7 + 0.08, 0.0, 1.0));
        vec3 r = reflect(-normalize(uSunDir), n);
        col += uSunColor * pow(max(dot(r, view), 0.0), 140.0) * 1.8;
        float foam = smoothstep(0.8, 0.97, edge + (vgNoise(vWorld.xz * 5.0 + t * 0.6) - 0.5) * 0.22);
        col = mix(col, uFoam * max(uLight, 0.3), foam * 0.75);
        gl_FragColor = vec4(col, mix(${alpha[0].toFixed(3)}, ${alpha[1].toFixed(3)}, max(fres, foam)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

/** One stream's water surface: `aSide` runs −1 to 1 across it, `aFlow` follows it downstream. */
function streamGeometry(pts: Point[], half: number, y: number) {
  const n = pts.length, L: Point[] = [], R: Point[] = [], T: Point[] = [];
  for (let j = 0; j < n; j += 1) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(n - 1, j + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    L.push([pts[j][0] - tz * half, pts[j][1] + tx * half]);
    R.push([pts[j][0] + tz * half, pts[j][1] - tx * half]);
    T.push([tx, tz]);
  }
  const pos: number[] = [], side: number[] = [], flow: number[] = [];
  const v = (q: Point, s: number, t: Point) => { pos.push(q[0], y, q[1]); side.push(s); flow.push(t[0], t[1]); };
  for (let i = 0; i < n - 1; i += 1) {
    v(L[i], -1, T[i]); v(L[i + 1], -1, T[i + 1]); v(R[i], 1, T[i]);
    v(R[i], 1, T[i]); v(L[i + 1], -1, T[i + 1]); v(R[i + 1], 1, T[i + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(flow, 2));
  return g;
}

/** All streams as one water mesh geometry (null when there are none). */
export function streamsGeometry(streams: Point[][], half: number, y: number) {
  const parts = streams.filter((s) => s.length >= 2).map((s) => streamGeometry(s, half, y));
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  merged?.computeBoundingSphere();
  return merged;
}

/** A unit pond (radius 0.5) lying flat: `aSide` is the distance out to the rim, with a slow swirl. */
export function pondGeometry() {
  const g = new THREE.CircleGeometry(0.5, 48).rotateX(-Math.PI / 2);
  const p = g.attributes.position, side: number[] = [], flow: number[] = [];
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) * 2;
    side.push(r);
    flow.push(-z * 0.3, x * 0.3);
  }
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(flow, 2));
  return g;
}

/* ───────────── sky ───────────── */

/** A dome with a gradient from the horizon to the top, and the sun (or the moon at night). */
export function makeSky() {
  const uniforms = {
    uTop: { value: new THREE.Color("#78b7e0") },
    uHorizon: { value: new THREE.Color("#cfe6ef") },
    uGround: { value: new THREE.Color("#9cb98a") },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
    uSunColor: { value: new THREE.Color("#fff3dc") },
    uNight: { value: 0 },
    uCloud: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uGround, uSunDir, uSunColor;
        uniform float uNight, uCloud;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uGround, smoothstep(0.0, -0.25, h));
          vec3 sd = normalize(uSunDir);
          float d = max(dot(normalize(vDir), sd), 0.0);
          float disc = smoothstep(mix(0.9988, 0.9993, uNight), mix(0.9993, 0.9997, uNight), d);
          vec3 body = mix(uSunColor * 1.6, vec3(0.92, 0.94, 1.0), uNight);
          float glow = pow(d, mix(18.0, 60.0, uNight)) * mix(0.45, 0.18, uNight);
          col += (body * disc + uSunColor * glow) * (1.0 - uCloud * 0.85);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/* ───────────── rain ───────────── */

/** Falling streaks in a box that follows the view; the shader moves them, the CPU only sets time. */
export function makeRain(count: number) {
  const pos = new Float32Array(count * 6), top = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() - 0.5) * 50, y = Math.random() * 22, z = (Math.random() - 0.5) * 50;
    pos.set([x, y, z, x, y, z], i * 6);
    top.set([1, 0], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aTop", new THREE.BufferAttribute(top, 1));
  const uniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() }, uAmount: { value: 0 }, uColor: { value: new THREE.Color("#dbe5ee") } };
  const mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aTop;
      uniform float uTime;
      uniform vec2 uWind;
      varying float vTop;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * 14.0, 22.0);
        p.xz += uWind * (p.y * 0.12);
        p += aTop * vec3(uWind.x * 0.06, 0.55, uWind.y * 0.06);
        vTop = aTop;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform vec3 uColor;
      varying float vTop;
      void main() { gl_FragColor = vec4(uColor, uAmount * mix(0.7, 0.12, vTop)); }`,
  }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, uniforms };
}

/* ───────────── chimney smoke ───────────── */

function puffTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft puffs that rise from chimneys and drift with the wind. */
export function makeSmoke(max: number) {
  const pos = new Float32Array(max * 3), life = new Float32Array(max), size = new Float32Array(max);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aLife", new THREE.BufferAttribute(life, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setDrawRange(0, 0);
  const tex = puffTexture();
  const uniforms = { uMap: { value: tex }, uScale: { value: 300 }, uTint: { value: new THREE.Color("#e9e6e1") } };
  const points = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aLife, aSize;
      uniform float uScale;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uTint;
      varying float vLife;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * 0.85;
        gl_FragColor = vec4(uTint, a);
        #include <colorspace_fragment>
      }`,
  }));
  points.frustumCulled = false;
  const ages = new Float32Array(max), speed = new Float32Array(max);
  let sources: THREE.Vector3[] = [];
  return {
    points,
    uniforms,
    setSources(list: THREE.Vector3[]) {
      sources = list;
      const n = Math.min(max, list.length * 7);
      g.setDrawRange(0, n);
      for (let i = 0; i < n; i += 1) {
        const src = list[i % list.length];
        ages[i] = Math.random();
        speed[i] = 0.18 + Math.random() * 0.1;
        // Start part-way up so the column is already there.
        pos.set([src.x, src.y + (ages[i] * 0.6) / speed[i], src.z], i * 3);
      }
    },
    update(dt: number, wind: { x: number; z: number }) {
      const n = g.drawRange.count;
      for (let i = 0; i < n; i += 1) {
        ages[i] += dt * speed[i];
        const src = sources[i % sources.length];
        if (ages[i] >= 1 || !src) { ages[i] = 0; if (src) pos.set([src.x, src.y, src.z], i * 3); }
        const a = ages[i];
        pos[i * 3] += wind.x * dt * 0.9;
        pos[i * 3 + 1] += dt * 0.6;
        pos[i * 3 + 2] += wind.z * dt * 0.9;
        life[i] = a;
        size[i] = 0.6 + a * 2.2;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.aLife.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    },
    dispose() { g.dispose(); tex.dispose(); (points.material as THREE.Material).dispose(); },
  };
}

/* ───────────── post-processing (High) ───────────── */

/** Bloom for lights at night, a gentle tilt-shift and a vignette. */
export function makeComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.55, 0.82);
  composer.addPass(bloom);
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = 0.95;
  vignette.uniforms.darkness.value = 1.05;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    setSize(w: number, h: number, dpr: number) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      // Blur grows towards the top and bottom edges; the middle third stays sharp.
      tiltH.uniforms.h.value = 1.6 / (w * dpr);
      tiltV.uniforms.v.value = 1.6 / (h * dpr);
    },
    dispose() { composer.dispose(); bloom.dispose(); },
  };
}
export type Composer = ReturnType<typeof makeComposer>;
