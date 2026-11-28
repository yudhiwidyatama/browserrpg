"use strict";
// Canvas 2D renderer. Everything is drawn from the core's state in linear memory plus a
// few presentation-only effects (particles, shake, floating text) that never feed back
// into the game. All art is procedural and generated from the run seed.

const { PASSIVES, MUTATORS } = require("./content.cjs");

const W = 1280;
const H = 720;
const GROUND_PX = 650;
const PARTICLE_CAP = 2000;
const PALETTE = {
  skyTop: "#05070d", skyBottom: "#101a33", warhead: "#ff6a3d", warheadGlow: "rgba(255,106,61,0.55)",
  interceptor: "#5be7ff", blastCore: "#ffffff", blastMid: "#ffc46b", city: "#8da2c4", cityDark: "#5f7396",
  ground: "#0b1220", text: "#e9f1ff", dim: "#8ea3c7", warn: "#ffd166",
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const targetX = (t) => 80 + 140 * t;

function passiveStanding(core, id) {
  const { m, L } = core;
  for (let t = 0; t < 9; t++) if (m[L.TGT_ALIVE + t] && m[L.TGT_PASS + t] === id) return true;
  return false;
}

/** Procedural scenery: the same seed always gives the same geometry. */
function generateScenery(seed) {
  const rnd = mulberry((seed ^ 0x5bd1e995) >>> 0);
  const stars = Array.from({ length: 140 }, () => ({ x: rnd() * W, y: rnd() * 470, r: 0.4 + rnd() * 1.2, ph: rnd() * 6.28 }));
  // ground line: smoothed value noise, kept flat under every target
  const knots = Array.from({ length: 22 }, () => rnd());
  const ground = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const f = (x / W) * 20;
    const i = Math.floor(f);
    const u = f - i;
    const s = u * u * (3 - 2 * u);
    let y = GROUND_PX + (knots[i] * (1 - s) + knots[i + 1] * s - 0.5) * 22;
    let nearest = 999;
    for (let t = 0; t < 9; t++) nearest = Math.min(nearest, Math.abs(x - targetX(t)));
    if (nearest < 70) y = GROUND_PX;
    else if (nearest < 110) y = GROUND_PX + (y - GROUND_PX) * ((nearest - 70) / 40);
    ground[x] = y;
  }
  // a skyline silhouette for each city (targets 1-3 and 5-7)
  const skylines = {};
  const rubble = {};
  for (const t of [1, 2, 3, 5, 6, 7]) {
    const buildings = [];
    let x = -46;
    while (x < 40) {
      const w = 10 + Math.floor(rnd() * 10);
      const h = 18 + Math.floor(rnd() * 52);
      const windows = [];
      for (let wy = 6; wy < h - 4; wy += 8) for (let wx = 3; wx < w - 3; wx += 6) if (rnd() > 0.55) windows.push([wx, wy]);
      buildings.push({ x, w, h, windows });
      x += w + 1;
    }
    skylines[t] = buildings;
    rubble[t] = Array.from({ length: 8 }, (_, k) => ({ x: -44 + k * 11, h: 3 + Math.floor(rnd() * 9) }));
  }
  return { stars, ground, skylines, rubble };
}

class Renderer {
  constructor(canvas, core, { random = Math.random } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.core = core;
    this.random = random;
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
    this.lastFlash = -1;
    this.time = 0;
    this.scenery = generateScenery(1);
    this.opts = { reducedMotion: false, reducedFlash: false, highContrast: false };
  }
  setOptions(o) {
    Object.assign(this.opts, o);
  }
  setSeed(seed) {
    this.scenery = generateScenery(seed);
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
  }
  resize(cssWidth, dpr) {
    const scale = Math.min(Math.max(dpr || 1, 1), 2);
    this.canvas.width = Math.round(cssWidth * scale);
    this.canvas.height = Math.round((cssWidth * H * scale) / W);
    this.scale = this.canvas.width / W;
  }

  // ---------- effects from core events ----------
  burst(x, y, n, color, speed, life) {
    const cap = this.opts.reducedMotion ? 600 : PARTICLE_CAP;
    for (let i = 0; i < n && this.particles.length < cap; i++) {
      const a = this.random() * Math.PI * 2;
      const s = speed * (0.3 + this.random());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: life * (0.5 + this.random() * 0.8), max: life, color, size: 1 + this.random() * 2.2 });
    }
  }
  addEvent(e, L) {
    const calm = this.opts.reducedMotion;
    switch (e.t) {
      case L.E_DETONATE:
        this.rings.push({ x: e.b, y: e.c, r: 4, max: e.d * 1.5, life: 0.6, age: 0 });
        this.burst(e.b, e.c, calm ? 4 : 14, "#ffd28a", 90, 0.7);
        break;
      case L.E_KILL:
        this.burst(e.b, e.c, calm ? 5 : 16, "#ff9d66", 130, 0.6);
        if (e.a >= 2) this.texts.push({ x: e.b, y: e.c - 8, text: `Chain \u00d7${e.a}`, age: 0, life: 1.1, size: 14 + Math.min(e.a, 12) });
        break;
      case L.E_CITY_HIT: {
        const x = targetX(e.a);
        this.burst(x, GROUND_PX - 10, calm ? 20 : 80, "#ffb066", 170, 1.4);
        this.burst(x, GROUND_PX - 10, calm ? 10 : 40, "#7d8aa3", 60, 2);
        this.rings.push({ x, y: GROUND_PX - 10, r: 6, max: 140, life: 0.8, age: 0 });
        this.kick(10, 0.35);
        break;
      }
      case L.E_BAT_HIT: {
        const x = targetX(e.a);
        this.burst(x, GROUND_PX - 12, calm ? 16 : 50, "#ffd24a", 150, 1.1);
        this.kick(8, 0.25);
        break;
      }
      case L.E_SHIELD:
        this.rings.push({ x: targetX(e.a), y: GROUND_PX - 30, r: 10, max: 90, life: 0.5, age: 0, color: "#7fe3ff" });
        break;
      case L.E_SPLIT:
        this.burst(e.a, e.b, calm ? 4 : 12, "#ffd0a8", 90, 0.5);
        break;
      default:
    }
  }
  kick(amount, flash) {
    if (!this.opts.reducedMotion) this.shake = Math.max(this.shake, amount);
    if (!this.opts.reducedFlash && this.time - this.lastFlash > 0.34) {
      this.flash = Math.max(this.flash, flash * 0.5);
      this.lastFlash = this.time;
    }
  }
  update(dt) {
    this.time += dt;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
    for (const t of this.texts) t.age += dt;
    this.texts = this.texts.filter((t) => t.age < t.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2);
  }

  // ---------- drawing ----------
  draw(view) {
    const { ctx } = this;
    const { core } = this;
    const sc = this.scale || 1;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate((this.random() - 0.5) * this.shake, (this.random() - 0.5) * this.shake);
    this.sky(core);
    this.groundAndCities(core);
    this.batteries(core, view);
    this.shields(core);
    this.threats(core, view);
    this.blasts(core);
    this.effects();
    ctx.restore();
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(this.flash, 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.hud(core, view);
    if (view.reticle) this.reticle(view.reticle);
  }
  sky(core) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_PX);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const twinkle = !this.opts.reducedMotion;
    for (const s of this.scenery.stars) {
      const a = twinkle ? 0.45 + 0.45 * Math.sin(this.time * 1.3 + s.ph) : 0.7;
      ctx.fillStyle = `rgba(220,232,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    const mut = core.get("S_MUT");
    if (mut & 2) {
      const f = ctx.createLinearGradient(0, 0, 0, GROUND_PX * 0.6);
      f.addColorStop(0, "rgba(120,130,150,0.55)");
      f.addColorStop(1, "rgba(120,130,150,0)");
      ctx.fillStyle = f;
      ctx.fillRect(0, 0, W, GROUND_PX * 0.6);
    }
  }
  groundAndCities(core) {
    const { ctx } = this;
    const { m, L } = core;
    const { ground, skylines, rubble } = this.scenery;
    ctx.fillStyle = PALETTE.ground;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ground[x]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    for (const t of [1, 2, 3, 5, 6, 7]) {
      const cx = targetX(t);
      const alive = m[L.TGT_ALIVE + t];
      ctx.fillStyle = alive ? PALETTE.city : PALETTE.cityDark;
      if (alive) {
        for (const b of skylines[t]) {
          ctx.fillRect(cx + b.x, GROUND_PX - b.h, b.w, b.h);
        }
        ctx.fillStyle = "rgba(255,226,140,0.85)";
        for (const b of skylines[t]) for (const [wx, wy] of b.windows) ctx.fillRect(cx + b.x + wx, GROUND_PX - b.h + wy, 2, 3);
      } else {
        for (const r of rubble[t]) ctx.fillRect(cx + r.x, GROUND_PX - r.h, 9, r.h);
      }
      // passive badge above the city
      const pid = m[L.TGT_PASS + t];
      const p = PASSIVES[pid];
      if (p) {
        ctx.globalAlpha = alive ? 1 : 0.35;
        ctx.fillStyle = "rgba(10,16,30,0.8)";
        ctx.strokeStyle = alive ? PALETTE.warn : PALETTE.dim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, GROUND_PX - 92, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = PALETTE.text;
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.letter, cx, GROUND_PX - 92);
        ctx.globalAlpha = 1;
      }
    }
  }
  batteries(core, view) {
    const { ctx } = this;
    const { m, L } = core;
    const aim = view.reticle || { x: W / 2, y: 200 };
    for (let b = 0; b < 3; b++) {
      const t = b * 4;
      const cx = targetX(t);
      const alive = m[L.TGT_ALIVE + t];
      const ammo = m[L.BAT_AMMO + b];
      const sel = view.selectedBattery === b;
      ctx.fillStyle = alive ? "#9fb3d6" : PALETTE.cityDark;
      ctx.beginPath();
      ctx.arc(cx, GROUND_PX, 22, Math.PI, 0);
      ctx.fill();
      if (alive) {
        const ang = Math.atan2(aim.y - (GROUND_PX - 14), aim.x - cx);
        ctx.strokeStyle = "#c8d6f0";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, GROUND_PX - 14);
        ctx.lineTo(cx + Math.cos(ang) * 24, GROUND_PX - 14 + Math.sin(ang) * 24);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillStyle = !alive ? PALETTE.dim : ammo > 0 ? PALETTE.text : "#ff7a7a";
      ctx.fillText(alive ? String(ammo) : "\u2715", cx, GROUND_PX + 34);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(`${b + 1}`, cx, GROUND_PX + 52);
      if (sel) {
        ctx.strokeStyle = PALETTE.warn;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 30, GROUND_PX - 28, 60, 84);
      }
    }
  }
  shields(core) {
    const { ctx } = this;
    const { m, L } = core;
    for (let t = 0; t < 9; t++) {
      if (!m[L.TGT_SHIELD + t] || !m[L.TGT_ALIVE + t]) continue;
      ctx.strokeStyle = "rgba(127,227,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(targetX(t), GROUND_PX, 56, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }
  }
  threats(core, view) {
    const { ctx } = this;
    const { m, L } = core;
    const observatory = passiveStanding(core, 7);
    const radar = passiveStanding(core, 3) || !!view.assistLead;
    const fog = (m[L.S_MUT] & 2) !== 0 && !observatory;
    for (let i = 0; i < L.N_WH; i++) {
      if (!m[L.WH_ACT + i]) continue;
      const p = m[L.WH_P + i];
      if (fog && p < 26214) continue;
      const sx = m[L.WH_SX + i] / 16;
      const sy = m[L.WH_SY + i] / 16;
      const x = m[L.WH_X + i] / 16;
      const y = m[L.WH_Y + i] / 16;
      const fromX = fog ? sx + ((m[L.WH_TX + i] / 16 - sx) * 26214) / 65536 : sx;
      const fromY = fog ? sy + ((m[L.WH_TY + i] / 16 - sy) * 26214) / 65536 : sy;
      const g = ctx.createLinearGradient(fromX, fromY, x, y);
      g.addColorStop(0, "rgba(255,106,61,0)");
      g.addColorStop(1, "rgba(255,150,100,0.85)");
      ctx.strokeStyle = g;
      ctx.lineWidth = this.opts.highContrast ? 3 : 1.6;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(x, y);
      ctx.stroke();
      const ang = Math.atan2(m[L.WH_TY + i] - m[L.WH_SY + i], m[L.WH_TX + i] - m[L.WH_SX + i]);
      const type = m[L.WH_TYPE + i];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang - Math.PI / 2);
      ctx.fillStyle = type === 2 ? "#ff3d6a" : PALETTE.warhead;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = this.opts.highContrast ? 1.5 : 0.8;
      ctx.beginPath();
      if (type === 1) {
        // splitter: diamond
        ctx.moveTo(0, -7); ctx.lineTo(5, 0); ctx.lineTo(0, 7); ctx.lineTo(-5, 0);
      } else {
        // warhead: downward-pointing triangle; fast ones are longer and thinner
        const len = type === 2 ? 11 : 7;
        ctx.moveTo(0, -len); ctx.lineTo(4, len * 0.6); ctx.lineTo(-4, len * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (radar) {
        const q = Math.min(p + m[L.WH_DP + i] * 30, 65536);
        const lx = (m[L.WH_SX + i] + ((m[L.WH_TX + i] - m[L.WH_SX + i]) * q) / 65536) / 16;
        const ly = (m[L.WH_SY + i] + ((m[L.WH_TY + i] - m[L.WH_SY + i]) * q) / 65536) / 16;
        ctx.strokeStyle = "rgba(255,209,102,0.8)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (let i = 0; i < L.N_IC; i++) {
      if (!m[L.IC_ACT + i]) continue;
      const sx = m[L.IC_SX + i] / 16;
      const sy = m[L.IC_SY + i] / 16;
      const x = m[L.IC_X + i] / 16;
      const y = m[L.IC_Y + i] / 16;
      ctx.strokeStyle = "rgba(91,231,255,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.interceptor;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      // target marker: a small x where it will detonate
      const tx = m[L.IC_TX + i] / 16;
      const ty = m[L.IC_TY + i] / 16;
      ctx.strokeStyle = "rgba(91,231,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty - 4); ctx.lineTo(tx + 4, ty + 4);
      ctx.moveTo(tx + 4, ty - 4); ctx.lineTo(tx - 4, ty + 4);
      ctx.stroke();
    }
  }
  blasts(core) {
    const { ctx } = this;
    const { m, L } = core;
    for (let i = 0; i < L.N_BL; i++) {
      if (!m[L.BL_ACT + i]) continue;
      const r = m[L.BL_R + i] / 16;
      if (r < 1) continue;
      const x = m[L.BL_X + i] / 16;
      const y = m[L.BL_Y + i] / 16;
      const age = m[L.BL_AGE + i];
      const total = m[L.BL_GROW + i] + m[L.BL_HOLD + i] + m[L.BL_SHRINK + i];
      const fade = Math.min(1, (total - age) / m[L.BL_SHRINK + i]);
      const maxA = this.opts.reducedFlash ? 0.55 : 0.9;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${maxA * fade})`);
      g.addColorStop(0.45, `rgba(255,196,107,${0.65 * fade})`);
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,236,200,${(this.opts.highContrast ? 1 : 0.5) * fade})`;
      ctx.lineWidth = this.opts.highContrast ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  effects() {
    const { ctx } = this;
    for (const r of this.rings) {
      const k = r.age / r.life;
      ctx.strokeStyle = r.color ? r.color : `rgba(255,230,190,${1 - k})`;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = 1 - t.age / t.life;
      ctx.fillStyle = PALETTE.warn;
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.fillText(t.text, t.x, t.y - t.age * 24);
    }
    ctx.globalAlpha = 1;
  }
  hud(core, view) {
    const { ctx } = this;
    const { m, L } = core;
    ctx.fillStyle = "rgba(5,8,16,0.55)";
    ctx.fillRect(0, 0, W, 38);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = PALETTE.text;
    const wave = m[L.S_WAVE];
    const mode = m[L.S_MODE];
    ctx.fillText(`SCORE ${m[L.S_SCORE]}`, 16, 19);
    ctx.fillText(`WAVE ${wave}${mode === 2 || m[L.S_ENDLESS] ? "" : " / 30"}`, 240, 19);
    ctx.fillText(`FUNDS ${m[L.S_FUNDS]}`, 430, 19);
    let x = 600;
    ctx.font = "16px system-ui, sans-serif";
    for (const bit of [1, 2, 4]) {
      if (m[L.S_MUT] & bit) {
        ctx.fillStyle = PALETTE.warn;
        const label = bit === 1 ? `WIND ${m[L.S_WIND] > 0 ? "\u2192" : "\u2190"}` : MUTATORS[bit].name.toUpperCase();
        ctx.fillText(label, x, 19);
        x += ctx.measureText(label).width + 18;
      }
    }
    // owned perks as initials, with level
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.dim;
    const owned = [];
    for (let i = 0; i < 8; i++) if (m[L.PK_LVL + i] > 0) owned.push(`${view.perkNames[i][0]}${m[L.PK_LVL + i]}`);
    if (owned.length) ctx.fillText(owned.join(" "), W - 16, 19);
    if (view.banner) {
      ctx.textAlign = "center";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillStyle = "rgba(5,8,16,0.65)";
      const w = ctx.measureText(view.banner).width + 40;
      ctx.fillRect(W / 2 - w / 2, 70, w, 40);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(view.banner, W / 2, 91);
    }
    if (view.tag) {
      ctx.textAlign = "left";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = PALETTE.warn;
      ctx.fillText(view.tag, 16, 58);
    }
  }
  reticle(r) {
    const { ctx } = this;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 11, 0, Math.PI * 2);
    ctx.moveTo(r.x - 18, r.y); ctx.lineTo(r.x - 6, r.y);
    ctx.moveTo(r.x + 6, r.y); ctx.lineTo(r.x + 18, r.y);
    ctx.moveTo(r.x, r.y - 18); ctx.lineTo(r.x, r.y - 6);
    ctx.moveTo(r.x, r.y + 6); ctx.lineTo(r.x, r.y + 18);
    ctx.stroke();
  }
}

module.exports = { Renderer, generateScenery, PARTICLE_CAP, W, H };
