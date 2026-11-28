"use strict";
// Thin wrapper over the WebAssembly simulation core. The core owns all game state in
// linear memory; this module only instantiates it, forwards inputs, and reads events.

// `source` is an already created WebAssembly instance (the browser path) or raw bytes (Node tests).
// Browsers refuse to compile a module over 4 KB synchronously on the main thread, so the page
// builds the instance with the asynchronous WebAssembly.instantiate and hands it in.
function createCore(source, L) {
  const instance = source && source.exports ? source : new WebAssembly.Instance(new WebAssembly.Module(source), {});
  const x = instance.exports;
  const m = new Int32Array(x.memory.buffer);
  const core = {
    L,
    m,
    exports: x,
    init(seed, mode) {
      x.init(seed | 0, mode | 0);
    },
    step() {
      x.step();
    },
    input(kind, a = 0, b = 0) {
      return x.input(kind, Math.round(a), Math.round(b));
    },
    pump() {
      x.pump();
    },
    hash() {
      return x.hash() >>> 0;
    },
    get(name) {
      return m[L[name]];
    },
    set(name, value) {
      m[L[name]] = value;
    },
    /** Reads and clears the event list written by the core since the last call. */
    events() {
      const n = m[L.S_EVN];
      const out = [];
      for (let i = 0; i < n; i++) {
        const o = L.EV_BUF + i * L.EV_STRIDE;
        out.push({ t: m[o], a: m[o + 1], b: m[o + 2], c: m[o + 3], d: m[o + 4] });
      }
      x.clear_events();
      return out;
    },
    /** True while the clock should advance (announce countdown or active play). */
    stepping() {
      const p = m[L.S_PHASE];
      return p === L.PH_ANNOUNCE || p === L.PH_PLAY;
    },
    cities() {
      let n = 0;
      for (let t = 0; t < 9; t++) if (t % 4 !== 0 && m[L.TGT_ALIVE + t]) n++;
      return n;
    },
    // ----- replay log -----
    exportLog() {
      const n = m[L.S_LOGN];
      const out = [];
      for (let i = 0; i < n; i++) {
        const o = L.LOG + i * 4;
        out.push([m[o], m[o + 1], m[o + 2], m[o + 3]]);
      }
      return out;
    },
    beginReplay(entries) {
      entries.forEach((e, i) => {
        for (let k = 0; k < 4; k++) m[L.LOG + i * 4 + k] = e[k];
      });
      x.replay_begin(entries.length);
    },
    endReplay() {
      x.replay_end();
    },
  };
  return core;
}

module.exports = { createCore };
