"use strict";
// Audio checks run against a recording stand-in for the Web Audio API (Node has none).
// They verify scheduling, limits and parameter validity, not how anything sounds.
const assert = require("node:assert/strict");
const { playCue, CUES, MAX_SECONDS } = require("../client/audio-cues.cjs");
const { AudioEngine, cueForEvent, VOICE_LIMIT, PITCH_VARIATION } = require("../client/audio.cjs");
const { build } = require("./helpers.cjs");

class Param {
  constructor(owner) { this.owner = owner; this._v = 0; }
  set value(v) { assert.ok(Number.isFinite(v), "param value must be finite"); this._v = v; }
  get value() { return this._v; }
  setValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t) && t >= 0); }
  linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); }
  exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(v), `exponential ramp needs a positive target, got ${v}`); assert.ok(Number.isFinite(t)); }
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  constructor(ac, kind) {
    this.ac = ac;
    this.kind = kind;
    this.frequency = new Param(this);
    this.gain = new Param(this);
    this.Q = new Param(this);
    this.threshold = new Param(this);
    this.ratio = new Param(this);
    this.stopped = null;
    ac.nodes.push(this);
  }
  connect() {}
  start(t) { this.started = t; }
  stop(t) { assert.ok(Number.isFinite(t)); this.stopped = t; this.ac.maxStop = Math.max(this.ac.maxStop, t); }
}
class FakeContext {
  constructor() {
    this.nodes = [];
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.maxStop = 0;
    this.state = "running";
    this.destination = {};
  }
  createOscillator() { return new Node(this, "osc"); }
  createGain() { return new Node(this, "gain"); }
  createBiquadFilter() { return new Node(this, "filter"); }
  createBufferSource() { return new Node(this, "source"); }
  createDynamicsCompressor() { return new Node(this, "comp"); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  suspend() { this.state = "suspended"; }
  resume() { this.state = "running"; }
}

// every cue is finite, valid and within its duration limit
for (const name of Object.keys(CUES)) {
  assert.ok(MAX_SECONDS[name] > 0, `${name} has a duration limit`);
  for (const params of [{}, { rate: 0.97 }, { rate: 1.03, n: 12, size: 1 }, { size: 0 }]) {
    const ac = new FakeContext();
    const out = ac.createGain();
    const end = playCue(name, ac, out, 0, params);
    assert.ok(Number.isFinite(end) && end > 0, name);
    assert.ok(end <= MAX_SECONDS[name] + 1e-9, `${name} lasts ${end}s, limit ${MAX_SECONDS[name]}s`);
    assert.ok(ac.maxStop <= MAX_SECONDS[name] + 1e-9);
    assert.ok(ac.nodes.some((n) => n.started !== undefined), `${name} makes sound`);
  }
}
assert.throws(() => playCue("nope", new FakeContext(), {}, 0), /unknown cue/);
{
  // the chain ping rises one semitone per kill, and stays within one octave
  const ac = new FakeContext();
  const seen = [];
  const orig = ac.createOscillator.bind(ac);
  ac.createOscillator = () => {
    const o = orig();
    const set = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { seen.push(v); set(v, t); };
    return o;
  };
  for (const n of [1, 2, 13, 30]) playCue("ping", ac, ac.createGain(), 0, { n, rate: 1 });
  assert.ok(Math.abs(seen[1] / seen[0] - Math.pow(2, 1 / 12)) < 1e-9, "one semitone per kill");
  assert.ok(Math.abs(seen[2] / seen[0] - 2) < 1e-9, "capped at one octave");
  assert.equal(seen[3], seen[2]);
}

// the engine
{
  assert.equal(new AudioEngine(null).unlock(), false, "no Web Audio: silent, not broken");
  const quiet = new AudioEngine(null);
  quiet.cue("blast");
  quiet.event({ t: 1, a: 0, b: 0, c: 0, d: 0 }, build().consts);
  quiet.setMusic(true);
  quiet.setSfx(true);

  const made = [];
  const timers = { set: (f) => { made.push(f); return made.length; }, clear: () => {} };
  const ctxs = [];
  const E = new AudioEngine(function () { const c = new FakeContext(); ctxs.push(c); return c; }, { random: () => 1, timers });
  assert.equal(E.sfx, false);
  assert.equal(E.music, false, "both channels start off");
  assert.equal(E.cue("blast"), false, "nothing plays while off");
  assert.equal(ctxs.length, 0, "no audio context before a user gesture");

  E.setSfx(true);
  const ac = ctxs[0];
  assert.ok(ac, "context created by the switch (a user gesture)");
  assert.equal(E.cue("blast"), true);
  assert.equal(E.cue("blast"), false, "identical cues within 30 ms merge");
  ac.currentTime = 0.05;
  assert.equal(E.cue("blast"), true);

  // voice limit
  const names = Object.keys(CUES);
  for (let i = 0; i < 80; i++) {
    ac.currentTime = 1 + i * 0.001;
    E.cue(names[i % names.length]);
    E.voices = E.voices.filter((v) => v.end > ac.currentTime);
    assert.ok(E.voices.length <= VOICE_LIMIT, "never more than 24 voices");
  }

  // pitch variation stays within +-3%
  const rates = new Set();
  for (const r of [0, 0.5, 1]) {
    const e2 = new AudioEngine(function () { return new FakeContext(); }, { random: () => r, timers });
    e2.setSfx(true);
    let seenRate;
    const real = e2.ac.createOscillator.bind(e2.ac);
    e2.ac.createOscillator = () => { const o = real(); const f = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v) => { seenRate = seenRate ?? v; f(v, 0); }; return o; };
    e2.cue("menu");
    rates.add(seenRate / 660);
  }
  const arr = [...rates];
  assert.ok(Math.min(...arr) >= 1 - PITCH_VARIATION - 1e-9 && Math.max(...arr) <= 1 + PITCH_VARIATION + 1e-9, "pitch variation within 3%");
  assert.ok(Math.max(...arr) > Math.min(...arr), "and it actually varies");

  // music: opt in, scheduled ahead, layered by wave, pauses with the page
  const m = new AudioEngine(function () { return new FakeContext(); }, { timers });
  m.setMusic(true);
  const base = m.ac.nodes.filter((n) => n.kind === "osc").length;
  assert.ok(base > 0, "music is scheduled ahead of the clock");
  assert.equal(made.length > 0, true, "uses a scheduling timer");
  m.setWave(12, false);
  m.ac.currentTime = 20;
  m.scheduleMusic();
  const loud = m.ac.nodes.filter((n) => n.kind === "osc").length - base;
  const m2 = new AudioEngine(function () { return new FakeContext(); }, { timers });
  m2.setMusic(true);
  m2.setWave(12, true);
  const b2 = m2.ac.nodes.filter((n) => n.kind === "osc").length;
  m2.ac.currentTime = 20;
  m2.scheduleMusic();
  const calm = m2.ac.nodes.filter((n) => n.kind === "osc").length - b2;
  assert.ok(loud > calm, "calm waves drop back to the pad");
  m.suspend();
  assert.equal(m.ac.state, "suspended");
  m.resume();
  assert.equal(m.ac.state, "running");
}

// every core event that should be heard maps to a real cue
{
  const { consts: L } = build();
  const heard = ["E_LAUNCH", "E_DETONATE", "E_KILL", "E_CITY_HIT", "E_BAT_HIT", "E_SHIELD", "E_EMPTY", "E_WARN", "E_WAVE_START", "E_WAVE_END", "E_PERK", "E_OVER", "E_WON", "E_REBUILD", "E_REROLL", "E_SPLIT"];
  for (const name of heard) {
    const cue = cueForEvent({ t: L[name], a: 0, b: 0, c: 0, d: 100 }, L);
    assert.ok(cue && CUES[cue.name], `${name} has a cue`);
  }
  assert.equal(cueForEvent({ t: 9999 }, L), null);
  assert.equal(cueForEvent({ t: L.E_DETONATE, a: 1, d: 10 }, L).name, "manual");
  assert.equal(cueForEvent({ t: L.E_WAVE_START, b: 2 }, L).name, "mutator");
}

console.log("audio: ok");
