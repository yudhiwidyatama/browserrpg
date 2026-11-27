const { items, slots, roles } = require("./catalog.cjs");
function recruit(index) {
  const [name, role, str, dex, int] = roles[index];
  const member = {
    name,
    role,
    str,
    dex,
    int,
    hp: 18 + str,
    max: 18 + str,
    mana: int,
    xp: 0,
    rank: 1,
    x: 10,
    y: 10,
    tactic: index ? "Front" : "Command",
    bag: [],
    equipped: {},
    status: {},
    vials: { yellow: 2, red: 1 },
  };
  member.equipped.body = { id: "cloth" };
  if (role !== "mouse") member.equipped.right = { id: "blade" };
  return member;
}
const worn = (member) => Object.values(member.equipped).filter(Boolean);
const weight = (gear) => gear.reduce((sum, o) => sum + items[o.id].weight, 0);
const carried = (m) =>
  weight([...m.bag, ...worn(m)]) +
  Object.values(m.vials).reduce((a, b) => a + b, 0);
function give(m, id) {
  if (carried(m) + items[id].weight > 2 * m.str) return false;
  m.bag.push({
    id,
    ...(id === "greenRing" || id === "blueRing" ? { charges: 18 } : {}),
  });
  return true;
}
function equip(m, index, slot) {
  const gear = m.bag[index];
  if (!gear || !slots.includes(slot)) return false;
  const spec = items[gear.id];
  if (
    !(
      spec.slot === slot ||
      (spec.slot === "finger" && slot.startsWith("finger"))
    )
  )
    return false;
  const old = m.equipped[slot];
  if (weight(worn(m)) + spec.weight - (old ? items[old.id].weight : 0) > m.str)
    return false;
  m.bag.splice(index, 1);
  if (old) m.bag.push(old);
  m.equipped[slot] = gear;
  return true;
}
const defense = (m) =>
  worn(m).reduce((n, g) => n + (items[g.id].armor || 0), 0) +
  (m.status.ward ? 5 : 0);
function drink(m, color) {
  if (!(m.vials[color] > 0)) return false;
  m.vials[color]--;
  switch (color) {
    case "yellow":
      m.hp = Math.min(m.max, m.hp + 10);
      break;
    case "red":
      delete m.status.poison;
      break;
    case "green":
      m.status.poison = 5;
      break;
    case "blue":
      delete m.status.sleep;
      break;
    case "orange":
      m.status.sleep = 3;
      break;
    case "purple":
      m.status.ward = 6;
      break;
    case "black":
      m.status.invisible = 6;
      break;
    case "white":
      m.status.sight = 8;
      break;
  }
  return true;
}
function upkeep(m) {
  if (!m.hp) return;
  if (m.status.poison && !m.status.ward) m.hp = Math.max(0, m.hp - 1);
  for (const key of Object.keys(m.status))
    if (--m.status[key] <= 0) delete m.status[key];
  for (const [slot, g] of Object.entries(m.equipped)) {
    if (g.id === "greenRing" && m.hp) m.hp = Math.min(m.max, m.hp + 1);
    if (g.charges && !--g.charges) delete m.equipped[slot];
  }
}
module.exports = {
  recruit,
  carried,
  worn,
  weight,
  give,
  equip,
  defense,
  drink,
  upkeep,
};
