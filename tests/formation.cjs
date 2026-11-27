const assert = require("node:assert/strict");
const G = require("../game.js");
const { createCampaign, resolve } = require("../src/atlas/campaign.cjs");
const { regions } = require("../src/atlas/catalog.cjs");
const point = ({ x, y }) => [x, y];
const game = G.fresh(40);
game.enemies = [];
for (const action of ["east", "south", "west", "north"]) {
  assert(G.act(game, action));
  assert.equal(game.hero.facing, action);
}
assert(!G.act(game, "west"));
assert.equal(game.hero.facing, "north");
// All connected coarse cells share a full-width opening, not a doorway.
for (let y = 1; y < G.N - 1; y += 4) {
  for (let x = 1; x < G.N - 1; x += 4) {
    for (let i = 0; i < 3; i++) {
      assert.equal(G.walk(game, x + 3, y + i), G.walk(game, x + 3, y));
      assert.equal(G.walk(game, x + i, y + 3), G.walk(game, x, y + 3));
    }
  }
}
const s = createCampaign(40);
while (s.party.length < 8) assert(resolve(s, "recruit"));
assert(resolve(s, "enter:" + regions[0].id));
const map = s.maps[s.zone];
map.enemies = [];
const unique = () => new Set(s.party.map((m) => point(m).join())).size;
assert.equal(unique(), 8);
// A three-wide straightaway: all ranks should translate east together.
map.tiles.fill(0);
for (let x = 1; x < G.N - 1; x++)
  for (let y = 8; y <= 10; y++) map.tiles[G.tileIndex(x, y)] = 1;
const ranks = [[5, 9], [5, 8], [5, 10], [4, 9], [4, 8], [4, 10], [3, 8], [3, 10]];
s.party.forEach((m, i) => Object.assign(m, { x: ranks[i][0], y: ranks[i][1] }));
for (let i = 1; i <= 5; i++) {
  assert(resolve(s, "east"));
  s.party.forEach((m, j) => {
    assert.deepEqual(point(m), [ranks[j][0] + i, ranks[j][1]]);
    assert.equal(m.facing, "east");
  });
}
// Turn into the left wing: the ally steps south as the leader steps north.
assert(resolve(s, "north"));
assert.equal(s.party[0].facing, "north");
assert.equal(s.party[1].facing, "south");
assert.equal(unique(), 8);
const before = s.party.map((m) => [m.x, m.y, m.facing]);
assert(!resolve(s, "north"));
assert(resolve(s, "wait"));
assert.deepEqual(s.party.map((m) => [m.x, m.y, m.facing]), before);
console.log("Cardinal headings, passage width and eight-member formation verified.");
