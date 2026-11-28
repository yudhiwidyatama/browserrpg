"use strict";
const assert = require("node:assert/strict");
const { compile, MclError } = require("../tools/mcl.cjs");

function load(src) {
  const out = compile(src, "test.mcl");
  assert.ok(WebAssembly.validate(out.wasm), "module validates");
  const inst = new WebAssembly.Instance(new WebAssembly.Module(out.wasm), {});
  return { ...out, x: inst.exports, mem: new Int32Array(inst.exports.memory.buffer) };
}

// arithmetic, precedence and constants
{
  const { x, consts } = load(`
    const A = 6; const B = A * 7;
    export fn calc(a, b) { return a + b * 2 - (a % 3) + B; }
    export fn bits(a) { return ((a << 4) | 3) ^ (a >> 1) & 255; }
    export fn neg(a) { return -a + ~a + !a; }
    export fn shifts(a) { return (a >> 1) * 1000 + (a >>> 28); }
  `);
  assert.equal(consts.B, 42);
  assert.equal(x.calc(10, 5), 10 + 5 * 2 - (10 % 3) + 42);
  assert.equal(x.bits(5), ((5 << 4) | 3) ^ ((5 >> 1) & 255));
  assert.equal(x.neg(5), -5 + ~5 + 0);
  assert.equal(x.shifts(-8), (-8 >> 1) * 1000 + (-8 >>> 28));
}

// loops, break, continue, nested control flow, recursion
{
  const { x } = load(`
    export fn sum(n) {
      let t = 0; let i = 0;
      while (i < n) {
        i += 1;
        if (i % 2 == 0) { continue; }
        if (i > 15) { break; }
        t += i;
      }
      return t;
    }
    export fn nested() {
      let c = 0; let i = 0;
      while (i < 4) {
        let j = 0;
        while (1) {
          j += 1;
          if (j > i) { break; }
          c += 1;
        }
        i += 1;
      }
      return c;
    }
    export fn fact(n) { if (n <= 1) { return 1; } return n * fact(n - 1); }
    export fn pick(a) { if (a == 1) { return 10; } else if (a == 2) { return 20; } else { return 30; } }
  `);
  assert.equal(x.sum(100), 1 + 3 + 5 + 7 + 9 + 11 + 13 + 15);
  assert.equal(x.nested(), 0 + 1 + 2 + 3);
  assert.equal(x.fact(10), 3628800);
  assert.deepEqual([x.pick(1), x.pick(2), x.pick(3)], [10, 20, 30]);
}

// memory, short-circuit evaluation and the 64-bit helpers
{
  const { x, mem } = load(`
    memory 1;
    fn bump(i) { m[i] += 1; return 1; }
    export fn sc(a) { let r = 0; if (a && bump(5)) { r += 1; } if (a || bump(6)) { r += 2; } return r; }
    export fn store(i, v) { m[i] = v; m[i + 1] = m[i] * 2; return m[i + 1]; }
    export fn mul(a, b) { return mulshr(a, b, 16); }
    export fn md(a, b, c) { return muldiv(a, b, c); }
    export fn root(n) { return isqrt(n); }
    export fn clampy(v) { return clamp(v, -5, 5) + abs(-3) + min(4, 9) + max(4, 9); }
  `);
  assert.equal(x.sc(0), 2 + 0);
  assert.equal(mem[5], 0); // `0 && bump()` never calls bump
  assert.equal(mem[6], 1); // `0 || bump()` does
  assert.equal(x.sc(1), 3);
  assert.equal(mem[6], 1); // `1 || bump()` short-circuits
  assert.equal(x.store(10, 21), 42);
  assert.equal(mem[10], 21);
  assert.equal(x.mul(327680, 65535), Math.floor((327680 * 65535) / 65536));
  assert.equal(x.md(2000000000, 65536, 4000000), Number((2000000000n * 65536n) / 4000000n));
  for (const n of [0, 1, 2, 3, 15, 16, 17, 999999, 550000000]) assert.equal(x.root(n), Math.floor(Math.sqrt(n)), `isqrt(${n})`);
  assert.equal(x.clampy(50), 5 + 3 + 4 + 9);
}

// errors are reported with file and line
for (const [src, pattern] of [
  ["fn a() { return b; }", /unknown name 'b'/],
  ["fn a() { return nope(1); }", /unknown function 'nope'/],
  ["fn a() { let x = 1; let x = 2; }", /already declared/],
  ["fn a() { break; }", /outside a loop/],
  ["fn a() { return 1 / 0; }", /division by zero/],
  ["fn a(x) { return x } ", /expected ';'/],
  ["fn a() { return abs(1, 2); }", /takes 1 arguments/],
  ["const X = y;", /not a compile-time constant|expected/],
]) {
  assert.throws(() => compile(src, "bad.mcl"), (e) => e instanceof MclError && pattern.test(e.message) && /bad\.mcl:1/.test(e.message), src);
}

console.log("mcl compiler: ok");
