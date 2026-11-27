"use strict";
(() => {
  const G = Lantern,
    $ = (id) => document.getElementById(id),
    canvas = $("map"),
    c = canvas.getContext("2d"),
    key = "lantern-below-v2",
    seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  let s;
  try {
    let v = JSON.parse(localStorage.getItem(key));
    if (v?.version === 2 && v.tiles?.length === G.N ** 2 && v.hero?.gear) s = v;
  } catch {}
  if (!s) s = G.fresh(seed());
  const palettes = [
    ["#506c75", "#394a53", "#a3e4de", "#213646"],
    ["#815747", "#4f3737", "#ffab52", "#382b32"],
    ["#64577b", "#473851", "#c9a0ff", "#2c293f"],
    ["#9b9679", "#847152", "#8bd7c5", "#314e5b"],
  ];
  let u, v, z, ox, oy;
  const proj = (x, y, a = 0) => [ox + (x - y) * u, oy + (x + y) * v - a * z];
  function poly(points, color) {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = color;
    c.fill();
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
      poly(
        a.p.map((p) => proj(...p)),
        tint(color, a.f),
      );
    poly(
      layers.at(-1).map((p) => proj(...p)),
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
    let [px, py] = proj(x, y, a);
    c.beginPath();
    c.ellipse(px, py, u * r * 1.414, v * r * 1.414, 0, 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = Math.max(1.5, u * 0.065);
    c.stroke();
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
  function actor(x, y, e) {
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
      if (s.hero.weapon === "Lantern Staff")
        box(x + 0.28, y, 0.37, 0.15, 0.23, "#ffc460");
      else sword(x + 0.25, y);
      return;
    }
    let m = e.boss ? 1.45 : 1;
    if (s.floor === 1) {
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
    } else if (s.floor === 2) {
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
      let [a, b] = proj(x, y, 1.12 * m);
      c.fillStyle = "#19212c";
      c.fillRect(a - u * 0.32, b, u * 0.64, 3);
      c.fillStyle = "#f79279";
      c.fillRect(a - u * 0.32, b, (u * 0.64 * e.hp) / e.max, 3);
    }
  }
  function deco(x, y, pal, surface) {
    const at = (p) => p.x === x && p.y === y;
    if (surface) {
      if (x === 10 && y === 10) ring(x, y, 0.42, "#ffe071");
      let shop = G.shops.find(at);
      if (shop) {
        let col = shop === G.shops[0] ? "#3e999d" : "#c36d59";
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
    if (s.exit.x === x && s.exit.y === y) {
      ring(x, y, 0.42, "#ffcb64");
      ring(x, y, 0.27, "#deb270");
    }
    if (!s.seal && at(s.rune)) {
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
    const f = s.fountains.find(at);
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
    const b = s.chests.find(at);
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
    if (s.vials.some(at))
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
    for (let o of s.loot.filter(at)) {
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
    let e = s.enemies.find(at);
    if (e) actor(x, y, e);
  }
  function draw() {
    const r = canvas.getBoundingClientRect(),
      w = r.width,
      h = r.height;
    if (!w || !h) return;
    let dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let surf = s.zone === "surface",
      pal = palettes[surf ? 3 : s.floor - 1],
      bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, pal[3]);
    bg.addColorStop(1, "#0e1925");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    u = Math.min(w / (surf ? 14 : 19), h / (surf ? 9 : 13));
    v = u / Math.sqrt(3);
    z = (u * 2) / Math.sqrt(3);
    let cx = surf ? 10 : s.hero.x,
      cy = surf ? 10 : s.hero.y;
    ox = w / 2 - (cx - cy) * u;
    oy = h * 0.53 - (cx + cy) * v;
    for (let sum = 0; sum < 2 * G.N - 1; sum++)
      for (let x = 0; x < G.N; x++) {
        let y = sum - x;
        if (y < 0 || y >= G.N || (surf && (x < 7 || x > 13 || y < 8 || y > 12)))
          continue;
        let [px, py] = proj(x, y);
        if (px < -u || px > w + u || py < -u || py > h + 3 * u) continue;
        let hash = (x * 137 + y * 23 + s.seed) >>> 0;
        poly(
          [
            [x - 0.5, y - 0.5],
            [x + 0.5, y - 0.5],
            [x + 0.5, y + 0.5],
            [x - 0.5, y + 0.5],
          ].map((p) => proj(...p)),
          tint(pal[0], 0.89 + (hash % 7) * 0.025),
        );
        if (!surf && !G.walk(s, x, y)) {
          box(x, y, 0, 0.95, 0.25 + (hash % 4) * 0.04, pal[1]);
          if (hash % 5 === 0)
            mesh(
              x,
              y,
              [
                [0.3, 0.19],
                [0.6, 0.14],
                [0.83, s.floor === 2 ? 0.12 : 0],
              ],
              s.floor === 3 ? 4 : 6,
              pal[2],
            );
        } else {
          deco(x, y, pal, surf);
          if (x === s.hero.x && y === s.hero.y) actor(x, y);
        }
      }
    if (!surf) {
      const step = Math.max(2, Math.min(4, Math.floor(w / 170))),
        off = 8;
      c.fillStyle = "#15222d";
      c.fillRect(4, 4, G.N * step + 8, G.N * step + 8);
      function dot(p, col) {
        c.fillStyle = col;
        c.fillRect(off + p.x * step, off + p.y * step, step, step);
      }
      s.tiles.forEach((v, i) => {
        if (v) dot({ x: i % G.N, y: Math.floor(i / G.N) }, "#617078");
      });
      s.fountains.filter((f) => f.charges).forEach((f) => dot(f, "#64d8ef"));
      s.chests.filter((b) => !b.open).forEach((b) => dot(b, "#c78d59"));
      dot(s.exit, "#ecd193");
      if (!s.seal) dot(s.rune, "#ffeb40");
      dot(s.hero, "#48ffe3");
    }
    if (s.state !== "playing") {
      c.fillStyle = "#0a1322be";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#ffe6a4";
      c.textAlign = "center";
      c.font = `bold ${Math.max(20, w * 0.04)}px Georgia`;
      c.fillText(
        s.state === "won" ? "The vault opens. You won!" : "Your lantern fades.",
        w / 2,
        h / 2,
      );
      c.textAlign = "left";
    }
  }
  const actions = document.querySelector(".actions");
  function btn(id, label) {
    let b = document.createElement("button");
    b.dataset.act = id;
    b.textContent = label;
    actions.append(b);
    return b;
  }
  let travel = btn("travel", "Surface [R]"),
    buys = [btn("buy0", ""), btn("buy1", "")];
  const use = document.querySelector("[data-act=exit]");
  use.textContent = "Interact [E]";
  document.querySelector(".legend").textContent =
    "Map: cyan = you · blue = spring · copper = chest · yellow = seal · gold ring = exit. Walk onto loot to pick it up.";
  function sync() {
    let h = s.hero,
      surf = s.zone === "surface",
      shop = G.atShop(s);
    $("floor").textContent =
      `${surf ? "Harbor Market" : "Floor " + s.floor + "/3"} · Turn ${s.turn}`;
    $("stats").textContent =
      `HP ${h.hp}/${h.max} · Rank ${h.rank} · ${h.coins} coins · ${h.potions} vials`;
    $("chapter").textContent = surf
      ? shop?.name || "Harbor Market"
      : G.chapters[s.floor - 1];
    let info = "";
    if (!surf) {
      let f = s.fountains.find((p) => !G.dist(p, h)),
        b = s.chests.find((p) => !G.dist(p, h));
      info = f
        ? `Spring: ${f.charges} drinks left. Press E.`
        : b
          ? b.open
            ? "Empty chest."
            : "Press E to open the chest."
          : !s.seal
            ? "Find the gold crystal."
            : s.enemies.some((e) => e.boss)
              ? "Defeat the Crown Warden."
              : "Reach the gold ring and press E.";
    } else
      info = shop
        ? "Choose a weapon below. Stronger weapons equip automatically."
        : "West stall: Tide Smith. East stall: Crown Forge. R at the central ring returns you to the dungeon.";
    $("goal").textContent =
      `${info} Equipped: ${h.weapon} · ${G.attack(h)} attack.`;
    travel.textContent = surf ? "Take lift [R]" : "Visit surface [R]";
    buys.forEach((b, i) => {
      b.hidden = !shop;
      if (shop) {
        let [name, bonus, price] = shop.stock[i];
        b.textContent = `${name} (+${bonus}) · ${price} coins`;
      }
    });
    document.querySelectorAll("[data-act]").forEach((b) => {
      b.disabled = s.state !== "playing";
      if (["exit", "heal", "pulse", "wait"].includes(b.dataset.act))
        b.hidden = surf;
    });
    document.querySelector("[data-act=pulse]").textContent = h.cd
      ? `Flare (${h.cd})`
      : "Flare [F]";
    $("log").replaceChildren(
      ...s.log.map((t) => {
        let li = document.createElement("li");
        li.textContent = t;
        return li;
      }),
    );
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {}
    draw();
  }
  function act(a) {
    G.act(s, a);
    sync();
  }
  document
    .querySelectorAll("[data-act]")
    .forEach((b) => (b.onclick = () => act(b.dataset.act)));
  const keys = {
    w: "north",
    arrowup: "north",
    a: "west",
    arrowleft: "west",
    s: "south",
    arrowdown: "south",
    d: "east",
    arrowright: "east",
    f: "pulse",
    h: "heal",
    ".": "wait",
    e: "use",
    r: "travel",
  };
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    let a = keys[e.key.toLowerCase()];
    if (a) {
      e.preventDefault();
      act(a);
    }
  });
  canvas.addEventListener("click", (e) => {
    let r = canvas.getBoundingClientRect(),
      a = (e.clientX - r.left - ox) / u,
      b = (e.clientY - r.top - oy) / v,
      x = Math.round((a + b) / 2),
      y = Math.round((b - a) / 2);
    for (let [dir, [dx, dy]] of Object.entries(G.dirs))
      if (x === s.hero.x + dx && y === s.hero.y + dy) {
        act(dir);
        return;
      }
    if (x === s.hero.x && y === s.hero.y && s.zone === "dungeon") act("use");
  });
  $("new").onclick = () => {
    if (s.state === "playing" && s.turn && !confirm("Replace your expedition?"))
      return;
    s = G.fresh(seed());
    sync();
  };
  window.addEventListener("resize", draw);
  sync();
})();
