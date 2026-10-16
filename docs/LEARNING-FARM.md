# Learning Farm game

`/learning/world` hosts a small farm, fishpond and ranch game in the spirit of classic farm games, with original art built from three.js primitives (or optional generated models, see "Meshy models"). It is a motivation layer around daily practice, not a progress tracker: nothing in the game marks a lesson complete, adds a reviewed attempt, creates a streak or changes a CEFR level.

## What the player can do

- **Fields (12 plots, 6 open at the start).** Hoe → sow → care → harvest → hoe again. Crops grow in real time, including while the page is closed (offline growth is simulated up to 14 days in one-minute steps). While growing, a plot can become dry (half speed), weedy or infested; each weed/pest still present at harvest costs one unit of yield (never below half). Fertilizer skips 30% of the remaining time, once per crop.
- **Pond.** Buy fry, feed the pond (one portion keeps every fish fed for 20 minutes; hungry fish grow at 35%), skim litter (each piece lowers water quality and growth), and net fish once they show a star.
- **Ranch.** Chickens, ducks, sheep and cows eat from the trough automatically — one bag of feed per production cycle — and drop eggs, duck eggs, wool and milk on the pasture to collect. Animals wait (bowl icon) when the trough is empty or 24 products are already lying around. Feed comes from milling harvested crops (grains give the most) or from the market.
- **Workshops.** Built with coins at higher levels: duck eggs → salted-egg jars, eggs + rice → sponge cake, wool → scarf, milk → cheese. Each runs one batch at a time; finished goods are collected into the barn.
- **Barn, market and truck.** Everything collected goes to the barn. Sell on the spot, or load up to 20 items on the truck: it drives to town, comes back after 90 seconds and pays 20% more. One crop and one fish sell for +25% each Vietnam calendar day. The market sells seeds, animals, fry, fertilizer, fish food and feed, and expands the fields, pasture and pond.
- **Levels.** Every action earns XP; levels unlock crops (9), fish (6), animals (4), workshops (4), extra plots and capacity.
- **Gifts.** A once-a-day visit gift, and a study gift that needs at least one practice draft saved on this device today (`learning-practice-v1:*` in localStorage, the same drafts the activity heatmap reads). A saved revision adds one fertilizer. The gift explains that it only reads local drafts.

Every scene action also has a button (plot card, pond card, ranch card, sheets), and the 2D board offers the same game without WebGL.

## Graphics and performance

The menu under the game ("Đồ họa") offers Automatic, 3D beautiful / balanced / smooth, and 2D battery saver. The choice is stored per browser (`learning-farm-graphics-v1`).

| Preset | Pixel ratio | Shadows | Shading | Frame cap |
|---|---|---|---|---|
| high | up to 2× | 2048 soft | PBR | 60 |
| medium | up to 1.5× | 1024 | PBR | 60 |
| low | 1× | off | Lambert | 30 |

Automatic picks a starting preset from the GPU name (`quality.ts`): Apple GPUs (e.g. iPhone 14 Pro Max) start high; Intel UHD 620/Iris start medium; older Intel HD/UHD 600–610, entry Mali/Adreno/PowerVR and software renderers start low (typical Inspiron 15 3000 configurations land on medium or low). In automatic mode the scene then measures real frame rate and steps down — resolution, then shadows, then a 30 fps cap — telling the player in a toast.

What keeps it light:

- **Baked geometry.** Every object is assembled from primitives, then merged into one geometry with per-vertex colours and drawn with one shared material. The static island (ground, fences, trees, buildings, mountains) is two draw calls; each plot, animal, workshop or fish is one or two. Measured in Chromium: 344–376 draw calls per frame before, 27–29 on the low preset and 53–61 on high with shadows (shadow pass included).
- No textures except tiny canvas icons; decorative meshes are excluded from tap picking; the loop pauses when the game is off-screen or the tab is hidden; three.js only downloads after "Vào nông trại".
- The 2D board is plain DOM with transform-only CSS animations.

## Meshy models (optional)

Generated GLB models can replace the built-in chicken, duck, sheep, cow and truck. The key stays on your machine:

1. Put `MESHY_API_KEY="..."` in `.env.local` (git-ignored; never `NEXT_PUBLIC_`).
2. Run `npm run models:meshy` (or `-- --only=chicken,cow`, `-- --dry-run`, `-- --polycount=2500`, `-- --force`). Each model is a preview task (remeshed to ~3000 triangles) plus a texture task, so it spends Meshy credits; task ids are remembered in `scripts/.meshy-tasks.json` so an interrupted run resumes without paying twice.
3. The script shrinks each model with `npx @gltf-transform/cli optimize` (meshopt geometry, 512 px WebP textures) and writes `public/models/<name>.glb` plus an entry in `public/models/manifest.json` (`url`, `height` in scene metres, `rotationY` to fix facing).
4. Commit the GLB files and manifest (not `public/models/raw/`) and redeploy.

The scene loads the manifest at runtime; anything missing, broken or slow simply keeps the built-in model. Check Meshy's licence terms for your plan before publishing generated assets.

## Where things live

| File | Role |
|---|---|
| `src/lib/farm/engine.ts` | Pure rules and data: crops, fish, animals, workshops, prices, levels, `advance()` for time, every action, save validation. No React, DOM or three.js. |
| `src/lib/farm/quality.ts` | Graphics presets, device detection and the stored choice (no three.js import). |
| `src/lib/farm/scene.ts` | three.js scene: baking, ranch, adaptive quality, optional GLB models. Renders a `GameState`, reports taps as `SceneHit`. Holds no rules. |
| `src/components/farm/FarmScene3D.tsx` | Mounts the scene; imports `scene.ts` (and three.js) only on demand; remounts when the preset changes. |
| `src/components/farm/FarmGame.tsx` | Game state (reducer), ticking, saving, HUD, tools, view switching. |
| `src/components/farm/cards.tsx`, `sheets.tsx`, `Board2D.tsx` | Bottom cards; market, barn, seeds, mill, workshops, truck, gifts and help sheets; the 2D board. |
| `scripts/meshy-models.mjs` | Optional model generation (see above). |
| `src/components/LearningWorld.tsx` | Page shell: entry gate, the game, today's learning tasks, heatmap, checkpoint. |

Randomness (weeds, pests, litter, drop positions) uses a seed passed with each tick so the reducer stays pure.

## Storage and limits

- One save per browser under `localStorage["learning-farm-game-v1"]`. It is validated on load; malformed fields are repaired or dropped. Saves from before the ranch existed get a starter chicken and six bags of feed. If storage is blocked the game runs in memory for that visit and says so.
- No server writes, no database tables, no migration. The read-only preview deployment needs nothing extra.
- Progress does not follow the player to another device. A synced farm would need the Studio session or visitor accounts plus a database table; that is deliberately out of scope.
- The clock is the device clock. Someone can move their clock forward to grow crops faster; that only affects their own local game.

## Changing the balance

Edit the tables at the top of `engine.ts` (`CROPS`, `FISHES`, `ANIMALS`, `PRODUCTS`, `GOODS`, `WORKSHOPS`, `MILL_YIELD`, `ITEMS`, unlock and upgrade tables, `TRUCK`, reward constants). Bump `SAVE_KEY` and the `version` field only if the save shape changes incompatibly; otherwise `parseSave` keeps old saves working.
