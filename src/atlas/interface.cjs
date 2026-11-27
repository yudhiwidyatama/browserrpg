const { createCampaign, resolve } = require("./campaign.cjs");
const { regions, items, slots, tactics, potions } = require("./catalog.cjs");
const { carried, weight, worn, defense } = require("./inventory.cjs");
const { paintScene } = require("./art/scene.cjs");
const { paintModel } = require("./art/mesh.cjs");
const { adventurer } = require("./art/figures.cjs");
const { createCamera } = require("../client/camera.cjs");
const { dirs } = require("../grid.cjs");
const SAVE = "lantern-regional-campaign-v1";
const fresh = () =>
  createCampaign(crypto.getRandomValues(new Uint32Array(1))[0]);
function installAtlas(audio, restoreClassic) {
  const entry = document.createElement("button");
  entry.id = "regional-campaign";
  entry.textContent = "Britain • Regional campaign";
  document.querySelector("header").append(entry);
  const panel = document.createElement("dialog");
  panel.setAttribute("aria-label", "Britain regional expedition");
  panel.style.cssText =
    "max-width:1120px;width:96vw;max-height:94vh;overflow:auto;background:#182735;color:#f0e9ce;border:1px solid #aa9566;border-radius:12px;padding:12px";
  panel.innerHTML = `<div class="bar"><h2 id="atlas-title">Britain</h2><button id="atlas-close">Back to classic</button></div><div class="game"><section><canvas id="atlas-map" tabindex="0" aria-label="Regional map: arrow keys or direction buttons move; E interacts"></canvas><p id="atlas-goal"></p><div id="atlas-actions" class="actions"></div><ol id="atlas-log" aria-live="polite"></ol></section><section><h2>Company &amp; equipment</h2><div id="atlas-party"></div><canvas id="atlas-portrait" width="180" height="160" style="width:110px;height:98px" aria-label="Active character equipment portrait"></canvas><p id="atlas-stats"></p><div id="atlas-pack"></div></section></div>`;
  document.body.append(panel);
  const el = (id) => panel.querySelector("#atlas-" + id);
  let state, camera;
  try {
    const loaded = JSON.parse(localStorage.getItem(SAVE));
    if (loaded?.version === 1 && loaded.party?.length && loaded.maps)
      state = loaded;
  } catch {}
  state ??= fresh();
  function button(parent, text, action, disabled = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.dataset.order = action;
    b.disabled = disabled;
    parent.append(b);
    return b;
  }
  function select(parent, label, options, value, order) {
    const tag = document.createElement("label");
    tag.textContent = label + " ";
    const input = document.createElement("select");
    for (const [id, title] of options) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = title;
      input.append(opt);
    }
    input.value = value;
    input.onchange = () => dispatch(order + input.value);
    tag.append(input);
    parent.append(tag);
  }
  function save() {
    try {
      localStorage.setItem(SAVE, JSON.stringify(state));
    } catch {}
  }
  function refresh() {
    if (!panel.open) return;
    const s = state,
      m = s.party[s.active],
      town = s.zone === "town",
      region = regions.find((r) => r.id === s.zone);
    audio.setScene(
      s.state !== "playing"
        ? null
        : town
          ? "harbor"
          : { sewer: "salt", mine: "ember", shame: "crown", fen: "salt" }[
              s.zone
            ],
    );
    el("title").textContent = town ? "Britain • Castle Ward" : region.name;
    el("goal").textContent =
      s.state === "won"
        ? "All four relics recovered. Britain welcomes your company home."
        : s.state === "lost"
          ? "Your company has fallen. Start a new regional expedition."
          : town
            ? `${s.relics.length}/4 relics • ${s.coins} coins • ${s.rations} rations. Recruit, provision, meditate or choose a route.`
            : `${region.subtitle}. ${s.maps[s.zone].quest.done ? "Return to the pale arch, then choose another route." : "Find the gold marker: " + region.relic + "."} Arrows/WASD move; E interacts. Turn ${s.turn}.`;
    const actions = el("actions");
    actions.replaceChildren();
    if (s.state === "playing") {
      if (town) {
        button(actions, "Recruit at inn", "recruit", s.party.length >= 8);
        button(actions, "Rest & provision", "rest");
        button(actions, "Meditate at shrine", "meditate");
        for (const r of regions)
          button(
            actions,
            (s.relics.includes(r.id) ? "✓ " : "") + r.name,
            "enter:" + r.id,
          );
        for (const id of ["helm", "shield", "boots", "pick"])
          button(actions, `${items[id].name} · 4 coins`, "buy:" + id);
      } else {
        for (const [dir, arrow] of [
          ["west", "↖"],
          ["north", "↗"],
          ["south", "↙"],
          ["east", "↘"],
        ])
          button(actions, arrow + " " + dir, dir);
        button(actions, "Interact [E]", "use");
        button(actions, "Cast spark [F]", "cast");
        button(actions, "Wait [.]", "wait");
        button(actions, "Return at arch", "return");
      }
      button(actions, s.solo ? "Solo → regroup" : "Party → solo", "mode");
    }
    button(actions, "New regional expedition", "restart");
    const party = el("party");
    party.replaceChildren();
    select(
      party,
      "Control",
      s.party.map((p, i) => [
        String(i),
        `${p.name} (${p.role}) ${p.hp}/${p.max}`,
      ]),
      String(s.active),
      "select:",
    );
    select(
      party,
      "Tactic",
      tactics.map((t) => [t, t]),
      m.tactic,
      "tactic:",
    );
    el("stats").textContent =
      `${s.solo ? "Solo" : "Party"} · STR ${m.str} / DEX ${m.dex} / INT ${m.int} · HP ${m.hp}/${m.max} · Mana ${m.mana}/${m.int} · Rank ${m.rank} · XP ${m.xp}/${4 * m.rank} · Defense ${defense(m)} · Load ${carried(m)}/${2 * m.str} stones · Worn ${weight(worn(m))}/${m.str}. ${Object.keys(m.status).join(", ")}`;
    const pack = el("pack");
    pack.replaceChildren();
    const equipped = document.createElement("p");
    equipped.textContent = slots
      .map((slot) => `${slot}: ${items[m.equipped[slot]?.id]?.name || "—"}`)
      .join(" · ");
    pack.append(equipped);
    for (const [i, g] of m.bag.entries()) {
      const item = items[g.id];
      for (const slot of item.slot === "finger"
        ? ["finger1", "finger2"]
        : [item.slot])
        button(pack, `Equip ${item.name} (${slot})`, `equip:${i}:${slot}`);
      if (!town) button(pack, "Drop " + item.name, "drop:" + i);
    }
    for (const color of potions.filter((c) => m.vials[c]))
      button(pack, `Drink ${color} ×${m.vials[color]}`, "drink:" + color);
    const log = el("log");
    log.replaceChildren(
      ...s.log.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
    const portrait = el("portrait"),
      ctx = portrait.getContext("2d");
    ctx.clearRect(0, 0, 180, 160);
    const preview = createCamera(180, 160, { x: 0, y: 0 }, true);
    const portraitCamera = {
      project: (x, y, z) => {
        const [a, b] = preview.project(x * 2.7, y * 2.7, z * 2.7);
        return [a, b + 38];
      },
    };
    paintModel(ctx, portraitCamera, 0, 0, (k) => adventurer(k, m));
    camera = paintScene(el("map"), s);
  }
  function dispatch(action) {
    if (action === "restart") {
      if (!confirm("Replace only your regional campaign?")) return;
      state = fresh();
    } else {
      const ok = resolve(state, action);
      if (ok && ["use", "cast", "meditate", "recruit"].includes(action))
        audio.effect(
          { use: "loot", cast: "flare", meditate: "mend", recruit: "trade" }[
            action
          ],
        );
    }
    refresh();
    save();
  }
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-order]");
    if (b) dispatch(b.dataset.order);
  });
  el("map").onclick = (e) => {
    if (!camera || state.zone === "town") return;
    const r = el("map").getBoundingClientRect(),
      p = camera.tileAt(e.clientX - r.left, e.clientY - r.top),
      m = state.party[state.active];
    for (const [dir, [dx, dy]] of Object.entries(dirs))
      if (p.x === m.x + dx && p.y === m.y + dy) return dispatch(dir);
    if (p.x === m.x && p.y === m.y) dispatch("use");
  };
  panel.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (
      e.target.tagName === "SELECT" ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.repeat
    )
      return;
    const action = {
      arrowup: "north",
      arrowdown: "south",
      arrowleft: "west",
      arrowright: "east",
      w: "north",
      a: "west",
      s: "south",
      d: "east",
      e: "use",
      f: "cast",
      ".": "wait",
    }[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      dispatch(action);
    }
  });
  entry.onclick = () => {
    panel.showModal();
    refresh();
    el("map").focus();
    save();
  };
  el("close").onclick = () => panel.close();
  panel.onclose = restoreClassic;
  window.addEventListener("resize", () => {
    if (panel.open) camera = paintScene(el("map"), state);
  });
}
module.exports = { installAtlas };
