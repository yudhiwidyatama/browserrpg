"use strict";
// Browser wiring: panels, input, the frame loop and settings. Rules live in the WebAssembly
// core, timing and saving in session.cjs, drawing in render.cjs, sound in audio.cjs.

const { createCore } = require("./core.cjs");
const { Session } = require("./session.cjs");
const { Renderer } = require("./render.cjs");
const { AudioEngine } = require("./audio.cjs");
const { createStorage } = require("./storage.cjs");
const { PERKS, PASSIVES, BATTERIES, MODES } = require("./content.cjs");
const replayCodec = require("./replay.cjs");

const KEYBOARD_AIM_SPEED = 600; // logical pixels per second

function h(doc, tag, props = {}, ...children) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c != null) el.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
  return el;
}

function start(env) {
  const { document: doc, window: win, wasmBytes, instance, layout } = env;
  const raf = env.raf || ((fn) => win.requestAnimationFrame(fn));
  const el = (id) => doc.getElementById(id);
  const canvas = el("game");
  const ui = el("ui");
  const stage = el("stage");

  let backing = null;
  try { backing = env.storage !== undefined ? env.storage : win.localStorage; } catch (e) { backing = null; }
  const storage = createStorage(backing);
  const settings = storage.data.settings;
  settings.music = false; // sound always starts off, as in Lantern Below
  settings.sfx = false;
  if (win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches) settings.reducedMotion = true;

  const AC = env.AudioContext !== undefined ? env.AudioContext : win.AudioContext || win.webkitAudioContext || null;
  const audio = new AudioEngine(AC);
  const core = createCore(instance || wasmBytes, layout);
  core.init(1, 0);
  const session = new Session({ core, storage, audio });
  const renderer = new Renderer(canvas, core);
  renderer.setSeed(1);
  const L = core.L;
  const perkNames = PERKS.map((p) => p.name);

  const aim = { x: 640, y: 260, dragging: false, visible: false };
  const keys = new Set();
  let touchSeen = false;
  let panel = null; // name of the panel currently shown
  let last = null;

  // ---------- settings ----------
  function applySettings() {
    renderer.setOptions({ reducedMotion: settings.reducedMotion, reducedFlash: settings.reducedFlash, highContrast: settings.highContrast });
    doc.body.classList.toggle("hc", !!settings.highContrast);
    audio.setSfx(!!settings.sfx);
    audio.setMusic(!!settings.music);
    storage.save();
  }
  const aimMode = (pointerType) => (settings.aim === "auto" ? (pointerType === "touch" ? "drag" : "tap") : settings.aim);

  // ---------- panels ----------
  function show(name, content) {
    panel = name;
    ui.replaceChildren(content);
    ui.hidden = false;
    const first = content.querySelector ? content.querySelector("button, textarea, input, select") : null;
    if (first && first.focus) first.focus();
  }
  function hide() {
    panel = null;
    ui.replaceChildren();
    ui.hidden = true;
  }
  const btn = (text, onclick, extra = {}) => h(doc, "button", { type: "button", text, onclick, ...extra });
  const row = (...c) => h(doc, "div", { class: "row" }, ...c);
  const card = (title, ...c) => h(doc, "section", { class: "panel", role: "dialog", "aria-label": title }, h(doc, "h2", { text: title }), ...c);

  function menu() {
    const best = storage.data.best;
    const saved = session.hasSavedRun();
    const run = storage.data.run;
    const date = replayCodec.utcDateNumber();
    const daily = storage.data.daily[date];
    session.stop();
    core.init(1, 0);
    renderer.setSeed(1);
    show("menu", card("Missile Defense",
      h(doc, "p", { class: "lead", text: "Protect six cities from falling warheads. Lead your targets, chain the blasts, and draft a perk after every wave." }),
      saved ? btn(`Continue run \u2014 ${MODES[run.mode]}, wave ${waveOfSaved(run)}`, () => { if (session.resume()) afterStart(); else menu(); }, { class: "primary" }) : null,
      btn("Campaign \u2014 30 waves", () => begin(0), { class: saved ? "" : "primary" }),
      btn(`Daily seed \u2014 ${date}${daily ? ` (best ${daily.score})` : ""}`, () => begin(1)),
      btn("Endless", () => begin(2)),
      btn("Watch a replay", replayPanel),
      btn("Settings", () => settingsPanel(menu)),
      h(doc, "p", { class: "dim", text: ["Campaign", "Daily seed", "Endless"].map((n, i) => (best[i] ? `${n}: best ${best[i].score}, wave ${best[i].wave}` : null)).filter(Boolean).join("  \u2022  ") || "No scores yet." }),
      h(doc, "p", { class: "dim", text: "Mouse: click to fire, right-click or D to detonate early, 1-3 pick a battery, P pauses. Touch: drag to aim, release to fire." }),
      storage.persistent ? null : h(doc, "p", { class: "dim", text: "Browser storage is unavailable, so progress will not be saved." })));
  }
  function waveOfSaved(run) {
    // the wave number is the count of "continue" inputs (kind 8) plus the first wave
    return 1 + run.entries.filter((e) => e[1] === L.IN_CONTINUE).length;
  }
  function begin(mode) {
    session.startNew(mode);
    afterStart();
  }
  function afterStart() {
    renderer.setSeed(session.seed);
    hide();
    last = null;
  }

  function checkbox(label, key, text) {
    const input = h(doc, "input", { type: "checkbox", id: `opt-${key}` });
    input.checked = !!settings[key];
    input.addEventListener("change", () => { settings[key] = input.checked; applySettings(); });
    return h(doc, "label", { class: "opt", for: `opt-${key}` }, input, h(doc, "span", { text: label }), text ? h(doc, "small", { text }) : null);
  }
  function select(label, key, options) {
    const s = h(doc, "select", { id: `opt-${key}` }, ...options.map(([v, t]) => h(doc, "option", { value: v, text: t })));
    s.value = String(settings[key]);
    s.addEventListener("change", () => { settings[key] = typeof settings[key] === "number" ? Number(s.value) : s.value; applySettings(); });
    return h(doc, "label", { class: "opt", for: `opt-${key}` }, h(doc, "span", { text: label }), s);
  }
  function settingsPanel(back) {
    show("settings", card("Settings",
      checkbox("Music", "music", "Off until you turn it on"),
      checkbox("Sound effects", "sfx", "Off until you turn it on"),
      checkbox("Reduced motion", "reducedMotion", "No screen shake or slow motion, fewer particles"),
      checkbox("Reduced flashing", "reducedFlash", "Dimmer blasts, no full-screen flashes"),
      checkbox("High contrast", "highContrast", "Brighter outlines and text"),
      select("Aiming", "aim", [["auto", "Automatic (drag on touch)"], ["tap", "Tap to fire"], ["drag", "Drag to aim"]]),
      select("Game speed", "speed", [[100, "100%"], [75, "75% (assist)"], [50, "50% (assist)"]]),
      checkbox("Lead marker for every warhead", "lead", "Assist: runs with assists get no daily share code"),
      btn("Back", () => { applySettings(); back(); }, { class: "primary" })));
  }
  function pausePanel() {
    session.paused = true;
    audio.suspend();
    show("pause", card("Paused",
      btn("Resume", resume, { class: "primary" }),
      session.playback ? null : btn("Restart wave", () => { session.paused = false; session.restartWave(); afterStart(); }),
      btn("Settings", () => settingsPanel(pausePanel)),
      btn("Quit to menu", menu)));
  }
  function resume() {
    session.paused = false;
    audio.resume();
    hide();
  }
  function replayPanel() {
    const box = h(doc, "textarea", { id: "replay-text", rows: "5", "aria-label": "Replay text", placeholder: "Paste a replay string here" });
    const msg = h(doc, "p", { class: "dim", role: "status", "aria-live": "polite", text: "" });
    show("replay", card("Watch a replay", box, msg, row(
      btn("Watch", () => {
        try { session.watch(box.value); renderer.setSeed(session.seed); hide(); } catch (e) { msg.textContent = e.message; }
      }, { class: "primary" }),
      btn("Back", menu))));
  }
  function betweenPanel() {
    const v = session.between();
    const s = v.summary;
    const line = (label, value) => h(doc, "tr", {}, h(doc, "td", { text: label }), h(doc, "td", { class: "num", text: String(value) }));
    const perks = v.offers.map((o, i) => (o ? btn("", () => { session.pick(i); betweenPanel(); }, { class: "perk", disabled: v.picked, "aria-label": `${o.name}${o.level ? `, level ${o.level + 1}` : ""}. ${o.text}` }, ) : null));
    perks.forEach((b, i) => {
      if (!b) return;
      const o = v.offers[i];
      b.appendChild(h(doc, "strong", { text: o.level ? `${o.name} \u2192 level ${o.level + 1}` : o.name }));
      b.appendChild(h(doc, "span", { text: o.text }));
    });
    const legend = [1, 2, 3, 5, 6, 7].map((t) => {
      const p = PASSIVES[core.m[L.TGT_PASS + t]];
      const alive = core.m[L.TGT_ALIVE + t];
      return h(doc, "li", { class: alive ? "" : "dim" }, `${p.letter} ${p.name}: ${p.text}${alive ? "" : " (city lost)"}`);
    });
    show("between", card(`Wave ${v.wave} cleared`,
      h(doc, "table", { class: "sum" },
        line("Warheads destroyed", s.kills), line("Surviving cities", s.city), line("Unused interceptors", s.ammo),
        line("Clean wave", s.clean), line("Thrifty wave", s.thrifty), line("Funds earned", s.funds)),
      h(doc, "p", { class: "lead", text: `Score ${v.score}  \u2022  Funds ${v.funds}` }),
      h(doc, "h3", { text: v.picked ? "Perk chosen" : "Choose a perk" }),
      h(doc, "div", { class: "perks" }, perks),
      v.picked || !v.offers[0] ? null : btn(`Reroll offers (${v.rerollCost})`, () => { session.reroll(); betweenPanel(); }, { disabled: v.funds < v.rerollCost }),
      v.rebuilds.length ? h(doc, "h3", { text: "Rebuild" }) : null,
      v.rebuilds.length ? row(v.rebuilds.map((r) => btn(`${r.battery ? "Battery" : "City"} ${r.battery ? BATTERIES[r.t / 4].name : r.t < 4 ? r.t : r.t < 8 ? r.t - 1 : r.t - 2} (${r.cost})`, () => { session.rebuild(r.t); betweenPanel(); }, { disabled: v.funds < r.cost }))) : null,
      h(doc, "details", {}, h(doc, "summary", { text: "City passives" }), h(doc, "ul", { class: "legend" }, legend)),
      btn(v.picked ? `Start wave ${v.wave + 1}` : "Pick a perk to continue", () => { session.next(); }, { class: "primary", disabled: !v.picked })));
  }
  function endPanel(won) {
    const r = session.result;
    const box = h(doc, "textarea", { readonly: true, rows: "3", "aria-label": "Replay text" });
    box.value = r.replay;
    show("end", card(won ? "Victory!" : "Game over",
      h(doc, "p", { class: "lead", text: `Score ${r.score}  \u2022  Wave ${r.wave}  \u2022  Best chain ${r.chain}  \u2022  Accuracy ${Math.round(r.accuracy * 100)}%` }),
      h(doc, "p", { class: "dim", text: `Best ${MODES[r.mode]}: ${storage.data.best[r.mode].score}` }),
      r.mode === 1 ? h(doc, "p", { text: r.code ? `Share code: ${r.code}` : "Assisted runs have no share code." }) : null,
      h(doc, "label", {}, "Replay (copy to keep or share)", box),
      row(won ? btn("Play on in endless mode", () => { session.next(); hide(); }, { class: "primary" }) : null,
        btn("Copy replay", () => { try { win.navigator.clipboard.writeText(r.replay); } catch (e) { box.select && box.select(); } }),
        btn("Menu", menu, { class: won ? "" : "primary" }))));
  }
  function replayEndPanel() {
    show("replay-end", card("Replay finished", h(doc, "p", { class: "lead", text: `Final score ${core.get("S_SCORE")}, wave ${core.get("S_WAVE")}.` }), btn("Back to menu", menu, { class: "primary" })));
  }

  session.on("phase", (ph) => {
    if (session.playback) {
      if (session.playback.done) replayEndPanel();
      return;
    }
    if (ph === L.PH_BETWEEN) betweenPanel();
    else if (ph === L.PH_OVER) endPanel(false);
    else if (ph === L.PH_WON) endPanel(true);
    else if (panel === "between" || panel === "end") hide();
  });
  session.on("event", (e) => renderer.addEvent(e, L));

  // ---------- input ----------
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / (r.width || 1)) * 1280, y: ((e.clientY - r.top) / (r.height || 1)) * 720 };
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") touchSeen = true;
    if (settings.sfx || settings.music) audio.unlock();
    if (e.button === 2) { session.detonate(); return; }
    const p = toLogical(e);
    if (aimMode(e.pointerType) === "drag") {
      aim.dragging = true;
      aim.visible = true;
      aim.x = p.x;
      aim.y = Math.max(p.y - 80, 0);
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
    } else {
      aim.x = p.x; aim.y = p.y; aim.visible = true;
      session.fire(p.x, p.y);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toLogical(e);
    if (aim.dragging) { aim.x = p.x; aim.y = Math.max(p.y - 80, 0); } else if (e.pointerType !== "touch") { aim.x = p.x; aim.y = p.y; aim.visible = true; }
  });
  const release = () => {
    if (!aim.dragging) return;
    aim.dragging = false;
    session.fire(aim.x, aim.y);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", () => { aim.dragging = false; });

  win.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    const k = e.key;
    if (k === "p" || k === "P" || k === "Escape") {
      if (panel === "pause") resume(); else if (session.running && !panel) pausePanel();
      e.preventDefault();
    } else if (k === "m" || k === "M") {
      const on = !(settings.sfx || settings.music);
      settings.sfx = on; settings.music = on;
      applySettings();
    } else if (!panel) {
      if (k === " " || k === "Enter") { if (!e.repeat) session.fire(aim.x, aim.y); e.preventDefault(); }
      else if (k === "d" || k === "D") session.detonate();
      else if (k === "1" || k === "2" || k === "3") session.selectBattery(Number(k) - 1);
      else if (k.startsWith("Arrow")) { keys.add(k); aim.visible = true; e.preventDefault(); }
    }
  });
  win.addEventListener("keyup", (e) => keys.delete(e.key));
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden && session.running && !panel && !session.paused) pausePanel();
  });
  el("pauseBtn").addEventListener("click", () => { if (session.running && !panel) pausePanel(); });
  el("detBtn").addEventListener("click", () => session.detonate());
  el("speedBtn").addEventListener("click", () => {
    if (!session.playback) return;
    session.playback.speed = session.playback.speed >= 4 ? 1 : session.playback.speed * 2;
    el("speedBtn").textContent = `${session.playback.speed}\u00d7`;
  });
  el("stopBtn").addEventListener("click", menu);

  // ---------- frame loop ----------
  function resize() {
    renderer.resize(stage.clientWidth || 1280, win.devicePixelRatio || 1);
  }
  win.addEventListener("resize", resize);

  function frame(now) {
    const dt = last == null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    if (keys.size && !panel) {
      const d = KEYBOARD_AIM_SPEED * dt;
      if (keys.has("ArrowLeft")) aim.x -= d;
      if (keys.has("ArrowRight")) aim.x += d;
      if (keys.has("ArrowUp")) aim.y -= d;
      if (keys.has("ArrowDown")) aim.y += d;
      aim.x = Math.min(Math.max(aim.x, 0), 1280);
      aim.y = Math.min(Math.max(aim.y, 0), 640);
    }
    session.tick(dt);
    renderer.update(dt);
    const playing = session.running && !session.playback && !panel && session.phase === L.PH_PLAY;
    renderer.draw({
      reticle: aim.visible && (playing || aim.dragging) ? { x: aim.x, y: aim.y } : null,
      selectedBattery: session.selectedBattery,
      perkNames,
      banner: session.paused ? "" : session.banner(),
      tag: session.playback ? "REPLAY" : session.paused ? "PAUSED" : "",
      assistLead: !!settings.lead,
    });
    el("pauseBtn").hidden = !session.running || !!panel;
    el("detBtn").hidden = !(touchSeen && playing);
    el("speedBtn").hidden = !session.playback || !!panel;
    el("stopBtn").hidden = !session.playback || !!panel;
    raf(frame);
  }

  applySettings();
  resize();
  menu();
  raf(frame);
  return { session, core, renderer, audio, storage, frame, menu, resize };
}

module.exports = { start, h };
