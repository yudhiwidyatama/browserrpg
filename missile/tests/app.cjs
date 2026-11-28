"use strict";
// Smoke test of the packaged offline game: the built bundle runs against a DOM stand-in.
// It checks wiring (menus, input, pause, saving, replays), not pixels or real-browser behaviour.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { build, BUDGET } = require("../build.cjs");
const { createEnvironment } = require("./dom-stub.cjs");
const { placeWarhead } = require("./helpers.cjs");
const { mulberry } = require("./bot.cjs");

const seededRandom = mulberry(20261128);

const built = build();
assert.ok(built.wasmBytes < BUDGET.wasm && built.htmlBytes < BUDGET.html, "size budgets");

// the packaged game is fully offline: no external references of any kind
{
  const html = built.html;
  assert.ok(!/\b(src|href)\s*=\s*["']?(https?:)?\/\//i.test(html), "no external src/href");
  assert.ok(!/url\(\s*["']?https?:/i.test(html), "no external css urls");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|importScripts|new\s+Worker\(/.test(built.script), "no network or worker calls");
  assert.ok(!/<script[^>]+src=/i.test(html), "scripts are inline");
  assert.ok(!/@import|<link[^>]+stylesheet/i.test(html), "no external stylesheets");
}

function boot(env) {
  const context = vm.createContext({
    document: env.doc, window: env.win, WebAssembly, console,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    setInterval: () => 1, // music scheduling is exercised in tests/audio.cjs
    clearInterval: () => {},
    Uint8Array, Date, JSON, Object, Array, Set, Map, Number, String, Error, Promise,
    Math: Object.assign(Object.create(Math), { random: seededRandom }), // fixed seeds keep this test reproducible
  });
  vm.runInContext(built.script, context);
  return env.win.__missileDefense;
}
const setup = (opts) => {
  const env = createEnvironment(opts);
  const app = boot(env);
  return { env, app, L: app.core.L, core: app.core, session: app.session };
};
const pointer = (type, x, y, extra = {}) => ({ clientX: x, clientY: y, button: 0, pointerType: "mouse", pointerId: 1, ...extra });

// ---------- menu ----------
{
  const { env, session } = setup();
  assert.match(env.text(env.ui()), /Missile Defense/);
  for (const re of [/Campaign/, /Daily seed/, /Endless/, /Watch a replay/, /Settings/]) env.button(re);
  assert.equal(env.buttons().some((b) => /Continue run/.test(b.textContent)), false, "no saved run yet");
  assert.equal(session.running, false);
  env.run(3);
  assert.ok(env.canvas().calls.n > 100, "the playfield is drawn behind the menu");
  assert.equal(env.canvas().width, 1280);
}

// ---------- playing: mouse, keyboard, pause ----------
{
  const { env, core, session, L } = setup();
  env.button(/Campaign/).click();
  assert.equal(session.running, true);
  assert.equal(env.ui().hidden, true, "menu closes");
  env.run(130);
  assert.equal(session.phase, L.PH_PLAY, "announce countdown finishes");
  const calls0 = env.canvas().calls.text.length;
  assert.ok(calls0 > 0);
  assert.ok(env.canvas().calls.text.some((t) => /^SCORE/.test(t)));

  const ammo = () => [0, 1, 2].map((b) => core.m[L.BAT_AMMO + b]);
  const before = ammo().reduce((a, b) => a + b);
  const canvas = env.canvas();
  canvas.dispatch("pointerdown", pointer("pointerdown", 640, 300));
  assert.equal(ammo().reduce((a, b) => a + b), before - 1, "click fires");
  const e = canvas.dispatch("pointerdown", pointer("pointerdown", 0, 0, { button: 2 }));
  assert.equal(core.m[L.IC_ACT], 0, "right-click detonates the latest interceptor");
  canvas.dispatch("contextmenu");

  env.win.key("keydown", "1");
  assert.equal(session.selectedBattery, 0);
  const first0 = core.m[L.BAT_AMMO + 0];
  canvas.dispatch("pointerdown", pointer("pointerdown", 900, 300));
  assert.equal(core.m[L.BAT_AMMO + 0], first0 - 1, "battery 1 was forced");
  env.win.key("keydown", "1");
  assert.equal(session.selectedBattery, -1, "pressing again clears it");
  env.win.key("keydown", "ArrowLeft");
  env.run(10);
  env.win.key("keyup", "ArrowLeft");
  env.win.key("keydown", " ");
  env.win.key("keydown", "d");
  assert.ok(e);

  // pause
  const steps = core.get("S_STEP");
  env.win.key("keydown", "p");
  assert.match(env.text(env.ui()), /Paused/);
  env.run(30);
  assert.equal(core.get("S_STEP"), steps, "no steps while paused");
  canvas.dispatch("pointerdown", pointer("pointerdown", 640, 300));
  env.win.key("keydown", "Escape");
  assert.equal(env.ui().hidden, true);
  env.run(30);
  assert.ok(core.get("S_STEP") > steps, "resumes");
  env.doc.hidden = true;
  env.doc.dispatch("visibilitychange");
  assert.match(env.text(env.ui()), /Paused/, "pauses when the page is hidden");
  env.button(/Resume/).click();

  // touch: drag to aim, release to fire
  const total = ammo().reduce((a, b) => a + b);
  canvas.dispatch("pointerdown", pointer("pointerdown", 600, 400, { pointerType: "touch" }));
  assert.equal(ammo().reduce((a, b) => a + b), total, "a touch does not fire until release");
  canvas.dispatch("pointermove", pointer("pointermove", 700, 420, { pointerType: "touch" }));
  canvas.dispatch("pointerup", pointer("pointerup", 700, 420, { pointerType: "touch" }));
  assert.equal(ammo().reduce((a, b) => a + b), total - 1);
  const tx = core.m[L.IC_TX + [...Array(L.N_IC).keys()].find((i) => core.m[L.IC_ACT + i] && core.m[L.IC_TX + i] === 700 * 16 && core.m[L.IC_TY + i] === 340 * 16)];
  assert.equal(tx, 700 * 16, "the reticle floats 80 px above the finger");
  env.run(2);
  assert.equal(env.doc.getElementById("detBtn").hidden, false, "the detonate button appears for touch players");
}

// ---------- between waves ----------
{
  const { env, core, session, L } = setup();
  env.button(/Campaign/).click();
  env.run(130);
  core.m[L.S_SPAWN_LEFT] = 0;
  env.run(10);
  assert.equal(session.phase, L.PH_BETWEEN);
  assert.match(env.text(env.ui()), /Wave 1 cleared/);
  const perks = env.buttons().filter((b) => b.classes.has("perk"));
  assert.equal(perks.length, 3);
  const go = env.button(/Pick a perk to continue/);
  assert.equal(go.disabled, true, "cannot continue before choosing");
  core.m[L.TGT_ALIVE + 2] = 0;
  core.m[L.S_FUNDS] = 1000;
  perks[1].click();
  assert.match(env.text(env.ui()), /Perk chosen/);
  assert.equal(env.buttons().filter((b) => b.classes.has("perk")).every((b) => b.disabled), true, "one pick only");
  env.button(/City \d \(\d+\)/).click();
  assert.equal(core.m[L.TGT_ALIVE + 2], 1, "rebuild button works");
  env.button(/Start wave 2/).click();
  assert.equal(core.get("S_WAVE"), 2);
  assert.equal(env.ui().hidden, true);
  assert.equal(session.storage.data.run.entries.length > 0, true);
}

// ---------- game over, replay export, watching ----------
let replayText;
{
  const { env, core, session, L } = setup();
  env.button(/Campaign/).click();
  env.run(130);
  for (const t of [1, 2, 3, 5, 6]) core.m[L.TGT_ALIVE + t] = 0;
  core.m[L.S_SPAWN_LEFT] = 0;
  placeWarhead(core, { x: (80 + 140 * 7) * 16, y: L.GROUND - 8, tgt: 7, p: 65500, dp: 100 });
  env.run(5);
  assert.equal(session.phase, L.PH_OVER);
  assert.match(env.text(env.ui()), /Game over/);
  const box = env.ui().findAll((c) => c.tagName === "TEXTAREA")[0];
  replayText = box.value;
  assert.match(replayText, /^MD1:0:/);
  env.button(/Menu/).click();
  assert.match(env.text(env.ui()), /Campaign: best/, "best score is shown");

  // watch it
  env.button(/Watch a replay/).click();
  const ta = env.ui().findAll((c) => c.tagName === "TEXTAREA")[0];
  ta.value = "nonsense";
  env.button(/^Watch$/).click();
  assert.match(env.text(env.ui()), /not a Missile Defense replay/);
  ta.value = replayText;
  env.button(/^Watch$/).click();
  assert.ok(session.playback, "playback started");
  env.run(1);
  assert.equal(env.doc.getElementById("stopBtn").hidden, false, "stop button shows while watching");
  for (let i = 0; i < 4000 && !session.playback.done; i++) env.run(1, 400);
  assert.equal(session.playback.done, true);
  assert.match(env.text(env.ui()), /Replay finished/);
}

// ---------- settings, audio starts off, persistence ----------
{
  class Ctx {
    constructor() { Ctx.made++; this.currentTime = 0; this.sampleRate = 8000; this.state = "running"; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
    createDynamicsCompressor() { return { threshold: {}, ratio: {}, connect() {} }; }
    createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: {}, connect() {} }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    suspend() { this.state = "suspended"; }
    resume() { this.state = "running"; }
  }
  Ctx.made = 0;
  const { env, session, app } = setup({ AudioContext: Ctx });
  assert.equal(Ctx.made, 0, "no audio context at page load");
  assert.equal(app.audio.sfx, false);
  assert.equal(app.audio.music, false);
  env.button(/Settings/).click();
  const boxes = env.ui().findAll((c) => c.tagName === "INPUT");
  const byId = (id) => boxes.find((b) => b.attrs.id === id);
  assert.equal(byId("opt-music").checked, false);
  assert.equal(byId("opt-sfx").checked, false);
  byId("opt-sfx").checked = true;
  byId("opt-sfx").dispatch("change");
  assert.equal(app.audio.sfx, true);
  assert.equal(Ctx.made, 1, "the switch is the user gesture that starts audio");
  byId("opt-reducedMotion").checked = true;
  byId("opt-reducedMotion").dispatch("change");
  byId("opt-highContrast").checked = true;
  byId("opt-highContrast").dispatch("change");
  assert.equal(env.doc.body.classes.has("hc"), true);
  const speed = env.ui().findAll((c) => c.tagName === "SELECT").find((s) => s.attrs.id === "opt-speed");
  speed.value = "75";
  speed.dispatch("change");
  assert.equal(session.settings.speed, 75);
  env.button(/Back/).click();
  const saved = JSON.parse(env.store.get("missiledefense.v1"));
  assert.equal(saved.settings.reducedMotion, true);
  assert.equal(saved.settings.speed, 75);

  // a new page load: audio is off again, but the other settings are remembered
  const second = setup({ AudioContext: Ctx, backing: env.store });
  assert.equal(second.app.audio.sfx, false, "sound starts off on every load");
  assert.equal(second.session.settings.reducedMotion, true);
  assert.equal(second.session.settings.speed, 75);

  // M toggles both channels
  second.env.button(/Campaign/).click();
  second.env.win.key("keydown", "m");
  assert.equal(second.app.audio.sfx, true);
  assert.equal(second.app.audio.music, true);
  second.env.win.key("keydown", "m");
  assert.equal(second.app.audio.music, false);
}

// ---------- continue a saved run after a page reload ----------
{
  const first = setup();
  first.env.button(/Campaign/).click();
  // play wave 1 through the real input path (memory edits are not recorded, so they cannot be replayed)
  const { core: fc, L: fl, env: fe } = first;
  for (let i = 0; i < 60 * 300 && first.session.phase !== fl.PH_BETWEEN; i++) {
    if (fc.get("S_PHASE") === fl.PH_PLAY && i % 24 === 0) {
      const w = [...Array(fl.N_WH).keys()].find((k) => fc.m[fl.WH_ACT + k]);
      if (w !== undefined) fe.canvas().dispatch("pointerdown", pointer("pointerdown", fc.m[fl.WH_X + w] / 16, fc.m[fl.WH_Y + w] / 16 + 90));
    }
    fe.run(1);
  }
  assert.equal(first.session.phase, fl.PH_BETWEEN, "wave 1 played through input");
  first.env.buttons().filter((b) => b.classes.has("perk"))[0].click();
  first.env.button(/Start wave 2/).click();
  const hash = first.core.hash();
  const second = setup({ backing: first.env.store });
  const cont = second.env.button(/Continue run/);
  assert.match(cont.textContent, /wave 2/);
  cont.click();
  assert.equal(second.core.get("S_WAVE"), 2);
  assert.equal(second.core.hash(), hash, "the reloaded page resumes at the start of the wave");
  second.env.run(5);
}

// ---------- storage that throws, and the daily button ----------
{
  const env = createEnvironment();
  env.win.localStorage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  const app = boot(env);
  assert.match(env.text(env.ui()), /storage is unavailable/);
  env.button(/Daily seed/).click();
  assert.equal(app.session.mode, 1);
  env.run(30);
  assert.ok(app.core.get("S_STEP") > 0);
}

console.log("app: ok");
