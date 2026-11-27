const { themes } = require("../content.cjs");
const { sameTile } = require("../grid.cjs");
const { atShop } = require("../market.cjs");
const { attack } = require("../combat.cjs");
const { renderShopControls } = require("./shop-controls.cjs");
function objective(game, shop) {
  if (game.zone === "surface")
    return shop
      ? "Choose a weapon below. Stronger weapons equip automatically."
      : "West stall: Tide Smith. East stall: Crown Forge. R at the central ring returns you to the dungeon.";
  const here = (p) => sameTile(p, game.hero);
  const spring = game.fountains.find(here);
  if (spring) return `Spring: ${spring.charges} drinks left. Press E.`;
  const chest = game.chests.find(here);
  if (chest) return chest.open ? "Empty chest." : "Press E to open the chest.";
  if (!game.seal) return "Find the gold crystal.";
  return game.enemies.some((e) => e.boss)
    ? "Defeat the Crown Warden."
    : "Reach the gold ring and press E.";
}
function renderHud(game) {
  const hero = game.hero,
    market = game.zone === "surface",
    shop = atShop(game),
    byId = (id) => document.getElementById(id);
  byId("floor").textContent =
    `${market ? "Harbor Market" : `Floor ${game.floor}/${themes.length}`} · Turn ${game.turn}`;
  byId("stats").textContent =
    `HP ${hero.hp}/${hero.max} · Rank ${hero.rank} · ${hero.coins} coins · ${hero.potions} vials`;
  byId("chapter").textContent = market
    ? (shop?.name ?? "Harbor Market")
    : themes[game.floor - 1].name;
  byId("goal").textContent =
    `${objective(game, shop)} Equipped: ${hero.weapon} · ${attack(hero)} attack.`;
  document.querySelector("[data-act=travel]").textContent = market
    ? "Take lift [R]"
    : "Visit surface [R]";
  document.querySelector("[data-act=pulse]").textContent = hero.flareCooldown
    ? `Flare (${hero.flareCooldown})`
    : "Flare [F]";
  renderShopControls(byId("shop-stock"), shop);
  for (const button of document.querySelectorAll("[data-act]")) {
    button.disabled = game.state !== "playing";
    if (["use", "heal", "pulse", "wait"].includes(button.dataset.act))
      button.hidden = market;
  }
  byId("log").replaceChildren(
    ...game.log.map((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      return li;
    }),
  );
}
module.exports = { renderHud };
