const { fresh } = require("../world.cjs");
const {
  dirs,
  tileIndex,
  walkingDistancesFrom,
  manhattanDistance: distance,
  sameTile,
  walk,
} = require("../grid.cjs");
const {
  regions,
  roles,
  names,
  items,
  tactics,
  potions,
} = require("./catalog.cjs");
const inv = require("./inventory.cjs");
const { step, deploy, march } = require("./formation.cjs");
const copyPoint = (p) => ({ x: p.x, y: p.y });
function log(s, text) {
  s.log.unshift(text);
  s.log = s.log.slice(0, 4);
}
function createCampaign(seed) {
  return {
    version: 1,
    seed: seed >>> 0,
    turn: 0,
    coins: 12,
    rations: 2,
    zone: "town",
    active: 0,
    solo: false,
    party: [inv.recruit(0)],
    maps: {},
    relics: [],
    state: "playing",
    log: ["Britain • recruit allies and choose an expedition."],
  };
}
function mapFor(seed, index) {
  const region = regions[index],
    base = fresh((seed + Math.imul(index + 1, 9011)) >>> 0);
  const map = {
    tiles: base.tiles,
    entrance: { x: 1, y: 1 },
    quest: { ...base.exit, done: false },
    chests: base.chests.map((p, i) => ({
      ...copyPoint(p),
      open: false,
      item: [region.reward, "coif", "collar", "blueRing"][i],
      potion: potions[(index * 2 + i) % 8],
    })),
    springs: base.fountains.map((p) => ({ ...p, charges: 2 })),
    hazards: [...base.loot, ...base.vials].map(copyPoint),
    enemies: [],
    ground: [],
  };
  if (index === 0) map.crevice = { ...copyPoint(base.rune), looted: false };
  map.enemies = base.enemies.map((p, i) => {
    const kind = region.foes[i % region.foes.length],
      hp = 6 + index * 2 + (kind === "troll" || kind === "drake" ? 5 : 0);
    return { ...copyPoint(p), kind, hp, max: hp, damage: 2 + index };
  });
  return map;
}
const currentMap = (s) => s.maps[s.zone];
const living = (s) => s.party.filter((m) => m.hp > 0);
function dieRoll(s, salt) {
  let v =
    Math.imul(s.seed ^ (s.turn + 1), 2654435761) ^
    Math.imul(salt + 1, 2246822519);
  return (v >>> 0) % 20;
}
const concealed = (m) =>
  m.status.invisible || inv.worn(m).some((g) => g.id === "blueRing");
function strike(s, m, e, bonus = 0) {
  if (
    dieRoll(s, m.dex + e.x * 3 + e.y) < Math.max(1, 5 - Math.floor(m.dex / 4))
  ) {
    log(s, `${m.name} misses.`);
    return;
  }
  const dmg =
    1 +
    Math.floor(m.str / 4) +
    (items[m.equipped.right?.id]?.damage || 0) +
    bonus;
  e.hp = Math.max(0, e.hp - dmg);
  log(s, `${m.name} hits ${names[e.kind]} for ${dmg}.`);
  if (!e.hp) {
    s.coins += 2;
    s.party.filter((p) => p.hp).forEach((p) => (p.xp += 2));
  }
}
function openNeighbor(map, from, target, retreat = false, allies = []) {
  const d = walkingDistancesFrom(map, target),
    here = d.get(tileIndex(from.x, from.y));
  return Object.values(dirs)
    .map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy }))
    .find(
      (p) =>
        walk(map, p.x, p.y) &&
        !allies.some((a) => sameTile(a, p)) &&
        !map.enemies.some((e) => e.hp && sameTile(p, e)) &&
        (retreat
          ? d.get(tileIndex(p.x, p.y)) > here
          : d.get(tileIndex(p.x, p.y)) === here - 1),
    );
}
function companions(s, marked, moved) {
  const map = currentMap(s);
  if (s.solo) return;
  for (const m of living(s)
    .filter(
      (p) =>
        p !== s.party[s.active] && !p.status.sleep && p.tactic !== "Command",
    )
    .sort((a, b) => b.dex - a.dex)) {
    const near = map.enemies
      .filter((e) => e.hp && distance(e, m) <= 4)
      .sort((a, b) => distance(m, a) - distance(m, b));
    const e = m.tactic === "Like" && marked?.hp ? marked : near[0];
    if (!e) continue;
    const gap = distance(m, e);
    if (m.tactic === "Retreat") {
      const p = openNeighbor(map, m, e, true, living(s));
      if (p && !moved.has(m)) step(m, p);
      continue;
    }
    if (
      m.tactic === "Rear" &&
      gap <= 3 &&
      walkingDistancesFrom(map, m).get(tileIndex(e.x, e.y)) <= 3
    ) {
      if (m.role === "healer" && m.mana > 0) {
        const hurt = living(s).find((p) => p.hp < p.max);
        if (hurt) {
          hurt.hp = Math.min(hurt.max, hurt.hp + 3);
          m.mana--;
          continue;
        }
      }
      strike(s, m, e);
      continue;
    }
    if (gap <= 1) strike(s, m, e, m.tactic === "Berserk" ? 1 : 0);
    else if (!moved.has(m)) {
      let target = e;
      if (m.tactic === "Flank") {
        const side = Object.values(dirs)
          .map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
          .filter((p) => walk(map, p.x, p.y))
          .sort(
            (a, b) =>
              distance(b, s.party[s.active]) - distance(a, s.party[s.active]),
          )[0];
        target = side || e;
      }
      const p = openNeighbor(map, m, target, false, living(s));
      if (p) step(m, p);
    }
  }
}
function enemyTurn(s) {
  const map = currentMap(s);
  map.enemies = map.enemies.filter((e) => e.hp);
  for (const e of map.enemies) {
    const target = living(s)
      .filter((p) => !concealed(p))
      .sort((a, b) => distance(a, e) - distance(b, e))[0];
    if (!target || distance(target, e) > 6) continue;
    const gap = distance(target, e);
    if (
      gap <= 1 ||
      (e.kind === "gazer" &&
        gap <= 3 &&
        walkingDistancesFrom(map, e).get(tileIndex(target.x, target.y)) <= 3)
    ) {
      if (dieRoll(s, target.dex + e.x + e.y) < Math.floor(target.dex / 5))
        continue;
      target.hp = Math.max(
        0,
        target.hp - Math.max(1, e.damage - Math.floor(inv.defense(target) / 3)),
      );
      if (e.kind === "snake" && !target.status.ward) target.status.poison = 3;
      if (e.kind === "gazer" && s.turn % 5 === 0) target.status.sleep = 2;
    } else {
      const p = openNeighbor(map, e, target);
      if (p && !living(s).some((m) => sameTile(m, p))) Object.assign(e, p);
    }
  }
}
function returnTown(s) {
  s.zone = "town";
  s.solo = false;
  for (const m of s.party) Object.assign(m, { x: 10, y: 10 });
}
function resolve(s, action) {
  if (s.state !== "playing") return false;
  const m = s.party[s.active],
    town = s.zone === "town",
    map = currentMap(s),
    [verb, arg, slot] = action.split(":");
  let marked = null;
  let moved = new Set();
  const deny = (text) => {
    log(s, text);
    return false;
  };
  if (verb === "select") {
    const i = Number(arg);
    if (!s.party[i]?.hp) return false;
    s.active = i;
    return true;
  }
  if (verb === "mode") {
    s.solo = !s.solo;
    return true;
  }
  if (verb === "tactic" && tactics.includes(arg)) {
    m.tactic = arg;
    return true;
  }
  if (verb === "recruit") {
    if (!town || s.party.length >= roles.length)
      return deny("Recruit at the inn; eight is a full party.");
    const ally = inv.recruit(s.party.length);
    s.party.push(ally);
    log(s, `${ally.name} the ${ally.role} joins.`);
    return true;
  }
  if (verb === "enter") {
    const index = regions.findIndex((r) => r.id === arg);
    if (!town || index < 0) return false;
    s.maps[arg] ??= mapFor(s.seed, index);
    s.zone = arg;
    const followers = living(s).filter((other) => other !== m);
    deploy(s.maps[arg], m, followers);
    log(s, regions[index].name);
    s.turn++;
    return true;
  }
  if (verb === "return") {
    if (town || !sameTile(m, map.entrance))
      return deny("Return to the stone arch at the entrance.");
    returnTown(s);
    s.turn++;
    return true;
  }
  if (verb === "rest" && town) {
    for (const member of s.party) {
      member.hp = member.max;
      member.mana = member.int;
      member.status = {};
    }
    s.rations = Math.max(2, s.rations);
    log(s, "Rested and provisioned at the inn.");
    s.turn++;
    return true;
  }
  if (verb === "meditate" && town) {
    const cost = m.rank * 4;
    if (m.xp < cost) return deny(`Meditation requires ${cost} experience.`);
    m.xp -= cost;
    m.rank++;
    m.str++;
    m.dex++;
    m.int++;
    m.max += 3;
    m.hp = m.max;
    m.mana = m.int;
    log(s, `${m.name} advances at the shrine.`);
    s.turn++;
    return true;
  }
  if (verb === "buy" && town) {
    if (!["boots", "pick", "shield", "helm"].includes(arg)) return false;
    if (s.coins < 4 || !inv.give(m, arg))
      return deny("Need four coins and free carrying capacity.");
    s.coins -= 4;
    return true;
  }
  if (verb === "equip") {
    if (!inv.equip(m, Number(arg), slot))
      return deny("That slot or equipped weight limit does not fit.");
    return true;
  }
  if (verb === "drop" && !town) {
    const index = Number(arg);
    if (!Number.isInteger(index) || !m.bag[index]) return false;
    map.ground.push({ ...copyPoint(m), gear: m.bag.splice(index, 1)[0] });
    return true;
  }
  if (verb === "drink") {
    if (!potions.includes(arg) || !inv.drink(m, arg))
      return deny("No vial of that color.");
  } else if (town) return false;
  else if (m.status.sleep && verb !== "wait")
    return deny("Asleep: wait, or drink a blue vial.");
  else if (Object.hasOwn(dirs, verb)) {
    const [dx, dy] = dirs[verb],
      p = { x: m.x + dx, y: m.y + dy };
    if (!walk(map, p.x, p.y)) return deny("Blocked passage.");
    marked = map.enemies.find((e) => e.hp && sameTile(e, p));
    if (marked) strike(s, m, marked);
    else {
      const followers = living(s).filter((o) => o !== m);
      const ally = followers.find((o) => sameTile(o, p));
      if (ally && (s.solo || ally.status.sleep))
        return deny("An ally occupies that tile.");
      if (ally) step(ally, m);
      step(m, p);
      if (!s.solo) moved = march(map, m, followers, ally);
      if (
        map.hazards.some((q) => sameTile(q, p)) &&
        !m.status.ward &&
        s.zone === "fen" &&
        m.equipped.feet?.id !== "boots"
      ) {
        m.status.poison = 4;
        log(s, "Toxic water seeps into your boots.");
      }
    }
  } else if (verb === "cast") {
    const distances = walkingDistancesFrom(map, m);
    const target = map.enemies
      .filter((e) => e.hp && distances.get(tileIndex(e.x, e.y)) <= 4)
      .sort((a, b) => distance(m, a) - distance(m, b))[0];
    if (!target || m.mana < 2)
      return deny("Spark needs 2 mana and a foe within four steps.");
    m.mana -= 2;
    strike(s, m, target, Math.floor(m.int / 4));
  } else if (verb === "use") {
    const here = (p) => sameTile(m, p);
    const chest = map.chests.find((p) => here(p) && !p.open),
      spring = map.springs.find(here),
      drop = map.ground.find(here);
    if (drop) {
      if (inv.carried(m) + items[drop.gear.id].weight > 2 * m.str)
        return deny("Backpack full.");
      m.bag.push(drop.gear);
      map.ground.splice(map.ground.indexOf(drop), 1);
    } else if (chest) {
      if (inv.carried(m) + items[chest.item].weight + 1 > 2 * m.str)
        return deny("Make space or select a stronger carrier.");
      inv.give(m, chest.item);
      m.vials[chest.potion] = (m.vials[chest.potion] || 0) + 1;
      chest.open = true;
      s.coins += 4;
      log(s, `Recovered ${items[chest.item].name} and a ${chest.potion} vial.`);
    } else if (map.crevice && here(map.crevice) && !map.crevice.looted) {
      if (!s.solo || m.role !== "mouse")
        return deny("A mouse could scout this drain alone.");
      if (!inv.give(m, "blueRing")) return deny("No space for the ring.");
      map.crevice.looted = true;
      m.xp += 4;
      log(s, "Pip slips between the bars and retrieves a blue ring.");
    } else if (here(map.quest) && !map.quest.done) {
      if (s.zone === "shame" && !s.rations)
        return deny("The explorer asks for food.");
      if (s.zone === "shame") s.rations--;
      map.quest.done = true;
      s.relics.push(s.zone);
      for (const member of living(s)) member.xp += 4;
      log(s, `Recovered ${regions.find((r) => r.id === s.zone).relic}.`);
      if (s.relics.length === regions.length) {
        s.state = "won";
        log(s, "All four roads to Britain are safe.");
        return true;
      }
    } else if (spring && spring.charges && m.hp < m.max) {
      spring.charges--;
      m.hp = Math.min(m.max, m.hp + 10);
      log(s, "Restored at the spring.");
    } else if (here(map.entrance)) return resolve(s, "return");
    else if (
      map.hazards.some(here) &&
      ["mine", "shame"].includes(s.zone) &&
      m.equipped.right?.id === "pick"
    ) {
      map.hazards = map.hazards.filter((p) => !here(p));
      s.coins += 6;
      log(s, "Mined six coins of ore.");
    } else return deny("Nothing to use here.");
  } else if (verb !== "wait") return false;
  s.turn++;
  if (!town) {
    companions(s, marked, moved);
    enemyTurn(s);
    for (const member of living(s)) inv.upkeep(member);
    if (!living(s).length) {
      s.state = "lost";
      log(s, "The expedition is lost.");
    } else if (!m.hp) s.active = s.party.indexOf(living(s)[0]);
  }
  return true;
}
module.exports = { createCampaign, resolve, mapFor, currentMap, living };
