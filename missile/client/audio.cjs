"use strict";
// Audio engine: sound effects from game events, plus sparse procedural music.
// Music and effects have separate switches and both start off. Nothing here can change
// game state: with sound off, or no Web Audio at all, the game plays identically.

const { playCue, NOTE } = require("./audio-cues.cjs");

const VOICE_LIMIT = 24;
const MERGE_SECONDS = 0.03;
const PITCH_VARIATION = 0.03;

// event kinds from the core (see core/missile.mcl)
function cueForEvent(e, L) {
  switch (e.t) {
    case L.E_LAUNCH: return { name: "launch" };
    case L.E_DETONATE: return { name: e.a ? "manual" : "blast", size: Math.min(e.d / 130, 1) };
    case L.E_KILL: return { name: "ping", n: e.a };
    case L.E_CITY_HIT: return { name: "city" };
    case L.E_BAT_HIT: return { name: "battery" };
    case L.E_SHIELD: return { name: "shield" };
    case L.E_EMPTY: return { name: "empty" };
    case L.E_WARN: return { name: "warn" };
    case L.E_WAVE_START: return { name: e.b ? "mutator" : "waveStart" };
    case L.E_WAVE_END: return { name: "waveEnd" };
    case L.E_PERK: return { name: "perk" };
    case L.E_OVER: return { name: "over" };
    case L.E_WON: return { name: "victory" };
    case L.E_REBUILD: return { name: "rebuild" };
    case L.E_REROLL: return { name: "menu" };
    case L.E_SPLIT: return { name: "split" };
    default: return null;
  }
}

// A-minor drone, one chord per bar
const BASS = [-24, -24, -28, -26]; // semitones from A4
const CHORDS = [[-12, -9, -5], [-12, -9, -5], [-16, -12, -9], [-14, -10, -7]];
const ARP = [0, 3, 7, 3, 0, 5, 7, 5];

class AudioEngine {
  constructor(AudioContextClass, { random = Math.random, timers = { set: setInterval, clear: clearInterval } } = {}) {
    this.AC = AudioContextClass;
    this.random = random;
    this.timers = timers;
    this.sfx = false;
    this.music = false;
    this.ac = null;
    this.voices = [];
    this.last = new Map();
    this.wave = 1;
    this.calm = false;
    this.nextBar = 0;
    this.bar = 0;
    this.timer = null;
  }
  get available() {
    return !!this.AC;
  }
  /** Must run inside a user gesture (browsers refuse to start audio otherwise). */
  unlock() {
    if (!this.AC) return false;
    if (!this.ac) {
      try {
        this.ac = new this.AC();
      } catch (e) {
        this.AC = null;
        return false;
      }
      const ac = this.ac;
      this.master = ac.createGain();
      this.master.gain.value = 0.8;
      this.limiter = ac.createDynamicsCompressor();
      this.limiter.threshold.value = -14;
      this.limiter.ratio.value = 8;
      this.sfxBus = ac.createGain();
      this.musicBus = ac.createGain();
      this.musicBus.gain.value = 0.35;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.limiter);
      this.limiter.connect(ac.destination);
    }
    if (this.ac.state === "suspended" && this.ac.resume) this.ac.resume();
    return true;
  }
  setSfx(on) {
    this.sfx = on;
    if (on) this.unlock();
  }
  setMusic(on) {
    this.music = on;
    if (on && this.unlock()) this.startMusic();
    else this.stopMusic();
  }
  suspend() {
    if (this.ac && this.ac.suspend) this.ac.suspend();
  }
  resume() {
    if (this.ac && this.ac.resume && (this.sfx || this.music)) this.ac.resume();
  }
  setWave(wave, calm) {
    this.wave = wave;
    this.calm = !!calm;
  }

  cue(name, params = {}) {
    if (!this.sfx || !this.ac) return false;
    const ac = this.ac;
    const now = ac.currentTime;
    if (now - (this.last.get(name) ?? -1) < MERGE_SECONDS) return false;
    this.last.set(name, now);
    this.voices = this.voices.filter((v) => v.end > now);
    while (this.voices.length >= VOICE_LIMIT) {
      const old = this.voices.shift();
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0, now, 0.01);
    }
    const gain = ac.createGain();
    gain.connect(this.sfxBus);
    const rate = 1 + (this.random() * 2 - 1) * PITCH_VARIATION;
    const end = playCue(name, ac, gain, now + 0.005, { ...params, rate });
    this.voices.push({ end, gain });
    return true;
  }
  event(e, L) {
    const c = cueForEvent(e, L);
    if (c) this.cue(c.name, c);
  }

  // ----- music -----
  startMusic() {
    if (this.timer || !this.ac) return;
    this.nextBar = this.ac.currentTime + 0.1;
    this.timer = this.timers.set(() => this.scheduleMusic(), 150);
    this.scheduleMusic();
  }
  stopMusic() {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = null;
  }
  scheduleMusic() {
    const ac = this.ac;
    if (!ac || !this.music) return;
    const beat = 60 / 76;
    while (this.nextBar < ac.currentTime + 1.2) {
      const t = this.nextBar;
      const b = this.bar % 4;
      this.musicNote(t, NOTE(CHORDS[b][0]), beat * 4, "sine", 0.09);
      this.musicNote(t, NOTE(CHORDS[b][1]), beat * 4, "sine", 0.07);
      this.musicNote(t, NOTE(CHORDS[b][2]), beat * 4, "triangle", 0.05);
      if (!this.calm) {
        for (let i = 0; i < 4; i++) this.musicNote(t + i * beat, NOTE(BASS[b]), beat * 0.8, "triangle", 0.13);
        if (this.wave > 5) for (let i = 0; i < 8; i++) this.musicNote(t + i * beat * 0.5, NOTE(BASS[b] + 12), beat * 0.3, "square", 0.025);
        if (this.wave > 10) for (let i = 0; i < 8; i++) this.musicNote(t + i * beat * 0.5, NOTE(ARP[i] + (b === 2 ? -4 : 0)), beat * 0.45, "sine", 0.05);
      }
      this.nextBar += beat * 4;
      this.bar += 1;
    }
  }
  musicNote(t, f, dur, type, peak) {
    const ac = this.ac;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.05, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

module.exports = { AudioEngine, cueForEvent, VOICE_LIMIT, MERGE_SECONDS, PITCH_VARIATION };
