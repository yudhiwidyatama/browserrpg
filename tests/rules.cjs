'use strict';
const assert=require('node:assert/strict'),G=require('../game.js');
for(let seed=0;seed<100;seed++){
 const s=G.fresh(seed); assert.deepEqual(s,G.fresh(seed));
 for(let f=1;f<=3;f++){
  const d=G.flood(s,s.hero);assert.equal(d.size,s.tiles.reduce((a,b)=>a+b,0));const pts=[s.hero,s.rune,s.exit,...s.vials,...s.enemies];assert.equal(new Set(pts.map(p=>G.k(p.x,p.y))).size,pts.length);assert(pts.every(p=>d.has(G.k(p.x,p.y))));
  assert.equal(G.act(s,'north'),false);let t=s.turn;assert.equal(G.act(s,'exit'),false);assert.equal(s.turn,t);
  Object.assign(s.hero,s.exit);s.seal=true;if(f===3){assert.equal(G.act(s,'exit'),false);s.enemies=[];}assert(G.act(s,'exit'));
 }assert.equal(s.state,'won');}
// Autoplay using only legal actions from an untouched fresh save.
function play(seed){const s=G.fresh(seed);for(let t=0;s.state==='playing'&&t<1800;t++){
 const h=s.hero, d=G.flood(s,h),near=s.enemies.filter(e=>d.get(G.k(e.x,e.y))<=2);let a;
 if(h.hp<=9&&h.potions)a='heal';else if(!h.cd&&near.length)a='pulse';else {
  const touching=near.find(e=>G.dist(h,e)===1),boss=s.enemies.find(e=>e.boss);
  const target=touching||(!s.seal?s.rune:boss||s.exit);if(G.dist(target,h)===0)a='exit';else {const m=G.flood(s,target);a=Object.entries(G.dirs).find(([_,[dx,dy]])=>G.walk(s,h.x+dx,h.y+dy)&&m.get(G.k(h.x+dx,h.y+dy))===m.get(G.k(h.x,h.y))-1)?.[0];}}
 assert(a&&G.act(s,a));}return s.state;}
assert(Array.from({length:10},(_,i)=>play(i)).includes('won'));console.log('100 seeded layouts on all three floors, invalid turns, and a legal full-campaign victory verified.');
