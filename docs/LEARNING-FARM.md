# Learning Farm game

`/learning/world` hosts a small farm-and-fishpond game in the spirit of classic social farm games, with original art built from three.js primitives. It is a motivation layer around daily practice, not a progress tracker: nothing in the game marks a lesson complete, adds a reviewed attempt, creates a streak or changes a CEFR level.

## What the player can do

- **Fields (12 plots, 6 open at the start).** Hoe → sow → care → harvest → hoe again. Crops grow in real time, including while the page is closed (offline growth is simulated up to 14 days in one-minute steps). While growing, a plot can become dry (half speed), weedy or infested; each weed/pest still present at harvest costs one unit of yield (never below half). Fertilizer skips 30% of the remaining time, once per crop.
- **Pond.** Buy fry, feed the pond (one portion keeps every fish fed for 20 minutes; hungry fish grow at 35%), skim litter (each piece lowers water quality and growth), and net fish once they show a star.
- **Barn and market.** Harvests and fish go to the barn and are sold for coins. One crop and one fish sell for +25% each Vietnam calendar day, the same for everyone. The market sells seeds, fry, fertilizer and fish food, and expands the fields and the pond.
- **Levels.** Every action earns XP; levels unlock crops (9), fish (6), extra plots and pond capacity.
- **Gifts.** A once-a-day visit gift, and a study gift that needs at least one practice draft saved on this device today (`learning-practice-v1:*` in localStorage, the same drafts the activity heatmap reads). A saved revision adds one fertilizer. The gift explains that it only reads local drafts.

Tools: 👋 does the sensible thing for the tapped plot; the other tools do one job each. Every scene action is also available from buttons (plot card, pond card, sheets), and a 2D board replaces the 3D scene on devices without WebGL or on request.

## Where things live

| File | Role |
|---|---|
| `src/lib/farm/engine.ts` | Pure rules and data: crops, fish, prices, levels, `advance()` for time, every action, save validation. No React, DOM or three.js. |
| `src/lib/farm/scene.ts` | three.js scene. Renders a `GameState`, animates idle motion, reports taps as `SceneHit`. Holds no rules. |
| `src/components/farm/FarmScene3D.tsx` | Mounts the scene; imports `scene.ts` (and three.js) only on demand. |
| `src/components/farm/FarmGame.tsx` | Game state (reducer), ticking, saving, HUD, tools, market/barn/gift/help sheets, 2D board. |
| `src/components/LearningWorld.tsx` | Page shell: entry gate, the game, today's learning tasks, heatmap, checkpoint. |

The page only downloads the game and three.js after "Vào nông trại". Randomness (weeds, pests, litter) uses a seed passed with each tick so the reducer stays pure.

## Storage and limits

- One save per browser under `localStorage["learning-farm-game-v1"]`. It is validated on load; malformed fields are repaired or dropped. If storage is blocked the game runs in memory for that visit and says so.
- No server writes, no database tables, no migration. The read-only preview deployment needs nothing extra.
- Progress does not follow the player to another device. A synced farm would need the Studio session or visitor accounts plus a database table; that is deliberately out of scope.
- The clock is the device clock. Someone can move their clock forward to grow crops faster; that only affects their own local game.

## Changing the balance

Edit the tables at the top of `engine.ts` (`CROPS`, `FISHES`, `ITEMS`, `PLOT_UNLOCKS`, `POND_UPGRADES`, reward constants). Bump `SAVE_KEY` and the `version` field only if the save shape changes incompatibly; otherwise `parseSave` keeps old saves working.
