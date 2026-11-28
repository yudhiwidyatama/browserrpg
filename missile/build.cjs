"use strict";
// Builds the standalone game: compiles the WebAssembly core with tools/mcl.cjs, bundles the
// client modules, and embeds both in a single offline HTML file. Needs only Node.
//
//   node missile/build.cjs   ->   missile/dist/Missile-Defense.html
//                                 missile/dist/core.wasm, missile/dist/missile.js

const fs = require("node:fs");
const path = require("node:path");
const { compile } = require("./tools/mcl.cjs");

const root = __dirname;
const dist = path.join(root, "dist");
const BUDGET = { wasm: 300 * 1024, html: 2 * 1024 * 1024 };

function build() {
  const core = compile(fs.readFileSync(path.join(root, "core", "missile.mcl"), "utf8"), "core/missile.mcl");
  if (!WebAssembly.validate(core.wasm)) throw new Error("The compiled core is not valid WebAssembly.");
  if (core.wasm.length > BUDGET.wasm) throw new Error(`core.wasm is ${core.wasm.length} bytes; the budget is ${BUDGET.wasm}.`);

  const modules = {};
  for (const file of fs.readdirSync(path.join(root, "client")).filter((f) => f.endsWith(".cjs"))) {
    modules[file] = fs.readFileSync(path.join(root, "client", file), "utf8");
  }
  modules["wasm.cjs"] = `module.exports = ${JSON.stringify({ base64: Buffer.from(core.wasm).toString("base64"), layout: core.consts })};`;

  const defs = Object.entries(modules)
    .map(([name, src]) => `${JSON.stringify(name)}: function (module, exports, require) {\n${src}\n}`)
    .join(",\n");
  const bundle = `(function () {
"use strict";
var defs = {\n${defs}\n};
var cache = {};
function load(name) {
  var key = name.replace(/^.*\\//, "");
  if (cache[key]) return cache[key].exports;
  if (!defs[key]) throw new Error("Missing module " + name);
  var module = (cache[key] = { exports: {} });
  defs[key](module, module.exports, load);
  return module.exports;
}
load("main.cjs");
})();`;
  const script = bundle.replace(/<\/script/gi, "<\\/script");

  const template = fs.readFileSync(path.join(root, "client", "index.html"), "utf8");
  if (!template.includes("<!--BUNDLE-->")) throw new Error("index.html has no <!--BUNDLE--> marker.");
  const html = template.replace("<!--BUNDLE-->", () => `<script>${script}</script>`);
  if (Buffer.byteLength(html) > BUDGET.html) throw new Error(`The standalone HTML is ${Buffer.byteLength(html)} bytes; the budget is ${BUDGET.html}.`);

  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "core.wasm"), core.wasm);
  fs.writeFileSync(path.join(dist, "missile.js"), script);
  fs.writeFileSync(path.join(dist, "Missile-Defense.html"), html);
  const web = writeWeb(modules, template, core);
  return { wasmBytes: core.wasm.length, htmlBytes: Buffer.byteLength(html), html, script, web };
}

// Multi-file variant of the same game (dist/web/index.html + part files). It works from file://
// like the standalone page and is meant for committing: every file stays small enough to review.
function writeWeb(allModules, template, core) {
  const webDir = path.join(dist, "web");
  fs.rmSync(webDir, { recursive: true, force: true });
  fs.mkdirSync(webDir, { recursive: true });
  // The WebAssembly bytes go into small wasmN.js files (base64 pieces) so each file can be
  // reviewed and checked on its own; wasm.cjs joins them at load time.
  const modules = { ...allModules };
  const b64 = Buffer.from(core.wasm).toString("base64");
  const pieces = [];
  for (let i = 0; i < b64.length; i += 3000) pieces.push(b64.slice(i, i + 3000));
  pieces.forEach((piece, i) => {
    fs.writeFileSync(path.join(webDir, `wasm${i + 1}.js`), `(window.__mdw = window.__mdw || []).push("${piece}");\n`);
  });
  modules["wasm.cjs"] = `module.exports = { base64: window.__mdw.join(""), layout: ${JSON.stringify(core.consts)} };`;
  const wrap = (name) => `__md[${JSON.stringify(name)}] = function (module, exports, require) {\n${modules[name]}\n};\n`.replace(/<\/script/gi, "<\\/script");
  const names = Object.keys(modules).sort();
  const parts = [];
  let current = null;
  for (const name of names) {
    const big = name === "wasm.cjs";
    if (big || !current || current.size > 18000) {
      current = { names: [], size: 0 };
      parts.push(current);
    }
    current.names.push(name);
    current.size += modules[name].length;
    if (big) current = null;
  }
  const files = [];
  parts.forEach((p, i) => {
    const file = `part${i + 1}.js`;
    fs.writeFileSync(path.join(webDir, file), `"use strict";\nvar __md = (window.__md = window.__md || {});\n${p.names.map(wrap).join("")}`);
    files.push(file);
  });
  const loader = `"use strict";
(function () {
  var defs = window.__md;
  var cache = {};
  function load(name) {
    var key = name.replace(/^.*\\//, "");
    if (cache[key]) return cache[key].exports;
    if (!defs[key]) throw new Error("Missing module " + name);
    var module = (cache[key] = { exports: {} });
    defs[key](module, module.exports, load);
    return module.exports;
  }
  load("main.cjs");
})();
`;
  fs.writeFileSync(path.join(webDir, "start.js"), loader);
  files.push("start.js");
  const wasmFiles = pieces.map((_, i) => `wasm${i + 1}.js`);
  const ordered = [...wasmFiles, ...files];
  const tags = ordered.map((f) => `<script src="${f}"></script>`).join("\n");
  fs.writeFileSync(path.join(webDir, "index.html"), template.replace("<!--BUNDLE-->", () => tags));
  return { dir: webDir, files: ["index.html", ...ordered] };
}

if (require.main === module) {
  const r = build();
  console.log(`core.wasm: ${r.wasmBytes} bytes; standalone game: ${r.htmlBytes} bytes`);
}

module.exports = { build, BUDGET };
