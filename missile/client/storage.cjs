"use strict";
// Versioned browser storage, separate from the Lantern Below saves. Every failure is
// non-fatal: with no storage the game plays normally and simply does not remember.

const KEY = "missiledefense.v1";

function defaults() {
  return {
    settings: { music: false, sfx: false, reducedMotion: false, reducedFlash: false, highContrast: false, aim: "auto", speed: 100, lead: false },
    best: {}, // per mode: { score, wave, chain }
    stats: {}, // per mode: { games, wins, shots, kills }
    daily: {}, // date -> { score, code }
    run: null, // { mode, seed, entries } saved at the start of the current wave
  };
}

function createStorage(backing) {
  const data = defaults();
  try {
    const raw = backing && backing.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        Object.assign(data.settings, saved.settings || {});
        for (const k of ["best", "stats", "daily"]) if (saved[k] && typeof saved[k] === "object") data[k] = saved[k];
        if (saved.run && Array.isArray(saved.run.entries)) data.run = saved.run;
      }
    }
  } catch (e) {
    /* corrupt or unavailable: start fresh */
  }
  let ok = true;
  return {
    data,
    get persistent() {
      return ok;
    },
    save() {
      try {
        if (backing) backing.setItem(KEY, JSON.stringify(data));
      } catch (e) {
        ok = false;
      }
    },
    /** `again` updates bests only, for a run already counted (e.g. play on after a victory). */
    recordRun({ mode, score, wave, chain, shots, kills, won, again = false }) {
      const b = (data.best[mode] = data.best[mode] || { score: 0, wave: 0, chain: 0 });
      b.score = Math.max(b.score, score);
      b.wave = Math.max(b.wave, wave);
      b.chain = Math.max(b.chain, chain);
      if (again) return;
      const s = (data.stats[mode] = data.stats[mode] || { games: 0, wins: 0, shots: 0, kills: 0 });
      s.games += 1;
      s.wins += won ? 1 : 0;
      s.shots += shots;
      s.kills += kills;
    },
  };
}

module.exports = { createStorage, KEY };
