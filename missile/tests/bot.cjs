"use strict";
// A simple deterministic "average player" used by tests and for balance checks.
// It leads moving warheads, fires at the most urgent unclaimed one, and never exceeds a
// human-like firing rate. It is not meant to be optimal.

const SPEED_MULT = [1.3, 0.8, 1.0];

function choose(core, claimed, step) {
  const { m, L } = core;
  let best = null;
  for (let w = 0; w < L.N_WH; w++) {
    if (!m[L.WH_ACT + w]) continue;
    const key = `${w}:${m[L.WH_SX + w]}:${m[L.WH_SY + w]}`;
    if ((claimed.get(key) || 0) > step) continue;
    const eta = (65536 - m[L.WH_P + w]) / m[L.WH_DP + w];
    if (!best || eta < best.eta) best = { w, key, eta };
  }
  return best;
}

function aim(core, w) {
  const { m, L } = core;
  const sx = m[L.WH_SX + w];
  const sy = m[L.WH_SY + w];
  const vx = ((m[L.WH_TX + w] - sx) * m[L.WH_DP + w]) / 65536;
  const vy = ((m[L.WH_TY + w] - sy) * m[L.WH_DP + w]) / 65536;
  let ax = m[L.WH_X + w];
  let ay = m[L.WH_Y + w];
  for (let k = 0; k < 5; k++) {
    let bestD = Infinity;
    let bat = -1;
    for (let b = 0; b < 3; b++) {
      if (!m[L.TGT_ALIVE + b * 4] || m[L.BAT_AMMO + b] <= 0) continue;
      const d = Math.abs(ax - (80 + 140 * b * 4) * 16);
      if (d < bestD) { bestD = d; bat = b; }
    }
    if (bat < 0) return null;
    const bx = (80 + 140 * bat * 4) * 16;
    const by = L.GROUND - 224;
    const dist = Math.hypot(ax - bx, ay - by);
    const t = dist / ((6400 / 60) * SPEED_MULT[bat]);
    ax = m[L.WH_X + w] + vx * t;
    ay = m[L.WH_Y + w] + vy * t;
  }
  return { ax, ay };
}

/**
 * Plays the current phase forward. Returns when the wave has ended (between waves, won or over).
 * `skill` = pixel aiming error, `gap` = minimum steps between taps.
 */
function playWave(core, { skill = 12, gap = 22, rng = Math.random } = {}) {
  const { L } = core;
  const claimed = new Map();
  let lastShot = -1000;
  let guard = 0;
  while (core.stepping() && guard++ < 60 * 900) {
    const step = core.get("S_STEP");
    if (core.get("S_PHASE") === L.PH_PLAY && step - lastShot >= gap) {
      const pick = choose(core, claimed, step);
      if (pick) {
        const a = aim(core, pick.w);
        if (a && a.ay < 600 * 16 && a.ax > 0 && a.ax < L.W) {
          const nx = (rng() - 0.5) * 2 * skill;
          const ny = (rng() - 0.5) * 2 * skill;
          core.input(0, a.ax / 16 + nx, a.ay / 16 + ny);
          claimed.set(pick.key, step + 120);
          lastShot = step;
        }
      }
    }
    core.step();
  }
}

/** Between waves: take the first perk, rebuild what is affordable, continue. */
function manage(core) {
  const { L } = core;
  if (core.get("S_PHASE") !== L.PH_BETWEEN) return;
  if (!core.get("S_PICKED")) core.input(5, 0, 0);
  for (const t of [1, 2, 3, 5, 6, 7, 0, 4, 8]) if (!core.m[L.TGT_ALIVE + t]) core.input(6, t, 0);
  core.input(8, 0, 0);
}

/** Small seeded PRNG so bot behaviour is reproducible in tests. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playRun(core, { maxWave = 30, ...opts } = {}) {
  const rng = mulberry(opts.botSeed || 99);
  const stats = [];
  while (core.get("S_WAVE") <= maxWave) {
    const wave = core.get("S_WAVE");
    const ammo0 = core.get("S_AMMO0");
    const shots0 = core.get("S_SHOTS");
    playWave(core, { ...opts, rng });
    const ph = core.get("S_PHASE");
    stats.push({ wave, ammo0, shots: core.get("S_SHOTS") - shots0, kills: core.get("S_WAVE_KILLS"), cities: core.cities(), score: core.get("S_SCORE"), phase: ph });
    if (ph === core.L.PH_OVER) break;
    if (ph === core.L.PH_WON) break;
    manage(core);
  }
  return stats;
}

module.exports = { playWave, playRun, manage, mulberry };
