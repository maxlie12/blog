/**
 * What the player just did, read from the game state before and after: the farmer in the scene
 * walks over and acts each one out. Only player-made changes count — time never raises soil
 * moisture, removes weeds, bugs, litter, fish or products, puts fruit back, or adds feed — and
 * nothing is read across a load, a reset or a long gap (the farm caught up on time away).
 */
import type { AnimalId, GameState, RanchDrop } from "./engine.ts";

/** The areas where the player works with the farmer (fishing at the river is drawn apart). */
export type ChoreView = "farm" | "orchard" | "pond" | "ranch";

export type ChoreKind =
  | "hoe" | "sow" | "water" | "weed" | "bug" | "fertilize" | "harvest"
  | "dig" | "plantTree" | "waterTree" | "shake" | "fellTree"
  | "feedFish" | "skim" | "netFish" | "stockFish"
  | "stackFeed" | "pour" | "collect" | "newAnimal" | "incubator";

export interface Chore {
  kind: ChoreKind;
  view: ChoreView;
  plot?: number;
  spot?: number;
  /** A point of the pond, in its ellipse (±1 at the edge). */
  pond?: [number, number];
  drop?: RanchDrop;
  /** The kind whose trough gets feed, or the kind of a new animal. */
  species?: AnimalId;
}

/** The most chores read from one change (collecting everything at once queues the first few). */
export const MAX_CHORES = 6;
const LONG_GAP_MS = 30_000;

export function choresBetween(before: GameState | null, after: GameState): Chore[] {
  if (!before || before === after || before.createdAt !== after.createdAt) return [];
  if (Math.abs(after.lastTick - before.lastTick) > LONG_GAP_MS) return [];
  const chores: Chore[] = [];

  after.plots.forEach((plot, index) => {
    const old = before.plots[index];
    if (!old || old === plot) return;
    const add = (kind: ChoreKind) => chores.push({ kind, view: "farm", plot: index });
    if ((old.status === "wild" || old.status === "withered") && plot.status === "tilled") add("hoe");
    else if (old.status === "tilled" && plot.status === "growing") add("sow");
    else if (old.status === "growing" && (plot.status === "withered" || plot.harvests > old.harvests)) add("harvest");
    else if (old.status === plot.status) {
      if (plot.moisture > old.moisture + 0.05) add("water");
      if (plot.weeds < old.weeds) add("weed");
      if (plot.bugs < old.bugs) add("bug");
      if (plot.fertilized && !old.fertilized) add("fertilize");
    }
  });

  after.orchard.spots.forEach((spot, index) => {
    const old = before.orchard.spots[index];
    if (!old || old === spot) return;
    const add = (kind: ChoreKind) => chores.push({ kind, view: "orchard", spot: index });
    if (old.status === "grass" && spot.status === "hole") add("dig");
    else if (old.status === "hole" && spot.status === "tree") add("plantTree");
    else if (old.status === "tree" && spot.status === "hole") add("fellTree");
    else if (old.status === "tree" && spot.status === "tree") {
      if (spot.moisture > old.moisture + 0.05) add("waterTree");
      if (old.fruit > 1 && spot.fruit < old.fruit - 1) add("shake");
    }
  });

  const pond = after.pond, oldPond = before.pond;
  if (pond.fedUntil > oldPond.fedUntil + 1000) chores.push({ kind: "feedFish", view: "pond", pond: [0.1, 0.9] });
  const trash = new Set(pond.trash.map((item) => item.id));
  for (const item of oldPond.trash) if (!trash.has(item.id)) chores.push({ kind: "skim", view: "pond", pond: [item.x, item.z] });
  const fish = new Set(pond.fish.map((item) => item.id));
  if (oldPond.fish.some((item) => !fish.has(item.id))) chores.push({ kind: "netFish", view: "pond", pond: [-0.2, 0.75] });
  const oldFish = new Set(oldPond.fish.map((item) => item.id));
  if (pond.fish.some((item) => !oldFish.has(item.id))) chores.push({ kind: "stockFish", view: "pond", pond: [0.35, 0.85] });

  const ranch = after.ranch, oldRanch = before.ranch;
  if (after.items.feed > before.items.feed) {
    chores.push({ kind: "stackFeed", view: "ranch" });
    const kinds = new Set(ranch.animals.map((animal) => animal.species));
    for (const species of ["chicken", "duck", "sheep", "cow"] as AnimalId[]) if (kinds.has(species)) chores.push({ kind: "pour", view: "ranch", species });
  }
  const drops = new Set(ranch.drops.map((item) => item.id));
  for (const drop of oldRanch.drops) if (!drops.has(drop.id)) chores.push({ kind: "collect", view: "ranch", drop });
  const oldAnimals = new Set(oldRanch.animals.map((animal) => animal.id));
  const hatched = (oldRanch.incubator?.eggs.length ?? 0) > (ranch.incubator?.eggs.length ?? 0);
  for (const animal of ranch.animals) if (!oldAnimals.has(animal.id) && !hatched) chores.push({ kind: "newAnimal", view: "ranch", species: animal.species });
  const eggs = ranch.incubator?.eggs ?? [], oldEggs = oldRanch.incubator?.eggs ?? [];
  const turned = eggs.some((egg) => oldEggs.some((old) => old.id === egg.id && egg.sinceTurn < old.sinceTurn - 1));
  if (ranch.incubator && (!oldRanch.incubator || eggs.length !== oldEggs.length || turned)) chores.push({ kind: "incubator", view: "ranch" });

  return chores.slice(0, MAX_CHORES);
}
