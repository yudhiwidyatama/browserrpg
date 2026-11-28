import assert from 'node:assert/strict';
import {game,R,M,D} from './engine.mjs';
// Tick within wave, then logical placement coordinates. Same-tick entries
// intentionally exercise ordering. This replay never writes simulation state.
const gold=[
 [[269,220,226],[409,740,226],[549,480,226]],
 [[269,350,226],[489,350,226]],
 [[269,220,226],[269,740,226],[449,480,226],[474,740,226]],
 [[269,740,226],[384,220,226],[489,480,226],[629,480,226]],
 [[269,350,226],[414,220,226],[419,740,226],[564,480,226]]
];
function run(hz,play){
 const g=game(),s=g.state;let debt=0;const trace=[];
 for(let frame=0;!s[4]&&frame<20000;frame++){
  debt+=60;while(debt>=hz&&!s[4]){debt-=hz;
   if(play)for(const [t,x,y] of gold[s[0]-1])if(t===s[1])assert.equal(g.place(x,y),1);
   g.step();trace.push([s[0],s[1],s[2],s[3],s[8],s[9],s[10]].join(':'));
  }
 }
 return {trace,end:[s[4],s[8],s[9],s[10],s[3]]};
}
const golden=run(60,true);assert.deepEqual(golden.end,[1,2,2,2,3]);assert.deepEqual(run(120,true),golden);
assert.deepEqual(run(60,false).end,[2,0,0,0,0]);
const g=game(),s=g.state;for(let i=0;i<4;i++)assert.equal(g.place(20,20),1);
assert.equal(g.place(20,20),0);g.reset();assert.equal(s[2],4);
// Isolate a single active ring and a tip passing vertically through this tick.
function fixture(age,offset,second=false){
 g.reset();const x=220,y=200;g.place(x,y);if(second)g.place(x,y);
 s[R+2]=age;s[M+3]=1;s[M+4]=x*D;s[M+5]=(y+offset)*D;g.step();return s[R+3];
}
assert.equal(fixture(10,21),1);assert.equal(fixture(10,0),0);assert.equal(fixture(36,72),0);
assert.equal(fixture(0,0,true),1);assert.equal(s[R+7],0);
console.log(`PASS: ${golden.trace.length} ticks, six windows, triple catch, 60/120 Hz parity, loss, charges, rim and tie fixtures.`);
