const {
  dirs,
  walk,
  sameTile,
  manhattanDistance,
  walkingDistancesFrom,
  tileIndex,
} = require("./grid.cjs");
const { themes } = require("./content.cjs");
const { grantWeapon } = require("./market.cjs");
const { reject, note, dungeonTurn } = require("./turns.cjs");
const attack = (hero) => hero.power + hero.gear[hero.weapon];
function collectPickups(game) {
  const hero = game.hero,
    here = (point) => sameTile(hero, point);
  for (const loot of game.loot.filter(here)) {
    if (loot.coins) {
      hero.coins += loot.coins;
      note(game, `Collected ${loot.coins} coins.`);
    }
    if (loot.weapon)
      grantWeapon(game, loot.weapon, themes[game.floor - 1].bonus);
  }
  game.loot = game.loot.filter((item) => !here(item));
  const vial = game.vials.findIndex(here);
  if (vial >= 0) {
    game.vials.splice(vial, 1);
    hero.potions++;
    note(game, "Vial collected.");
  }
  if (!game.seal && here(game.rune)) {
    game.seal = true;
    note(game, "Seal recovered!");
  }
}
function moveOrStrike(game, direction) {
  const hero = game.hero,
    [dx, dy] = dirs[direction],
    destination = { x: hero.x + dx, y: hero.y + dy };
  if (!walk(game, destination.x, destination.y))
    return reject(game, "Stone blocks the way.");
  const enemy = game.enemies.find((other) => sameTile(other, destination));
  if (enemy) {
    const damage = attack(hero);
    enemy.hp -= damage;
    note(game, `${hero.weapon}: ${damage} damage.`);
  } else {
    Object.assign(hero, destination);
    collectPickups(game);
  }
  return dungeonTurn;
}
function flare(game) {
  const hero = game.hero;
  if (hero.flareCooldown)
    return reject(game, `Flare ready in ${hero.flareCooldown} turns.`);
  const distances = walkingDistancesFrom(game, hero),
    targets = game.enemies.filter(
      (enemy) => (distances.get(tileIndex(enemy.x, enemy.y)) ?? Infinity) <= 2,
    );
  if (!targets.length) return reject(game, "No foe within two walking steps.");
  for (const enemy of targets) enemy.hp -= attack(hero) + 2;
  hero.flareCooldown = 4;
  note(game, "Lantern flare!");
  return dungeonTurn;
}
function drinkVial(game) {
  const hero = game.hero;
  if (!hero.potions || hero.hp === hero.max)
    return reject(game, "Cannot use a vial now.");
  hero.potions--;
  hero.hp = Math.min(hero.max, hero.hp + 10);
  note(game, "Vial consumed.");
  return dungeonTurn;
}
function collectDefeated(game) {
  const hero = game.hero;
  for (const enemy of game.enemies.filter((e) => e.hp <= 0)) {
    game.loot.push({ x: enemy.x, y: enemy.y, coins: enemy.coins });
    note(game, `${enemy.name} drops ${enemy.coins} coins.`);
    hero.xp++;
    if (hero.xp % 3 === 0) {
      hero.rank++;
      hero.power++;
      hero.max += 3;
      hero.hp = Math.min(hero.max, hero.hp + 5);
      note(game, "Rank up!");
    }
  }
  game.enemies = game.enemies.filter((e) => e.hp > 0);
}
function advanceEnemies(game) {
  const hero = game.hero;
  for (const enemy of game.enemies) {
    const distance = manhattanDistance(enemy, hero);
    if (distance === 1) {
      hero.hp = Math.max(0, hero.hp - enemy.atk);
      note(game, `${enemy.name} hits for ${enemy.atk}.`);
      if (hero.hp === 0) {
        game.state = "lost";
        note(game, "Your lantern fades.");
        return;
      }
      continue;
    }
    if (distance > enemy.range) continue;
    const occupied = new Set(
      game.enemies
        .filter((other) => other !== enemy)
        .map((other) => tileIndex(other.x, other.y)),
    );
    const distances = walkingDistancesFrom(game, hero, occupied),
      here = distances.get(tileIndex(enemy.x, enemy.y));
    if (!here || here > enemy.range + 2) continue;
    for (const [dx, dy] of Object.values(dirs)) {
      if (distances.get(tileIndex(enemy.x + dx, enemy.y + dy)) === here - 1) {
        enemy.x += dx;
        enemy.y += dy;
        break;
      }
    }
  }
}
module.exports = {
  moveOrStrike,
  flare,
  drinkVial,
  attack,
  collectDefeated,
  advanceEnemies,
};
