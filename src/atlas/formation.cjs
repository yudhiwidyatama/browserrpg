const {
  N,
  dirs,
  tileIndex,
  sameTile,
  walkingDistancesFrom,
  manhattanDistance,
} = require("../grid.cjs");
const id = (p) => tileIndex(p.x, p.y);
const point = (i) => ({ x: i % N, y: Math.floor(i / N) });

function step(member, to) {
  const dx = to.x - member.x;
  const dy = to.y - member.y;
  const matches = ([, [x, y]]) => x === dx && y === dy;
  const heading = Object.entries(dirs).find(matches);
  if (!heading) return false;
  Object.assign(member, { x: to.x, y: to.y, facing: heading[0] });
  return true;
}

function deploy(map, leader, others) {
  const blocked = new Set(map.enemies.filter((e) => e.hp).map(id));
  const area = walkingDistancesFrom(map, map.entrance, blocked);
  const entrance = id(map.entrance);
  const places = [...area.keys()].filter((i) => i !== entrance);
  // Leave the first available exit clear for a solo scout.
  if (places.length > others.length) places.shift();
  Object.assign(leader, map.entrance);
  others.forEach((m, i) => Object.assign(m, point(places[i] ?? entrance)));
}

// Lateral and rear offsets in the leader's frame. If a wall clips a slot,
// use the nearest unclaimed floor tile on the leader's side of the wall.
const slots = [
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, 1],
  [1, 1],
  [-1, 2],
  [1, 2],
];
function march(map, leader, followers, alreadyMoved) {
  const [dx, dy] = dirs[leader.facing];
  const enemies = new Set(map.enemies.filter((e) => e.hp).map(id));
  const area = walkingDistancesFrom(map, leader, enemies);
  const claimed = new Set([id(leader)]);
  const goals = followers.map((m, i) => {
    const [side, back] = slots[i];
    const ideal = {
      x: leader.x - dy * side - dx * back,
      y: leader.y + dx * side - dy * back,
    };
    let best;
    let score = Infinity;
    for (const [j, dist] of area) {
      if (claimed.has(j)) continue;
      const p = point(j);
      const cost = manhattanDistance(p, ideal) * 2 + dist;
      if (cost < score) {
        best = p;
        score = cost;
      }
    }
    if (best) claimed.add(id(best));
    return best;
  });
  const moved = new Set([alreadyMoved]);
  // Retry a blocked rank after the rank ahead has vacated its tiles.
  for (let pass = 0; pass < followers.length; pass++) {
    let progress = false;
    followers.forEach((m, i) => {
      const goal = goals[i];
      if (!goal || moved.has(m) || m.status.sleep || sameTile(m, goal)) return;
      const allies = followers.filter((p) => p !== m).map(id);
      const blocked = new Set([...enemies, id(leader), ...allies]);
      if (blocked.has(id(goal))) return;
      const d = walkingDistancesFrom(map, goal, blocked);
      let best;
      let cost = d.get(id(m)) ?? Infinity;
      for (const [a, b] of Object.values(dirs)) {
        const p = { x: m.x + a, y: m.y + b };
        const n = d.get(id(p));
        if (n < cost) {
          best = p;
          cost = n;
        }
      }
      if (best && step(m, best)) {
        moved.add(m);
        progress = true;
      }
    });
    if (!progress) break;
  }
  return moved;
}
module.exports = { step, deploy, march };
