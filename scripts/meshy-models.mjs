#!/usr/bin/env node
/**
 * Generate optional 3D models for the Learning Farm with the Meshy API, shrink them for phones,
 * and register them in public/models/manifest.json. The game uses its built-in low-poly
 * models for anything not listed there, so this step is never required.
 *
 * Run on your own machine (the key must never be committed or sent to the browser):
 *   MESHY_API_KEY=msy_xxx npm run models:meshy
 *   npm run models:meshy -- --only=chicken,cow     # just some models
 *   npm run models:meshy -- --force                # regenerate even if a GLB exists
 *   npm run models:meshy -- --dry-run              # print what would happen, spend nothing
 *   npm run models:meshy -- --polycount=2500       # triangle budget per model (default 3000)
 *
 * Every generation spends Meshy credits. Task ids are remembered in scripts/.meshy-tasks.json
 * (git-ignored) so an interrupted run resumes instead of paying again.
 *
 * Size step: `npx @gltf-transform/cli optimize` with meshopt geometry compression and 512px
 * WebP textures, which usually brings a model from several MB to a few hundred KB.
 * API reference: https://docs.meshy.ai/en/api/text-to-3d
 */
import "./load-env.mjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = join(ROOT, "public", "models");
const RAW_DIR = join(MODELS_DIR, "raw");
const MANIFEST = join(MODELS_DIR, "manifest.json");
const STATE = join(ROOT, "scripts", ".meshy-tasks.json");
// MESHY_API_BASE exists only so the script can be tested against a local mock server.
const API = process.env.MESHY_API_BASE ?? "https://api.meshy.ai/openapi/v2/text-to-3d";

const STYLE = "cute stylized low poly game asset, full body, simple flat colors, clean shapes, no base, no ground";
/** height = metres in the scene; rotationY turns the model so it faces the game's forward axis. */
const ASSETS = {
  chicken: { height: 0.85, rotationY: 0, prompt: `white hen with red comb and orange beak, standing, ${STYLE}` },
  duck: { height: 0.8, rotationY: 0, prompt: `white farm duck with orange bill and orange feet, standing, ${STYLE}` },
  sheep: { height: 0.85, rotationY: 0, prompt: `fluffy white sheep with black face and black legs, standing on four legs, ${STYLE}` },
  cow: { height: 1.15, rotationY: 0, prompt: `black and white dairy cow with small horns, standing on four legs, ${STYLE}` },
  // The game drives the truck along +X; Meshy models usually face +Z, hence a quarter turn.
  truck: { height: 1.1, rotationY: Math.PI / 2, prompt: `small red farm pickup truck with a wooden cargo bed, ${STYLE}` },
};

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  }),
);
const only = typeof args.only === "string" ? args.only.split(",").map((item) => item.trim()) : Object.keys(ASSETS);
const force = Boolean(args.force);
const dryRun = Boolean(args["dry-run"]);
const polycount = Math.min(15000, Math.max(500, Number(args.polycount) || 3000));
const key = process.env.MESHY_API_KEY;

const unknown = only.filter((name) => !ASSETS[name]);
if (unknown.length) {
  console.error(`Unknown model(s): ${unknown.join(", ")}. Choose from: ${Object.keys(ASSETS).join(", ")}`);
  process.exit(1);
}
if (!key && !dryRun) {
  console.error("MESHY_API_KEY is not set. Put it in .env.local (never commit it) or pass it inline for this command.");
  process.exit(1);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    const hint = { 401: "check the API key", 402: "not enough Meshy credits", 429: "rate limited, try again later" }[response.status] ?? "";
    throw new Error(`Meshy ${response.status}${hint ? ` (${hint})` : ""}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(taskId, label) {
  const started = Date.now();
  let lastProgress = -1;
  while (Date.now() - started < 20 * 60 * 1000) {
    const task = await api(`/${taskId}`);
    if (task.progress !== lastProgress) {
      process.stdout.write(`\r  ${label}: ${task.status} ${task.progress ?? 0}%   `);
      lastProgress = task.progress;
    }
    if (task.status === "SUCCEEDED") {
      process.stdout.write("\n");
      return task;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      process.stdout.write("\n");
      throw new Error(`${label} ${task.status}: ${JSON.stringify(task.task_error ?? {})}`);
    }
    await sleep(5000);
  }
  throw new Error(`${label} timed out after 20 minutes (task ${taskId}); run again to resume.`);
}

async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${path}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

function optimize(input, output) {
  try {
    execFileSync(
      "npx",
      ["--yes", "@gltf-transform/cli@4", "optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "512"],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    return true;
  } catch {
    return false;
  }
}

const kb = async (path) => `${Math.round((await stat(path)).size / 1024)} KB`;

await mkdir(RAW_DIR, { recursive: true });
const state = await readJson(STATE, {});
const manifest = await readJson(MANIFEST, { version: 1, models: {} });
manifest.models ??= {};

for (const name of only) {
  const asset = ASSETS[name];
  const output = join(MODELS_DIR, `${name}.glb`);
  if (existsSync(output) && !force) {
    console.log(`• ${name}: ${output} already exists (use --force to regenerate)`);
    continue;
  }
  console.log(`• ${name}: "${asset.prompt}" · ~${polycount} triangles`);
  if (dryRun) continue;

  const entry = (state[name] ??= {});
  if (!entry.preview || force) {
    const created = await api("", {
      method: "POST",
      body: JSON.stringify({
        mode: "preview",
        prompt: asset.prompt,
        ai_model: "latest",
        should_remesh: true,
        topology: "triangle",
        target_polycount: polycount,
        target_formats: ["glb"],
      }),
    });
    entry.preview = created.result;
    delete entry.refine;
    await writeFile(STATE, JSON.stringify(state, null, 2));
  }
  await waitFor(entry.preview, "shape");

  if (!entry.refine) {
    const created = await api("", {
      method: "POST",
      body: JSON.stringify({ mode: "refine", preview_task_id: entry.preview, enable_pbr: false, target_formats: ["glb"] }),
    });
    entry.refine = created.result;
    await writeFile(STATE, JSON.stringify(state, null, 2));
  }
  const refined = await waitFor(entry.refine, "texture");
  const glbUrl = refined.model_urls?.glb;
  if (!glbUrl) throw new Error(`${name}: Meshy returned no GLB url`);

  const raw = join(RAW_DIR, `${name}.glb`);
  await download(glbUrl, raw);
  console.log(`  downloaded ${await kb(raw)}`);
  if (!optimize(raw, output)) {
    console.warn("  ! gltf-transform failed; using the unoptimized model (bigger download).");
    await copyFile(raw, output);
  }
  console.log(`  saved public/models/${name}.glb (${await kb(output)})`);

  manifest.models[name] = { url: `/models/${name}.glb`, height: asset.height, rotationY: asset.rotationY, source: "Meshy", task: entry.refine };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(
  dryRun
    ? "Dry run: nothing was generated."
    : "Done. Commit public/models/*.glb and manifest.json (not raw/ or scripts/.meshy-tasks.json), then redeploy.\n" +
        "If a model faces the wrong way, adjust its rotationY (radians) in public/models/manifest.json.",
);
