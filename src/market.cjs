const { shops, weapons, surface } = require("./content.cjs");
const { note, reject, quietTurn } = require("./turns.cjs");
const { sameTile, manhattanDistance, dirs } = require("./grid.cjs");
function grantWeapon(game, name, attackBonus) {
  const hero = game.hero;
  if (Object.hasOwn(hero.gear, name)) return;
  hero.gear[name] = attackBonus;
  if (attackBonus > hero.gear[hero.weapon]) hero.weapon = name;
  note(game, `Found ${name} (+${attackBonus} attack).`);
}
function atShop(game) {
  return game.zone === "surface"
    ? shops.find((shop) => sameTile(game.hero, shop))
    : undefined;
}
function buyWeapon(game, weaponId) {
  const offer = atShop(game)?.stock.find((item) => item.weaponId === weaponId);
  if (!offer) return reject(game, "This stall does not sell that weapon.");
  const hero = game.hero,
    weapon = weapons[weaponId];
  if (Object.hasOwn(hero.gear, weapon.name))
    return reject(game, "Already owned.");
  if (hero.coins < offer.priceInCoins)
    return reject(game, `Need ${offer.priceInCoins - hero.coins} more coins.`);
  hero.coins -= offer.priceInCoins;
  grantWeapon(game, weapon.name, weapon.attackBonus);
  return quietTurn;
}
function moveOnSurface(game, direction) {
  const [dx, dy] = dirs[direction],
    x = game.hero.x + dx,
    y = game.hero.y + dy;
  const { minX, maxX, minY, maxY } = surface.bounds;
  if (x < minX || x > maxX || y < minY || y > maxY)
    return reject(game, "The promenade ends here.");
  Object.assign(game.hero, { x, y });
  return quietTurn;
}
function useLift(game) {
  const hero = game.hero;
  if (game.zone === "surface") {
    if (!sameTile(hero, surface.lift))
      return reject(game, "Return to the central lift (gold ring).");
    game.zone = "dungeon";
    Object.assign(hero, game.anchor);
    note(game, "Back in the dungeon.");
  } else {
    if (game.enemies.some((enemy) => manhattanDistance(hero, enemy) <= 2))
      return reject(game, "Too close to a foe to recall.");
    game.anchor = { x: hero.x, y: hero.y };
    game.zone = "surface";
    Object.assign(hero, surface.lift);
    note(game, "Harbor Market: walk onto a striped stall to trade.");
  }
  return quietTurn;
}
module.exports = { atShop, buyWeapon, moveOnSurface, useLift, grantWeapon };
