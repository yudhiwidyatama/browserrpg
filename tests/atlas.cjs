const assert = require("node:assert/strict");
const {
  createCampaign,
  resolve,
  mapFor,
} = require("../src/atlas/campaign.cjs");
const inv = require("../src/atlas/inventory.cjs");
const { regions } = require("../src/atlas/catalog.cjs");
const { walkingDistancesFrom, tileIndex } = require("../src/grid.cjs");
const { kit } = require("../src/atlas/art/mesh.cjs");
const { creature, adventurer } = require("../src/atlas/art/figures.cjs");
for (const r of regions) {
  const i = regions.indexOf(r);
  for (let seed = 0; seed < 12; seed++) {
    const map = mapFor(seed, i),
      d = walkingDistancesFrom(map, map.entrance);
    for (const p of [
      map.quest,
      ...map.chests,
      ...map.enemies,
      ...map.springs,
      ...map.hazards,
    ])
      assert(d.has(tileIndex(p.x, p.y)));
  }
  for (const kind of r.foes) {
    let faces = 0;
    creature(
      kit((points) => {
        faces++;
        assert(points.flat().every(Number.isFinite));
      }),
      kind,
    );
    assert(faces > 50, kind);
  }
}
const s = createCampaign(45);
for (let i = 0; i < 7; i++) assert(resolve(s, "recruit"));
assert(!resolve(s, "recruit"));
assert.equal(s.party.length, 8);
for (const member of s.party) {
  let faces = 0;
  adventurer(
    kit(() => faces++),
    member,
  );
  assert(faces > 100);
}
assert(resolve(s, "buy:shield"));
assert(resolve(s, "equip:0:left"));
assert.equal(inv.defense(s.party[0]), 3);
assert(!resolve(s, "meditate"));
s.party[0].xp = 4;
assert(resolve(s, "meditate"));
assert.equal(s.party[0].rank, 2);
for (const r of regions) {
  assert(resolve(s, "enter:" + r.id));
  const map = s.maps[r.id];
  map.enemies = [];
  assert(resolve(s, "mode"));
  const p = s.party[s.active],
    ally = s.party[1],
    before = { x: ally.x, y: ally.y };
  const dir = map.tiles[tileIndex(2, 1)] ? "east" : "south";
  assert(resolve(s, dir));
  assert.deepEqual({ x: ally.x, y: ally.y }, before);
  Object.assign(p, { x: map.chests[0].x, y: map.chests[0].y });
  assert(resolve(s, "use"));
  assert(map.chests[0].open);
  Object.assign(p, { x: map.quest.x, y: map.quest.y });
  assert(resolve(s, "use"));
  if (r.id !== "fen") {
    Object.assign(p, map.entrance);
    assert(resolve(s, "return"));
  }
}
assert.equal(s.state, "won");
assert.equal(s.relics.length, 4);
assert.equal(s.rations, 1);
const m = inv.recruit(0);
assert(inv.give(m, "redRing"));
assert(inv.equip(m, 0, "finger1"));
assert.equal(inv.defense(m), 6);
assert(inv.give(m, "blueRing"));
assert(inv.equip(m, 0, "finger2"));
for (let i = 0; i < 18; i++) inv.upkeep(m);
assert(!m.equipped.finger2);
assert(m.equipped.finger1);
console.log(
  "Regional progression, equipment, reachability and procedural meshes passed.",
);
