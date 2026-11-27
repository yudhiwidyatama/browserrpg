const N = 21;
const dirs = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const tileIndex = (x, y) => y * N + x;
const sameTile = (left, right) => left.x === right.x && left.y === right.y;
const manhattanDistance = (left, right) =>
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
function walk(game, x, y) {
  return (
    x >= 0 && y >= 0 && x < N && y < N && game.tiles[tileIndex(x, y)] === 1
  );
}
function walkingDistancesFrom(game, start, blocked = new Set()) {
  const queue = [start],
    distances = new Map([[tileIndex(start.x, start.y), 0]]);
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head],
      nextDistance = distances.get(tileIndex(tile.x, tile.y)) + 1;
    for (const [dx, dy] of Object.values(dirs)) {
      const x = tile.x + dx,
        y = tile.y + dy,
        index = tileIndex(x, y);
      if (!walk(game, x, y) || distances.has(index) || blocked.has(index))
        continue;
      distances.set(index, nextDistance);
      queue.push({ x, y });
    }
  }
  return distances;
}
module.exports = {
  N,
  dirs,
  tileIndex,
  sameTile,
  manhattanDistance,
  walkingDistancesFrom,
  walk,
};
