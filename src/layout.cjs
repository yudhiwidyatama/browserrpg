const { N, dirs, tileIndex } = require("./grid.cjs");

// Carve a maze on a coarse grid. Each junction is a 3x3 square;
// joining two squares opens the full width of the intervening wall.
function carveLayout(random, roomCount) {
  const tiles = Array(N * N).fill(0);
  function square(x, y) {
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) tiles[tileIndex(x + i, y + j)] = 1;
  }
  const stack = [[1, 1]];
  square(1, 1);
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const options = Object.values(dirs).filter(([dx, dy]) => {
      const a = x + 4 * dx,
        b = y + 4 * dy;
      return a > 0 && b > 0 && a + 3 < N && b + 3 < N && !tiles[tileIndex(a, b)];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[Math.floor(random() * options.length)];
    square(x + 2 * dx, y + 2 * dy);
    square(x + 4 * dx, y + 4 * dy);
    stack.push([x + 4 * dx, y + 4 * dy]);
  }
  const cells = Math.floor((N - 1) / 4);
  for (let room = 0; room < roomCount; room++) {
    const x = 1 + 4 * Math.floor(random() * (cells - 1));
    const y = 1 + 4 * Math.floor(random() * cells);
    square(x + 2, y);
  }
  return tiles;
}
module.exports = { carveLayout };
