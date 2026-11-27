const { dirs } = require("../grid.cjs");
const { kit, paintModel } = require("../atlas/art/mesh.cjs");
const { adventurer } = require("../atlas/art/figures.cjs");

// Figures are sculpted looking down +X. Rotate every vertex, including
// equipment, before paintModel computes depth, normals and projection.
function paintPerson(ctx, camera, x, y, member, scale = 1) {
  const [dx, dy] = dirs[member.facing] || dirs.east;
  paintModel(ctx, camera, x, y, (world) => {
    adventurer(kit((points, color) => {
      world.face(points.map(([a, b, z]) => [dx * a - dy * b, dy * a + dx * b, z]), color);
    }), member);
  }, scale);
}
module.exports = { paintPerson };
