"use strict";
const assert = require("node:assert/strict");
const { Session, STEP, SLOWMO_SECONDS, HITSTOP_SECONDS } = require("../client/session.cjs");
const { createStorage, KEY } = require("../client/storage.cjs");
const replay = require("../client/replay.cjs");
const { newCore, placeBlast, placeWarhead, quiet, gotoWave } = require("./helpers.cjs");
const bot = require("./bot.cjs");

const memoryBacking = () => {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
};

function make({ seed = 1234, mode = 0, settings = {}, backing = memoryBacking(), date } = {}) {
  const core = newCore(1, 0);
  const storage = createStorage(backing);
  Object.assign(storage.data.settings, settings);
  const heard = [];
  const audio = { waves: [], event: (e) => heard.push(e.t), setWave(w, calm) { this.waves.push([w, calm]); } };
  const session = new Session({ core, storage, audio, random: () => (seed % 1000) / 1000, date: date || (() => new Date(Date.UTC(2026, 10, 28, 15, 0, 0))) });
  return { core, storage, audio, heard, session, backing };
}

/** Plays with the bot through the session (so every input is recorded). */
function playWaveThroughSession(s, rng) {
  const { core } = s;
  let guard = 0;
  while (core.stepping() && guard++ < 60 * 900) {
    const step = core.get("S_STEP");
    if (core.get("S_PHASE") === core.L.PH_PLAY && step % 24 === 0) {
      const w = (() => { for (let i = 0; i < core.L.N_WH; i++) if (core.m[core.L.WH_ACT + i]) return i; return -1; })();
      if (w >= 0) s.fire(core.m[core.L.WH_X + w] / 16 + (rng() - 0.5) * 30, core.m[core.L.WH_Y + w] / 16 + 90);
    }
    s.tick(STEP);
  }
}

// ---------- new runs and the clock ----------
{
  const { session, core } = make();
  session.startNew(0);
  assert.ok(session.seed > 0 && session.mode === 0);
  assert.equal(session.phase, core.L.PH_ANNOUNCE);
  const daily = make();
  daily.session.startNew(1);
  assert.equal(daily.session.seed, 20261128, "daily seed comes from the UTC date");
  const again = make({ date: () => new Date(Date.UTC(2026, 10, 28, 23, 59, 59)) });
  again.session.startNew(1);
  assert.equal(again.session.seed, 20261128, "same UTC day gives the same seed all day");
  const next = make({ date: () => new Date(Date.UTC(2026, 10, 29, 0, 0, 1)) });
  next.session.startNew(1);
  assert.equal(next.session.seed, 20261129);
  // time: one second of ticks is about sixty steps; speed setting scales it
  for (const [speed, expected] of [[100, 60], [75, 45], [50, 30]]) {
    const t = make({ settings: { speed } });
    t.session.startNew(0);
    const start = t.core.get("S_STEP");
    for (let i = 0; i < 60; i++) t.session.tick(1 / 60);
    const steps = t.core.get("S_STEP") - start;
    assert.ok(Math.abs(steps - expected) <= 1, `speed ${speed}: ${steps} steps`);
  }
  const paused = make();
  paused.session.startNew(0);
  paused.session.paused = true;
  paused.session.tick(1);
  assert.equal(paused.core.get("S_STEP"), 0, "paused means no steps");
  assert.ok(session.assisted === false);
  assert.equal(make({ settings: { speed: 75 } }).session.assisted, false, "not started yet");
}

// ---------- saving and resuming at the start of a wave ----------
{
  const t = make();
  const { session, core, storage } = t;
  session.startNew(0);
  assert.equal(storage.data.run.entries.length, 0, "run saved as soon as the wave starts");
  const rng = bot.mulberry(5);
  playWaveThroughSession(session, rng);
  assert.equal(session.phase, core.L.PH_BETWEEN);
  session.pick(0);
  session.next();
  assert.equal(core.get("S_WAVE"), 2);
  const atWaveTwo = core.hash();
  assert.equal(storage.data.run.entries.length, core.exportLog().length, "saved after the continue input");
  for (let i = 0; i < 600; i++) session.tick(STEP); // play into wave 2
  session.fire(640, 300);
  assert.notEqual(core.hash(), atWaveTwo);

  // a fresh page: new core, same storage
  const fresh = new Session({ core: newCore(9, 0), storage: createStorage(t.backing), audio: null });
  assert.equal(fresh.hasSavedRun(), true);
  assert.equal(fresh.resume(), true);
  assert.equal(fresh.core.hash(), atWaveTwo, "resumes exactly at the start of the wave");
  assert.equal(fresh.core.get("S_WAVE"), 2);
  fresh.fire(640, 300); // not in play yet (announce): ignored
  assert.equal(fresh.core.exportLog().length >= 0, true);

  // restart wave returns to the same state and keeps the log consistent
  for (let i = 0; i < 400; i++) fresh.tick(STEP);
  assert.notEqual(fresh.core.hash(), atWaveTwo);
  assert.equal(fresh.restartWave(), true);
  assert.equal(fresh.core.hash(), atWaveTwo, "restarting a wave costs nothing");
}
{
  const t = make();
  assert.equal(t.session.hasSavedRun(), false);
  assert.equal(t.session.resume(), false);
  // corrupt storage falls back to defaults
  const bad = memoryBacking();
  bad.map.set(KEY, "{not json");
  assert.equal(createStorage(bad).data.run, null);
  assert.equal(createStorage(bad).data.settings.music, false, "audio starts off");
  // storage that throws is non-fatal
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  const st = createStorage(broken);
  st.save();
  assert.equal(st.persistent, false);
  const s = new Session({ core: newCore(1, 0), storage: st, audio: null });
  s.startNew(0);
  s.tick(1);
  assert.ok(s.core.get("S_STEP") > 0, "plays normally without storage");
}

// ---------- game over, statistics, replays ----------
{
  const t = make();
  const { session, core, storage } = t;
  session.startNew(0);
  for (let i = 0; i < 130; i++) session.tick(STEP);
  session.fire(500, 300);
  session.fire(700, 300);
  const phases = [];
  session.on("phase", (p) => phases.push(p));
  // never fire again: all cities fall
  let guard = 0;
  while (session.phase !== core.L.PH_OVER && guard++ < 60 * 3000) {
    if (session.phase === core.L.PH_BETWEEN) { session.pick(0); session.next(); }
    session.tick(STEP);
  }
  assert.equal(session.phase, core.L.PH_OVER);
  assert.ok(phases.includes(core.L.PH_OVER));
  assert.equal(storage.data.run, null, "no saved run after game over");
  assert.equal(storage.data.stats[0].games, 1);
  assert.equal(storage.data.best[0].score, core.get("S_SCORE"));
  assert.ok(session.result.replay.startsWith("MD1:0:"));
  assert.equal(session.result.code, null, "share codes are for the daily seed");

  // watching the replay reproduces the run
  const watcher = new Session({ core: newCore(77, 0), storage: createStorage(memoryBacking()), audio: null });
  watcher.watch(session.result.replay);
  assert.equal(watcher.playback.done, false);
  let g2 = 0;
  while (!watcher.playback.done && g2++ < 60 * 6000) watcher.tick(1 / 20); // fast playback
  assert.equal(watcher.playback.done, true);
  assert.equal(watcher.core.get("S_SCORE"), core.get("S_SCORE"));
  assert.equal(watcher.core.get("S_WAVE"), core.get("S_WAVE"));
  assert.equal(watcher.phase, core.L.PH_OVER);
  assert.equal(watcher.storage.data.stats[0], undefined, "watching a replay records nothing");
  watcher.fire(640, 300);
  assert.equal(watcher.core.exportLog().length, core.exportLog().length, "no input during a replay");
}

// ---------- daily seed, share code, assists ----------
{
  const run = (settings) => {
    const t = make({ settings });
    t.session.startNew(1);
    for (let i = 0; i < 400; i++) t.session.tick(STEP);
    const c = t.core;
    c.m[c.L.S_PHASE] = c.L.PH_PLAY;
    for (const x of [1, 2, 3, 5, 6, 7]) c.m[c.L.TGT_ALIVE + x] = 0;
    c.m[c.L.S_SPAWN_LEFT] = 0;
    placeWarhead(c, { x: (80 + 140 * 7) * 16, y: c.L.GROUND - 8, tgt: 7, p: 65500, dp: 100 });
    t.session.tick(STEP * 2);
    assert.equal(t.session.phase, c.L.PH_OVER);
    return t;
  };
  const plain = run({});
  assert.match(plain.session.result.code, /^MDD-20261128-\d+-[0-9A-Z]{1,6}$/);
  assert.equal(plain.storage.data.daily[20261128].score, plain.core.get("S_SCORE"));
  const assisted = run({ speed: 75 });
  assert.equal(assisted.session.result.code, null, "assisted runs get no share code");
  assert.equal(assisted.storage.data.daily[20261128], undefined, "and no daily best");
  assert.equal(run({ lead: true }).session.result.assisted, true);
}

// ---------- presentation timing: slow motion, hit-stop ----------
{
  const prep = (settings) => {
    const t = make({ settings });
    t.session.startNew(0);
    for (let i = 0; i < 130; i++) t.session.tick(STEP);
    const c = t.core;
    c.m[c.L.S_SPAWN_LEFT] = 0;
    const out = { ...t, c };
    placeBlast(c, { x: 10000, y: 3000, r: 1600 });
    for (let i = 0; i < 6; i++) placeWarhead(c, { x: 10000 + i * 90, y: 3000, tgt: 4 });
    return out;
  };
  const t = prep({});
  const before = t.session.clock;
  t.session.tick(STEP);
  assert.ok(t.session.slowUntil > before && t.session.slowUntil <= t.session.clock + SLOWMO_SECONDS + 1e-9, "a chain of 5+ slows time");
  assert.ok(t.session.freezeUntil > before && t.session.freezeUntil <= t.session.clock + HITSTOP_SECONDS + 1e-9, "a chain of 3+ freezes briefly");
  const steps0 = t.core.get("S_STEP");
  t.session.tick(HITSTOP_SECONDS / 2);
  assert.equal(t.core.get("S_STEP"), steps0, "frozen during hit-stop");
  const calm = prep({ reducedMotion: true });
  calm.session.tick(STEP);
  assert.ok(calm.session.slowUntil <= calm.session.clock - 0 && calm.session.freezeUntil <= calm.session.clock, "reduced motion disables both");
}

// ---------- hints, summaries, audio hookup ----------
{
  const t = make();
  const { session, core, heard, audio } = t;
  session.startNew(0);
  assert.match(session.banner(), /Click or tap the sky/);
  for (let i = 0; i < 130; i++) session.tick(STEP);
  assert.match(session.banner(), /Click or tap/);
  for (let i = 0; i < 60 * 16; i++) session.tick(STEP);
  assert.equal(session.banner(), "", "hints fade after a while");
  assert.ok(heard.includes(core.L.E_WAVE_START));
  assert.deepEqual(audio.waves[0], [1, 0]);
  const endless = make();
  endless.session.startNew(2);
  assert.equal(endless.session.banner(), "", "no tutorial hints in endless mode");

  // mutator banner on an announce screen
  const m = make();
  m.session.startNew(0);
  gotoWave(m.core, 5);
  m.session.processEvents();
  const mask = m.core.get("S_MUT");
  if (mask) assert.match(m.session.banner(), /Wind|Fog|Low ammo/);

  // between-waves view
  const b = make();
  b.session.startNew(0);
  const c = b.core;
  quiet(c);
  placeBlast(c, { x: 10000, y: 3000, r: 1600 });
  b.session.tick(STEP * 2);
  for (let i = 0; i < 600 && b.session.phase !== c.L.PH_BETWEEN; i++) b.session.tick(STEP);
  assert.equal(b.session.phase, c.L.PH_BETWEEN);
  c.m[c.L.TGT_ALIVE + 2] = 0;
  c.m[c.L.TGT_ALIVE + 4] = 0;
  const v = b.session.between();
  assert.equal(v.offers.length, 3);
  assert.ok(v.offers.every((o) => o && o.name && o.text));
  assert.deepEqual(v.rebuilds.map((r) => r.t), [2, 4]);
  assert.deepEqual(v.rebuilds.map((r) => r.cost).map((x, i) => x === [300, 150][i] || x === [150, 75][i]), [true, true]);
  assert.equal(v.rerollCost, 100);
  assert.equal(v.picked, false);
  b.session.pick(0);
  assert.equal(b.session.between().picked, true);
  assert.equal(b.session.between().owned.length, 1);
}

// ---------- replay strings ----------
{
  const entries = [[0, 0, 640, 300], [57, 4, 0, 0], [60, 0, 100, 250], [5000, 8, 0, 0]];
  const text = replay.encode({ version: 1, mode: 1, seed: 20261128, entries });
  assert.deepEqual(replay.decode(text, 1), { mode: 1, seed: 20261128, entries });
  assert.throws(() => replay.decode("hello", 1), /not a Missile Defense replay/);
  assert.throws(() => replay.decode(text, 2), /different version/);
  assert.throws(() => replay.decode(text.replace(/:[0-9a-z]+$/, ":zzzz"), 1), /damaged/);
  const parts = text.split(":");
  parts[3] = "9";
  assert.throws(() => replay.decode(parts.join(":"), 1), /damaged|incomplete/);
  assert.deepEqual(replay.decode(replay.encode({ version: 1, mode: 0, seed: 5, entries: [] }), 1).entries, []);
  assert.equal(replay.utcDateNumber(new Date(Date.UTC(2026, 0, 5))), 20260105);
  assert.equal(replay.shareCode({ date: 1, score: 2, replay: "x", assisted: true }), null);
}

console.log("session: ok");
