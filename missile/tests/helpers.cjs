"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { compile } = require("../tools/mcl.cjs");
const { createCore } = require("../client/core.cjs");

const SOURCE = path.join(__dirname, "..", "core", "missile.mcl");
let compiled;

function build() {
  if (!compiled) {
    compiled = compile(fs.readFileSync(SOURCE, "utf8"), "missile.mcl");
    if (!WebAssembly.validate(compiled.wasm)) throw new Error("core.wasm does not validate");
  }
  return compiled;
}

function newCore(seed = 12345, mode = 0) {
  const { wasm, consts } = build();
  const core = createCore(wasm, consts);
  core.init(seed, mode);
  return core;
}

/** Runs steps until the predicate holds or the step limit is hit. */
function runUntil(core, pred, limit = 60 * 600) {
  for (let i = 0; i < limit; i++) {
    if (pred(core)) return i;
    core.step();
  }
  throw new Error("runUntil: limit reached");
}

/** Skips the announce countdown so the wave is in play. */
function toPlay(core) {
  runUntil(core, (c) => c.get("S_PHASE") === c.L.PH_PLAY, 500);
}

const px = (v) => v * 16;

/** Puts a slow, vertical warhead at (x, y) in units. Returns its slot. */
function placeWarhead(core, { x, y, tgt = 4, type = 0, p = 1, dp = 1 }) {
  const { m, L } = core;
  for (let i = 0; i < L.N_WH; i++) {
    if (m[L.WH_ACT + i]) continue;
    const set = { ACT: 1, X: x, Y: y, SX: x, SY: y, TX: x, TY: L.GROUND, P: p, DP: dp, TYPE: type, TGT: tgt, SLOW: 0, SPD: 640, SPLIT: 0 };
    for (const [k, v] of Object.entries(set)) m[L[`WH_${k}`] + i] = v;
    return i;
  }
  throw new Error("no free warhead slot");
}

/** Puts a long-lived blast (already full size) at (x, y). Returns its slot. */
function placeBlast(core, { x, y, r = 1000, gen = 0, chain = 777, bat = 0 }) {
  const { m, L } = core;
  for (let i = 0; i < L.N_BL; i++) {
    if (m[L.BL_ACT + i]) continue;
    const set = { ACT: 1, X: x, Y: y, RMAX: r, AGE: 1, GROW: 1, HOLD: 300, SHRINK: 1, GEN: gen, CHAIN: chain, BAT: bat, R: 0 };
    for (const [k, v] of Object.entries(set)) m[L[`BL_${k}`] + i] = v;
    return i;
  }
  throw new Error("no free blast slot");
}

/** Empties the field and stops spawning, so a test controls exactly what exists. */
function quiet(core, { hold = false } = {}) {
  const { m, L } = core;
  toPlay(core);
  m[L.S_SPAWN_LEFT] = 0;
  if (hold) {
    // a motionless warhead in the far corner keeps the wave open across several steps
    const i = L.N_WH - 1;
    const set = { ACT: 1, X: 100, Y: 100, SX: 100, SY: 100, TX: 100, TY: L.GROUND, P: 1, DP: 1, TYPE: 0, TGT: 0, SLOW: 0, SPD: 640, SPLIT: 0 };
    for (const [k, v] of Object.entries(set)) m[L[`WH_${k}`] + i] = v;
  }
  core.events();
}

/** Seeds from a range until the predicate accepts the fresh core. */
function findSeed(pred, mode = 0) {
  for (let s = 1; s < 400; s++) {
    const c = newCore(s, mode);
    if (pred(c)) return s;
  }
  throw new Error("no matching seed");
}

/** Jumps to the start of the given wave using the normal continue path. */
function gotoWave(core, wave) {
  const { m, L } = core;
  m[L.S_PHASE] = L.PH_BETWEEN;
  m[L.S_PICKED] = 1;
  m[L.S_WAVE] = wave - 1;
  core.input(L.IN_CONTINUE);
}

const passiveOf = (core, id) => {
  for (let t = 0; t < 9; t++) if (core.m[core.L.TGT_PASS + t] === id) return t;
  return -1;
};

module.exports = { build, newCore, runUntil, toPlay, px, placeWarhead, placeBlast, quiet, findSeed, gotoWave, passiveOf };
