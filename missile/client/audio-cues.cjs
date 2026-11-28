"use strict";
// Procedural sound cues built from Web Audio nodes. No recordings, no files, no downloads.
// Each builder schedules its nodes starting at time `t` and returns the time its last node
// stops. `p.rate` is a pitch multiplier, `p.n` a chain size and `p.size` a blast size 0..1.

const MAX_SECONDS = {
  launch: 0.7, blast: 1.8, manual: 1.2, ping: 0.4, city: 2.2, battery: 1.2, shield: 0.8,
  empty: 0.15, warn: 0.3, mutator: 1.2, waveStart: 1.2, waveEnd: 1.2, perk: 0.8, over: 3.2,
  victory: 3.0, menu: 0.2, split: 0.5, rebuild: 0.8,
};

function noiseBuffer(ac) {
  if (!ac.__noise) {
    const len = Math.floor(ac.sampleRate);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let s = 20240229;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = s / 2147483648 - 1;
    }
    ac.__noise = buf;
  }
  return ac.__noise;
}

function tone(ac, out, t, { type = "sine", f0, f1, dur, peak = 0.25, attack = 0.005 }) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return t + dur + 0.02;
}

function burst(ac, out, t, { dur, peak = 0.3, f0, f1, q = 1, type = "bandpass", attack = 0.003 }) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
  return t + dur + 0.02;
}

const NOTE = (semi) => 440 * Math.pow(2, semi / 12);

function arpeggio(ac, out, t, semis, step, type, peak, r) {
  let end = t;
  semis.forEach((s, i) => { end = Math.max(end, tone(ac, out, t + i * step, { type, f0: NOTE(s) * r, dur: step * 1.8, peak })); });
  return end;
}

const CUES = {
  launch: (ac, out, t, p) =>
    Math.max(
      burst(ac, out, t, { dur: 0.5, peak: 0.22, f0: 400 * p.rate, f1: 2600 * p.rate, q: 2 }),
      tone(ac, out, t, { type: "sawtooth", f0: 140 * p.rate, f1: 420 * p.rate, dur: 0.4, peak: 0.07 }),
    ),
  blast: (ac, out, t, p) => {
    const size = Math.min(Math.max(p.size ?? 0.5, 0), 1);
    const len = 0.7 + size * 1.0;
    return Math.max(
      tone(ac, out, t, { type: "sine", f0: (110 - size * 40) * p.rate, f1: 38 * p.rate, dur: len * 0.8, peak: 0.5, attack: 0.004 }),
      burst(ac, out, t, { dur: len, peak: 0.4, f0: 1800, f1: 120, q: 0.7, type: "lowpass" }),
    );
  },
  manual: (ac, out, t, p) =>
    Math.max(
      CUES.blast(ac, out, t, { ...p, size: 0.3 }),
      burst(ac, out, t, { dur: 0.08, peak: 0.25, f0: 3500, f1: 1200, q: 1, type: "highpass" }),
    ),
  ping: (ac, out, t, p) => {
    const chain = Math.min(Math.max((p.n || 1) - 1, 0), 12);
    const f = NOTE(-5 + chain) * p.rate;
    return Math.max(
      tone(ac, out, t, { type: "triangle", f0: f, dur: 0.25, peak: 0.22 }),
      burst(ac, out, t, { dur: 0.06, peak: 0.18, f0: 4000, f1: 2000, q: 1, type: "highpass" }),
    );
  },
  city: (ac, out, t, p) =>
    Math.max(
      tone(ac, out, t, { type: "sine", f0: 90 * p.rate, f1: 28, dur: 1.4, peak: 0.6 }),
      burst(ac, out, t, { dur: 1.2, peak: 0.45, f0: 900, f1: 70, q: 0.6, type: "lowpass" }),
      tone(ac, out, t + 0.1, { type: "sawtooth", f0: 200 * p.rate, f1: 45, dur: 1.8, peak: 0.12 }),
    ),
  battery: (ac, out, t, p) =>
    Math.max(
      tone(ac, out, t, { type: "square", f0: 160 * p.rate, f1: 50, dur: 0.6, peak: 0.25 }),
      burst(ac, out, t, { dur: 0.9, peak: 0.35, f0: 6000, f1: 800, q: 2, type: "bandpass" }),
    ),
  shield: (ac, out, t, p) =>
    Math.max(tone(ac, out, t, { type: "sine", f0: 1320 * p.rate, f1: 1180, dur: 0.6, peak: 0.2 }), tone(ac, out, t, { type: "sine", f0: 1980 * p.rate, dur: 0.5, peak: 0.1 })),
  empty: (ac, out, t) => burst(ac, out, t, { dur: 0.05, peak: 0.2, f0: 1500, q: 4, type: "bandpass" }),
  warn: (ac, out, t, p) => tone(ac, out, t, { type: "square", f0: 880 * p.rate, dur: 0.12, peak: 0.07 }),
  mutator: (ac, out, t, p) =>
    Math.max(tone(ac, out, t, { type: "sawtooth", f0: 110 * p.rate, f1: 82, dur: 0.9, peak: 0.16 }), tone(ac, out, t + 0.12, { type: "triangle", f0: 165 * p.rate, f1: 123, dur: 0.8, peak: 0.12 })),
  waveStart: (ac, out, t, p) => arpeggio(ac, out, t, [-12, -8, -5, 0], 0.12, "triangle", 0.16, p.rate),
  waveEnd: (ac, out, t, p) => arpeggio(ac, out, t, [0, -5, -8, -12], 0.12, "triangle", 0.16, p.rate),
  perk: (ac, out, t, p) => arpeggio(ac, out, t, [3, 10], 0.1, "sine", 0.2, p.rate),
  over: (ac, out, t, p) => arpeggio(ac, out, t, [-5, -8, -12, -17, -24], 0.45, "triangle", 0.2, p.rate),
  victory: (ac, out, t, p) => arpeggio(ac, out, t, [-12, -8, -5, 0, 4, 7, 12], 0.2, "triangle", 0.18, p.rate),
  menu: (ac, out, t, p) => tone(ac, out, t, { type: "square", f0: 660 * p.rate, f1: 880 * p.rate, dur: 0.07, peak: 0.08 }),
  split: (ac, out, t, p) => burst(ac, out, t, { dur: 0.3, peak: 0.15, f0: 3000 * p.rate, f1: 800, q: 3 }),
  rebuild: (ac, out, t, p) => arpeggio(ac, out, t, [-5, 0, 4], 0.09, "sine", 0.16, p.rate),
};

/** Schedules a cue. Returns when its last node stops; throws on an unknown name. */
function playCue(name, ac, out, t, params = {}) {
  const build = CUES[name];
  if (!build) throw new Error(`unknown cue ${name}`);
  return build(ac, out, t, { rate: 1, n: 1, size: 0.5, ...params });
}

module.exports = { playCue, CUES, MAX_SECONDS, NOTE };
