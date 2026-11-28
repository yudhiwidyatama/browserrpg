"use strict";
(function () {
  var defs = window.__md;
  var cache = {};
  function load(name) {
    var key = name.replace(/^.*\//, "");
    if (cache[key]) return cache[key].exports;
    if (!defs[key]) throw new Error("Missing module " + name);
    var module = (cache[key] = { exports: {} });
    defs[key](module, module.exports, load);
    return module.exports;
  }
  load("main.cjs");
})();
