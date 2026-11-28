"use strict";
const assert = require("node:assert/strict");
const { build, newCore, runUntil, toPlay, px, placeWarhead, placeBlast, quiet, findSeed, gotoWave, passiveOf } = require("./helpers.cjs");
const bot = require("./bot.cjs");

const KILL = (evs) => evs.filter((e) => e.t === 3);
const OF = (evs, t) => evs.filter((e) => e.t === t);
const activeCount = (core, base, n) => {
  let c = 0;
  for (let i = 0; i < n; i++) if (core.m[base + i]) c++;
  return c;
};

// ---------- size and shape ----------
{
  const { wasm, exports } = build();
  assert.ok(wasm.length < 300 * 1024, `wasm is ${wasm.length} bytes, budget is 300 KB`);
  for (const name of ["init", "step", "input", "pump", "hash", "replay_begin", "replay_end", "clear_events"]) assert.ok(exports.includes(name), name);
}

// ---------- initial state ----------
{
  const c = newCore(42);
  const { L } = c;
  assert.equal(c.get("S_PHASE"), L.PH_ANNOUNCE);
  assert.equal(c.get("S_WAVE"), 1);
  assert.equal(c.get("S_SPAWN_TOTAL"), 8);
  assert.equal(c.cities(), 6);
  assert.deepEqual([0, 1, 2].map((b) => c.m[L.BAT_AMMO + b]).map((a, i) => a - c.m[L.BAT_AMMO + i] + [10, 8, 12][i]), [10, 8, 12]);
  const ammo = [0, 1, 2].map((b) => c.m[L.BAT_AMMO + b]);
  const depot = passiveOf(c, 4) >= 0 ? 1 : 0;
  assert.deepEqual(ammo, [10 + depot, 8 + depot, 12 + depot]);
  const pass = [1, 2, 3, 5, 6, 7].map((t) => c.m[L.TGT_PASS + t]);
  assert.equal(new Set(pass).size, 6, "six distinct passives");
  assert.ok(pass.every((p) => p >= 0 && p < 8));
  assert.deepEqual([0, 4, 8].map((t) => c.m[L.TGT_PASS + t]), [-1, -1, -1]);
  assert.equal(runUntil(c, (k) => k.get("S_PHASE") === L.PH_PLAY, 500), 120, "two-second announce");
  const ev = c.events();
  assert.equal(OF(ev, L.E_WAVE_START).length, 1);
}

// ---------- firing ----------
{
  const c = newCore(5);
  const { L, m } = c;
  quiet(c);
  m[L.S_WIND] = 0;
  const ammo = (b) => m[L.BAT_AMMO + b];
  const a1 = ammo(1);
  c.input(0, 640, 300); // nearest battery to x = 640 is the centre one
  assert.equal(ammo(1), a1 - 1);
  assert.equal(OF(c.events(), L.E_LAUNCH)[0].a, 1);
  assert.equal(activeCount(c, L.IC_ACT, L.N_IC), 1);
  const a0 = ammo(0);
  c.input(1, 100, 300); // explicit battery 0
  assert.equal(ammo(0), a0 - 1);
  const a2 = ammo(2);
  c.input(3, 1100, 300); // salvo battery fires two interceptors for one round
  assert.equal(ammo(2), a2 - 1);
  assert.equal(activeCount(c, L.IC_ACT, L.N_IC), 1 + 1 + 2);
  m[L.BAT_AMMO + 1] = 0;
  c.events();
  c.input(2, 640, 300);
  assert.equal(OF(c.events(), L.E_EMPTY).length, 1, "empty battery clicks");
  m[L.TGT_ALIVE + 0] = 0;
  c.input(1, 100, 300);
  assert.equal(OF(c.events(), L.E_EMPTY).length, 1, "destroyed battery cannot fire");
  // aim is clamped above the ground line
  const c2 = newCore(5);
  quiet(c2);
  c2.input(0, 640, 700);
  assert.ok(c2.m[c2.L.IC_TY] <= 610 * 16);
}

// ---------- flight time, detonation, manual detonation, wind ----------
{
  const c = newCore(5);
  const { L, m } = c;
  quiet(c);
  m[L.S_WIND] = 0;
  c.input(2, 640, 300);
  c.events();
  const steps = runUntil(c, () => OF(c.events(), L.E_DETONATE).length > 0, 400);
  assert.ok(steps > 55 && steps < 75, `centre battery flight of 336 px takes about 63 steps, got ${steps}`);

  const d = newCore(5);
  quiet(d);
  d.m[d.L.S_WIND] = 0;
  d.input(2, 640, 300);
  d.events();
  for (let i = 0; i < 20; i++) d.step();
  assert.equal(activeCount(d, d.L.IC_ACT, d.L.N_IC), 1, "still in flight");
  d.input(d.L.IN_DETONATE);
  const ev = OF(d.events(), d.L.E_DETONATE);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].a, 1, "manual flag");
  assert.ok(ev[0].c > 300 && ev[0].c < 636, "blast centred where the interceptor was");
  assert.equal(activeCount(d, d.L.IC_ACT, d.L.N_IC), 0);
  assert.equal(activeCount(d, d.L.BL_ACT, d.L.N_BL), 1);
  d.input(d.L.IN_DETONATE);
  assert.equal(OF(d.events(), d.L.E_DETONATE).length, 0, "nothing left to detonate");

  const w = newCore(5);
  quiet(w);
  w.m[w.L.S_WIND] = 10;
  w.input(2, 640, 300);
  w.events();
  let det;
  for (let i = 0; i < 200 && !det; i++) { w.step(); det = OF(w.events(), w.L.E_DETONATE)[0]; }
  assert.ok(det.b > 660, `wind pushes the interceptor sideways, got x=${det.b}`);
}

// ---------- kills, chains, scoring ----------
{
  const c = newCore(9);
  const { L, m } = c;
  quiet(c);
  const base = m[L.S_SCORE];
  placeBlast(c, { x: 10000, y: 3000, r: 1400 });
  for (let i = 0; i < 3; i++) placeWarhead(c, { x: 10000 + i * 200, y: 3000, tgt: 4 });
  c.step();
  const kills = KILL(c.events());
  assert.deepEqual(kills.map((k) => k.d), [25, 75, 125], "chain of 3 awards 25 * n * n in total");
  assert.deepEqual(kills.map((k) => k.a), [1, 2, 3]);
  assert.equal(c.get("S_BEST_CHAIN"), 3);
  assert.equal(m[L.S_SCORE] - base >= 225, true);
}
{
  // cap: a chain of n awards n * 25 * n up to n = 12, so at most 3,600
  const c = newCore(9);
  const { L } = c;
  quiet(c);
  placeBlast(c, { x: 10000, y: 3000, r: 1600 });
  for (let i = 0; i < 14; i++) placeWarhead(c, { x: 10000 + (i % 7) * 100, y: 3000 + Math.floor(i / 7) * 100, tgt: 4 });
  c.step();
  const kills = KILL(c.events());
  assert.equal(kills.length, 14);
  assert.equal(kills.reduce((s, k) => s + k.d, 0), 3600);
}
{
  // secondary blasts: one generation by default, one more with Chain amplifier
  for (const amp of [0, 1]) {
    const c = newCore(9);
    const { L, m } = c;
    quiet(c, { hold: true });
    m[L.PK_LVL + L.PK_AMP] = amp;
    const parent = placeBlast(c, { x: 10000, y: 3000, r: 1000 });
    placeWarhead(c, { x: 10000, y: 3000, tgt: 4 });
    c.step();
    m[L.BL_ACT + parent] = 0; // only the secondary blast should catch the next warhead
    const secondary = [];
    for (let b = 0; b < L.N_BL; b++) if (m[L.BL_ACT + b] && m[L.BL_GEN + b] === 1) secondary.push(b);
    assert.equal(secondary.length, 1, "a kill creates one secondary blast");
    assert.equal(m[L.BL_RMAX + secondary[0]], 400, "40% of the radius that destroyed it");
    assert.equal(m[L.BL_CHAIN + secondary[0]], 777, "secondary blasts keep the chain");
    placeWarhead(c, { x: m[L.BL_X + secondary[0]], y: m[L.BL_Y + secondary[0]], tgt: 4 });
    c.step();
    let gen2 = 0;
    for (let b = 0; b < L.N_BL; b++) if (m[L.BL_ACT + b] && m[L.BL_GEN + b] === 2) gen2++;
    assert.equal(gen2, amp, amp ? "Chain amplifier allows a second generation" : "secondary blasts do not chain");
  }
}
{
  // last-second save: a kill within 40 px of a standing target is worth 50 more
  const c = newCore(9);
  const { L } = c;
  quiet(c);
  const near = (80 + 140 * 2) * 16;
  placeBlast(c, { x: near, y: L.GROUND - 300, r: 1200 });
  placeWarhead(c, { x: near, y: L.GROUND - 300, tgt: 2 });
  c.step();
  assert.equal(KILL(c.events())[0].d, 25 + 50);
}

// ---------- impacts, shields, game over ----------
{
  const c = newCore(9);
  const { L, m } = c;
  quiet(c, { hold: true });
  placeWarhead(c, { x: (80 + 140) * 16, y: L.GROUND - 8, tgt: 1, p: 65500, dp: 100 });
  c.step();
  assert.equal(OF(c.events(), L.E_CITY_HIT)[0].a, 1);
  assert.equal(m[L.TGT_ALIVE + 1], 0);
  assert.equal(c.cities(), 5);
  placeWarhead(c, { x: 80 * 16, y: L.GROUND - 8, tgt: 0, p: 65500, dp: 100 });
  c.step();
  assert.equal(OF(c.events(), L.E_BAT_HIT).length, 1);
  assert.equal(m[L.BAT_AMMO + 0], 0, "a destroyed battery loses its ammunition");
}
{
  const c = newCore(9);
  const { L, m } = c;
  m[L.PK_LVL + L.PK_SHIELD] = 2;
  gotoWave(c, 2);
  assert.deepEqual([1, 2, 3].map((t) => m[L.TGT_SHIELD + t]), [1, 1, 0], "two leftmost standing cities are shielded");
  quiet(c, { hold: true });
  placeWarhead(c, { x: (80 + 140) * 16, y: L.GROUND - 8, tgt: 1, p: 65500, dp: 100 });
  c.step();
  assert.equal(OF(c.events(), L.E_SHIELD).length, 1);
  assert.equal(m[L.TGT_ALIVE + 1], 1, "shield absorbed the hit");
  placeWarhead(c, { x: (80 + 140) * 16, y: L.GROUND - 8, tgt: 1, p: 65500, dp: 100 });
  c.step();
  assert.equal(m[L.TGT_ALIVE + 1], 0, "only one hit per wave");
}
{
  const c = newCore(9);
  const { L, m } = c;
  quiet(c);
  for (const t of [1, 2, 3, 5, 6]) m[L.TGT_ALIVE + t] = 0;
  placeWarhead(c, { x: (80 + 140 * 7) * 16, y: L.GROUND - 8, tgt: 7, p: 65500, dp: 100 });
  c.step();
  assert.equal(c.get("S_PHASE"), L.PH_OVER);
  assert.equal(OF(c.events(), L.E_OVER).length, 1);
  const before = c.hash();
  c.step();
  assert.equal(c.hash(), before, "nothing advances after game over");
  c.input(0, 600, 300);
  assert.equal(OF(c.events(), L.E_LAUNCH).length, 0, "cannot fire after game over");
}

// ---------- warhead behaviour ----------
{
  const c = newCore(9);
  const { L, m } = c;
  gotoWave(c, 4);
  quiet(c);
  const s = placeWarhead(c, { x: 10000, y: 2000, tgt: 4, type: 1, p: 26000, dp: 400 });
  m[L.WH_TX + s] = 10000;
  c.step();
  c.step();
  const alive = activeCount(c, L.WH_ACT, L.N_WH);
  assert.ok(alive === 2 || alive === 3, `a splitter becomes 2 or 3 warheads, got ${alive}`);
  assert.equal(OF(c.events(), L.E_SPLIT).length, 1);
}
{
  // a warhead falls in a straight line and arrives exactly when its progress completes
  const c = newCore(9);
  const { L, m } = c;
  quiet(c);
  const sx = 4000;
  const s = placeWarhead(c, { x: sx, y: 0, tgt: 4, dp: 1000 });
  m[L.WH_TX + s] = 640 * 16;
  m[L.WH_P + s] = 0;
  c.step();
  const x1 = m[L.WH_X + s];
  const y1 = m[L.WH_Y + s];
  c.step();
  const dx = m[L.WH_X + s] - x1;
  const dy = m[L.WH_Y + s] - y1;
  assert.ok(Math.abs(dx / dy - (640 * 16 - sx) / L.GROUND) < 0.01, "straight line");
}

// ---------- perks ----------
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_CLUSTER] = 1;
  m[L.S_WIND] = 0;
  c.input(2, 640, 300);
  runUntil(c, () => activeCount(c, L.BL_ACT, L.N_BL) > 0, 200);
  assert.equal(activeCount(c, L.BL_ACT, L.N_BL), 3, "Cluster: three blasts");
}
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_LINGER] = 1;
  m[L.S_WIND] = 0;
  const plain = newCore(31);
  quiet(plain);
  plain.m[plain.L.S_WIND] = 0;
  c.input(2, 640, 300);
  plain.input(2, 640, 300);
  runUntil(c, () => activeCount(c, L.BL_ACT, L.N_BL) > 0, 200);
  runUntil(plain, () => activeCount(plain, L.BL_ACT, L.N_BL) > 0, 200);
  assert.equal(m[L.BL_HOLD + [...Array(L.N_BL).keys()].find((b) => m[L.BL_ACT + b])], 60, "Lingering: hold time doubles");
  const rLing = m[L.BL_RMAX + [...Array(L.N_BL).keys()].find((b) => m[L.BL_ACT + b])];
  const rPlain = plain.m[plain.L.BL_RMAX + [...Array(L.N_BL).keys()].find((b) => plain.m[L.BL_ACT + b])];
  assert.equal(rLing, Math.floor((rPlain * 80) / 100), "Lingering: radius x0.8");
}
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_SALVO] = 1;
  const a = m[L.BAT_AMMO + 1];
  c.input(2, 640, 300);
  assert.equal(activeCount(c, L.IC_ACT, L.N_IC), 2, "Salvo perk: two interceptors");
  assert.equal(m[L.BAT_AMMO + 1], a - 1, "for one round");
  c.input(c.L.IN_DETONATE);
  assert.equal(activeCount(c, L.IC_ACT, L.N_IC), 0, "one tap detonates both together");
}
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_EMP] = 1;
  const w = placeWarhead(c, { x: 10000, y: 3000, tgt: 4 });
  placeBlast(c, { x: 10000, y: 3000 + 1100, r: 1000 }); // warhead is outside the blast, inside 1.5x
  c.step();
  assert.ok(m[L.WH_SLOW + w] > 0 && m[L.WH_ACT + w] === 1, "EMP field slows without killing");
}
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_MAGNET] = 1;
  const w = placeWarhead(c, { x: 12000, y: 3000, tgt: 4 });
  const b = placeBlast(c, { x: 10000, y: 3000, r: 500 });
  m[L.BL_AGE + b] = 0;
  m[L.BL_GROW + b] = 20;
  const x0 = m[L.BL_X + b];
  c.step();
  assert.ok(m[L.BL_X + b] > x0, "Magnetic: blast drifts toward the nearest warhead");
  assert.equal(m[L.WH_ACT + w], 1);
}
{
  const c = newCore(31);
  const { L, m } = c;
  quiet(c);
  m[L.PK_LVL + L.PK_RECYCLE] = 1;
  const before = m[L.BAT_AMMO + 0];
  placeBlast(c, { x: 10000, y: 3000, r: 1600, bat: 0 });
  for (let i = 0; i < 5; i++) placeWarhead(c, { x: 10000 + i * 100, y: 3000, tgt: 4 });
  c.step();
  assert.equal(m[L.BAT_AMMO + 0], before + 1, "Recycler: the 5th kill refunds one interceptor");
}

// ---------- draft, funds, rebuilds ----------
{
  const c = newCore(77);
  const { L, m } = c;
  quiet(c);
  placeBlast(c, { x: 10000, y: 3000, r: 1600 });
  c.step();
  runUntil(c, (k) => k.get("S_PHASE") === L.PH_BETWEEN, 3000);
  const offers = [0, 1, 2].map((i) => m[L.S_OFFER + i]);
  assert.equal(new Set(offers).size, 3);
  assert.ok(offers.every((o) => o >= 0 && o < 8));
  c.input(L.IN_CONTINUE);
  assert.equal(c.get("S_PHASE"), L.PH_BETWEEN, "cannot continue before picking a perk");
  c.input(L.IN_PICK, 1);
  assert.equal(m[L.PK_LVL + offers[1]], 1);
  c.input(L.IN_PICK, 0);
  assert.equal(m[L.PK_LVL + offers[0]], 0, "only one pick per draft");
  c.input(L.IN_CONTINUE);
  assert.equal(c.get("S_WAVE"), 2);
  assert.equal(c.get("S_PHASE"), L.PH_ANNOUNCE);
}
{
  const c = newCore(77);
  const { L, m } = c;
  quiet(c);
  m[L.S_FUNDS] = 1000;
  runUntil(c, (k) => k.get("S_PHASE") === L.PH_BETWEEN, 3000);
  m[L.S_FUNDS] = 1000;
  const first = [0, 1, 2].map((i) => m[L.S_OFFER + i]).join();
  c.input(L.IN_REROLL);
  assert.equal(m[L.S_FUNDS], 900, "first reroll costs 100");
  c.input(L.IN_REROLL);
  assert.equal(m[L.S_FUNDS], 750, "second costs 150");
  assert.equal(m[L.S_REROLLS], 2);
  m[L.S_FUNDS] = 50;
  c.input(L.IN_REROLL);
  assert.equal(m[L.S_FUNDS], 50, "cannot afford a reroll");
  assert.ok(first.length > 0);
}
{
  const c = newCore(77);
  const { L, m } = c;
  quiet(c);
  runUntil(c, (k) => k.get("S_PHASE") === L.PH_BETWEEN, 3000);
  const harbour = passiveOf(c, 5);
  m[L.S_FUNDS] = 1000;
  m[L.TGT_ALIVE + 2] = 0;
  m[L.TGT_ALIVE + 4] = 0;
  const half = harbour >= 0 && m[L.TGT_ALIVE + harbour] === 1;
  c.input(L.IN_REBUILD, 2);
  assert.equal(m[L.S_FUNDS], 1000 - (half ? 150 : 300));
  c.input(L.IN_REBUILD, 4);
  assert.equal(m[L.S_FUNDS], 1000 - (half ? 150 : 300) - 150, "Harbour discount applies once per wave");
  m[L.S_FUNDS] = 10;
  m[L.TGT_ALIVE + 3] = 0;
  c.input(L.IN_REBUILD, 3);
  assert.equal(m[L.TGT_ALIVE + 3], 0, "cannot rebuild without funds");
}
{
  // end-of-wave bonuses with a perfect first wave, funds = 25% of the wave score
  const seed = findSeed((k) => passiveOf(k, 2) < 0); // no Bank
  const c = newCore(seed);
  const { L, m } = c;
  bot.playWave(c, { skill: 0, gap: 20 });
  assert.equal(c.get("S_PHASE"), L.PH_BETWEEN);
  assert.equal(m[L.S_SUM_CITY], 600);
  assert.equal(m[L.S_SUM_CLEAN], 200, "clean wave bonus");
  assert.equal(m[L.S_SUM_THRIFTY], 150, "thrifty wave bonus");
  assert.equal(m[L.S_SUM_AMMO], 5 * ([0, 1, 2].reduce((s, b) => s + m[L.BAT_AMMO + b], 0)));
  const wave = m[L.S_SUM_KILLS] + m[L.S_SUM_CITY] + m[L.S_SUM_AMMO] + m[L.S_SUM_CLEAN] + m[L.S_SUM_THRIFTY];
  assert.equal(m[L.S_SUM_FUNDS], Math.floor(wave / 4));
  assert.equal(m[L.S_FUNDS], m[L.S_SUM_FUNDS]);
  assert.equal(m[L.S_SCORE], wave);
}
{
  const seed = findSeed((k) => passiveOf(k, 2) >= 0);
  const c = newCore(seed);
  bot.playWave(c, { skill: 0, gap: 20 });
  const wave = c.get("S_SUM_KILLS") + c.get("S_SUM_CITY") + c.get("S_SUM_AMMO") + c.get("S_SUM_CLEAN") + c.get("S_SUM_THRIFTY");
  assert.equal(c.get("S_SUM_FUNDS"), Math.floor((Math.floor(wave / 4) * 115) / 100), "Bank passive adds 15%");
}

// ---------- campaign flow ----------
{
  const c = newCore(8);
  const { L, m } = c;
  m[L.TGT_ALIVE + 2] = 0;
  gotoWave(c, 5);
  quiet(c);
  c.step();
  assert.equal(m[L.TGT_ALIVE + 2], 1, "a free city is rebuilt after every 5th wave");
  assert.equal(OF(c.events(), L.E_REBUILD)[0].b, 1);
}
{
  const c = newCore(8);
  const { L } = c;
  gotoWave(c, 30);
  assert.equal(c.get("S_SPAWN_TOTAL"), 80, "wave 30 is double sized");
  quiet(c);
  c.step();
  assert.equal(c.get("S_PHASE"), L.PH_WON);
  assert.equal(OF(c.events(), L.E_WON).length, 1);
  c.input(L.IN_CONTINUE);
  assert.equal(c.get("S_WAVE"), 31);
  assert.equal(c.get("S_ENDLESS"), 1);
  const e = newCore(8, 2);
  gotoWave(e, 30);
  quiet(e);
  e.step();
  assert.equal(e.get("S_PHASE"), e.L.PH_BETWEEN, "endless mode never ends in victory");
}
{
  // wave sizes and calm waves
  const sizes = [];
  const c = newCore(8);
  for (const w of [1, 2, 4, 8, 16, 17, 20]) { gotoWave(c, w); sizes.push(c.get("S_SPAWN_TOTAL")); }
  assert.deepEqual(sizes, [8, 10, Math.floor((14 * 6) / 10), Math.floor((22 * 6) / 10), Math.floor((38 * 6) / 10), 40, Math.floor((40 * 6) / 10)]);
}

// ---------- mutators ----------
{
  const c = newCore(3);
  const { L, m } = c;
  const count = (mask) => [1, 2, 4].filter((b) => mask & b).length;
  const expect = { 1: 0, 4: 0, 5: 1, 6: 0, 8: 1, 9: 0, 11: 1, 19: 0, 20: 1, 21: 1, 22: 1, 25: 1, 26: 2, 27: 2 };
  for (const [w, n] of Object.entries(expect)) {
    gotoWave(c, +w);
    assert.equal(count(m[L.S_MUT]), n, `wave ${w} mutators`);
  }
  let seenWind = false;
  for (let s = 1; s < 60 && !seenWind; s++) {
    const k = newCore(s);
    gotoWave(k, 5);
    if (k.m[L.S_MUT] & 1) {
      seenWind = true;
      assert.ok(Math.abs(k.m[L.S_WIND]) >= 5 && Math.abs(k.m[L.S_WIND]) <= 11, "wind is 20-40 px/s");
    } else assert.equal(k.m[L.S_WIND], 0);
  }
  assert.ok(seenWind, "wind appears for some seeds");
  const s4 = findSeed((k) => { gotoWave(k, 5); return (k.m[k.L.S_MUT] & 4) !== 0; });
  const low = newCore(s4);
  gotoWave(low, 5);
  const depot = passiveOf(low, 4) >= 0 ? 1 : 0;
  assert.deepEqual([0, 1, 2].map((b) => low.m[L.BAT_AMMO + b]), [6 + depot, 6 + depot, 6 + depot], "Low ammo: six per battery");
  quiet(low);
  const before = low.m[L.BAT_AMMO + 0];
  placeBlast(low, { x: 10000, y: 3000, r: 1600, bat: 0 });
  for (let i = 0; i < 4; i++) placeWarhead(low, { x: 10000 + i * 100, y: 3000, tgt: 4 });
  low.step();
  assert.equal(low.m[L.BAT_AMMO + 0], before + 1, "every 4th kill refunds one");
}

// ---------- passives ----------
{
  const s = findSeed((k) => passiveOf(k, 4) >= 0);
  const c = newCore(s);
  assert.deepEqual([0, 1, 2].map((b) => c.m[c.L.BAT_AMMO + b]), [11, 9, 13], "Depot: +1 interceptor per battery");
  const r = findSeed((k) => passiveOf(k, 0) >= 0);
  const p = newCore(r);
  quiet(p);
  p.m[p.L.S_WIND] = 0;
  p.input(2, 640, 300);
  let det;
  for (let i = 0; i < 200 && !det; i++) { p.step(); det = OF(p.events(), p.L.E_DETONATE)[0]; }
  assert.equal(det.d, Math.floor((((960 * 130) / 100) * 110) / 100 / 16), "Power plant: +10% blast radius");
  const b = findSeed((k) => passiveOf(k, 6) >= 0);
  const bar = newCore(b);
  quiet(bar, { hold: true });
  bar.m[bar.L.TGT_ALIVE + 0] = 0;
  bar.m[bar.L.BAT_TIMER + 0] = 2;
  bar.step();
  bar.step();
  assert.equal(bar.m[bar.L.TGT_ALIVE + 0], 1, "Barracks: a destroyed battery comes back");
}

// ---------- determinism and replay ----------
{
  const a = newCore(2026);
  const b = newCore(2026);
  const sa = bot.playRun(a, { maxWave: 6, botSeed: 5 });
  const sb = bot.playRun(b, { maxWave: 6, botSeed: 5 });
  assert.deepEqual(sa, sb);
  assert.equal(a.hash(), b.hash(), "same seed and inputs give identical state");
  const other = newCore(2027);
  bot.playRun(other, { maxWave: 6, botSeed: 5 });
  assert.notEqual(other.hash(), a.hash());
}
{
  // random streams are independent: drafting never changes the waves
  const spawnsOfWave2 = (rerolls) => {
    const c = newCore(555);
    const { L, m } = c;
    bot.playWave(c, { skill: 0, gap: 20 });
    m[L.S_FUNDS] = 5000;
    for (let i = 0; i < rerolls; i++) c.input(L.IN_REROLL);
    m[L.S_PICKED] = 1;
    c.input(L.IN_CONTINUE);
    toPlay(c);
    const out = [];
    for (let i = 0; i < 1800; i++) {
      c.step();
      for (let w = 0; w < L.N_WH; w++) if (m[L.WH_ACT + w] && m[L.WH_P + w] < 600) out.push([m[L.WH_SX + w], m[L.WH_TGT + w], m[L.WH_TYPE + w]].join());
    }
    return [...new Set(out)];
  };
  const none = spawnsOfWave2(0);
  assert.ok(none.length >= 8);
  assert.deepEqual(spawnsOfWave2(3), none);
}
{
  // replay round trip, and resuming from the start of a wave
  const live = newCore(31337, 1);
  const { L } = live;
  const rng = bot.mulberry(11);
  let resumeHash = null;
  let resumeLog = null;
  for (let w = 1; w <= 4; w++) {
    bot.playWave(live, { skill: 10, gap: 22, rng });
    if (live.get("S_PHASE") !== L.PH_BETWEEN) break;
    if (!live.get("S_PICKED")) live.input(L.IN_PICK, 0);
    for (const t of [1, 2, 3, 5, 6, 7, 0, 4, 8]) if (!live.m[L.TGT_ALIVE + t]) live.input(L.IN_REBUILD, t);
    live.input(L.IN_CONTINUE);
    if (w === 2) { resumeHash = live.hash(); resumeLog = live.exportLog(); }
  }
  const log = live.exportLog();
  assert.ok(log.length > 20);
  const finalHash = live.hash();
  const finalScore = live.get("S_SCORE");

  const replay = (entries, until) => {
    const r = newCore(31337, 1);
    r.beginReplay(entries);
    let guard = 0;
    while (r.get("S_LOGPOS") < entries.length && guard++ < 1e6) {
      r.pump();
      if (r.get("S_LOGPOS") >= entries.length) break;
      if (r.stepping()) r.step();
      else if (until === undefined) break;
    }
    return r;
  };
  const full = replay(log);
  assert.equal(full.get("S_SCORE"), finalScore, "replay reproduces the score");
  assert.equal(full.hash(), finalHash, "replay reproduces the exact state");

  const resumed = replay(resumeLog);
  assert.equal(resumed.hash(), resumeHash, "resume lands exactly at the start of the wave");
  resumed.endReplay();
  resumed.input(0, 640, 300);
  assert.equal(resumed.exportLog().length, resumeLog.length + 1, "play continues appending to the log");
}
{
  // inputs are ignored during replay, so a replay cannot be altered by stray clicks
  const c = newCore(4);
  c.beginReplay([]);
  toPlay(c);
  const h = c.hash();
  c.input(0, 640, 300);
  assert.equal(c.hash(), h);
}

// ---------- balance targets (informational bot, not a human) ----------
{
  const c = newCore(2024);
  const stats = bot.playRun(c, { maxWave: 10, skill: 14, gap: 24, botSeed: 3 });
  const used = stats.filter((s) => s.wave === 10).map((s) => s.shots / s.ammo0)[0];
  assert.ok(used >= 0.5 && used <= 1.0, `ammunition use by wave 10 should be high but not impossible, got ${used}`);
  assert.ok(c.cities() >= 1, "the bot survives ten waves");
}

console.log("core: ok");
