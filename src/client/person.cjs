const { dirs } = require("../grid.cjs");
const { kit, paintModel } = require("../atlas/art/mesh.cjs");
const { adventurer } = require("../atlas/art/figures.cjs");

// Figures face +X in model space. Rotate before computing normals and depth.
function paintPerson(ctx, camera, x, y, member, scale = 1) {
  const [dx, dy] = dirs[member.facing] || dirs.east;
  const rotate = ([a, b, z]) => [dx * a - dy * b, dy * a + dx * b, z];
  function model(world) {
    const face = (points, color) => world.face(points.map(rotate), color);
    adventurer(kit(face), member);
  }
  paintModel(ctx, camera, x, y, model, scale);
}
module.exports = { paintPerson };
