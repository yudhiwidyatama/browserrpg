const G = require("../grid.cjs");
const { surface, shops } = require("../content.cjs");
const { createCamera } = require("./camera.cjs");
function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  const palettes = [
    ["#506c75", "#394a53", "#a3e4de", "#213646"],
    ["#815747", "#4f3737", "#ffab52", "#382b32"],
    ["#64577b", "#473851", "#c9a0ff", "#2c293f"],
    ["#9b9679", "#847152", "#8bd7c5", "#314e5b"],
  ];
  let camera, game, tileHalfWidth, tileHalfHeight;
  const project = (x, y, height = 0) => camera.project(x, y, height);
  function fillPolygon(points, color) {
    context.beginPath();
    points.forEach(([x, y], i) =>
      i ? context.lineTo(x, y) : context.moveTo(x, y),
    );
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }
  function tint(hex, f) {
    let n = parseInt(hex.slice(1), 16);
    return `rgb(${[16, 8, 0].map((b) => Math.min(255, Math.round(((n >> b) & 255) * f))).join(",")})`;
  }
  // Sweep profiles through 3D rings; orthographically project the faces.
  function mesh(x, y, rings, n, color, rot = 0) {
    let layers = rings.map(([a, r]) =>
      Array.from({ length: n }, (_, i) => {
        let t = rot + (i * 2 * Math.PI) / n;
        return [x + r * Math.cos(t), y + r * Math.sin(t), a];
      }),
    );
    let faces = [];
    for (let j = 1; j < layers.length; j++)
      for (let i = 0; i < n; i++) {
        let b = (i + 1) % n,
          p = [layers[j - 1][i], layers[j - 1][b], layers[j][b], layers[j][i]],
          t = rot + ((i + 0.5) * 2 * Math.PI) / n;
        faces.push({
          p,
          d: p.reduce((sum, q) => sum + q[0] + q[1] + q[2], 0),
          f: 0.79 + 0.2 * Math.cos(t + 1),
        });
      }
    for (let a of faces.sort((a, b) => a.d - b.d))
      fillPolygon(
        a.p.map((p) => project(...p)),
        tint(color, a.f),
      );
    fillPolygon(
      layers.at(-1).map((p) => project(...p)),
      tint(color, 1.1),
    );
  }
  const box = (x, y, a, side, height, color) =>
    mesh(
      x,
      y,
      [
        [a, side / Math.SQRT2],
        [a + height, side / Math.SQRT2],
      ],
      4,
      color,
      Math.PI / 4,
    );
  function ring(x, y, r, color, a = 0) {
    let [px, py] = project(x, y, a);
    context.beginPath();
    context.ellipse(
      px,
      py,
      tileHalfWidth * r * 1.414,
      tileHalfHeight * r * 1.414,
      0,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = color;
    context.lineWidth = Math.max(1.5, tileHalfWidth * 0.065);
    context.stroke();
  }
  function sword(x, y) {
    box(x, y, 0.04, 0.1, 0.23, "#9b6847");
    box(x, y, 0.26, 0.26, 0.06, "#e1b467");
    mesh(
      x,
      y,
      [
        [0.3, 0.09],
        [0.67, 0.08],
        [0.84, 0],
      ],
      4,
      "#e0e9fa",
    );
  }
  function drawActor(x, y, e) {
    if (!e) {
      ring(x, y, 0.4, "#8efaff");
      mesh(
        x,
        y,
        [
          [0.03, 0.22],
          [0.2, 0.32],
          [0.65, 0.18],
        ],
        6,
        "#44c4c6",
      );
      mesh(
        x,
        y,
        [
          [0.6, 0.16],
          [0.73, 0.22],
          [0.9, 0.17],
        ],
        6,
        "#f9c79d",
      );
      mesh(
        x,
        y,
        [
          [0.85, 0.26],
          [1.13, 0.09],
        ],
        6,
        "#3b8091",
      );
      if (game.hero.weapon === "Lantern Staff")
        box(x + 0.28, y, 0.37, 0.15, 0.23, "#ffc460");
      else sword(x + 0.25, y);
      return;
    }
    let m = e.boss ? 1.45 : 1;
    if (game.floor === 1) {
      mesh(
        x,
        y,
        [
          [0.02, 0.29],
          [0.51, 0.19],
          [0.77, 0.25],
          [0.9, 0.1],
        ],
        5,
        "#c3cdbf",
      );
      box(x, y + 0.19, 0.57, 0.12, 0.08, "#a33f55");
    } else if (game.floor === 2) {
      box(x, y, 0.01, 0.46, 0.54, "#995944");
      box(x, y, 0.55, 0.44, 0.28, "#dd804d");
      for (let dx of [-0.26, 0.26]) box(x + dx, y, 0.25, 0.22, 0.33, "#654648");
    } else {
      mesh(
        x,
        y,
        [
          [0.04, 0.1 * m],
          [0.28 * m, 0.36 * m],
          [0.64 * m, 0.24 * m],
          [0.83 * m, 0],
        ],
        6,
        e.boss ? "#a9536a" : "#aa7ac6",
      );
      for (let dx of [-0.16, 0.16])
        mesh(
          x + dx * m,
          y,
          [
            [0.58 * m, 0.1 * m],
            [0.98 * m, 0],
          ],
          4,
          e.boss ? "#ffcd68" : "#e0a1ea",
        );
    }
    if (e.hp !== e.max || e.boss) {
      let [a, b] = project(x, y, 1.12 * m);
      context.fillStyle = "#19212c";
      context.fillRect(a - tileHalfWidth * 0.32, b, tileHalfWidth * 0.64, 3);
      context.fillStyle = "#f79279";
      context.fillRect(
        a - tileHalfWidth * 0.32,
        b,
        (tileHalfWidth * 0.64 * e.hp) / e.max,
        3,
      );
    }
  }
  function drawScenery(x, y, onSurface) {
    const at = (p) => p.x === x && p.y === y;
    if (onSurface) {
      if (x === surface.lift.x && y === surface.lift.y)
        ring(x, y, 0.42, "#ffe071");
      let shop = shops.find(at);
      if (shop) {
        let col = shop.color;
        box(x, y, 0.02, 0.78, 0.26, "#986d46");
        for (let d of [-0.27, 0.27])
          box(x + d, y - 0.2, 0.28, 0.08, 0.54, "#705644");
        mesh(
          x,
          y,
          [
            [0.83, 0.56],
            [1.08, 0.4],
          ],
          4,
          col,
          Math.PI / 4,
        );
        ring(x, y, 0.43, "#ffdea2");
      }
      return;
    }
    if (game.exit.x === x && game.exit.y === y) {
      ring(x, y, 0.42, "#ffcb64");
      ring(x, y, 0.27, "#deb270");
    }
    if (!game.seal && at(game.rune)) {
      box(x, y, 0, 0.4, 0.13, "#6a6356");
      mesh(
        x,
        y,
        [
          [0.14, 0.03],
          [0.45, 0.23],
          [0.75, 0],
        ],
        4,
        "#ffdb68",
      );
    }
    const f = game.fountains.find(at);
    if (f) {
      mesh(
        x,
        y,
        [
          [0.02, 0.32],
          [0.11, 0.42],
          [0.25, 0.39],
        ],
        8,
        "#848d96",
      );
      mesh(
        x,
        y,
        [
          [0.25, 0.3],
          [0.26, 0.3],
        ],
        8,
        f.charges ? "#69e7f1" : "#677584",
      );
      if (f.charges)
        mesh(
          x,
          y,
          [
            [0.25, 0.1],
            [0.55, 0.05],
            [0.66, 0.08],
          ],
          6,
          "#9bf3ef",
        );
    }
    const b = game.chests.find(at);
    if (b) {
      box(x, y, 0.01, 0.47, 0.23, "#a3673e");
      if (!b.open) {
        mesh(
          x,
          y,
          [
            [0.23, 0.33],
            [0.38, 0.26],
          ],
          4,
          "#db9d50",
          Math.PI / 4,
        );
        box(x + 0.16, y + 0.16, 0.17, 0.1, 0.1, "#ffe078");
      } else box(x, y, 0.24, 0.34, 0.02, "#41352f");
    }
    if (game.vials.some(at))
      mesh(
        x,
        y,
        [
          [0, 0.11],
          [0.17, 0.15],
          [0.27, 0.06],
          [0.32, 0.06],
        ],
        6,
        "#89e4a5",
      );
    for (let o of game.loot.filter(at)) {
      if (o.weapon) sword(x, y);
      else
        mesh(
          x,
          y,
          [
            [0.02, 0.16],
            [0.13, 0.16],
          ],
          8,
          "#ffcd5d",
        );
    }
    let e = game.enemies.find(at);
    if (e) drawActor(x, y, e);
  }
  function draw(state) {
    game = state;
    const r = canvas.getBoundingClientRect(),
      w = r.width,
      h = r.height;
    if (!w || !h) return;
    let dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    let onSurface = game.zone === "surface",
      palette = palettes[onSurface ? 3 : game.floor - 1],
      bg = context.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, palette[3]);
    bg.addColorStop(1, "#0e1925");
    context.fillStyle = bg;
    context.fillRect(0, 0, w, h);
    camera = createCamera(
      w,
      h,
      onSurface ? surface.lift : game.hero,
      onSurface,
    );
    tileHalfWidth = camera.halfWidth;
    tileHalfHeight = camera.halfHeight;
    for (let sum = 0; sum < 2 * G.N - 1; sum++)
      for (let x = 0; x < G.N; x++) {
        let y = sum - x;
        if (
          y < 0 ||
          y >= G.N ||
          (onSurface &&
            (x < surface.bounds.minX ||
              x > surface.bounds.maxX ||
              y < surface.bounds.minY ||
              y > surface.bounds.maxY))
        )
          continue;
        let [px, py] = project(x, y);
        if (
          px < -tileHalfWidth ||
          px > w + tileHalfWidth ||
          py < -tileHalfWidth ||
          py > h + 3 * tileHalfWidth
        )
          continue;
        let hash = (x * 137 + y * 23 + game.seed) >>> 0;
        fillPolygon(
          [
            [x - 0.5, y - 0.5],
            [x + 0.5, y - 0.5],
            [x + 0.5, y + 0.5],
            [x - 0.5, y + 0.5],
          ].map((p) => project(...p)),
          tint(palette[0], 0.89 + (hash % 7) * 0.025),
        );
        if (!onSurface && !G.walk(game, x, y)) {
          box(x, y, 0, 0.95, 0.25 + (hash % 4) * 0.04, palette[1]);
          if (hash % 5 === 0)
            mesh(
              x,
              y,
              [
                [0.3, 0.19],
                [0.6, 0.14],
                [0.83, game.floor === 2 ? 0.12 : 0],
              ],
              game.floor === 3 ? 4 : 6,
              palette[2],
            );
        } else {
          drawScenery(x, y, onSurface);
          if (x === game.hero.x && y === game.hero.y) drawActor(x, y);
        }
      }
    if (!onSurface) {
      const step = Math.max(2, Math.min(4, Math.floor(w / 170))),
        off = 8;
      context.fillStyle = "#15222d";
      context.fillRect(4, 4, G.N * step + 8, G.N * step + 8);
      function dot(p, col) {
        context.fillStyle = col;
        context.fillRect(off + p.x * step, off + p.y * step, step, step);
      }
      game.tiles.forEach((walkable, i) => {
        if (walkable) dot({ x: i % G.N, y: Math.floor(i / G.N) }, "#617078");
      });
      game.fountains.filter((f) => f.charges).forEach((f) => dot(f, "#64d8ef"));
      game.chests.filter((b) => !b.open).forEach((b) => dot(b, "#c78d59"));
      dot(game.exit, "#ecd193");
      if (!game.seal) dot(game.rune, "#ffeb40");
      dot(game.hero, "#48ffe3");
    }
    if (game.state !== "playing") {
      context.fillStyle = "#0a1322be";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#ffe6a4";
      context.textAlign = "center";
      context.font = `bold ${Math.max(20, w * 0.04)}px Georgia`;
      context.fillText(
        game.state === "won"
          ? "The vault opens. You won!"
          : "Your lantern fades.",
        w / 2,
        h / 2,
      );
      context.textAlign = "left";
    }
  }

  return {
    draw,
    get camera() {
      return camera;
    },
  };
}
module.exports = { createRenderer };
