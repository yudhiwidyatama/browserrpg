const {themes} = require('./content.cjs');
const {sameTile}=require('./grid.cjs');
const {grantWeapon}=require('./market.cjs');
const {buildFloor}=require('./world.cjs');
const {quietTurn,dungeonTurn,reject,note}=require('./turns.cjs');
function drinkFromFountain(game,spring){
  const hero=game.hero;
  if (!spring.charges) return reject(game,'The spring is dry.');
  if (hero.hp===hero.max) return reject(game,'Already at full health.');
  const restored=Math.min(themes[game.floor-1].water,hero.max-hero.hp);
  spring.charges--; hero.hp+=restored;note(game,`Spring restores ${restored} health.`);
  return dungeonTurn;
}
function openChest(game,chest){
  if(chest.open) return reject(game,'Chest is empty.');
  chest.open=true; game.hero.coins+=chest.coins;
  if(chest.vial)game.hero.potions++;
  note(game,`Chest: ${chest.coins} coins${chest.vial?' and a vial':''}.`);
  if(chest.weapon) grantWeapon(game,chest.weapon,themes[game.floor-1].bonus);
  return dungeonTurn;
}
function leaveFloor(game){
  if(!game.seal||game.enemies.some(enemy=>enemy.boss))return reject(game,'Recover the seal and defeat any Warden first.');
  if(game.floor===themes.length){game.state='won';note(game,'The vault opens. Dawn returns.');}
  else {game.floor++;game.hero.hp=Math.min(game.hero.max,game.hero.hp+8);game.hero.flareCooldown=0;buildFloor(game);}
  return quietTurn;
}
function interact(game){
  const here=point=>sameTile(game.hero,point);
  const chest=game.chests.find(here); if(chest)return openChest(game,chest);
  const spring=game.fountains.find(here); if(spring)return drinkFromFountain(game,spring);
  if(here(game.exit)) return leaveFloor(game);
  return reject(game,'Stand on a chest, spring, or exit.');
}
module.exports={interact};
