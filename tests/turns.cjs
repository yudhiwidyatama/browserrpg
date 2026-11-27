const assert = require('node:assert/strict');
const gameRules = require('../game.js');
const game = gameRules.fresh(17);
const hero = game.hero;
// A rejected move is free; neither cooldown nor an enemy turn advances.
hero.cd = 2;
assert.equal(gameRules.act(game, 'north'), false);
assert.equal(game.turn, 0);
assert.equal(hero.cd, 2);
// Travel and market turns count, but never advance dungeon enemies or cooldowns.
const enemiesBefore = JSON.stringify(game.enemies);
for (const action of ['travel','west','west','buy0']) assert(gameRules.act(game, action));
assert.equal(game.turn, 4);
assert.equal(hero.weapon,'Hookblade');
assert.equal(gameRules.act(game, 'buy0'), false);
assert.equal(game.turn, 4);
assert.equal(JSON.stringify(game.enemies), enemiesBefore);
assert.equal(hero.cd, 2);
for (const action of ['east','east','travel']) assert(gameRules.act(game, action));
// A spring heals before the enemy acts. Adjacent foe deals two damage.
const spring = game.fountains[0]; Object.assign(hero,{x:spring.x,y:spring.y,hp:3});
game.enemies = [{x:hero.x+1,y:hero.y,hp:5,max:5,atk:2,range:6,name:'Sentry'}];
assert(gameRules.act(game,'use'));
assert.equal(hero.hp,9); assert.equal(spring.charges,1); assert.equal(hero.cd,1);
console.log('Turn-cost characterization passed.');
