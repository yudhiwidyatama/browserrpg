const { N, walkingDistancesFrom } = require("./grid.cjs");
const { carveLayout } = require("./layout.cjs");
const { themes, weapons } = require("./content.cjs");
const { note } = require("./turns.cjs");
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function buildFloor(game) {
  const random = seededRandom(game.seed + 7919 * game.floor),
    theme = themes[game.floor - 1];
  game.tiles = carveLayout(random, theme.rooms);
  Object.assign(game.hero, { x: 1, y: 1 });
  game.zone = "dungeon";
  game.seal = false;
  const distance = walkingDistancesFrom(game, game.hero);
  const candidates = [...distance.keys()]
    .filter((id) => distance.get(id) >= 5)
    .sort((a, b) => distance.get(a) - distance.get(b));
  function takeAt(index) {
    const [id] = candidates.splice(index, 1);
    return { x: id % N, y: Math.floor(id / N) };
  }
  const takeFraction = (fraction) =>
    takeAt(Math.floor(candidates.length * fraction));
  const takeRandom = () => takeFraction(random());
  game.exit = takeAt(candidates.length - 1);
  game.rune = takeFraction(0.65);
  game.fountains = [0.12, 0.47, 0.86].map((depth) => ({
    ...takeFraction(depth),
    charges: 2,
  }));
  game.chests = Array.from({ length: 4 }, (_, index) => ({
    ...takeRandom(),
    open: false,
    coins: 3 + game.floor + Math.floor(random() * 5),
    vial: index === 1,
    weapon: index === 0 ? theme.weapon : null,
  }));
  game.loot = Array.from({ length: 5 }, () => ({
    ...takeRandom(),
    coins: 1 + game.floor,
  }));
  game.loot.push({ ...takeRandom(), weapon: theme.weapon });
  game.vials = Array.from({ length: 3 }, takeRandom);
  game.enemies = Array.from({ length: 4 + game.floor }, (_, index) => {
    const boss = game.floor === themes.length && index === 0,
      hp = boss ? 21 : theme.hp;
    return {
      ...takeRandom(),
      name: boss ? "Crown Warden" : theme.mob,
      boss,
      hp,
      max: hp,
      atk: boss ? 5 : theme.atk,
      range: boss ? 6 : theme.range,
      coins: boss ? 15 : game.floor + 2,
    };
  });
  note(game, theme.name + ": find the gold seal.");
}
function fresh(seed) {
  const starter = weapons["lantern-staff"];
  const game = {
    version: 2,
    seed: seed >>> 0,
    floor: 1,
    turn: 0,
    state: "playing",
    hero: {
      hp: 24,
      max: 24,
      power: 4,
      potions: 2,
      flareCooldown: 0,
      xp: 0,
      rank: 1,
      coins: 5,
      weapon: starter.name,
      gear: { [starter.name]: starter.attackBonus },
    },
    log: [],
  };
  buildFloor(game);
  return game;
}
module.exports = { buildFloor, fresh };
