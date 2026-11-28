"use strict";
// Every embedded media asset must have a row in CREDITS.md. The game currently ships none.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("../build.cjs");

const credits = fs.readFileSync(path.join(__dirname, "..", "CREDITS.md"), "utf8");
const listed = credits
  .split("\n")
  .filter((l) => /^\|/.test(l) && !/^\|\s*(Title|---)/.test(l))
  .filter((l) => l.replace(/[|\s-]/g, "").length > 0);

const { html } = build();
const embedded = html.match(/data:(image|audio|video|font|application\/(font|x-font|vnd\.ms-fontobject))[^"')\s]*/gi) || [];
const external = html.match(/\b(?:src|href)\s*=\s*["'](?!#)[^"']+["']/gi) || [];

assert.equal(embedded.length, listed.length, `embedded media (${embedded.length}) must match CREDITS.md rows (${listed.length})`);
assert.deepEqual(external, [], "the page references no external files");
assert.match(credits, /No third-party assets are bundled/);
console.log("credits: ok");
