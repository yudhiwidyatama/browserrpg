"use strict";
const assert = require("node:assert/strict"),
  G = require("../game.js");
for (let seed = 0; seed < 100; seed++) {
  const s = G.fresh(seed);
  for (let f = 1; f <= 3; f++) {
    assert.equal(G.N, 21);
    assert.equal(s.chests.length, 4);
    assert.equal(s.fountains.length, 3);
    let points = [
        s.hero,
        s.rune,
        s.exit,
        ...s.loot,
        ...s.enemies,
        ...s.fountains,
        ...s.chests,
        ...s.vials,
      ],
      d = G.walkingDistancesFrom(s, s.hero);
    assert.equal(
      new Set(points.map((p) => G.tileIndex(p.x, p.y))).size,
      points.length,
    );
    assert(points.every((p) => d.has(G.tileIndex(p.x, p.y))));
    assert(s.loot.some((o) => o.weapon === G.themes[f - 1].weapon));
    assert(s.enemies.some((e) => e.name === G.themes[f - 1].mob));
    Object.assign(s.hero, s.exit);
    s.seal = true;
    s.enemies = [];
    assert(G.act(s, "exit"));
  }
}
let s = G.fresh(42),
  h = s.hero;
s.enemies = [];
const position = (p) => Object.assign(h, { x: p.x, y: p.y });
position(s.chests[0]);
const before = h.coins;
assert(G.act(s, "use"));
assert.equal(h.coins, before + s.chests[0].coins);
assert.equal(h.weapon, "Brine Knife");
assert(!G.act(s, "use"));
const f = s.fountains[0];
position(f);
assert(!G.act(s, "use"));
assert.equal(f.charges, 2);
for (let i = 0; i < 2; i++) {
  h.hp = 1;
  assert(G.act(s, "use"));
  assert.equal(h.hp, 9);
}
assert(!G.act(s, "use"));
const anchor = [h.x, h.y];
assert(G.act(s, "travel"));
G.act(s, "west");
G.act(s, "west");
assert.equal(G.atShop(s).name, "Tide Smith");
h.coins = 4;
assert(!G.act(s, "buy:hookblade"));
assert.equal(h.coins, 4);
h.coins = 14;
assert(G.act(s, "buy:tide-sabre"));
assert.equal(h.coins, 0);
assert.equal(h.weapon, "Tide Sabre");
assert(!G.act(s, "buy:tide-sabre"));
assert(!G.act(s, "travel"));
for (let i = 0; i < 4; i++) G.act(s, "east");
assert.equal(G.atShop(s).name, "Crown Forge");
h.coins = 44;
assert(G.act(s, "buy:dawn-pike"));
assert.equal(G.attack(h), h.power + 8);
G.act(s, "west");
G.act(s, "west");
assert(G.act(s, "travel"));
assert.deepEqual([h.x, h.y], anchor);
assert.equal(f.charges, 0);
assert(s.chests[0].open);
// Bump a foe on an open neighbor, then step onto the dropped coin pile.
position({ x: 1, y: 1 });
const [a, [dx, dy]] = Object.entries(G.dirs).find(([_, [x, y]]) =>
  G.walk(s, h.x + x, h.y + y),
);
const e = {
  x: h.x + dx,
  y: h.y + dy,
  hp: 1,
  max: 1,
  coins: 7,
  name: "Test foe",
};
s.enemies = [e];
assert(!G.act(s, "travel"));
const coins = h.coins;
assert(G.act(s, a));
assert.equal(h.coins, coins);
assert(G.act(s, a));
assert.equal(h.coins, coins + 7);
console.log(
  "Loot, purchases, charges, recall persistence, combat drops and 300 seeded floors verified.",
);
