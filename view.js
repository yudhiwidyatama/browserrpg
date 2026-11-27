// Browser composition root. Domain modules never import this file.
const rules = require("./game.js");
const { createRenderer } = require("./src/client/renderer.cjs");
const { renderHud } = require("./src/client/hud.cjs");
const { bindInput } = require("./src/client/input.cjs");
const { loadGame, saveGame } = require("./src/client/save.cjs");
const newGame = () =>
  rules.fresh(crypto.getRandomValues(new Uint32Array(1))[0]);
let game;
try {
  game = loadGame(window.localStorage);
} catch (error) {
  console.warn("Expedition could not be loaded:", error.message);
}
if (!game) game = newGame();
const canvas = document.getElementById("map");
const renderer = createRenderer(canvas);
function refresh() {
  renderHud(game);
  renderer.draw(game);
}
function persist() {
  try {
    saveGame(window.localStorage, game);
  } catch (error) {
    console.warn("Expedition could not be saved:", error.message);
  }
}
function dispatch(action) {
  rules.act(game, action);
  refresh();
  persist();
}
bindInput(
  canvas,
  () => game,
  () => renderer.camera,
  dispatch,
);
window.addEventListener("resize", () => renderer.draw(game));
document.getElementById("new").onclick = () => {
  if (
    game.state === "playing" &&
    game.turn &&
    !confirm("Replace your expedition?")
  )
    return;
  game = newGame();
  refresh();
  persist();
};
refresh();
persist();
