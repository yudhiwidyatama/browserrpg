const { dirs, sameTile } = require("../../grid.cjs");
const { themes } = require("../../content.cjs");
function sceneFor(game) {
  if (game.state !== "playing") return null;
  return game.zone === "surface" ? "harbor" : themes[game.floor - 1].id;
}
// Snapshot only what sound needs. No audio code changes game state or interprets log text.
function observe(game, action) {
  const hero = game.hero,
    delta = dirs[action];
  return {
    hp: hero.hp,
    coins: hero.coins,
    potions: hero.potions,
    weapon: hero.weapon,
    seal: game.seal,
    floor: game.floor,
    zone: game.zone,
    strike:
      game.zone === "dungeon" &&
      delta &&
      game.enemies.some(
        (e) => e.x === hero.x + delta[0] && e.y === hero.y + delta[1],
      ),
    chest:
      game.zone === "dungeon" &&
      game.chests.some((chest) => !chest.open && sameTile(hero, chest)),
  };
}
function soundsAfter(before, game, action, accepted) {
  if (!accepted) return [];
  if (game.state === "won") return ["victory"];
  if (game.state === "lost") return ["defeat"];
  if (before.zone !== game.zone) return ["lift"];
  if (before.floor !== game.floor) return ["descend"];
  let cue;
  if (action.startsWith("buy:")) cue = "trade";
  else if (action === "pulse") cue = "flare";
  else if (action === "heal") cue = "mend";
  else if (action === "use" || action === "exit")
    cue = before.chest ? "chest" : "mend";
  else if (before.strike) cue = "strike";
  else if (
    game.hero.coins > before.coins ||
    game.hero.potions > before.potions ||
    game.hero.weapon !== before.weapon ||
    game.seal !== before.seal
  )
    cue = "loot";
  else if (Object.hasOwn(dirs, action)) cue = "step";
  const result = cue ? [cue] : [];
  if (game.hero.hp < before.hp) result.push("hurt");
  return result;
}
module.exports = { sceneFor, observe, soundsAfter };
