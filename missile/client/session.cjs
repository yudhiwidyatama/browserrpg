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
