const assert = require("node:assert/strict");
const fixture = require("./fixtures/v2-market.json");
const { act, atShop, attack, fresh } = require("../game.js");
const { decodeSave, encodeSave } = require("../src/client/save.cjs");
const { createCamera } = require("../src/client/camera.cjs");
const { renderShopControls } = require("../src/client/shop-controls.cjs");
// Keep the historical file immutable; migrations must work on this exact old representation.
const game = decodeSave(JSON.stringify(fixture));
assert.equal(game.zone, "surface");
assert.equal(game.hero.flareCooldown, 2);
assert.equal(game.hero.weapon, "Hookblade");
assert.deepEqual(JSON.parse(encodeSave(game)), fixture);
const original = fresh(17);
for (const action of ["travel", "west", "west", "buy:hookblade"])
  assert(act(original, action));
original.hero.flareCooldown = 2;
assert.deepEqual(JSON.parse(encodeSave(original)), fixture);
// A catalog-only addition must reach the HUD, dispatch, equipment, and persistence.
const shop = atShop(game);
shop.stock.push({ weaponId: "prism-glaive", priceInCoins: 7 });
game.hero.coins = 7;
try {
  const container = {
    ownerDocument: { createElement: () => ({ dataset: {} }) },
    replaceChildren(...children) {
      this.children = children;
    },
  };
  renderShopControls(container, shop);
  const third = container.children[2];
  assert.match(third.textContent, /Prism Glaive/);
  assert(act(game, third.dataset.act));
  const restored = decodeSave(encodeSave(game));
  assert.equal(restored.hero.weapon, "Prism Glaive");
  assert.equal(restored.hero.coins, 0);
  assert.equal(attack(restored.hero), restored.hero.power + 6);
} finally {
  shop.stock.pop();
}
for (const surface of [true, false])
  for (const [width, height] of [
    [320, 250],
    [1150, 600],
  ]) {
    const camera = createCamera(width, height, { x: 10, y: 12 }, surface);
    for (const tile of [
      { x: 1, y: 1 },
      { x: 12, y: 9 },
      { x: 18, y: 19 },
    ])
      assert.deepEqual(camera.tileAt(...camera.project(tile.x, tile.y)), tile);
  }
console.log(
  "Historical save, catalog-only third offer, and camera round trips passed.",
);
// Exercise the real world renderer even if an event handler error would be swallowed by a browser.
const { createRenderer } = require("../src/client/renderer.cjs");
global.devicePixelRatio = 1;
const context = new Proxy(
  { createLinearGradient: () => ({ addColorStop() {} }) },
  { get: (target, key) => target[key] ?? (() => {}) },
);
const renderer = createRenderer({
  getBoundingClientRect: () => ({ width: 800, height: 500 }),
  getContext: () => context,
});
const expedition = fresh(31);
renderer.draw(expedition);
assert(act(expedition, "travel"));
renderer.draw(expedition);
assert.deepEqual(renderer.camera.tileAt(...renderer.camera.project(10, 10)), {
  x: 10,
  y: 10,
});
delete global.devicePixelRatio;
