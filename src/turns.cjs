// Actions mutate their own domain objects. Only finishTurn advances time or runs AI.
const rejected = Object.freeze({accepted:false, spendTurn:false, enemiesAct:false});
const quietTurn = Object.freeze({accepted:true, spendTurn:true, enemiesAct:false});
const dungeonTurn = Object.freeze({accepted:true, spendTurn:true, enemiesAct:true});
function note(game, message) { game.log.unshift(message); game.log.length = Math.min(6,game.log.length); }
function reject(game,message) { note(game,message); return rejected; }
function finishTurn(game, outcome, action, collectDefeated, advanceEnemies) {
  if (outcome.spendTurn) game.turn++;
  if (outcome.enemiesAct) {
    if (action !== 'pulse' && game.hero.flareCooldown > 0) game.hero.flareCooldown--;
    collectDefeated(game);
    advanceEnemies(game);
  }
  return outcome.accepted;
}
module.exports={rejected,quietTurn,dungeonTurn,note,reject,finishTurn};
