"use strict";
// The renderer is exercised against a recording canvas stand-in: it must draw every phase
// without errors, generate identical scenery from a seed, and respect the comfort options.
const assert = require("node:assert/strict");
const { Renderer, generateScenery, PARTICLE_CAP } = require("../client/render.cjs");
const { PERKS, PASSIVES, MUTATORS } = require("../client/content.cjs");
const { newCore, gotoWave, placeBlast, placeWarhead, toPlay } = require("./helpers.cjs");
const bot = require("./bot.cjs");

function fakeCanvas() {
  const calls = { n: 0, fillText: [] };
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (s) => ({ width: String(s).length * 8 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
      if (prop === "fillText") return (...a) => { calls.n++; calls.fillText.push(a[0]); };
      return () => { calls.n++; };
    },
    set(target, prop, value) { target[prop] = value; return true; },
  };
  const ctx = new Proxy({}, handler);
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls };
}

const view = (extra = {}) => ({ reticle: { x: 640, y: 300 }, selectedBattery: 1, perkNames: PERKS.map((p) => p.name), banner: "hint", tag: "REPLAY", ...extra });

// scenery depends only on the seed
{
  const a = generateScenery(77);
  const b = generateScenery(77);
  const c = generateScenery(78);
  assert.deepEqual(a.stars, b.stars);
  assert.deepEqual([...a.ground], [...b.ground]);
  assert.deepEqual(a.skylines, b.skylines);
  assert.notDeepEqual(a.stars, c.stars);
  for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    const x = 80 + 140 * t;
    assert.equal(a.ground[x], 650, "flat ground under every target");
  }
  assert.deepEqual(Object.keys(a.skylines).map(Number), [1, 2, 3, 5, 6, 7]);
}

// draws through every phase, with every option combination
for (const opts of [{}, { reducedMotion: true }, { reducedFlash: true }, { highContrast: true }]) {
  const core = newCore(4242);
  const { canvas, calls } = fakeCanvas();
  const r = new Renderer(canvas, core, { random: () => 0.5 });
  r.setOptions(opts);
  r.resize(960, 2);
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1080);
  r.setSeed(4242);
  const L = core.L;
  const frame = () => { r.addEvent && core.events().forEach((e) => r.addEvent(e, L)); r.update(1 / 60); r.draw(view()); };
  frame(); // announce
  for (let w = 1; w <= 6; w++) {
    let guard = 0;
    gotoWave(core, w);
    while (core.stepping() && guard++ < 6000) {
      if (core.get("S_PHASE") === L.PH_PLAY && guard % 25 === 0) core.input(0, 200 + ((guard * 37) % 880), 250);
      if (guard % 90 === 0) core.input(L.IN_DETONATE);
      core.step();
      if (guard % 3 === 0) frame();
    }
    frame(); // between waves / over
  }
  assert.ok(calls.n > 5000, "drew a lot of primitives");
  assert.ok(calls.fillText.some((t) => String(t).startsWith("SCORE")), "HUD is drawn");
}

// fog hides warheads until 40% of the way down; Observatory shows them
{
  const core = newCore(6);
  toPlay(core);
  core.set("S_MUT", 2);
  placeWarhead(core, { x: 8000, y: 800, tgt: 4, p: 1000 });
  const count = (r, fk) => { fk.calls.n = 0; r.draw(view()); return fk.calls.n; };
  const fk = fakeCanvas();
  const r = new Renderer(fk.canvas, core, { random: () => 0.5 });
  r.resize(1280, 1);
  const foggy = count(r, fk);
  core.set("S_MUT", 0);
  const clear = count(r, fk);
  assert.ok(clear > foggy, "a hidden warhead is not drawn");
}

// comfort options and limits
{
  const core = newCore(3);
  const L = core.L;
  const { canvas } = fakeCanvas();
  const r = new Renderer(canvas, core, { random: () => 0.3 });
  for (let i = 0; i < 100; i++) r.addEvent({ t: L.E_CITY_HIT, a: 2, b: 0, c: 0, d: 0 }, L);
  assert.ok(r.particles.length <= PARTICLE_CAP, "particle cap");
  const q = new Renderer(canvas, core, { random: () => 0.3 });
  q.setOptions({ reducedMotion: true });
  for (let i = 0; i < 100; i++) q.addEvent({ t: L.E_CITY_HIT, a: 2, b: 0, c: 0, d: 0 }, L);
  assert.ok(q.particles.length <= 600, "reduced motion uses fewer particles");
  assert.equal(q.shake, 0, "no screen shake with reduced motion");
  const f = new Renderer(canvas, core);
  f.setOptions({ reducedFlash: true });
  f.kick(10, 1);
  assert.equal(f.flash, 0, "no flashes with reduced flash");
  // at most 3 flashes in any second
  const g = new Renderer(canvas, core);
  let flashes = 0;
  for (let i = 0; i < 120; i++) {
    const before = g.flash;
    g.update(1 / 60);
    g.kick(0, 1);
    if (g.flash > before + 0.1) flashes++;
  }
  assert.ok(flashes <= 6, `at most 3 per second over 2 seconds, got ${flashes}`);
  // effects fade out
  for (let i = 0; i < 300; i++) r.update(1 / 30);
  assert.equal(r.particles.length, 0);
  assert.equal(r.rings.length, 0);
}

// content tables match the core
{
  const { consts: L } = require("./helpers.cjs").build();
  assert.equal(PERKS.length, 8);
  assert.deepEqual(PERKS.map((p) => p.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(PERKS.map((p) => L[`PK_${["CLUSTER", "LINGER", "MAGNET", "SHIELD", "EMP", "SALVO", "RECYCLE", "AMP"][p.id]}`]), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(PASSIVES.length, 8);
  assert.equal(new Set(PASSIVES.map((p) => p.letter)).size, 8, "unique badge letters");
  assert.deepEqual(Object.keys(MUTATORS).map(Number), [1, 2, 4]);
}

// a placed blast is drawn (blast code path with a full-size blast)
{
  const core = newCore(8);
  toPlay(core);
  placeBlast(core, { x: 8000, y: 4000, r: 1200 });
  core.step();
  const { canvas, calls } = fakeCanvas();
  const r = new Renderer(canvas, core);
  r.resize(1280, 1);
  r.draw(view());
  assert.ok(calls.n > 100);
  assert.ok(bot);
}

console.log("render: ok");
