'use strict';
(() => {
const G=Lantern,$=id=>document.getElementById(id),canvas=$('map'),c=canvas.getContext('2d');
const saveKey='lantern-below-v1';const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let s;try{const v=JSON.parse(localStorage.getItem(saveKey));if(v?.version===1&&v.tiles?.length===G.N**2&&v.hero&&v.enemies&&v.exit)s=v;}catch{}if(!s)s=G.fresh(randomSeed());
const palettes=[['#567478','#31494f','#78a9a2','#21323e'],['#986951','#553e44','#c88c61','#382b32'],['#716789','#423b58','#a69bc4','#2c293f']];
let w,h,u,v,z,ox,oy;const proj=(x,y,a=0)=>[ox+(x-y)*u,oy+(x+y)*v-a*z];
function polygon(p,col,edge){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=col;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=.65;c.stroke();}}
function tint(hex,f){let n=parseInt(hex.slice(1),16);return `rgb(${[16,8,0].map(b=>Math.min(255,Math.round(((n>>b)&255)*f))).join(',')})`;}
// Sweep an n-sided profile through rings (height, radius). Faces are actual XYZ vertices,
// sorted back-to-front for this fixed orthographic camera. No sprites or model files.
function mesh(x,y,rings,n,color,rotation=0){const layers=rings.map(([a,r])=>Array.from({length:n},(_,i)=>{const t=rotation+i*2*Math.PI/n;return [x+r*Math.cos(t),y+r*Math.sin(t),a];}));let faces=[];
 for(let j=1;j<layers.length;j++)for(let i=0;i<n;i++){let b=(i+1)%n,points=[layers[j-1][i],layers[j-1][b],layers[j][b],layers[j][i]],t=rotation+(i+.5)*2*Math.PI/n;faces.push({points,d:points.reduce((sum,p)=>sum+p[0]+p[1]+p[2],0)/4,f:.80+.18*Math.cos(t+1)});}
 faces.sort((a,b)=>a.d-b.d);for(const f of faces)polygon(f.points.map(p=>proj(...p)),tint(color,f.f));polygon(layers.at(-1).map(p=>proj(...p)),tint(color,1.12));}
function box(x,y,a,side,height,color){mesh(x,y,[[a,side/Math.SQRT2],[a+height,side/Math.SQRT2]],4,color,Math.PI/4);}
function ring(x,y,r,col,a=0){const [px,py]=proj(x,y,a);c.beginPath();c.ellipse(px,py,u*r*Math.SQRT2,v*r*Math.SQRT2,0,0,Math.PI*2);c.strokeStyle=col;c.lineWidth=Math.max(1.5,u*.07);c.stroke();}
function hero(x,y){ring(x,y,.4,'#82eff0');box(x-.12,y,.01,.17,.19,'#303a50');box(x+.12,y,.01,.17,.19,'#303a50');mesh(x,y,[[.15,.35],[.62,.21]],6,'#49c3c4');mesh(x,y,[[.57,.14],[.66,.25],[.92,.17]],6,'#f1ca98');mesh(x-.04,y-.03,[[.80,.26],[1.04,.19],[1.16,.025]],6,'#47798b');box(x+.29,y+.12,.29,.16,.22,'#ffb74e');}
function foe(e){let {x,y,boss}=e,m=boss?1.38:1;mesh(x,y,[[0,.20*m],[.26*m,.34*m],[.53*m,.25*m],[.63*m,.1*m]],7,boss?'#974765':'#dc735a');for(let dir of [-1,1])mesh(x+dir*.17*m,y,[[.50*m,.09*m],[.85*m,0]],4,'#ffc586');box(x+.06*m,y+.20*m,.31*m,.115*m,.095*m,'#ffeb96');if(e.hp!==e.max||boss){let [px,py]=proj(x,y,1.05*m);c.fillStyle='#19212c';c.fillRect(px-u*.32,py,u*.64,3);c.fillStyle='#f79279';c.fillRect(px-u*.32,py,u*.64*e.hp/e.max,3);}}
function draw(){const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;if(!w||!h)return;let dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0);
 const pal=palettes[s.floor-1];let bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,pal[3]);bg.addColorStop(1,'#111923');c.fillStyle=bg;c.fillRect(0,0,w,h);
 u=Math.min((w-18)/(2*G.N),(h-30)/((2*G.N+3)/Math.sqrt(3)));v=u/Math.sqrt(3);z=u*2/Math.sqrt(3);ox=w/2;oy=(h-(G.N*2-2)*v)/2+5;
 // Paint the floor first; draw scenery and actors by map depth afterwards.
 for(let sum=0;sum<G.N*2-1;sum++)for(let x=0;x<G.N;x++){let y=sum-x;if(y<0||y>=G.N)continue;const corners=[[x-.5,y-.5],[x+.5,y-.5],[x+.5,y+.5],[x-.5,y+.5]],p=corners.map(a=>proj(...a));if(x===G.N-1||y===G.N-1){for(const [a,b] of [[1,2],[2,3]])polygon([p[a],p[b],proj(...corners[b],-.28),proj(...corners[a],-.28)],'#273642');}polygon(p,s.tiles[G.k(x,y)]?tint(pal[0],.93+((x*13+y*7+s.seed)%7)*.018):pal[1],'#30404b');}
 for(let sum=0;sum<G.N*2-1;sum++)for(let x=0;x<G.N;x++){let y=sum-x;if(y<0||y>=G.N)continue;const hash=(Math.imul(x+17,137)+y*23+s.seed)>>>0;
 if(!G.walk(s,x,y)){box(x,y,0,.91,.24+(hash%4)*.045,pal[1]);if(hash%8===0)mesh(x,y,[[.29,.19],[.48,.13],[.67,0]],5,pal[2]);continue;}
 if(s.exit.x===x&&s.exit.y===y){ring(x,y,.42,'#ffcc6b');ring(x,y,.27,'#ebae56');mesh(x,y,[[0,.16],[.09,.16]],6,'#c69c58');}
 if(!s.seal&&s.rune.x===x&&s.rune.y===y){box(x,y,0,.53,.13,'#6a6356');mesh(x,y,[[.15,.06],[.43,.22],[.76,0]],4,'#ffd56e');}
 if(s.vials.some(p=>p.x===x&&p.y===y)){mesh(x,y,[[.02,.12],[.19,.15],[.27,.07],[.34,.07]],6,'#8de6aa');box(x,y,.34,.1,.07,'#b67e50');}
 const e=s.enemies.find(p=>p.x===x&&p.y===y);if(e)foe(e);if(s.hero.x===x&&s.hero.y===y)hero(x,y);}
 if(s.state!=='playing'){c.fillStyle='#0a1322ba';c.fillRect(0,0,w,h);c.fillStyle='#ffe6a4';c.textAlign='center';c.font=`bold ${Math.max(20,w*.04)}px Georgia`;c.fillText(s.state==='won'?'The vault opens. You won!':'Your lantern fades.',w/2,h/2);c.textAlign='left';}}
function sync(){let p=s.hero;$('floor').textContent=`Floor ${s.floor}/3 · Turn ${s.turn}`;$('stats').textContent=`HP ${p.hp}/${p.max} · Rank ${p.rank} · Vials ${p.potions}`;$('chapter').textContent=G.chapters[s.floor-1];$('goal').textContent=s.state==='won'?'Expedition complete.':s.state==='lost'?'Start a new expedition to return.':(!s.seal?'Find the gold crystal seal.':s.floor===3&&s.enemies.some(e=>e.boss)?'Defeat the crowned Warden.':'Reach the gold ring and use the exit.');$('log').replaceChildren(...s.log.map(t=>{let li=document.createElement('li');li.textContent=t;return li;}));document.querySelector('[data-act=pulse]').textContent=p.cd?`Flare (${p.cd})`:'Flare [F]';document.querySelectorAll('[data-act]').forEach(b=>b.disabled=s.state!=='playing');try{localStorage.setItem(saveKey,JSON.stringify(s));}catch{}draw();}
function act(a){G.act(s,a);sync();}document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));const keys={w:'north',arrowup:'north',a:'west',arrowleft:'west',s:'south',arrowdown:'south',d:'east',arrowright:'east',f:'pulse',h:'heal','.':'wait',e:'exit'};
window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;let a=keys[e.key.toLowerCase()];if(a){e.preventDefault();act(a);}});canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),a=(e.clientX-r.left-ox)/u,b=(e.clientY-r.top-oy)/v,x=Math.round((a+b)/2),y=Math.round((b-a)/2);for(let [dir,[dx,dy]] of Object.entries(G.dirs))if(x===s.hero.x+dx&&y===s.hero.y+dy){act(dir);return;}if(x===s.hero.x&&y===s.hero.y&&!G.dist(s.hero,s.exit))act('exit');});
$('new').onclick=()=>{if(s.state==='playing'&&s.turn>0&&!confirm('Replace your saved expedition?'))return;s=G.fresh(randomSeed());sync();};window.addEventListener('resize',draw);sync();
})();
