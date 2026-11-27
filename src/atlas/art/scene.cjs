const { createCamera } = require("../../client/camera.cjs");
const { paintPerson } = require("../../client/person.cjs");
const { paintModel } = require("./mesh.cjs");
const { adventurer, creature } = require("./figures.cjs");
const { landmark, terrain } = require("./scenery.cjs");
const { N, tileIndex, sameTile } = require("../../grid.cjs");
const { regions } = require("../catalog.cjs");
function paintScene(canvas, s) {
  const ctx = canvas.getContext("2d"),
    rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = rect.width,
    h = rect.height,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hero = s.party[s.active],
    town = s.zone === "town",
    map = s.maps[s.zone],
    r = regions.find((r) => r.id === s.zone),
    camera = createCamera(w, h, town ? { x: 10, y: 10 } : hero, town);
  let bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, town ? "#68848a" : "#25343a");
  bg.addColorStop(1, "#111923");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const visible = [];
  const small = town ? 7 : 0,
    large = town ? 13 : N - 1;
  for (let sum = 2 * small; sum <= 2 * large; sum++)
    for (let x = small; x <= large; x++) {
      let y = sum - x;
      if (y < small || y > large) continue;
      let [px, py] = camera.project(x, y);
      if (
        px < -camera.halfWidth ||
        px > w + camera.halfWidth ||
        py < -camera.halfWidth ||
        py > h + 3 * camera.halfWidth
      )
        continue;
      const hash = (Math.imul(x + 19, 137) + y * 23 + s.seed) >>> 0;
      const same = (p) => p.x === x && p.y === y;
      let hazard = !town && map.hazards.some(same);
      let color = town
        ? (x + y) % 3
          ? "#a1a48b"
          : "#acaa92"
        : hazard
          ? r.water
          : r.floor;
      ctx.beginPath();
      [
        [x - 0.5, y - 0.5],
        [x + 0.5, y - 0.5],
        [x + 0.5, y + 0.5],
        [x - 0.5, y + 0.5],
      ].forEach(([a, b], i) => {
        const [cx, cy] = camera.project(a, b);
        i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy);
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#26343935";
      ctx.stroke();
      visible.push({ x, y, hash, same, hazard });
    }
  for (const { x, y, hash, same, hazard } of visible) {
    const put = (fn, scale = 1) => paintModel(ctx, camera, x, y, fn, scale);
    if (town) {
      const kind =
        (x === 7 || x === 13) && y === 7
          ? "tower"
          : x === 8 && y === 9
            ? "inn"
            : x === 11 && y === 9
              ? "shrine"
              : x === 10 && y === 7
                ? "arch"
                : null;
      if (kind) put((k) => landmark(k, kind), 1.25);
    } else if (!map.tiles[tileIndex(x, y)]) {
      put((k) => terrain(k, s.zone, hash));
      continue;
    } else {
      const chest = map.chests.find(same);
      let kind = same(map.entrance)
        ? "arch"
        : same(map.quest) && !map.quest.done
          ? "relic"
          : chest
            ? chest.open
              ? "open"
              : "chest"
            : map.springs.some(same)
              ? "spring"
              : null;
      if (kind === "relic" && s.zone === "shame")
        put((k) => adventurer(k, { role: "scout", equipped: {} }));
      else if (kind) put((k) => landmark(k, kind));
      if (map.crevice && !map.crevice.looted && same(map.crevice))
        put((k) => {
          k.block(0, 0, 0.01, 0.59, 0.42, 0.04, "#273d3f");
          for (let i = -2; i <= 2; i++)
            k.block(i * 0.11, 0, 0.05, 0.04, 0.43, 0.045, "#a4a99e");
        });
      if (map.ground.some(same))
        put((k) => k.block(0, 0, 0, 0.3, 0.23, 0.18, "#af8054"));
      if (hazard && (s.zone === "shame" || s.zone === "mine"))
        put((k) => k.globe([0, 0, 0.1], [0.22, 0.15, 0.13], "#e1ba5d", 6, 3));
      for (const e of map.enemies.filter((e) => e.hp && same(e)))
        put((k) => creature(k, e.kind));
    }
    const group = s.party.filter((p) => p.hp && same(p));
    group
      .slice(0, 3)
      .sort((a, b) => (a === hero) - (b === hero))
      .forEach((m, i) =>
        paintPerson(
          ctx,
          camera,
          x + 0.16 * i,
          y - 0.13 * i,
          m,
          m.role === "mouse" ? 0.66 : 0.87,
        ),
      );
  }
  if (!town) {
    const step = w < 420 ? 2.5 : 4,
      origin = 9;
    ctx.fillStyle = "#192630";
    ctx.fillRect(5, 5, N * step + 8, N * step + 8);
    function dot(p, color) {
      ctx.fillStyle = color;
      ctx.fillRect(origin + p.x * step, origin + p.y * step, step, step);
    }
    map.tiles.forEach((v, i) => {
      if (v) dot({ x: i % N, y: Math.floor(i / N) }, "#71847e");
    });
    dot(map.entrance, "#acd5df");
    if (!map.quest.done) dot(map.quest, "#ffcf68");
    if (hero.status.sight) {
      map.chests.filter((c) => !c.open).forEach((p) => dot(p, "#eeaa72"));
      map.enemies.forEach((p) => dot(p, "#ff6c70"));
    }
    s.party
      .filter((p) => p.hp)
      .forEach((p) => dot(p, sameTile(p, hero) ? "#55fff1" : "#9db39a"));
  }
  return camera;
}
module.exports = { paintScene };
