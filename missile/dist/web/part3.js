"use strict";
var __md = (window.__md = window.__md || {});
__md["replay.cjs"] = function (module, exports, require) {
"use strict";
// Replay strings: version, mode, seed and every recorded input. Because the simulation is
// deterministic, replaying the inputs reproduces a run exactly.
//
//   MD<version>:<mode>:<seed base36>:<count>:<payload>:<checksum>
//   payload = entries joined by ";", each "<step delta>,<kind>,<x>,<y>" in base 36

function checksum(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function encode({ version, mode, seed, entries }) {
  let prev = 0;
  const payload = entries
    .map(([step, kind, x, y]) => {
      const delta = step - prev;
      prev = step;
      return [delta, kind, x, y].map((v) => v.toString(36)).join(",");
    })
    .join(";");
  return `MD${version}:${mode}:${(seed >>> 0).toString(36)}:${entries.length}:${payload}:${checksum(payload)}`;
}

function decode(text, version) {
  const parts = String(text || "").trim().split(":");
  if (parts.length !== 6 || !/^MD\d+$/.test(parts[0])) throw new Error("This is not a Missile Defense replay.");
  if (parts[0] !== `MD${version}`) throw new Error("This replay was made with a different version of the game.");
  const [, modeText, seedText, countText, payload, sum] = parts;
  if (checksum(payload) !== sum) throw new Error("This replay is damaged (checksum mismatch).");
  const mode = parseInt(modeText, 10);
  const seed = parseInt(seedText, 36) | 0;
  const count = parseInt(countText, 10);
  if (![0, 1, 2].includes(mode) || !Number.isFinite(count)) throw new Error("This replay has invalid settings.");
  let step = 0;
  const entries = payload
    ? payload.split(";").map((chunk) => {
        const v = chunk.split(",").map((s) => parseInt(s, 36));
        if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) throw new Error("This replay contains an invalid input.");
        step += v[0];
        return [step, v[1], v[2], v[3]];
      })
    : [];
  if (entries.length !== count) throw new Error("This replay is incomplete.");
  return { mode, seed, entries };
}

/** Short code for sharing a daily result. Assisted runs get none, so codes compare fairly. */
function shareCode({ date, score, replay, assisted }) {
  if (assisted) return null;
  return `MDD-${date}-${score}-${checksum(replay).toUpperCase().slice(0, 6)}`;
}

function utcDateNumber(now = new Date()) {
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

module.exports = { encode, decode, shareCode, utcDateNumber, checksum };

};
__md["session.cjs"] = function (module, exports, require) {
"use strict";
// Game session: owns the simulation, the clock, saving and resuming, replays, statistics and
// presentation timing (speed, slow motion, hit-stop). It has no DOM, so it can be tested in Node.

const replay = require("./replay.cjs");
const { PERKS, MUTATORS, HINTS } = require("./content.cjs");

const STEP = 1 / 60;
const MAX_STEPS_PER_TICK = 5;
const SLOWMO_SECONDS = 0.4;
const SLOWMO_SCALE = 0.4;
const HITSTOP_SECONDS = 0.05;
const HINT_SECONDS = 14;

class Session {
  constructor({ core, storage, audio = null, random = Math.random, date = () => new Date() }) {
    this.core = core;
    this.storage = storage;
    this.audio = audio;
    this.random = random;
    this.date = date;
    this.L = core.L;
    this.listeners = { event: [], phase: [] };
    this.running = false;
    this.paused = false;
    this.playback = null;
    this.selectedBattery = -1;
    this.clock = 0;
    this.acc = 0;
    this.slowUntil = 0;
    this.freezeUntil = 0;
    this.waveClock = 0;
    this.lastPhase = 0;
    this.recorded = false;
    this.assisted = false;
    this.result = null;
  }
  on(kind, fn) {
    this.listeners[kind].push(fn);
  }
  get settings() {
    return this.storage.data.settings;
  }
  get phase() {
    return this.core.get("S_PHASE");
  }
  get mode() {
    return this.core.get("S_MODE");
  }
  get seed() {
    return this.core.get("S_SEED");
  }

  // ---------- starting, resuming, watching ----------
  begin(mode, seed) {
    this.core.init(seed, mode);
    this.running = true;
    this.paused = false;
    this.playback = null;
    this.recorded = false;
    this.result = null;
    this.acc = 0;
    this.selectedBattery = -1;
    this.assisted = this.settings.speed < 100 || !!this.settings.lead;
    this.lastPhase = this.phase;
    this.waveClock = this.clock;
  }
  startNew(mode) {
    const seed = mode === 1 ? replay.utcDateNumber(this.date()) : Math.floor(this.random() * 0x7fffffff) + 1;
    this.begin(mode, seed);
    this.processEvents();
  }
  hasSavedRun() {
    const run = this.storage.data.run;
    return !!(run && run.entries && [0, 1, 2].includes(run.mode));
  }
  /** Rebuilds the saved run by replaying its inputs, then hands control back to the player. */
  fastForward(mode, seed, entries) {
    this.begin(mode, seed);
    this.core.beginReplay(entries);
    let guard = 0;
    while (this.core.get("S_LOGPOS") < entries.length) {
      this.core.pump();
      if (this.core.get("S_LOGPOS") >= entries.length) break;
      if (!this.core.stepping() || guard++ > 4e6) {
        this.core.endReplay();
        throw new Error("The saved run could not be restored.");
      }
      this.core.step();
    }
    this.core.endReplay();
    this.core.events();
    this.lastPhase = this.phase;
  }
  resume() {
    const run = this.storage.data.run;
    if (!this.hasSavedRun()) return false;
    this.fastForward(run.mode, run.seed | 0, run.entries);
    this.waveClock = this.clock;
    this.emitPhase();
    return true;
  }
  /** Restart the current wave from its saved start; costs nothing. */
  restartWave() {
    if (this.playback) return false;
    if (this.hasSavedRun()) return this.resume();
    this.begin(this.mode, this.seed);
    this.processEvents();
    return true;
  }
  watch(text) {
    const { mode, seed, entries } = replay.decode(text, this.L.VERSION);
    this.begin(mode, seed);
    this.core.beginReplay(entries);
    this.playback = { entries, done: false, speed: 1 };
    this.processEvents();
  }
  stop() {
    this.running = false;
    this.playback = null;
  }

  // ---------- saving ----------
  saveRun() {
    if (this.playback) return;
    this.storage.data.run = { mode: this.mode, seed: this.seed, entries: this.core.exportLog() };
    this.storage.save();
  }
  exportReplay() {
    return replay.encode({ version: this.L.VERSION, mode: this.mode, seed: this.seed, entries: this.core.exportLog() });
  }

  // ---------- time ----------
  tick(dt) {
    this.clock += dt;
    if (!this.running || this.paused) return;
    if (this.playback) return this.tickPlayback(dt);
    if (this.clock < this.freezeUntil) return;
    const reduced = this.settings.reducedMotion;
    let scale = this.settings.speed / 100;
    if (!reduced && this.clock < this.slowUntil) scale *= SLOWMO_SCALE;
    this.acc = Math.min(this.acc + dt * scale, 0.25);
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS_PER_TICK && this.core.stepping()) {
      this.core.step();
      this.acc -= STEP;
      steps++;
      this.processEvents();
      if (this.clock < this.freezeUntil) break;
    }
    if (!this.core.stepping()) this.acc = 0;
    this.emitPhase();
  }
  tickPlayback(dt) {
    const pb = this.playback;
    if (pb.done) return;
    this.acc = Math.min(this.acc + dt * pb.speed, 0.5);
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS_PER_TICK * 4) {
      this.core.pump();
      const finished = this.core.get("S_LOGPOS") >= pb.entries.length;
      if (!this.core.stepping()) {
        if (finished) { pb.done = true; this.core.endReplay(); break; }
        // the recorded input is for a step that is not coming; the replay does not match this build
        pb.done = true;
        this.core.endReplay();
        break;
      }
      this.core.step();
      this.acc -= STEP;
      steps++;
    }
    this.processEvents();
    if (pb.done) this.emitPhase();
  }

  // ---------- events and phases ----------
  processEvents() {
    const { L } = this;
    const reduced = this.settings.reducedMotion;
    for (const e of this.core.events()) {
      if (e.t === L.E_KILL && !reduced) {
        if (e.a >= 5) this.slowUntil = this.clock + SLOWMO_SECONDS;
        if (e.a >= 3) this.freezeUntil = this.clock + HITSTOP_SECONDS;
      }
      if (e.t === L.E_WAVE_START) {
        this.waveClock = this.clock;
        if (this.audio) this.audio.setWave(e.a, e.c);
        this.saveRun();
      }
      if (this.audio) this.audio.event(e, L);
      for (const fn of this.listeners.event) fn(e);
    }
    this.emitPhase();
  }
  emitPhase() {
    const ph = this.phase;
    if (ph === this.lastPhase && !(this.playback && this.playback.done && !this.playback.notified)) return;
    const prev = this.lastPhase;
    this.lastPhase = ph;
    if (this.playback && this.playback.done) this.playback.notified = true;
    if ((ph === this.L.PH_OVER || ph === this.L.PH_WON) && !this.playback) this.finish(ph === this.L.PH_WON);
    for (const fn of this.listeners.phase) fn(ph, prev);
  }
  finish(won) {
    const c = this.core;
    const stats = {
      mode: this.mode, score: c.get("S_SCORE"), wave: c.get("S_WAVE"), chain: c.get("S_BEST_CHAIN"),
      shots: c.get("S_SHOTS"), kills: c.get("S_KILLS"), won,
    };
    this.storage.recordRun({ ...stats, again: this.recorded });
    this.recorded = true;
    const text = this.exportReplay();
    let code = null;
    if (this.mode === 1) {
      const date = this.seed;
      code = replay.shareCode({ date, score: stats.score, replay: text, assisted: this.assisted });
      const prev = this.storage.data.daily[date];
      if (!this.assisted && (!prev || stats.score > prev.score)) this.storage.data.daily[date] = { score: stats.score, code };
    }
    this.result = { ...stats, replay: text, code, assisted: this.assisted, accuracy: stats.shots ? stats.kills / stats.shots : 0 };
    this.storage.data.run = null;
    this.storage.save();
  }

  // ---------- player actions ----------
  canAct() {
    return this.running && !this.paused && !this.playback;
  }
  selectBattery(b) {
    this.selectedBattery = this.selectedBattery === b ? -1 : b;
  }
  fire(x, y) {
    if (!this.canAct() || this.phase !== this.L.PH_PLAY) return;
    const kind = this.selectedBattery >= 0 ? 1 + this.selectedBattery : 0;
    this.core.input(kind, Math.min(Math.max(x, 0), 1280), Math.min(Math.max(y, 0), 720));
    this.processEvents();
  }
  detonate() {
    if (!this.canAct() || this.phase !== this.L.PH_PLAY) return;
    this.core.input(this.L.IN_DETONATE);
    this.processEvents();
  }
  pick(i) {
    if (!this.canAct()) return;
    this.core.input(this.L.IN_PICK, i);
    this.processEvents();
  }
  rebuild(t) {
    if (!this.canAct()) return;
    this.core.input(this.L.IN_REBUILD, t);
    this.processEvents();
  }
  reroll() {
    if (!this.canAct()) return;
    this.core.input(this.L.IN_REROLL);
    this.processEvents();
  }
  next() {
    if (!this.canAct()) return;
    this.core.input(this.L.IN_CONTINUE);
    this.processEvents();
  }

  // ---------- read-only views for the interface ----------
  banner() {
    const { L } = this;
    if (!this.running || this.playback) return "";
    const ph = this.phase;
    if (ph !== L.PH_ANNOUNCE && ph !== L.PH_PLAY) return "";
    const mask = this.core.get("S_MUT");
    if (ph === L.PH_ANNOUNCE && mask) {
      return [1, 2, 4].filter((b) => mask & b).map((b) => `${MUTATORS[b].name}: ${MUTATORS[b].text}`).join("  \u2022  ");
    }
    const wave = this.core.get("S_WAVE");
    if (this.mode !== 2 && wave <= 3 && this.clock - this.waveClock < HINT_SECONDS) return HINTS[wave] || "";
    return "";
  }
  rebuildCost(t) {
    const { m, L } = this.core;
    let cost = t % 4 === 0 ? 150 : 300;
    if (m[L.S_REBUILT] === 0) {
      for (let i = 0; i < 9; i++) if (m[L.TGT_ALIVE + i] && m[L.TGT_PASS + i] === 5) cost = Math.floor(cost / 2);
    }
    return cost;
  }
  between() {
    const { m, L } = this.core;
    const offers = [0, 1, 2].map((i) => m[L.S_OFFER + i]).map((id) => (id >= 0 ? { id, ...PERKS[id], level: m[L.PK_LVL + id] } : null));
    const rebuilds = [];
    for (let t = 0; t < 9; t++) if (!m[L.TGT_ALIVE + t]) rebuilds.push({ t, battery: t % 4 === 0, cost: this.rebuildCost(t) });
    return {
      wave: m[L.S_WAVE], score: m[L.S_SCORE], funds: m[L.S_FUNDS], picked: !!m[L.S_PICKED], offers, rebuilds,
      rerollCost: 100 + 50 * m[L.S_REROLLS],
      summary: { kills: m[L.S_SUM_KILLS], city: m[L.S_SUM_CITY], ammo: m[L.S_SUM_AMMO], clean: m[L.S_SUM_CLEAN], thrifty: m[L.S_SUM_THRIFTY], funds: m[L.S_SUM_FUNDS] },
      owned: PERKS.map((p) => ({ ...p, level: m[L.PK_LVL + p.id] })).filter((p) => p.level > 0),
    };
  }
}

module.exports = { Session, STEP, SLOWMO_SECONDS, HITSTOP_SECONDS };

};
__md["storage.cjs"] = function (module, exports, require) {
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

};
