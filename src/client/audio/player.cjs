const {playBeat,playCue}=require('./score.cjs');
// Constructing the player is silent. The browser context is created only by a user gesture.
function createPlayer(Context){let context,musicBus,effectsBus,timer=null,nextBeat=0,beat=0,scene=null,hidden=false;
 const enabled={music:false,effects:false};
 function sync(){if(timer!==null){clearInterval(timer);timer=null;}if(!context)return;
   const now=context.currentTime;musicBus.gain.setTargetAtTime(enabled.music&&!hidden&&scene?.length?.valueOf()?0.42:0,now,.018);effectsBus.gain.setTargetAtTime(enabled.effects&&!hidden?.valueOf()?0.5:0,now,.012);
   if(hidden||(!enabled.music&&!enabled.effects)){void context.suspend().catch(()=>{});return;}
   if(!enabled.music||!scene)return;nextBeat=now+.06;
   function schedule(){if(context.state!=='running')return;const clock=context.currentTime;if(nextBeat<clock)nextBeat=clock+.02;while(nextBeat<clock+.12){nextBeat+=playBeat(context,musicBus,scene,beat++,nextBeat);}}
   schedule();timer=setInterval(schedule,50);
 }
 async function toggle(channel){if(!Context)return false;if(!context){context=new Context();musicBus=context.createGain();effectsBus=context.createGain();musicBus.gain.value=effectsBus.gain.value=0;musicBus.connect(context.destination);effectsBus.connect(context.destination);}enabled[channel]=!enabled[channel];if(!hidden&&(enabled.music||enabled.effects)){try{await context.resume();}catch{enabled[channel]=false;}}sync();return enabled[channel];}
 function setScene(value){if(value!==scene){scene=value;beat=0;sync();}}
 function setHidden(value){hidden=value;if(!hidden&&context&&(enabled.music||enabled.effects))void context.resume().catch(()=>{});sync();}
 function effect(name){if(context?.state==='running'&&enabled.effects&&!hidden)playCue(context,effectsBus,name);}
 return {toggle,setScene,setHidden,effect};}
module.exports={createPlayer};
