"use strict";
// A small DOM stand-in, just enough to run the packaged game without a browser.

class TextNode {
  constructor(text) { this.nodeType = 3; this.text = text; }
}

class El {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.doc = doc;
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.classes = new Set();
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
      toggle: (c, on) => { if (on) this.classes.add(c); else this.classes.delete(c); },
      contains: (c) => this.classes.has(c),
    };
    this.hidden = false;
    this.style = {};
    this.value = "";
    this.checked = false;
    this.focused = false;
  }
  setAttribute(k, v) { this.attrs[k] = v; if (k === "class") this.classes = new Set(String(v).split(/\s+/)); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...nodes) { this.children = nodes; }
  set textContent(v) { this.children = [new TextNode(String(v))]; }
  get textContent() { return this.children.map((c) => (c.nodeType === 3 ? c.text : c.textContent)).join(""); }
  get disabled() { return this.attrs.disabled !== undefined; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() { this.focused = true; this.doc.active = this; }
  select() {}
  setPointerCapture() {}
  getContext() { return this.ctx; }
  get clientWidth() { return 1280; }
  dispatch(type, event = {}) {
    const e = { target: this, preventDefault() { this.prevented = true; }, ...event };
    for (const fn of this.listeners[type] || []) fn(e);
    return e;
  }
  click() { return this.dispatch("click"); }
  findAll(pred, out = []) {
    for (const c of this.children) {
      if (c.nodeType === 3) continue;
      if (pred(c)) out.push(c);
      c.findAll(pred, out);
    }
    return out;
  }
  querySelector(sel) {
    const tags = sel.split(",").map((s) => s.trim().toUpperCase());
    return this.findAll((c) => tags.includes(c.tagName))[0] || null;
  }
}

function proxyContext() {
  const calls = { n: 0, text: [] };
  const ctx = new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "measureText") return (s) => ({ width: String(s).length * 8 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "fillText") return (s) => { calls.n++; calls.text.push(String(s)); };
      return () => { calls.n++; };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  return { ctx, calls };
}

function createEnvironment({ backing, AudioContext = null } = {}) {
  const frames = [];
  const doc = {
    active: null,
    hidden: false,
    listeners: {},
    els: {},
    body: null,
    createElement: (tag) => new El(tag, doc),
    createTextNode: (t) => new TextNode(t),
    getElementById(id) {
      if (!this.els[id]) {
        const e = new El(id === "game" ? "canvas" : "div", doc);
        if (id === "game") { const p = proxyContext(); e.ctx = p.ctx; e.calls = p.calls; e.width = 0; e.height = 0; }
        this.els[id] = e;
      }
      return this.els[id];
    },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    dispatch(type) { for (const fn of this.listeners[type] || []) fn({}); },
  };
  doc.body = new El("body", doc);
  const store = backing || new Map();
  const win = {
    listeners: {},
    devicePixelRatio: 1,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    navigator: {},
    AudioContext,
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    requestAnimationFrame(fn) { frames.push(fn); },
    key(type, key, extra = {}) {
      const e = { key, target: doc.body, preventDefault() { this.prevented = true; }, ...extra };
      for (const fn of this.listeners[type] || []) fn(e);
      return e;
    },
  };
  let t = 0;
  const env = {
    doc, win, store, frames,
    /** Runs n animation frames of 1/60 s each. */
    run(n, ms = 1000 / 60) {
      for (let i = 0; i < n; i++) {
        const fn = frames.shift();
        if (!fn) throw new Error("no frame scheduled");
        t += ms;
        fn(t);
      }
    },
    ui: () => doc.getElementById("ui"),
    canvas: () => doc.getElementById("game"),
    text: (el) => el.textContent,
    buttons: () => doc.getElementById("ui").findAll((c) => c.tagName === "BUTTON"),
    button(re) {
      const b = this.buttons().find((x) => re.test(x.textContent));
      if (!b) throw new Error(`no button matching ${re}; have: ${this.buttons().map((x) => x.textContent).join(" | ")}`);
      return b;
    },
  };
  return env;
}

module.exports = { createEnvironment, El };
