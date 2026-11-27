const fs = require("node:fs");
const esbuild = require("esbuild");
const entry = "dist/lantern.js";
const build = esbuild.buildSync({
  entryPoints: ["view.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  legalComments: "none",
});
const script = build.outputFiles[0].text;
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync(entry, script);
const template = fs.readFileSync("index.html", "utf8");
const tag = `<script src="${entry}"></script>`;
if (!template.includes(tag))
  throw Error("Missing browser entry point in index.html");
const standalone = template.replace(
  tag,
  () => `<script>${script.replace(/<\/script/gi, "<\\/script")}</script>`,
);
fs.writeFileSync("Lantern-Below.html", standalone);
console.log(`Standalone game: ${Buffer.byteLength(standalone)} bytes`);
