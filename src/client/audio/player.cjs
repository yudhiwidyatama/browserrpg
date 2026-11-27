const { playBeat, playCue } = require('./score.cjs');

function createPlayer(Context) {
  const enabled = { music: false, effects: false };
  let context, musicBus, effectsBus, timer;
  let scene = null, hidden = false, beat = 0, nextBeat = 0;

  function updatePlayback() {
    clearInterval(timer);
    if (!context) return;
    const playMusic = enabled.music && !hidden && scene !== null;
    musicBus.gain.setTargetAtTime(playMusic ? 0.42 : 0, context.currentTime, 0.018);
    effectsBus.gain.setTargetAtTime(enabled.effects && !hidden ? 0.5 : 0, context.currentTime, 0.012);
    if (hidden || (!enabled.music && !enabled.effects)) {
      void context.suspend().catch(() => {});
      return;
    }
    if (!playMusic) return;
    nextBeat = context.currentTime + 0.06;
    function schedule() {
      if (context.state !== 'running') return;
      const clock = context.currentTime;
      // Do not play a backlog of notes after a throttled or suspended tab resumes.
      if (nextBeat < clock) nextBeat = clock + 0.02;
      while (nextBeat < clock + 0.12) {
        nextBeat += playBeat(context, musicBus, scene, beat++, nextBeat);
      }
    }
    schedule(); timer = setInterval(schedule, 50);
  }

  async function toggle(channel) {
    if (!Context || !Object.hasOwn(enabled, channel)) return false;
    if (!context) {
      context = new Context(); musicBus = context.createGain(); effectsBus = context.createGain();
      musicBus.gain.value = effectsBus.gain.value = 0;
      musicBus.connect(context.destination); effectsBus.connect(context.destination);
    }
    enabled[channel] = !enabled[channel];
    if (!hidden && (enabled.music || enabled.effects)) {
      try { await context.resume(); } catch { enabled[channel] = false; }
    }
    updatePlayback(); return enabled[channel];
  }
  function setScene(value) {
    if (scene === value) return;
    scene = value; beat = 0; updatePlayback();
  }
  function setHidden(value) {
    hidden = value;
    if (!hidden && context && (enabled.music || enabled.effects)) void context.resume().catch(() => {});
    updatePlayback();
  }
  function effect(name) {
    if (context?.state === 'running' && enabled.effects && !hidden) playCue(context, effectsBus, name);
  }
  return { toggle, setScene, setHidden, effect };
}
module.exports = { createPlayer };
