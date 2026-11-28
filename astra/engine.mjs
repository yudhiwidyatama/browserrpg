// Assemble a dependency-free Wasm simulation at startup. Addresses are i32 word indices.
export const X=[220,480,740], D=420, R=24, M=48;
// Header: wave, wave tick, charges, best, outcome (0/live,1/dawn,2/loss),
// run tick, end tick, threat count, windows[3]. Ring: x,y,age,count.
// Threat: birth,startX,lane,status (0/waiting,1/live,2/done),x*D,y*D.
const one=(t,l)=>[[t,X[l],l]], pair=t=>[[t,X[0],1],[t,X[1],0]];
const cluster=t=>[[t,X[0],2],[t,X[1],1],[t,X[2],0]];
const waves=[
 [...one(60,0),...one(200,2),...one(340,1)], [...pair(60),...pair(280)],
 [...one(60,0),...one(60,2),...one(240,1),...one(265,2)],
 [...one(60,2),...one(175,0),...one(280,1),...cluster(420)],
 [...pair(60),...one(205,0),...one(210,2),...cluster(355)]
];
const u=n=>{const a=[];do{let b=n&127;n>>>=7;a.push(b|(n?128:0));}while(n);return a;};
const s=n=>{const a=[];for(;;){let b=n&127;n>>=7;let end=(n===0&&!(b&64))||(n===-1&&(b&64));a.push(b|(end?0:128));if(end)return a;}};
const C=n=>[65,...s(n)], L=n=>[32,n], set=(n,e)=>[...e,33,n];
const op=k=>(a,b)=>[...a,...b,k], add=op(106),sub=op(107),mul=op(108),eq=op(70),lt=op(72),gt=op(74),and=op(113);
const load=a=>[...a,40,2,0], store=(a,v)=>[...a,...v,54,2,0];
const addr=w=>C(w*4), get=w=>load(addr(w)), put=(w,v)=>store(addr(w),v);
const field=(p,k)=>add(L(p),addr(k)), read=(p,k)=>load(field(p,k)), write=(p,k,v)=>store(field(p,k),v);
const iff=(c,yes,no=[])=>[...c,4,64,...yes,...(no.length?[5,...no]:[]),11];
const inc=(w,d)=>put(w,add(get(w),C(d)));
const loop=(p,start,end,stride,body)=>[...set(p,addr(start)),2,64,3,64,...L(p),...addr(end),78,13,1,...body,...set(p,add(L(p),addr(stride))),12,0,11,11];
const rings=(p,body)=>loop(p,R,R+16,4,body), threats=(p,body)=>loop(p,M,M+42,6,body);
const sq=e=>[...e,183,...e,183,162]; // convert to f64 before squaring
const dist2=(x,y)=>[...sq(x),...sq(y),160];
const laneX=l=>add(C(220),mul(l,C(260)));
function moduleBytes(){
 const begin=[...put(1,C(0)),...put(2,C(4)),...rings(0,write(0,2,C(-1))),...threats(0,write(0,3,C(2)))];
 waves.forEach((list,i)=>begin.push(...iff(eq(get(0),C(i+1)),[
  ...put(6,C(Math.max(...list.map(a=>a[0]))+D+60)),...put(7,C(list.length)),
  ...list.flatMap(([birth,x,l],j)=>[birth,x,l,0,x*D,16*D].flatMap((v,k)=>put(M+j*6+k,C(v))))
 ])));
 const reset=[...put(0,C(1)),...put(3,C(0)),...put(4,C(0)),...put(5,C(0)),...[8,9,10].flatMap(w=>put(w,C(2))),16,0];
 const place=[...iff(and(eq(get(4),C(0)),gt(get(2),C(0))),rings(2,
  iff(lt(read(2,2),C(0)),[...write(2,0,L(0)),...write(2,1,L(1)),...write(2,2,C(0)),...write(2,3,C(0)),...inc(2,-1),...C(1),15]))),...C(0)];
 // The rim expands faster than every streak. Distance minus radius is thus
 // monotone: comparing both interval endpoints gives swept contact, not just a snapshot.
 const dx=sub(read(0,4),mul(read(1,0),C(D))),dy=sub(read(0,5),mul(read(1,1),C(D)));
 const vx=sub(laneX(read(0,2)),read(0,1));
 const inner=mul(sub(mul(read(1,2),C(2)),C(3)),C(D)), outer=mul(add(mul(read(1,2),C(2)),C(5)),C(D));
 const swept=and([...dist2(dx,dy),...sq(outer),101],[...lt(inner,C(0)),...dist2(sub(dx,vx),sub(dy,C(420))),...sq(inner),102,114]);
 const caught=[...write(0,3,C(2)),...write(1,3,add(read(1,3),C(1))),...iff(gt(read(1,3),get(3)),put(3,read(1,3)))];
 const fly=[...write(0,4,add(read(0,4),vx)),...write(0,5,add(read(0,5),C(420))),
  ...rings(1,iff(and(eq(read(0,3),C(1)),and(gt(read(1,2),C(-1)),lt(read(1,2),C(36)))),iff(swept,caught))),
  ...iff(and(eq(read(0,3),C(1)),eq(read(0,5),C(436*D))),[
   ...set(2,mul(add(C(8),read(0,2)),C(4))),...iff(gt(load(L(2)),C(0)),store(L(2),sub(load(L(2)),C(1)))),...write(0,3,C(2))])];
 const step=[...iff(get(4),[15]),...inc(5,1),...inc(1,1),
  ...threats(0,[...iff(and(eq(read(0,3),C(0)),eq(read(0,0),get(1))),write(0,3,C(1))),...iff(eq(read(0,3),C(1)),fly)]),
  ...rings(1,iff(and(gt(read(1,2),C(-1)),lt(read(1,2),C(48))),write(1,2,add(read(1,2),C(1))))),
  ...iff(eq(add(add(get(8),get(9)),get(10)),C(0)),put(4,C(2)),iff(eq(get(1),get(6)),iff(eq(get(0),C(5)),put(4,C(1)),[...inc(0,1),16,0])))];
 const section=(id,data)=>[id,...u(data.length),...data],name=t=>[t.length,...Array.from(t,c=>c.charCodeAt(0))];
 const body=(n,b)=>{let code=[...(n?[1,n,127]:[0]),...b,11];return [...u(code.length),...code];};
 return Uint8Array.from([0,97,115,109,1,0,0,0,...section(1,[2,96,0,0,96,2,127,127,1,127]),...section(3,[4,0,0,1,0]),...section(5,[1,0,1]),
  ...section(7,[4,...name('memory'),2,0,...name('reset'),0,1,...name('place'),0,2,...name('step'),0,3]),
  ...section(10,[4,...body(1,begin),...body(0,reset),...body(1,place),...body(3,step)])]);
}
export function game(){const {exports:e}=new WebAssembly.Instance(new WebAssembly.Module(moduleBytes()));e.reset();return {reset:e.reset,step:e.step,place:e.place,state:new Int32Array(e.memory.buffer)};}
