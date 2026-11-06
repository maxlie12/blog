# Learning Farm game

`/learning/world` hosts a small farm, orchard, fishpond, river and ranch game in the spirit of classic farm games, with original art built from three.js primitives (or optional generated models, see "Meshy models"). It is a motivation layer around daily practice, not a progress tracker: nothing in the game marks a lesson complete, adds a reviewed attempt, creates a streak or changes a CEFR level.

## What the player can do

- **Clock and seasons.** Each farm has its own clock: one game hour is one real minute, so a game day (dawn, day, dusk, night) lasts 24 real minutes; a new farm starts at 6:00 on day 1 of spring. Spring, summer, autumn and winter last seven game days each. The HUD shows the season, day and hour. See "Time, seasons and growth" below.
- **Fields (12 plots, 6 open at the start).** Hoe → sow → water → care → harvest → hoe again. Crops grow in real time, including while the page is closed (offline growth is simulated up to 14 days in one-minute, one-game-hour steps), over game days. Soil moisture drains over game hours; dry soil slows growth to a quarter until watered. Out of season a crop grows at half speed and dries faster. Tomatoes, strawberries and watermelons stay after a harvest and fruit again until spent; the rest harvest once. A plot can become weedy or infested; each weed/pest still present at harvest costs one unit of yield (never below half). Fertilizer skips 30% of the remaining time, once per harvest.
- **Hands-on work.** In the fields and the orchard, press on a plot or tree and drag: every plot or tree the tool passes is worked, and the tool follows the finger (hoe chops, seed bag scatters, can pours, glove pulls) with dirt, seeds, water, leaves, sparkles, harvested crops or falling fruit. A tap works one plot. Plots passed after the first stay quiet when there is nothing to do; a drag never opens a sheet half-way. The effects come from comparing each new state with the last, so card buttons look the same.
- **Orchard (6 tree spots, 2 open at the start).** Dig a hole, plant a sapling (lemon, orange, banana, mango, coconut by level; bought at the market), water it when the soil gets dry (deep roots: a watering lasts a day or two; dry soil slows it to a quarter). A tree takes three to ten game days to grow from sapling to young to grown, then fruits again and again, fastest in its fruiting seasons (slowly outside them); shake a ripe tree (⭐) to drop its fruit into the barn. A tree can be cut down (asks twice) to plant another. More spots for coins and level.
- **River.** A river runs down the east side (spring, bridge for the road, waterfall off the cliff) with an angler on a jetty. Tap the water to cast there (or press **Thả câu**). Nibbles shake the float but are not a bite; when the fish bites (float plunges, “!”), strike within about a second. Then hold to reel: tension rises, more while the fish pulls; let go in the red or the line snaps, but a slack line for 2.5 s lets the fish go. Six wild fish by level (goby, perch, river prawn, catfish, snakehead, featherback; the last two need care with the tension) and sometimes an old boot. Each bite uses one 🪱 bait (market, 2 xu; five in the daily gift); striking too early keeps the bait. Space or Enter on the fishing button does the same as a press.
- **Pond.** Buy fry, feed the pond (one portion keeps every fish fed for 20 minutes; hungry fish grow at 35%), skim litter (each piece lowers water quality and growth), and net fish once they show a star.
- **Ranch (GAME-017).** The ranch is split into a poultry yard for chickens and ducks (a hen house with a ramp, straw nests, a small duck pond with stones, reeds and lily pads where ducks swim and dabble), a sheep pen with a lean-to shelter, a cow pen with an open red shed and hay rack, each with its own trough (all show the same feed store), and a middle lane with sacks of feed, a grain bin, a hand pump and the incubator hut. Each animal stays in its own pen; hens walk round the water. The pens start smaller and grow with each capacity upgrade (4 → 6 → 8 → 10 animals), each step adding details: a hay stack, a wheelbarrow and straw piles; then a bench, milk cans, a water barrel and flower boxes; then bunting over the lane, lanterns at its entrance and more bales. The layout lives in `src/lib/farm/ranchLayout.ts` (tested in `src/lib/farmLayout.test.ts`); the buildings are baked with the island, the fences and extras rebuilt when the level changes. Animals are bought young (chick, duckling, lamb, calf: smaller, chicks and ducklings yellow) and grow up over one to two and a half game days while they eat from the trough. Grown chickens, ducks, sheep and cows eat one bag of feed per production cycle and drop eggs, duck eggs, wool and milk in their pens to collect — by day only: they sleep (💤) from 20:00 to 5:00. The young eat and grow day and night. Animals wait (bowl icon) when the trough is empty or 24 products are already lying around. They walk on their own legs (chickens and ducks on two, one after the other; sheep and cows on four, in diagonal pairs) at a step rate that matches their speed, so feet do not slide. The pens have clumps of taller grass: grown animals walk over to one (or stop at one they pass), eat for a few seconds (pecking, dabbling or head down, chewing; only the head and neck go down, the body stays level) and crop it short; it grows back over about a minute and a half, one animal per clump. They also peck and preen, sometimes walk to the trough, keep a little room from each other, and chicks and ducklings follow a grown one of their kind. The legs are swung and the head and neck lowered in the vertex shader from per-vertex marks found in the mesh itself (`src/lib/farm/legs.ts`; the built-in models mark their head parts as they are built), so the skeleton-less Meshy models walk and graze too.
- **Pond fish** have their own bodies (tapered and flattened, dark back and pale belly, each species' markings, fins, eyes, barbels on carp, koi and sturgeon) and swim with a wave that runs down the body to the tail, faster when they dart.
- **Incubator.** Built at the ranch (level 2, 150 xu, four slots): set eggs or duck eggs from the barn; they hatch after 21 and 28 game hours into a chick or a duckling, which waits beside the hut until brought out to the pasture (if there is room). Eggs must be turned at least every 12 game hours or they stop developing, except in the last 15% (lockdown). Feed comes from milling harvested crops (grains give the most) or from the market.
- **Workshops.** Built with coins at higher levels: duck eggs → salted-egg jars, eggs + rice → sponge cake, wool → scarf, milk → cheese. Each runs one batch at a time; finished goods are collected into the barn.
- **Barn, market and truck.** Everything collected goes to the barn. Sell on the spot, or load up to 20 items on the truck: it drives to town, comes back after 90 seconds and pays 20% more. One crop and one fish sell for +25% each Vietnam calendar day. The market sells seeds, animals, fry, fertilizer, fish food and feed, and expands the fields, pasture and pond.
- **Levels.** Every action earns XP; levels unlock crops (9), fish (6), animals (4), workshops (4), extra plots and capacity.
- **Gifts.** A once-a-day visit gift (coins, fish food and bait), and a study gift that needs at least one practice draft saved on this device today (`learning-practice-v1:*` in localStorage, the same drafts the activity heatmap reads). A saved revision adds one fertilizer. The gift explains that it only reads local drafts.

Every scene action also has a button (plot card, pond card, ranch card, sheets), and the 2D board offers the same game without WebGL.

**Zoom and look around (GAME-017).** Every 3D area has `+`, `−` and “fit” buttons at the left (44 px; with one focused, the arrow keys look around). Two fingers pinch to zoom and move; Ctrl/⌘ + scroll (and a trackpad pinch) zooms about the pointer, a plain scroll still scrolls the page. Zoomed in, a drag on empty ground (not on a plot or tree, where drags work the soil) moves the view, kept within the area. On a narrow screen each area starts closer (its `phone` share of the width in `VIEWS`: the fields start centred on the plots and keep all of them, the ranch shows its first pens), framed in the part between the top bar and the bottom tool bar or card (`FarmScene3D` measures them when the area or screen size changes, not when a card opens, so the view keeps still under a tap); a sideways drag shows the rest and vertical swipes still scroll the page (`touch-action: pan-y`, `none` once zoomed in). Wide screens keep the old framing. The limits are pure functions in `src/lib/farm/view.ts`. The learning-world page no longer lays out wider than a phone (its grid column could stretch to the widest content, about 464 px, so phones shrank the whole page).

Background music (`src/lib/cozyMusic.ts`, made in the browser with Web Audio, no files) plays while the game is on screen; the **Nhạc** side button turns it off and the slider under the game sets the volume. The setting is shared with Làng Rêu (`cozy-music-v1` in localStorage).

## Time, seasons and growth (GAME-013)

All in `engine.ts`: `gameClock(game, now)` gives day, hour, season, daylight and whether animals are asleep from `game.clockStart`. Old saves get a clock reading 6:00 in spring when first loaded, keep animals grown, keep dry plots dry, and keep each crop's, tree's and animal's progress as the same share of the new, longer times (`LEGACY_*` tables).

| Crop | Level | First harvest | Then | Harvests | Water lasts | Seasons |
|---|---|---|---|---|---|---|
| Rau cải | 1 | 20 h | – | 1 | 10 h | spring, autumn, winter |
| Cà rốt | 1 | 36 h | – | 1 | 14 h | spring, autumn, winter |
| Cà chua | 2 | 48 h | every 18 h | 4 | 9 h | spring, summer |
| Ngô | 3 | 60 h | – | 1 | 11 h | spring, summer |
| Lúa | 4 | 72 h | – | 1 | 6 h | summer, autumn |
| Dâu tây | 5 | 48 h | every 24 h | 5 | 9 h | spring, winter |
| Bí ngô | 6 | 96 h | – | 1 | 12 h | summer, autumn |
| Hướng dương | 7 | 72 h | – | 1 | 16 h | summer |
| Dưa hấu | 8 | 96 h | every 48 h | 2 | 8 h | summer |

Hours are game hours (= real minutes). "Water lasts" is for a mild spring day; soil dries ×1.35 in summer, ×0.9 in autumn, ×0.65 in winter, about ×1.25 under the sun and ×0.6 at night, and ×1.25 out of season. Watering is refused while the soil is at least 60% moist. Trees grow in 72–240 h and fruit every 30–72 h (lemon, banana and coconut all year; orange autumn and winter; mango spring and summer; ×0.4 outside). Animals grow up in 20–60 h and produce every 8–30 daytime hours. Weeds come more in spring, bugs more in summer, both rarely in winter. Product and goods prices were raised for the slower pace. Pond fish, workshops, the truck and fishing keep their real-time pace.

The scene follows the hour: the sun moves from east to west (a cool moon at night), sky, fog, light and water colours blend through dawn, day, dusk and night (`lightAt` in `look.ts`), and lanterns, fairy lights, lit windows and stars come up after dusk. Grass, leaves and the grassy ground take the season's colour (fresh in spring, orange in autumn, frosted in winter; `addSeason`), easing in over the last day of the season before.

## Graphics and performance

The menu under the game ("Đồ họa") offers Automatic, 3D beautiful / balanced / smooth, and 2D battery saver. The choice is stored per browser (`learning-farm-graphics-v1`).

| Preset | Pixel ratio | Shadows | Shading | Water | Grass / flowers | Glow, edge blur, vignette | Frame cap |
|---|---|---|---|---|---|---|---|
| high | up to 2× | 2048 soft | PBR | rippling | 4200 / 650 | yes | 60 |
| medium | up to 1.5× | 1024 | PBR | rippling | 2400 / 360 | no | 60 |
| low | 1× | off | Lambert, coarser spheres | flat | 1000 / 140 | no | 30 |

Automatic picks a starting preset from the GPU name (`quality.ts`): Apple GPUs (e.g. iPhone 14 Pro Max) start high; Intel UHD 620/Iris start medium; older Intel HD/UHD 600–610, entry Mali/Adreno/PowerVR and software renderers start low (typical Inspiron 15 3000 configurations land on medium or low). In automatic mode the scene then measures real frame rate and steps down — glow and edge blur, then resolution, then shadows, then a 30 fps cap — telling the player in a toast.

### The cozy look (GAME-012)

- **Light:** neutral tone mapping, a warm sun with a cool sky light, soft shadows on Medium/High. Sides of things darken a little near the ground and the ground darkens under trees, buildings, beds and bushes; both are baked into vertex colours, so they cost nothing per frame and still show on Low. A gradient sky, haze (fog) and a ring of small floating islands in the distance; the island has a grassy lip and a rough rock cliff tapering underneath.
- **High only** (`look.ts`, `makePost`): a multisampled HDR pass so lanterns and string lights bloom, a gentle tilt-shift blur towards the top and bottom (the middle stays sharp for tapping) and a soft vignette.
- **Ground:** one painted grid (grass patches, dirt yard, sandy road with ruts, worn footpaths, shade) instead of flat boxes. Grass tufts and wild flowers are one instanced mesh each, scattered in clumps away from paths, water, buildings and tree spots, and sway in the wind (`addWind`), as do the baked leaves, vines and bushes (`aSway`).
- **Models:** smooth shading for rounded parts (few-sided roofs, posts and rocks keep facets); rounded boxes for planks and furniture; a reusable leaf blade for crops, vines, reeds, banana plants and sunflowers; raised wooden beds with soil mounds; shingled gable roofs, timber trims, windows with flower boxes; a vine-covered trellis with grapes and fairy lights at the back of the fields; lanterns; a cosy corner (patchwork rug, bean bags, tea table, umbrella, easel) between the fields and the pond; pots, crates, sunflowers, bushes and big banana plants.
- **Fruit (GAME-016):** each fruit is a reshaped, vertex-painted sphere (`fruitGeometry`), one shared geometry per kind and ripeness, with a lit top and a shaded underside: pointed lemons, pitted oranges with a leaf, mangoes with a red blush on long stalks, ridged coconuts, banana hands curving up on a hanging stalk with its purple bell; lobed tomatoes and seeded strawberries with a star of sepals, ribbed pumpkins, watermelons striped end to end with a pale patch, corn kernels in an open husk with silk. Tree fruit turn from green through a turning colour to ripe. With every plot ripe and every tree fruiting, triangles per frame stay within about 5–13% of before.
- **Water:** Medium/High reuse Làng Rêu's water shader (`src/lib/village/graphics.ts`, with a lower opacity so pond fish stay visible): it ripples, flows down the river, takes the sky colour at a glance and foams at the banks. Low keeps the flat transparent surface.

What keeps it light:

- **Baked geometry.** Every object is assembled from primitives, then merged into one geometry with per-vertex colours and drawn with one shared material. The static island is seven draw calls (ground, props, swaying foliage, glowing bulbs, far islands, instanced grass, instanced flowers); each plot, animal, workshop or fish is one or two. Measured in Chromium: 344–376 draw calls per frame before, 27–29 on the low preset and 53–61 on high with shadows (shadow pass included). With the orchard and river (GAME-011): 10–42 per view on the low preset. With the cozy look (GAME-012), per view: low 8–47 draw calls and 69–170k triangles, medium 26–79 and 167–369k, high 41–96 and 191–401k (shadow pass included; before it was about 14k triangles). Software rendering in the test browser runs about 2.4× slower than before; real GPUs have not been measured yet. The river bed, banks, bridge, jetty and angler are baked into the static island; the river surface, flow streaks, fish shadows and particles are one draw call each (instanced where there are many).
- No textures except tiny canvas icons and the sky gradient; decorative meshes are excluded from tap picking, and so are the detailed looks of plots, buildings and workshops (their hit boxes answer taps); the loop pauses when the game is off-screen or the tab is hidden; three.js only downloads after "Vào nông trại".
- The 2D board is plain DOM with transform-only CSS animations.

## Meshy models (optional)

Generated GLB models can replace the built-in chicken, duck, sheep, cow, truck and the six pond fish (tilapia, carp, puffer, goldfish, koi, sturgeon). The key stays on your machine:

1. Put `MESHY_API_KEY="..."` in `.env.local` (git-ignored; never `NEXT_PUBLIC_`).
2. Run `npm run models:meshy` (or `-- --only=chicken,cow`, `-- --dry-run`, `-- --polycount=2500`, `-- --force`). Each model is a preview task (remeshed to ~3000 triangles) plus a texture task, so it spends Meshy credits; task ids are remembered in `scripts/.meshy-tasks.json` so an interrupted run resumes without paying twice.
3. The script shrinks each model with `npx @gltf-transform/cli optimize` (meshopt geometry, 512 px WebP textures) and writes `public/models/<name>.glb` plus an entry in `public/models/manifest.json` (`url`, `height` in scene metres or `length` nose to tail for fish, `rotationY` to fix facing).
4. Commit the GLB files and manifest (not `public/models/raw/`) and redeploy.

The scene loads the manifest at runtime; anything missing, broken or slow simply keeps the built-in model. The committed set (chicken, duck, sheep, cow, truck) is about 440 KB in total; Meshy does not guarantee which way a model faces, so check each new one and correct `rotationY` (the current cow uses π/2 and the truck π). Fish are not generated yet: `npm run models:meshy -- --only=tilapia,carp,puffer,goldfish,koi,sturgeon` makes them (six models' worth of credits). A fish must lie straight with its head along +X in the game (the script guesses `rotationY` π/2); one that swims backwards needs −π/2. Meshy's rigging and animation only cover humanoids (and a dog walk in the web app), so walking and swimming come from the game's own shader, not from Meshy. Check Meshy's licence terms for your plan before publishing generated assets.

## Where things live

| File | Role |
|---|---|
| `src/lib/farm/engine.ts` | Pure rules and data: crops, fish, animals, workshops, prices, levels, `advance()` for time, every action, save validation. No React, DOM or three.js. |
| `src/lib/farm/quality.ts` | Graphics presets, device detection and the stored choice (no three.js import). |
| `src/lib/farm/fishing.ts` | Rod fishing as a pure state machine (cast, nibbles, bite window, reeling tension); tested in `src/lib/farm.test.ts`. |
| `src/lib/farm/scene.ts` | three.js scene: baking, ranch, adaptive quality, optional GLB models. Renders a `GameState`, reports taps as `SceneHit`. Holds no rules. |
| `src/lib/farm/view.ts`, `src/lib/farm/ranchLayout.ts` | Zoom and pan limits per area; the ranch's pens, buildings and duck pond and how pens grow with the capacity level (both tested in `src/lib/farmLayout.test.ts`). |
| `src/lib/farm/legs.ts` | Finds each leg and the head and neck of a model and marks their vertices (tested in `src/lib/farmLegs.test.ts`); the animal (legs and neck) and fish-swim material patches. |
| `src/lib/farm/look.ts` | The cozy look: sky gradient, grass tuft and flower geometry, the wind patch, and High's post-processing. |
| `src/components/farm/FarmScene3D.tsx` | Mounts the scene; imports `scene.ts` (and three.js) only on demand; remounts when the preset changes. |
| `src/components/farm/FarmGame.tsx` | Game state (reducer), ticking, saving, HUD, tools, view switching. |
| `src/components/farm/cards.tsx`, `sheets.tsx`, `Board2D.tsx` | Bottom cards (plot, tree, pond, ranch); market, barn, seeds, saplings, mill, workshops, truck, gifts and help sheets; the 2D board (with the orchard and river). |
| `src/components/farm/FishingPanel.tsx` | Steps the fishing state each frame from presses on the water, the 2D river or its button, and reports each finished round. The state and input are refs shared with the scene, which draws the rod, line, float and catch. |
| `scripts/meshy-models.mjs` | Optional model generation (see above). |
| `src/components/LearningWorld.tsx` | Page shell: entry gate, the game, today's learning tasks, heatmap, checkpoint. |

Randomness (weeds, pests, litter, drop positions) uses a seed passed with each tick so the reducer stays pure.

## Storage and limits

- One save per browser under `localStorage["learning-farm-game-v1"]`. It is validated on load; malformed fields are repaired or dropped. Saves from before the ranch existed get a starter chicken and six bags of feed. Saves from before the orchard and river get the orchard, one lemon sapling and eight bait. If storage is blocked the game runs in memory for that visit and says so.
- No server writes, no database tables, no migration. The read-only preview deployment needs nothing extra.
- Progress does not follow the player to another device. A synced farm would need the Studio session or visitor accounts plus a database table; that is deliberately out of scope.
- The clock is the device clock. Someone can move their clock forward to grow crops faster; that only affects their own local game.

## Changing the balance

Edit the tables at the top of `engine.ts` (`CROPS`, `FISHES`, `ANIMALS`, `PRODUCTS`, `GOODS`, `WORKSHOPS`, `MILL_YIELD`, `ITEMS`, unlock and upgrade tables, `TRUCK`, reward constants). Bump `SAVE_KEY` and the `version` field only if the save shape changes incompatibly; otherwise `parseSave` keeps old saves working.
