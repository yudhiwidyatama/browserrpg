"use strict";
const Lantern = (() => {
  const N = 21,
    dirs = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] },
    steps = Object.values(dirs),
    k = (x, y) => y * N + x,
    dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const themes = [
    {
      name: "The Salt Archive",
      mob: "Salt Scribe",
      hp: 5,
      atk: 2,
      range: 6,
      rooms: 9,
      weapon: "Brine Knife",
      bonus: 2,
      water: 8,
    },
    {
      name: "The Ember Foundry",
      mob: "Furnace Brute",
      hp: 10,
      atk: 4,
      range: 4,
      rooms: 5,
      weapon: "Ember Cleaver",
      bonus: 4,
      water: 11,
    },
    {
      name: "The Crown Vault",
      mob: "Amethyst Shade",
      hp: 9,
      atk: 3,
      range: 9,
      rooms: 13,
      weapon: "Prism Glaive",
      bonus: 6,
      water: 14,
    },
  ];
  const chapters = themes.map((t) => t.name),
    shops = [
      {
        x: 8,
        y: 10,
        name: "Tide Smith",
        stock: [
          ["Hookblade", 1, 5],
          ["Tide Sabre", 3, 14],
        ],
      },
      {
        x: 12,
        y: 10,
        name: "Crown Forge",
        stock: [
          ["Sun Hammer", 5, 26],
          ["Dawn Pike", 8, 44],
        ],
      },
    ];
  function rng(seed) {
    let n = seed >>> 0;
    return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  }
  const walk = (s, x, y) =>
    x >= 0 && y >= 0 && x < N && y < N && s.tiles[k(x, y)] === 1;
  function flood(s, p, blocked = new Set()) {
    let q = [p],
      d = new Map([[k(p.x, p.y), 0]]);
    for (let i = 0; i < q.length; i++) {
      let a = q[i];
      for (let [dx, dy] of steps) {
        let x = a.x + dx,
          y = a.y + dy,
          id = k(x, y);
        if (walk(s, x, y) && !d.has(id) && !blocked.has(id)) {
          d.set(id, 1 + d.get(k(a.x, a.y)));
          q.push({ x, y });
        }
      }
    }
    return d;
  }
  function note(s, text) {
    s.log.unshift(text);
    s.log = s.log.slice(0, 6);
  }
  function build(s) {
    const rand = rng(s.seed + 7919 * s.floor),
      t = themes[s.floor - 1],
      pick = (a) => Math.floor(rand() * a.length);
    s.tiles = Array(N * N).fill(0);
    const carve = (x, y) => (s.tiles[k(x, y)] = 1);
    let stack = [{ x: 1, y: 1 }];
    carve(1, 1);
    while (stack.length) {
      let a = stack.at(-1),
        opts = steps.filter(([dx, dy]) => {
          let x = a.x + 2 * dx,
            y = a.y + 2 * dy;
          return x > 0 && x < N - 1 && y > 0 && y < N - 1 && !s.tiles[k(x, y)];
        });
      if (!opts.length) {
        stack.pop();
        continue;
      }
      let [dx, dy] = opts[pick(opts)],
        b = { x: a.x + dx * 2, y: a.y + dy * 2 };
      carve(a.x + dx, a.y + dy);
      carve(b.x, b.y);
      stack.push(b);
    }
    for (let i = 0; i < t.rooms; i++) {
      let x = 1 + 2 * Math.floor(rand() * 9),
        y = 1 + 2 * Math.floor(rand() * 9);
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) carve(x + a, y + b);
    }
    Object.assign(s.hero, { x: 1, y: 1 });
    s.zone = "dungeon";
    s.seal = false;
    const d = flood(s, s.hero),
      ids = [...d.keys()]
        .filter((i) => d.get(i) >= 5)
        .sort((a, b) => d.get(a) - d.get(b));
    const point = (id) => ({ x: id % N, y: Math.floor(id / N) });
    s.exit = point(ids.pop());
    s.rune = point(ids.splice(Math.floor(ids.length * 0.65), 1)[0]);
    // Sample near, middle and deep distance bands so fountains are not all in one room.
    s.fountains = [0.12, 0.47, 0.86].map((fr) => ({
      ...point(ids.splice(Math.floor(ids.length * fr), 1)[0]),
      charges: 2,
    }));
    const take = () => point(ids.splice(pick(ids), 1)[0]);
    s.chests = Array.from({ length: 4 }, (_, i) => ({
      ...take(),
      open: false,
      coins: 3 + s.floor + Math.floor(rand() * 5),
      vial: i === 1,
      weapon: i === 0 ? t.weapon : null,
    }));
    s.loot = Array.from({ length: 5 }, () => ({
      ...take(),
      coins: 1 + s.floor,
    }));
    s.loot.push({ ...take(), weapon: t.weapon });
    s.vials = Array.from({ length: 3 }, take);
    s.enemies = Array.from({ length: 4 + s.floor }, (_, i) => {
      let boss = s.floor === 3 && i === 0,
        hp = boss ? 21 : t.hp;
      return {
        ...take(),
        name: boss ? "Crown Warden" : t.mob,
        boss,
        hp,
        max: hp,
        atk: boss ? 5 : t.atk,
        range: boss ? 6 : t.range,
        coins: boss ? 15 : s.floor + 2,
      };
    });
    note(s, t.name + ": find the gold seal.");
  }
  function fresh(seed) {
    let s = {
      version: 2,
      seed: seed >>> 0,
      floor: 1,
      turn: 0,
      state: "playing",
      hero: {
        hp: 24,
        max: 24,
        power: 4,
        potions: 2,
        cd: 0,
        xp: 0,
        rank: 1,
        coins: 5,
        weapon: "Lantern Staff",
        gear: { "Lantern Staff": 0 },
      },
      log: [],
    };
    build(s);
    return s;
  }
  const attack = (h) => h.power + h.gear[h.weapon];
  function gear(s, name, bonus) {
    let h = s.hero;
    if (Object.hasOwn(h.gear, name)) return;
    h.gear[name] = bonus;
    if (bonus > h.gear[h.weapon]) h.weapon = name;
    note(s, `Found ${name} (+${bonus} attack).`);
  }
  function collect(s) {
    let h = s.hero,
      t = themes[s.floor - 1];
    for (const o of s.loot.filter((p) => !dist(h, p))) {
      if (o.coins) {
        h.coins += o.coins;
        note(s, `Collected ${o.coins} coins.`);
      }
      if (o.weapon) gear(s, o.weapon, t.bonus);
    }
    s.loot = s.loot.filter((p) => dist(h, p));
    let i = s.vials.findIndex((p) => !dist(h, p));
    if (i >= 0) {
      s.vials.splice(i, 1);
      h.potions++;
      note(s, "Vial collected.");
    }
    if (!s.seal && !dist(h, s.rune)) {
      s.seal = true;
      note(s, "Seal recovered!");
    }
  }
  function reap(s) {
    let h = s.hero;
    for (let e of s.enemies.filter((e) => e.hp <= 0)) {
      s.loot.push({ x: e.x, y: e.y, coins: e.coins });
      note(s, `${e.name} drops ${e.coins} coins.`);
      if (++h.xp % 3 === 0) {
        h.rank++;
        h.power++;
        h.max += 3;
        h.hp = Math.min(h.max, h.hp + 5);
        note(s, "Rank up!");
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }
  function enemies(s) {
    let h = s.hero;
    for (let e of s.enemies) {
      if (dist(e, h) === 1) {
        h.hp = Math.max(0, h.hp - e.atk);
        note(s, `${e.name} hits for ${e.atk}.`);
        if (!h.hp) {
          s.state = "lost";
          note(s, "Your lantern fades.");
          break;
        }
        continue;
      }
      if (dist(e, h) > e.range) continue;
      let d = flood(
          s,
          h,
          new Set(s.enemies.filter((p) => p !== e).map((p) => k(p.x, p.y))),
        ),
        n = d.get(k(e.x, e.y));
      if (!n || n > e.range + 2) continue;
      for (let [dx, dy] of steps) {
        if (d.get(k(e.x + dx, e.y + dy)) === n - 1) {
          e.x += dx;
          e.y += dy;
          break;
        }
      }
    }
  }
  const atShop = (s) =>
    s.zone === "surface" ? shops.find((o) => !dist(s.hero, o)) : null;
  function act(s, a) {
    if (s.state !== "playing") return false;
    let h = s.hero,
      t = themes[s.floor - 1];
    const fail = (m) => {
      note(s, m);
      return false;
    };
    if (a === "travel") {
      if (s.zone === "surface") {
        if (h.x !== 10 || h.y !== 10)
          return fail("Return to the central lift (gold ring).");
        s.zone = "dungeon";
        Object.assign(h, s.anchor);
        note(s, "Back in the dungeon.");
      } else {
        if (s.enemies.some((e) => dist(h, e) <= 2))
          return fail("Too close to a foe to recall.");
        s.anchor = { x: h.x, y: h.y };
        s.zone = "surface";
        Object.assign(h, { x: 10, y: 10 });
        note(s, "Harbor Market: walk onto a striped stall to trade.");
      }
      s.turn++;
      return true;
    }
    if (s.zone === "surface") {
      let shop = atShop(s);
      if (Object.hasOwn(dirs, a)) {
        let [dx, dy] = dirs[a],
          x = h.x + dx,
          y = h.y + dy;
        if (x < 7 || x > 13 || y < 8 || y > 12)
          return fail("The promenade ends here.");
        Object.assign(h, { x, y });
      } else if (/^buy[01]$/.test(a) && shop) {
        let [name, bonus, price] = shop.stock[Number(a.slice(-1))];
        if (Object.hasOwn(h.gear, name)) return fail("Already owned.");
        if (h.coins < price) return fail(`Need ${price - h.coins} more coins.`);
        h.coins -= price;
        gear(s, name, bonus);
      } else return fail("Visit a stall or return to the lift.");
      s.turn++;
      return true;
    }
    if (Object.hasOwn(dirs, a)) {
      let [dx, dy] = dirs[a],
        x = h.x + dx,
        y = h.y + dy;
      if (!walk(s, x, y)) return fail("Stone blocks the way.");
      let e = s.enemies.find((p) => p.x === x && p.y === y);
      if (e) {
        e.hp -= attack(h);
        note(s, `${h.weapon}: ${attack(h)} damage.`);
      } else {
        Object.assign(h, { x, y });
        collect(s);
      }
    } else if (a === "use" || a === "exit") {
      let chest = s.chests.find((o) => !dist(h, o)),
        f = s.fountains.find((o) => !dist(h, o));
      if (chest) {
        if (chest.open) return fail("Chest is empty.");
        chest.open = true;
        h.coins += chest.coins;
        if (chest.vial) h.potions++;
        note(
          s,
          `Chest: ${chest.coins} coins${chest.vial ? " and a vial" : ""}.`,
        );
        if (chest.weapon) gear(s, chest.weapon, t.bonus);
      } else if (f) {
        if (!f.charges || h.hp === h.max)
          return fail(
            !f.charges ? "The spring is dry." : "Already at full health.",
          );
        f.charges--;
        let gain = Math.min(t.water, h.max - h.hp);
        h.hp += gain;
        note(s, `Spring restores ${gain} health.`);
      } else if (!dist(h, s.exit)) {
        if (!s.seal || s.enemies.some((e) => e.boss))
          return fail("Recover the seal and defeat any Warden first.");
        s.turn++;
        if (s.floor === 3) {
          s.state = "won";
          note(s, "The vault opens. Dawn returns.");
        } else {
          s.floor++;
          h.hp = Math.min(h.max, h.hp + 8);
          h.cd = 0;
          build(s);
        }
        return true;
      } else return fail("Stand on a chest, spring, or exit.");
    } else if (a === "pulse") {
      if (h.cd) return fail(`Flare ready in ${h.cd} turns.`);
      let d = flood(s, h),
        hits = s.enemies.filter((e) => (d.get(k(e.x, e.y)) ?? Infinity) <= 2);
      if (!hits.length) return fail("No foe within two walking steps.");
      hits.forEach((e) => (e.hp -= attack(h) + 2));
      h.cd = 4;
      note(s, "Lantern flare!");
    } else if (a === "heal") {
      if (!h.potions || h.hp === h.max) return fail("Cannot use a vial now.");
      h.potions--;
      h.hp = Math.min(h.max, h.hp + 10);
      note(s, "Vial consumed.");
    } else if (a !== "wait") return false;
    s.turn++;
    if (a !== "pulse" && h.cd) h.cd--;
    reap(s);
    enemies(s);
    return true;
  }
  return {
    N,
    dirs,
    chapters,
    themes,
    shops,
    k,
    dist,
    flood,
    walk,
    fresh,
    act,
    attack,
    atShop,
  };
})();
if (typeof module !== "undefined") module.exports = Lantern;
