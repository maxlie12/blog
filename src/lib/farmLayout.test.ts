import assert from "node:assert/strict";
import test from "node:test";
import { DUCK_POND, FIXTURES, LANE, PEN_OF, RANCH_BOUNDS, TOP_LEVEL, fixtureRect, inside, overlaps, penRect, walkable, type PenId } from "./farm/ranchLayout.ts";
import { NO_COVER, ZOOM_MAX, clampZoom, coverLift, defaultHeight, isNarrow, panLimits, zoomMin } from "./farm/view.ts";

const PENS: PenId[] = ["poultry", "sheep", "cow"];

test("view: a wide screen fits the area, a phone shows it closer, and panning reaches its edges", () => {
  const area = { width: 12, height: 9 };
  assert.equal(defaultHeight(area, 1.4), 9, "wide: the whole area fits");
  const phone = defaultHeight(area, 0.6);
  assert.ok(phone < 12 / 0.6, "phone: closer than fitting the full width");
  assert.ok(phone >= 9 * 0.85, "phone: still most of the height");
  assert.deepEqual(panLimits(area, 1.4, 1), { x: Math.max(0, (12 - 9 * 1.4) / 2), y: 0 }, "wide at zoom 1: almost nothing to pan");
  const phonePan = panLimits(area, 0.6, 1);
  assert.ok(phonePan.x > 0, "phone: a sideways drag shows the rest");
  const zoomed = panLimits(area, 1.4, 2);
  assert.ok(zoomed.x > 0 && zoomed.y > 0, "zoomed in: pans both ways");
  assert.ok(Math.abs(zoomed.x - (12 - (9 / 2) * 1.4) / 2) < 1e-9);
  assert.equal(clampZoom(10, area, 1.4), ZOOM_MAX);
  assert.equal(clampZoom(0.1, area, 1.4), zoomMin(area, 1.4));
  assert.ok(zoomMin(area, 0.6) < zoomMin(area, 1.4), "a phone may zoom out further, to see the whole width");
});

test("view: on a phone the area is framed in the part the bars and cards leave open", () => {
  const area = { width: 12, height: 9, phone: 0.7 };
  const cover = { top: 0.15, bottom: 0.3 };
  // The open part sits above the middle when the bottom card is taller than the top bar.
  assert.ok(coverLift(10, cover) > 0);
  assert.equal(coverLift(10, NO_COVER), 0);
  // The open part still shows most of the area's height, and panning reaches its top and bottom.
  const height = defaultHeight(area, 0.55, cover);
  assert.ok(height * (1 - 0.45) >= 9 * 0.85 - 1e-9);
  const limit = panLimits(area, 0.55, 2, cover);
  assert.ok(Math.abs(limit.y - (9 - (height / 2) * 0.55) / 2) < 1e-9);
  assert.ok(limit.y > panLimits(area, 0.55, 2).y, "less of the screen open: more to pan up and down");
  // A wide screen keeps its framing whatever the cover.
  assert.ok(!isNarrow(1.4) && isNarrow(0.55));
});

test("ranch: pens grow with the level, stay inside the ranch and never overlap each other or the lane", () => {
  for (const pen of PENS) {
    let previous = penRect(pen, 0);
    for (let level = 0; level <= TOP_LEVEL; level += 1) {
      const rect = penRect(pen, level);
      assert.ok(rect.x0 <= previous.x0 && rect.x1 >= previous.x1 && rect.z0 <= previous.z0 && rect.z1 >= previous.z1, `${pen} grows at level ${level}`);
      assert.ok(rect.x0 >= RANCH_BOUNDS.x0 && rect.x1 <= RANCH_BOUNDS.x1 && rect.z0 >= RANCH_BOUNDS.z0 && rect.z1 <= RANCH_BOUNDS.z1, `${pen} stays in the ranch`);
      assert.ok(!overlaps(rect, LANE), `${pen} keeps off the lane`);
      for (const other of PENS) if (other !== pen) assert.ok(!overlaps(rect, penRect(other, level)), `${pen} and ${other} apart at level ${level}`);
      previous = rect;
    }
  }
  // The ranch stays on the island (radius about 15.75, with room for the grassy lip).
  for (const [x, z] of [[RANCH_BOUNDS.x0, RANCH_BOUNDS.z1], [RANCH_BOUNDS.x1, RANCH_BOUNDS.z1]]) assert.ok(Math.hypot(x, z) < 15);
});

test("ranch: buildings and the duck pond fit in the smallest pens, and each animal has room", () => {
  for (const [name, item] of Object.entries(FIXTURES)) {
    const rect = fixtureRect(name as keyof typeof FIXTURES);
    const home = item.pen === "lane" ? LANE : penRect(item.pen, 0);
    assert.ok(rect.x0 >= home.x0 && rect.x1 <= home.x1 && rect.z0 >= home.z0 && rect.z1 <= home.z1, `${name} fits its pen from the start`);
  }
  const yard = penRect("poultry", 0);
  assert.ok(inside(yard, DUCK_POND.x - DUCK_POND.rx, DUCK_POND.z - DUCK_POND.rz) && inside(yard, DUCK_POND.x + DUCK_POND.rx, DUCK_POND.z + DUCK_POND.rz), "the pond fits the first yard");
  assert.equal(PEN_OF.duck, "poultry");
  assert.ok(walkable("poultry", 0, DUCK_POND.x, DUCK_POND.z, true) && !walkable("poultry", 0, DUCK_POND.x, DUCK_POND.z), "only swimmers go in the pond");
  // Enough free ground in each first pen for its animals to move about.
  for (const pen of PENS) {
    const rect = penRect(pen, 0);
    let free = 0;
    for (let x = rect.x0; x <= rect.x1; x += 0.1) for (let z = rect.z0; z <= rect.z1; z += 0.1) if (walkable(pen, 0, x, z)) free += 0.01;
    assert.ok(free > 1.2, `${pen}: ${free.toFixed(2)} m² free at the first level`);
  }
});
