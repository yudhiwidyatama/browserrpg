const { N } = require("../grid.cjs");
const SAVE_KEY = "lantern-below-v2";
function decodeSave(json) {
  const saved = JSON.parse(json);
  if (
    saved?.version !== 2 ||
    saved.tiles?.length !== N * N ||
    !saved.hero?.gear ||
    !Array.isArray(saved.enemies) ||
    !Number.isInteger(saved.hero.cd)
  )
    throw new Error("Unsupported or invalid expedition");
  const { cd, ...hero } = saved.hero;
  return { ...saved, hero: { ...hero, flareCooldown: cd } };
}
function encodeSave(game) {
  const { flareCooldown, ...hero } = game.hero;
  return JSON.stringify({ ...game, hero: { ...hero, cd: flareCooldown } });
}
function loadGame(storage) {
  const json = storage.getItem(SAVE_KEY);
  return json ? decodeSave(json) : null;
}
function saveGame(storage, game) {
  storage.setItem(SAVE_KEY, encodeSave(game));
}
module.exports = { decodeSave, encodeSave, loadGame, saveGame, SAVE_KEY };
