"use strict";
/*
 * mcl: a tiny integer-only language that compiles straight to a WebAssembly binary.
 *
 * Why it exists: the game's simulation core must be real WebAssembly, and this
 * repository builds with plain Node. mcl needs no toolchain, no network and no
 * dependencies, so `node missile/build.cjs` works anywhere Node does.
 *
 * Language summary (every value is a 32-bit signed integer):
 *   const NAME = <constant expression>;     compile-time constant, also exported to JS
 *   memory N;                               linear memory size in 64 KiB pages
 *   fn name(a, b) { ... }  /  export fn ... every function returns an i32 (0 by default)
 *   let x = e;  x = e;  x += e;  m[i] = e;  m[i] += e;      m[i] is the i-th i32 of linear memory
 *   if (c) { } else { }   while (c) { }   break;  continue;  return e;
 *   Operators: || && | ^ & == != < <= > >= << >> >>> + - * / %  and unary - ! ~
 *   Builtins:  mulshr(a, b, s) = (a * b) >> s  and  muldiv(a, b, c) = (a * b) / c, both in 64-bit.
 * There are no floats, no imports and no host calls, so output is deterministic.
 */

const PRELUDE = `
fn abs(a) { if (a < 0) { return -a; } return a; }
fn min(a, b) { if (a < b) { return a; } return b; }
fn max(a, b) { if (a > b) { return a; } return b; }
fn clamp(v, lo, hi) { if (v < lo) { return lo; } if (v > hi) { return hi; } return v; }
fn isqrt(n) {
  if (n <= 0) { return 0; }
  let x = n;
  let y = (x + 1) >> 1;
  while (y < x) { x = y; y = (x + n / x) >> 1; }
  return x;
}
`;

const OPS = [
  ">>>=", "<<=", ">>=", ">>>", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||",
  "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
];
const SINGLE = "+-*/%&|^~!<>=(){}[];,";
const BIN_LEVELS = [
  ["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", "<=", ">", ">="],
  ["<<", ">>", ">>>"], ["+", "-"], ["*", "/", "%"],
];
const ASSIGN_OPS = /^(=|[-+*/%&|^]=|<<=|>>=|>>>=)$/;

class MclError extends Error {}

function lex(src, file) {
  const toks = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      if (c === "0" && /[xX]/.test(src[i + 1] || "")) {
        j += 2;
        while (/[0-9a-fA-F]/.test(src[j] || "")) j++;
      } else {
        while (/[0-9]/.test(src[j] || "")) j++;
      }
      toks.push({ t: "num", v: Number(src.slice(i, j)) | 0, line, file });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (/[A-Za-z0-9_]/.test(src[j] || "")) j++;
      toks.push({ t: "id", v: src.slice(i, j), line, file });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { toks.push({ t: "op", v: op, line, file }); i += op.length; continue; }
    if (SINGLE.includes(c)) { toks.push({ t: "op", v: c, line, file }); i++; continue; }
    throw new MclError(`${file}:${line}: unexpected character '${c}'`);
  }
  toks.push({ t: "eof", v: "<eof>", line, file });
  return toks;
}

function fold(op, a, b) {
  switch (op) {
    case "+": return (a + b) | 0;
    case "-": return (a - b) | 0;
    case "*": return Math.imul(a, b);
    case "/": return (a / b) | 0;
    case "%": return (a % b) | 0;
    case "&": return a & b;
    case "|": return a | b;
    case "^": return a ^ b;
    case "<<": return a << b;
    case ">>": return a >> b;
    case ">>>": return (a >>> b) | 0;
    case "==": return +(a === b);
    case "!=": return +(a !== b);
    case "<": return +(a < b);
    case "<=": return +(a <= b);
    case ">": return +(a > b);
    case ">=": return +(a >= b);
    case "&&": return +(a !== 0 && b !== 0);
    case "||": return +(a !== 0 || b !== 0);
  }
  throw new MclError(`cannot fold ${op}`);
}

class Parser {
  constructor(toks, state) {
    this.toks = toks;
    this.p = 0;
    this.s = state;
  }
  get tok() { return this.toks[this.p]; }
  err(msg, tok = this.tok) { throw new MclError(`${tok.file}:${tok.line}: ${msg}`); }
  is(v) { return (this.tok.t === "op" || this.tok.t === "id") && this.tok.v === v; }
  eat(v) { if (this.is(v)) { this.p++; return true; } return false; }
  expect(v) { if (!this.eat(v)) this.err(`expected '${v}' but found '${this.tok.v}'`); }
  ident() {
    if (this.tok.t !== "id") this.err(`expected a name but found '${this.tok.v}'`);
    return this.toks[this.p++].v;
  }

  program() {
    while (this.tok.t !== "eof") {
      if (this.eat("const")) {
        const name = this.ident();
        this.expect("=");
        const v = this.expr();
        if (v.k !== "num") this.err(`constant '${name}' is not a compile-time constant`);
        if (name in this.s.consts) this.err(`duplicate constant '${name}'`);
        this.s.consts[name] = v.v;
        this.expect(";");
      } else if (this.eat("memory")) {
        const n = this.expr();
        if (n.k !== "num") this.err("memory size must be constant");
        this.s.pages = n.v;
        this.expect(";");
      } else {
        const exported = this.eat("export");
        const file = this.tok.file;
        const line = this.tok.line;
        this.expect("fn");
        const name = this.ident();
        if (this.s.fns.has(name)) this.err(`duplicate function '${name}'`);
        this.expect("(");
        const params = [];
        while (!this.is(")")) { params.push(this.ident()); if (!this.eat(",")) break; }
        this.expect(")");
        const body = this.block();
        this.s.fns.set(name, { name, params, body, exported, line, file });
      }
    }
  }
  block() {
    this.expect("{");
    const out = [];
    while (!this.is("}")) {
      if (this.tok.t === "eof") this.err("unterminated block");
      out.push(this.stmt());
    }
    this.expect("}");
    return out;
  }
  stmt() {
    const line = this.tok.line;
    if (this.eat("let")) {
      const name = this.ident();
      this.expect("=");
      const e = this.expr();
      this.expect(";");
      return { k: "let", name, e, line };
    }
    if (this.eat("if")) {
      this.expect("(");
      const c = this.expr();
      this.expect(")");
      const a = this.block();
      let b = [];
      if (this.eat("else")) b = this.is("if") ? [this.stmt()] : this.block();
      return { k: "if", c, a, b, line };
    }
    if (this.eat("while")) {
      this.expect("(");
      const c = this.expr();
      this.expect(")");
      return { k: "while", c, body: this.block(), line };
    }
    if (this.eat("return")) {
      const e = this.is(";") ? { k: "num", v: 0 } : this.expr();
      this.expect(";");
      return { k: "return", e, line };
    }
    if (this.eat("break")) { this.expect(";"); return { k: "break", line }; }
    if (this.eat("continue")) { this.expect(";"); return { k: "continue", line }; }
    const e = this.expr();
    if (this.tok.t === "op" && ASSIGN_OPS.test(this.tok.v)) {
      const opTok = this.toks[this.p++].v;
      if (e.k !== "var" && e.k !== "mem") this.err("cannot assign to this expression");
      let v = this.expr();
      if (opTok !== "=") v = this.mkBin(opTok.slice(0, -1), e, v);
      this.expect(";");
      return { k: "assign", target: e, e: v, line };
    }
    this.expect(";");
    return { k: "expr", e, line };
  }
  mkBin(op, a, b) {
    if (a.k === "num" && b.k === "num") {
      if ((op === "/" || op === "%") && b.v === 0) this.err("division by zero");
      return { k: "num", v: fold(op, a.v, b.v) };
    }
    if (op === "&&") return { k: "and", a, b };
    if (op === "||") return { k: "or", a, b };
    return { k: "bin", op, a, b };
  }
  expr(level = 0) {
    if (level === BIN_LEVELS.length) return this.unary();
    let a = this.expr(level + 1);
    while (this.tok.t === "op" && BIN_LEVELS[level].includes(this.tok.v)) {
      const op = this.toks[this.p++].v;
      a = this.mkBin(op, a, this.expr(level + 1));
    }
    return a;
  }
  unary() {
    const line = this.tok.line;
    for (const op of ["-", "!", "~"]) {
      if (this.eat(op)) {
        const e = this.unary();
        if (e.k === "num") return { k: "num", v: op === "-" ? -e.v | 0 : op === "!" ? +(e.v === 0) : ~e.v };
        return { k: "un", op, e, line };
      }
    }
    return this.primary();
  }
  primary() {
    const tok = this.tok;
    if (tok.t === "num") { this.p++; return { k: "num", v: tok.v }; }
    if (this.eat("(")) { const e = this.expr(); this.expect(")"); return e; }
    if (tok.t === "id") {
      this.p++;
      if (tok.v === "m" && this.is("[")) {
        this.p++;
        const idx = this.expr();
        this.expect("]");
        return { k: "mem", idx, line: tok.line };
      }
      if (this.is("(")) {
        this.p++;
        const args = [];
        while (!this.is(")")) { args.push(this.expr()); if (!this.eat(",")) break; }
        this.expect(")");
        return { k: "call", name: tok.v, args, line: tok.line };
      }
      if (tok.v in this.s.consts) return { k: "num", v: this.s.consts[tok.v] };
      return { k: "var", name: tok.v, line: tok.line };
    }
    return this.err(`unexpected '${tok.v}'`);
  }
}

// ---------- binary encoding ----------
const uleb = (n) => {
  const o = [];
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n);
  return o;
};
const sleb = (n) => {
  const o = [];
  for (;;) {
    const b = n & 0x7f;
    n >>= 7;
    if ((n === 0 && !(b & 0x40)) || (n === -1 && b & 0x40)) { o.push(b); return o; }
    o.push(b | 0x80);
  }
};
const str = (s) => [...uleb(s.length), ...Buffer.from(s, "utf8")];
const vec = (items) => [...uleb(items.length), ...items.flat()];
const section = (id, body) => [id, ...uleb(body.length), ...body];

const BINOP = {
  "+": 0x6a, "-": 0x6b, "*": 0x6c, "/": 0x6d, "%": 0x6f, "&": 0x71, "|": 0x72, "^": 0x73,
  "<<": 0x74, ">>": 0x75, ">>>": 0x76, "==": 0x46, "!=": 0x47, "<": 0x48, "<=": 0x4c, ">": 0x4a, ">=": 0x4e,
};
const I64_EXTEND_S = 0xac;
const I64_MUL = 0x7e;
const I64_SHR_S = 0x87;
const I64_DIV_S = 0x7f;
const I32_WRAP = 0xa7;

class FnGen {
  constructor(fn, fnIndex) {
    this.fn = fn;
    this.fnIndex = fnIndex;
    this.locals = new Map(fn.params.map((p, i) => [p, i]));
    this.out = [];
    this.depth = 0;
    this.loops = [];
  }
  err(msg, line) { throw new MclError(`${this.fn.file}:${line || this.fn.line}: ${msg} (in '${this.fn.name}')`); }
  e(...bytes) { this.out.push(...bytes); }
  expr(x) {
    switch (x.k) {
      case "num": this.e(0x41, ...sleb(x.v)); break;
      case "var":
        if (!this.locals.has(x.name)) this.err(`unknown name '${x.name}'`, x.line);
        this.e(0x20, ...uleb(this.locals.get(x.name)));
        break;
      case "mem": this.expr(x.idx); this.e(0x41, 2, 0x74, 0x28, 2, 0); break;
      case "un":
        this.expr(x.e);
        if (x.op === "-") this.e(0x41, 0x7f, 0x6c);
        else if (x.op === "!") this.e(0x45);
        else this.e(0x41, 0x7f, 0x73);
        break;
      case "bin": this.expr(x.a); this.expr(x.b); this.e(BINOP[x.op]); break;
      case "and": this.expr(x.a); this.e(0x04, 0x7f); this.expr(x.b); this.e(0x45, 0x45, 0x05, 0x41, 0, 0x0b); break;
      case "or": this.expr(x.a); this.e(0x04, 0x7f, 0x41, 1, 0x05); this.expr(x.b); this.e(0x45, 0x45, 0x0b); break;
      case "call": this.call(x); break;
      default: this.err(`bad expression ${x.k}`);
    }
  }
  call(x) {
    const need = (n) => { if (x.args.length !== n) this.err(`'${x.name}' takes ${n} arguments`, x.line); };
    if (x.name === "mulshr" || x.name === "muldiv") {
      need(3);
      this.expr(x.args[0]); this.e(I64_EXTEND_S);
      this.expr(x.args[1]); this.e(I64_EXTEND_S, I64_MUL);
      this.expr(x.args[2]); this.e(I64_EXTEND_S, x.name === "mulshr" ? I64_SHR_S : I64_DIV_S, I32_WRAP);
      return;
    }
    const f = this.fnIndex.get(x.name);
    if (!f) this.err(`unknown function '${x.name}'`, x.line);
    need(f.fn.params.length);
    x.args.forEach((a) => this.expr(a));
    this.e(0x10, ...uleb(f.index));
  }
  stmts(list) { list.forEach((s) => this.stmt(s)); }
  stmt(s) {
    switch (s.k) {
      case "let":
        if (this.locals.has(s.name)) this.err(`'${s.name}' is already declared`, s.line);
        this.expr(s.e);
        this.locals.set(s.name, this.locals.size);
        this.e(0x21, ...uleb(this.locals.get(s.name)));
        break;
      case "assign":
        if (s.target.k === "var") {
          if (!this.locals.has(s.target.name)) this.err(`unknown name '${s.target.name}'`, s.line);
          this.expr(s.e);
          this.e(0x21, ...uleb(this.locals.get(s.target.name)));
        } else {
          this.expr(s.target.idx); this.e(0x41, 2, 0x74);
          this.expr(s.e);
          this.e(0x36, 2, 0);
        }
        break;
      case "if":
        this.expr(s.c); this.e(0x04, 0x40); this.depth++;
        this.stmts(s.a);
        if (s.b.length) { this.e(0x05); this.stmts(s.b); }
        this.depth--; this.e(0x0b);
        break;
      case "while": {
        this.e(0x02, 0x40); this.depth++;
        const k = this.depth;
        this.e(0x03, 0x40); this.depth++;
        this.loops.push(k);
        this.expr(s.c); this.e(0x45, 0x0d, 1);
        this.stmts(s.body);
        this.e(0x0c, 0);
        this.loops.pop();
        this.depth -= 2; this.e(0x0b, 0x0b);
        break;
      }
      case "break":
      case "continue": {
        if (!this.loops.length) this.err(`'${s.k}' outside a loop`, s.line);
        const k = this.loops[this.loops.length - 1];
        this.e(0x0c, ...uleb(s.k === "break" ? this.depth - k : this.depth - (k + 1)));
        break;
      }
      case "return": this.expr(s.e); this.e(0x0f); break;
      case "expr": this.expr(s.e); this.e(0x1a); break;
      default: this.err(`bad statement ${s.k}`);
    }
  }
}

function compile(source, file = "core.mcl") {
  const state = { consts: Object.create(null), fns: new Map(), pages: 2 };
  new Parser(lex(PRELUDE, "prelude"), state).program();
  new Parser(lex(source, file), state).program();

  const fnIndex = new Map();
  [...state.fns.values()].forEach((fn, index) => fnIndex.set(fn.name, { fn, index }));

  const types = [];
  const typeOf = new Map();
  for (const { fn } of fnIndex.values()) {
    if (!typeOf.has(fn.params.length)) { typeOf.set(fn.params.length, types.length); types.push(fn.params.length); }
  }

  const bodies = [];
  for (const { fn } of fnIndex.values()) {
    const g = new FnGen(fn, fnIndex);
    g.stmts(fn.body);
    g.e(0x41, 0, 0x0b);
    const extra = g.locals.size - fn.params.length;
    const body = [...(extra ? [1, ...uleb(extra), 0x7f] : [0]), ...g.out];
    bodies.push([...uleb(body.length), ...body]);
  }

  const exported = [...fnIndex.values()].filter(({ fn }) => fn.exported);
  const bytes = [
    0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...section(1, vec(types.map((n) => [0x60, ...vec(Array.from({ length: n }, () => [0x7f])), 1, 0x7f]))),
    ...section(3, vec([...fnIndex.values()].map(({ fn }) => uleb(typeOf.get(fn.params.length))))),
    ...section(5, vec([[0, ...uleb(state.pages)]])),
    ...section(7, vec([[...str("memory"), 2, 0], ...exported.map(({ fn, index }) => [...str(fn.name), 0, ...uleb(index)])])),
    ...section(10, vec(bodies)),
  ];
  return {
    wasm: Uint8Array.from(bytes),
    consts: { ...state.consts },
    exports: exported.map(({ fn }) => fn.name),
    pages: state.pages,
  };
}

module.exports = { compile, MclError };
