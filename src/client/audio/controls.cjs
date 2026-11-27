const { createPlayer } = require('./player.cjs');
function installAudioControls() {
  const Context = window.AudioContext || window.webkitAudioContext;
  const player = createPlayer(Context);
  const controls = document.createElement('div');
  controls.className = 'actions'; controls.setAttribute('role','group'); controls.setAttribute('aria-label','Audio');
  for (const [channel,label] of [['music','Music'],['effects','Sound effects']]) {
    const button = document.createElement('button'); button.type = 'button';button.id = `audio-${channel}`;
    const display = on => {button.setAttribute('aria-pressed',String(on));button.textContent = `${label}: ${on?'on':'off'}`;};
    display(false);button.disabled = !Context;
    if (!Context) button.title = 'Web Audio is not available in this browser.';
    button.onclick = async () => {
      button.disabled = true;
      try { const on = await player.toggle(channel);display(on); if (on && channel==='effects') player.effect('loot'); }
      catch { display(false);button.title='Audio is unavailable. You can still play silently.'; }
      finally { button.disabled=false; }
    };
    controls.append(button);
  }
  document.querySelector('header').append(controls);
  document.addEventListener('visibilitychange',()=>player.setHidden(document.hidden));
  window.addEventListener('pagehide',()=>player.setHidden(true));
  window.addEventListener('pageshow',()=>player.setHidden(document.hidden));
  return player;
}
module.exports={installAudioControls};
