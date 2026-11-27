// The rendered tile centre and its pointer hit-test share the same camera.
function createCamera(width, height, center, surface) {
  const halfWidth = Math.min(
    width / (surface ? 14 : 19),
    height / (surface ? 9 : 13),
  );
  const halfHeight = halfWidth / Math.sqrt(3),
    unitHeight = 2 * halfHeight;
  const originX = width / 2 - (center.x - center.y) * halfWidth,
    originY = height * 0.53 - (center.x + center.y) * halfHeight;
  function project(x, y, height = 0) {
    return [
      originX + (x - y) * halfWidth,
      originY + (x + y) * halfHeight - height * unitHeight,
    ];
  }
  function tileAt(pixelX, pixelY) {
    const difference = (pixelX - originX) / halfWidth,
      sum = (pixelY - originY) / halfHeight;
    return {
      x: Math.round((difference + sum) / 2),
      y: Math.round((sum - difference) / 2),
    };
  }
  return { halfWidth, halfHeight, project, tileAt };
}
module.exports = { createCamera };
