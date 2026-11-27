// Public rules API. No browser APIs, timers or rendering dependencies.
const grid = require("./src/grid.cjs");
const { themes, shops } = require("./src/content.cjs");
const { fresh } = require("./src/world.cjs");
const {
  moveOrStrike,
  flare,
  drinkVial,
  attack,
  collectDefeated,
  advanceEnemies,
} = require("./src/combat.cjs");
const {
  useLift,
  atShop,
  buyWeapon,
  moveOnSurface,
} = require("./src/market.cjs");
const { interact } = require("./src/interactions.cjs");
const {
  finishTurn,
  reject,
  rejected,
  dungeonTurn,
} = require("./src/turns.cjs");
function resolveAction(game, action) {
  if (game.state !== "playing") return rejected;
  if (action === "travel") return useLift(game);
  const moving = Object.hasOwn(grid.dirs, action);
  if (game.zone === "surface") {
    if (moving) return moveOnSurface(game, action);
    if (action.startsWith("buy:")) return buyWeapon(game, action.slice(4));
    return reject(game, "Visit a stall or return to the lift.");
  }
  if (moving) return moveOrStrike(game, action);
  switch (action) {
    case "use":
    case "exit":
      return interact(game);
    case "pulse":
      return flare(game);
    case "heal":
      return drinkVial(game);
    case "wait":
      return dungeonTurn;
    default:
      return rejected;
  }
}
function act(game, action) {
  return finishTurn(
    game,
    resolveAction(game, action),
    action,
    collectDefeated,
    advanceEnemies,
  );
}
module.exports = {
  ...grid,
  chapters: themes.map((f) => f.name),
  themes,
  shops,
  fresh,
  act,
  attack,
  atShop,
};
