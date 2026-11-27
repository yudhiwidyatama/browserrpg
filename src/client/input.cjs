const {dirs,sameTile}=require('../grid.cjs');
const keys={w:'north',arrowup:'north',a:'west',arrowleft:'west',s:'south',arrowdown:'south',d:'east',arrowright:'east',f:'pulse',h:'heal','.':'wait',e:'use',r:'travel'};
function bindInput(canvas,getGame,getCamera,dispatch){
 document.addEventListener('click',event=>{const button=event.target.closest('button[data-act]');if(button&&!button.disabled)dispatch(button.dataset.act);});
 window.addEventListener('keydown',event=>{if(event.metaKey||event.ctrlKey||event.altKey||event.repeat)return;const action=keys[event.key.toLowerCase()];if(action){event.preventDefault();dispatch(action);}});
 canvas.addEventListener('click',event=>{const bounds=canvas.getBoundingClientRect(),camera=getCamera();if(!camera)return;const tile=camera.tileAt(event.clientX-bounds.left,event.clientY-bounds.top),game=getGame();for(const [direction,[dx,dy]] of Object.entries(dirs)){if(tile.x===game.hero.x+dx&&tile.y===game.hero.y+dy){dispatch(direction);return;}}if(game.zone==='dungeon'&&sameTile(tile,game.hero))dispatch('use');});
}
module.exports={bindInput};
