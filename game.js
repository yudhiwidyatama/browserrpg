'use strict';
// Pure game rules. No rendering, timing, DOM, or network dependencies.
const Lantern = (() => {
  const N=13, dirs={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}, steps=Object.values(dirs);
  const chapters=['The Salt Archive','The Ember Foundry','The Crown Vault'];
  const k=(x,y)=>y*N+x, dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  function rng(seed){let n=seed>>>0;return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
  function walk(s,x,y){return x>=0&&y>=0&&x<N&&y<N&&s.tiles[k(x,y)]===1;}
  function flood(s,start,blocked=new Set()){
    const q=[start], d=new Map([[k(start.x,start.y),0]]);
    for(let i=0;i<q.length;i++){const p=q[i];for(const [dx,dy] of steps){const x=p.x+dx,y=p.y+dy,id=k(x,y);if(walk(s,x,y)&&!d.has(id)&&!blocked.has(id)){d.set(id,1+d.get(k(p.x,p.y)));q.push({x,y});}}}return d;
  }
  function note(s,text){s.log.unshift(text);s.log=s.log.slice(0,5);}
  function build(s){
    const rand=rng(s.seed+Math.imul(s.floor,7919));s.tiles=Array(N*N).fill(0);const carve=(x,y)=>s.tiles[k(x,y)]=1;
    // Depth-first maze, then open a few chambers and loops. All carved space stays connected.
    let stack=[{x:1,y:1}];carve(1,1);
    while(stack.length){let a=stack.at(-1),opts=steps.filter(([dx,dy])=>{let x=a.x+dx*2,y=a.y+dy*2;return x>0&&x<N-1&&y>0&&y<N-1&&!s.tiles[k(x,y)];});if(!opts.length){stack.pop();continue;}let [dx,dy]=opts[Math.floor(rand()*opts.length)];carve(a.x+dx,a.y+dy);let b={x:a.x+dx*2,y:a.y+dy*2};carve(b.x,b.y);stack.push(b);}
    for(let i=0;i<4;i++){let x=1+2*Math.floor(rand()*5),y=1+2*Math.floor(rand()*5);for(let u=0;u<3;u++)for(let v=0;v<3;v++)carve(x+u,y+v);}
    Object.assign(s.hero,{x:1,y:1});s.enemies=[];s.vials=[];s.seal=false;
    const d=flood(s,s.hero),ids=[...d.keys()].sort((a,b)=>d.get(b)-d.get(a));const point=id=>({x:id%N,y:Math.floor(id/N)});
    s.exit=point(ids.shift());s.rune=point(ids.splice(Math.floor(ids.length*.17),1)[0]);
    const pool=ids.filter(id=>d.get(id)>=5),take=()=>point(pool.splice(Math.floor(rand()*pool.length),1)[0]);
    for(let i=0;i<2+s.floor;i++){const boss=s.floor===3&&i===0,hp=boss?12:3+s.floor;s.enemies.push({...take(),hp,max:hp,boss,name:boss?'Crown Warden':'Cinderling'});}
    for(let i=0;i<3;i++)s.vials.push(take());note(s,chapters[s.floor-1]+': recover the gold seal.');
  }
  function fresh(seed){const s={version:1,seed:seed>>>0,floor:1,turn:0,state:'playing',hero:{hp:22,max:22,power:4,potions:2,cd:0,xp:0,rank:1},log:[]};build(s);return s;}
  function reap(s){for(const e of s.enemies.filter(e=>e.hp<=0)){s.hero.xp++;note(s,e.name+' falls.');if(s.hero.xp%3===0){const h=s.hero;h.rank++;h.power++;h.max+=3;h.hp=Math.min(h.max,h.hp+5);note(s,'Rank up! Stronger strike, +3 maximum health.');}}s.enemies=s.enemies.filter(e=>e.hp>0);}
  function enemies(s){const h=s.hero;for(const e of s.enemies){if(dist(e,h)===1){const hit=e.boss?4:2;h.hp=Math.max(0,h.hp-hit);note(s,e.name+' hits for '+hit+'.');if(!h.hp){s.state='lost';note(s,'Your lantern fades. Start a new expedition to try again.');break;}continue;}
      if(dist(e,h)>6)continue;
      const blocked=new Set(s.enemies.filter(o=>o!==e).map(o=>k(o.x,o.y))),d=flood(s,h,blocked),current=d.get(k(e.x,e.y));if(current==null||current>8)continue;
      for(const [dx,dy] of steps){let x=e.x+dx,y=e.y+dy;if(d.get(k(x,y))===current-1){e.x=x;e.y=y;break;}}
    }}
  function act(s,a){if(s.state!=='playing')return false;const h=s.hero;
    if(Object.hasOwn(dirs,a)){let [dx,dy]=dirs[a],x=h.x+dx,y=h.y+dy;if(!walk(s,x,y)){note(s,'Stone blocks the way.');return false;}const e=s.enemies.find(e=>e.x===x&&e.y===y);
      if(e){e.hp-=h.power;note(s,'Strike: '+h.power+' damage.');}else{h.x=x;h.y=y;if(!s.seal&&!dist(h,s.rune)){s.seal=true;note(s,'Seal recovered! Find the ringed exit.');}const i=s.vials.findIndex(p=>!dist(h,p));if(i>=0){s.vials.splice(i,1);h.potions++;note(s,'Healing vial collected.');}}}
    else if(a==='pulse'){if(h.cd){note(s,'Flare recharges in '+h.cd+' turns.');return false;}const d=flood(s,h),hits=s.enemies.filter(e=>(d.get(k(e.x,e.y))??Infinity)<=2);if(!hits.length){note(s,'No foes within two walking steps.');return false;}hits.forEach(e=>e.hp-=h.power+2);h.cd=4;note(s,'Lantern flare strikes '+hits.length+'!');}
    else if(a==='heal'){if(!h.potions||h.hp===h.max){note(s,!h.potions?'No healing vials.':'Already at full health.');return false;}h.potions--;h.hp=Math.min(h.max,h.hp+10);note(s,'You drink a healing vial.');}
    else if(a==='exit'){if(dist(h,s.exit)||!s.seal||(s.floor===3&&s.enemies.some(e=>e.boss))){note(s,'Stand on the exit with the seal'+(s.floor===3?' and defeat the Warden.':'.'));return false;}s.turn++;if(s.floor===3){s.state='won';note(s,'The crown is yours. Dawn returns to the archive.');}else{s.floor++;h.hp=Math.min(h.max,h.hp+8);h.cd=0;build(s);}return true;}
    else if(a!=='wait')return false;
    s.turn++;if(a!=='pulse'&&h.cd)h.cd--;reap(s);enemies(s);return true;
  }
  return {N,dirs,chapters,k,dist,flood,walk,fresh,act};
})();
if(typeof module!=='undefined')module.exports=Lantern;
