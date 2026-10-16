/**
 * Graphics presets for the farm scene. Kept free of three.js imports so the game UI can read
 * and store the player's choice without downloading the 3D engine.
 */

export type Quality = "high" | "medium" | "low";
export type QualityChoice = "auto" | Quality;
/** What the player picks in the menu: a 3D preset, automatic, or the 2D board. */
export type GraphicsChoice = QualityChoice | "2d";

export interface QualityPreset {
  /** Upper bound for devicePixelRatio. */
  dprCap: number;
  antialias: boolean;
  shadows: boolean;
  shadowSize: number;
  /** Frame-rate cap; 30 halves GPU work on weak machines. */
  fps: 30 | 60;
  clouds: number;
  /** Physically based shading looks softer; Lambert is cheaper per pixel. */
  pbr: boolean;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  high: { dprCap: 2, antialias: true, shadows: true, shadowSize: 2048, fps: 60, clouds: 4, pbr: true },
  medium: { dprCap: 1.5, antialias: true, shadows: true, shadowSize: 1024, fps: 60, clouds: 3, pbr: true },
  low: { dprCap: 1, antialias: false, shadows: false, shadowSize: 512, fps: 30, clouds: 2, pbr: false },
};

export const QUALITY_LABELS: Record<GraphicsChoice, string> = {
  auto: "Tự động",
  high: "3D đẹp",
  medium: "3D cân bằng",
  low: "3D mượt",
  "2d": "2D tiết kiệm pin",
};

export const QUALITY_KEY = "learning-farm-graphics-v1";

function gpuName(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

/**
 * Picks a starting preset from the GPU name and device class. It is only a first guess: the
 * scene measures real frame times in "auto" mode and steps down if the device struggles.
 */
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const gpu = gpuName();
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return "low";
  // Older Intel iGPUs (HD Graphics, UHD 600/605/610) and entry mobile GPUs.
  if (/Intel.*(\bHD Graphics|UHD Graphics 6[01]\d\b)|Mali-[GT]?[3-6]\d\b|Adreno[^\d]*[3-5]\d\d|PowerVR/i.test(gpu)) return "low";
  if (cores <= 2 || memory <= 2) return "low";
  if (/Apple/i.test(gpu)) return "high";
  if (touch || /Intel/i.test(gpu) || cores <= 4) return "medium";
  return "high";
}

export function readQualityChoice(): GraphicsChoice {
  try {
    const value = window.localStorage.getItem(QUALITY_KEY);
    if (value === "auto" || value === "high" || value === "medium" || value === "low" || value === "2d") return value;
  } catch {
    // Storage blocked: fall back to automatic.
  }
  return "auto";
}

export function saveQualityChoice(choice: GraphicsChoice) {
  try {
    window.localStorage.setItem(QUALITY_KEY, choice);
  } catch {
    // Ignore: the choice still applies for this visit.
  }
}
