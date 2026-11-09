import assert from "node:assert/strict";
import test from "node:test";
import { penRect, walkable, TOP_LEVEL } from "./farm/ranchLayout.ts";
import { ORCHARD } from "./farm/paths.ts";

test("four birds have separated usable space at every yard level", () => {
  for (const pen of ["chicken", "duck"] as const) {
    for (let level = 0; level <= TOP_LEVEL; level++) {
      const r = penRect(pen, level);
      assert.ok(r.z1 - r.z0 >= 2.39, "bird yards grow in depth as well as width");
      assert.ok(penRect("chicken", level).z1 <= penRect("duck", level).z0);
      assert.ok(penRect("duck", level).z1 < penRect("sheep", level).z0);
      assert.ok((r.x1-r.x0)*(r.z1-r.z0) >= (pen === "chicken" ? 7.9 : 7));
      const positions = [[-3.8,r.z0+.35],[-2.9,r.z0+.35],[-3.8,r.z1-.35],[-2.9,r.z1-.35]];
      for (const [x,z] of positions) assert.ok(walkable(pen,level,x,z), `${pen} ${level}: ${x},${z}`);
      for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)assert.ok(Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1])>=.79);
      assert.ok(ORCHARD.x+3.7 < r.x0, "orchard fence remains clear");
    }
  }
});
