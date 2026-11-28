import {game,X,R,M,D} from './engine.mjs';
const $=id=>document.getElementById(id), canvas=$('sky'), c=canvas.getContext('2d');
let g;
try{g=game();}catch(e){$('status').textContent='WebAssembly could not start in this browser.';throw e;}
const s=g.state, labels=['First light','Crossing','Split sky','Hold one back','Daybreak'];
let mode='ready', aim=[480,225], prev=0, debt=0, inputs=[], last=null, watching=false, cursor=0, sparks=[];
$('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
let ac,fx,amb,master,voices=[];
function soundOn(){
 try{if(!ac){ac=new AudioContext();master=ac.createGain();fx=ac.createGain();amb=ac.createGain();fx.connect(master);amb.connect(master);master.connect(ac.destination);
 voices=[130.81,164.81,196].map(freq=>{const o=ac.createOscillator(),v=ac.createGain();o.frequency.value=freq;v.gain.value=0;o.connect(v);v.connect(amb);o.start();return v;});}
 ac.resume().catch(()=>{});mix();}catch{/* Audio is optional. */}
}
function mix(){if(!master)return;master.gain.value=$('mute').checked||mode!=='live'?0:1;fx.gain.value=+$('effects').value;amb.gain.value=+$('ambient').value;voices.forEach((v,i)=>v.gain.value=s[8+i]?0.028:0);}
for(const id of ['mute','effects','ambient'])$(id).oninput=mix;
const notes=new Set();
function tone(a,b,span,volume=.18,delay=0){
 if(!fx||ac.state!=='running'||$('mute').checked)return;
 const o=ac.createOscillator(),v=ac.createGain(),t=ac.currentTime+delay;
 o.frequency.setValueAtTime(a,t);o.frequency.exponentialRampToValueAtTime(b,t+span);
 v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(volume,t+.009);v.gain.exponentialRampToValueAtTime(.0001,t+span);
 o.connect(v);v.connect(fx);notes.add(o);o.onended=()=>{notes.delete(o);o.disconnect();v.disconnect();};o.start(t);o.stop(t+span+.01);
}
function quiet(){for(const o of notes){try{o.stop();}catch{}}mix();}
function waveCue(){tone(330,330,.12);tone(440,440,.18,.13,.14);}
function drawHUD(){
 $('wave').textContent=`Wave ${s[0]} / 5 · ${labels[s[0]-1]}`;
 $('charges').textContent='Charges '+ '●'.repeat(s[2])+'○'.repeat(4-s[2]);
 $('score').textContent=`Windows ${s[8]+s[9]+s[10]} / 6 · Best ring ${s[3]}`;
}
function place(x,y,record){if(g.place(x,y)){if(record)inputs.push([s[5],x,y]);tone(240,680,.15);drawHUD();}}
function tick(){
 if(watching)while(cursor<last.length&&last[cursor][0]===s[5]){const [,x,y]=last[cursor++];aim=[x,y];place(x,y,false);}
 const before=s.slice(0,M+42);g.step();
 const hit=[8,9,10].some(w=>s[w]<before[w]);
 if(hit){tone(110,46,.26,.35);mix();}
 for(let r=R;r<R+16;r+=4)if(s[r+2]===36&&s[r+3]>0)tone(440+s[r+3]*85,440+s[r+3]*85,.24,hit?.035:.18);
 for(let m=M;m<M+6*s[7];m+=6)if(s[0]===before[0]&&before[m+3]===1&&s[m+3]===2&&s[m+5]<436*D&&!$('reduced').checked)sparks.push([s[m+4]/D,s[m+5]/D,s[5]]);
 sparks=sparks.filter(p=>s[5]-p[2]<14);
 if(s[0]!==before[0]){waveCue();$('status').textContent=labels[s[0]-1]+' · Four fresh charges.';}
 if(s[4]){
  mode='end';if(!watching)last=inputs.slice();voices.forEach(v=>v.gain.value=0);
  tone(330,s[4]===1?660:110,.6,.2);$('status').textContent=(s[4]===1?'Dawn over Astra.':'The last lantern is dark.')+` ${s[8]+s[9]+s[10]} windows saved. Best ring: ${s[3]}.`;
  $('action').textContent='Play again';$('replay').disabled=false;
 }
 drawHUD();
}
function advance(now){
 if(mode!=='live')return;
 debt+=Math.max(0,now-prev)*60;prev=now;
 while(debt>=1000&&mode==='live'){debt-=1000;tick();}
}
function begin(replay=false){
 quiet();g.reset();watching=replay;cursor=0;inputs=[];sparks=[];aim=[480,225];mode='live';prev=performance.now();debt=0;
 soundOn();waveCue();drawHUD();$('status').textContent=replay?'Watching your last completed run.':'Keep a lantern lit until dawn.';$('action').textContent='Pause';$('restart').disabled=false;$('replay').disabled=true;canvas.focus();
}
function pause(){if(mode!=='live')return;mode='paused';quiet();$('action').textContent='Resume';$('status').textContent='Watch paused. Resume when ready.';}
function action(){if(mode==='live')pause();else if(mode==='paused'){mode='live';prev=performance.now();soundOn();$('action').textContent='Pause';$('status').textContent=watching?'Replay resumed.':'Watch resumed.';canvas.focus();}else begin();}
$('action').onclick=action;$('restart').onclick=()=>begin();$('replay').onclick=()=>begin(true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const clamp=(v,n)=>Math.max(0,Math.min(n,Math.round(v)));
function point(e){const b=canvas.getBoundingClientRect();return [clamp((e.clientX-b.left)*960/b.width,960),clamp((e.clientY-b.top)*540/b.height,540)];}
canvas.onpointermove=e=>{if(!watching)aim=point(e);};
canvas.onpointerdown=e=>{if(mode!=='live'||watching||e.button!==0)return;advance(performance.now());aim=point(e);place(...aim,true);canvas.focus();};
canvas.onkeydown=e=>{
 if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)action();return;}
 if(mode!=='live'||watching)return;
 const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(d){e.preventDefault();aim=[clamp(aim[0]+d[0]*12,960),clamp(aim[1]+d[1]*12,540)];}
 if(e.code==='Space'){e.preventDefault();if(!e.repeat){advance(performance.now());place(...aim,true);}}
};
let seed=1973;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const stars=Array.from({length:110},()=>[rand()*960,rand()*375,rand()*1.5+.5]);
const roofs=Array.from({length:64},(_,i)=>[i*16,444+rand()*43,17+rand()*15]);
function rect(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function path(points,color,fill=false,w=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill){c.closePath();c.fillStyle=color;c.fill();}else{c.strokeStyle=color;c.lineWidth=w;c.stroke();}}
function arc(x,y,r,color,w){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function text(str,x,y,size,color,align='center'){c.textAlign=align;c.font=`600 ${size}px system-ui`;c.fillStyle=color;c.fillText(str,x,y);}
function draw(){
 const width=Math.max(1,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))),height=Math.max(1,Math.round(width*9/16));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 c.setTransform(width/960,0,0,height/540,0,0);
 const sky=c.createLinearGradient(0,0,0,540);sky.addColorStop(0,'#09162f');sky.addColorStop(.65,'#203653');sky.addColorStop(1,s[4]===1?'#ffc784':s[0]===5?'#b37e77':'#49516c');c.fillStyle=sky;c.fillRect(0,0,960,540);
 for(const [x,y,r] of stars){c.globalAlpha=$('reduced').checked?.7:.65+.25*Math.sin(x+s[5]/60);rect(x,y,r,r,'#c7e6f4');}c.globalAlpha=1;
 c.beginPath();c.arc(s[4]===1?480:815,s[4]===1?444:85,s[4]===1?54:25,0,Math.PI*2);c.fillStyle=s[4]===1?'#ffe5a0':'#b2c5ce';c.fill();
 if(s[4]!==1){c.beginPath();c.arc(805,78,24,0,Math.PI*2);c.fillStyle='#14243e';c.fill();}
 for(const [x,y,w] of roofs)rect(x,y,w,540-y,'#16263a');
 X.forEach((x,i)=>{rect(x-25,436,50,104,'#0c1829');
  if(i===0){c.beginPath();c.arc(x,452,23,Math.PI,0);c.fillStyle='#75909d';c.fill();}
  else if(i===1)path([[x-25,450],[x,421],[x+25,450]],'#75909d',true);
  else rect(x-30,434,60,8,'#75909d');
  for(let j=0;j<2;j++){const wx=x-15+j*19,ok=j<s[8+i];rect(wx,458,13,22,ok?'#ffdc8c':'#29384c');if(ok)rect(wx-5,505+j*4,24,3,'#cfad76');else{path([[wx,458],[wx+13,480]],'#a1aabc');path([[wx+13,458],[wx,480]],'#a1aabc');}}
 });
 for(let i=0;i<s[7];i++){const m=M+i*6;if(s[m+3]!==1)continue;
  const x=s[m+4]/D,y=s[m+5]/D,dx=(X[s[m+2]]-s[m+1])/D,angle=Math.atan2(1,dx);
  c.save();c.translate(x,y);c.rotate(angle);path([[-40,0],[-7,-1],[-7,1]],'#d58f83',true);path([[0,0],[-12,-5],[-9,0],[-12,5]],'#ffe0b6',true);c.restore();
 }
 for(let r=R;r<R+16;r+=4){const age=s[r+2];if(age<0||age>=48)continue;
  const x=s[r],y=s[r+1],rad=Math.min(36,age)*2;c.setLineDash(age<36?[]:[10,8]);c.globalAlpha=age<36?1:(48-age)/12;
  arc(x,y,Math.max(.1,rad),'#96fff0',6);c.globalAlpha=1;c.setLineDash([]);
  if(s[r+3])text('×'+s[r+3],x,y-8,20,'#fff2bb');
 }
 if(!$('reduced').checked)for(const [x,y,t] of sparks){const a=s[5]-t+1;for(let i=0;i<6;i++)rect(x+Math.cos(i)*a,y+Math.sin(i)*a,2,2,'#ffecae');}
 if(mode==='live')for(const h of [-1,1])for(const v of [-1,1])path([[aim[0]+h*4,aim[1]+v*12],[aim[0]+h*12,aim[1]+v*12],[aim[0]+h*12,aim[1]+v*4]],'#effbff');
 else {rect(0,168,960,110,'#102038e8');text(mode==='end'?(s[4]===1?'Dawn over Astra':'The watch has ended'):mode==='paused'?'Watch paused':'The lantern watch',480,218,32,'#ffe0a2');text(mode==='ready'?'Start the watch below':mode==='end'?`${s[8]+s[9]+s[10]} windows saved · best ring ${s[3]}`:'Resume when ready',480,250,17,'#e1f3ff');}
}
function frame(t){advance(Math.max(t,prev));draw();requestAnimationFrame(frame);}
$('action').disabled=false;$('status').textContent='Ready. Protect the three lantern towers.';drawHUD();requestAnimationFrame(frame);
