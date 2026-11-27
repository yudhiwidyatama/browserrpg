const fs = require("node:fs");
let html = fs.readFileSync("index.html", "utf8");
for (const name of ["game.js", "view.js"])
  html = html.replace(
    `<script src="${name}"></script>`,
    () => `<script>\n${fs.readFileSync(name, "utf8")}\n</script>`,
  );
fs.writeFileSync("Lantern-Below.html", html);
console.log("Standalone HTML bytes:", Buffer.byteLength(html));
