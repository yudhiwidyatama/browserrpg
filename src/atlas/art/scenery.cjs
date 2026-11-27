const stone = "#85928c",
  wood = "#816044",
  gold = "#e6b961";
function arch(k) {
  for (const x of [-0.32, 0.32]) {
    k.block(x, 0, 0, 0.2, 0.32, 0.82, stone);
    k.block(x, 0, 0.79, 0.27, 0.39, 0.12, "#b1b8a2");
  }
  k.block(0, 0, 0.9, 0.86, 0.37, 0.15, stone);
  k.block(0, 0.17, 0.91, 0.16, 0.07, 0.17, gold);
}
function tower(k) {
  k.block(0, 0, 0, 0.91, 0.9, 1.14, stone);
  for (const x of [-0.3, 0, 0.3])
    for (const y of [-0.37, 0.37])
      k.block(x, y, 1.14, 0.2, 0.18, 0.22, "#acb8a7");
  k.block(0.05, 0.46, 0.54, 0.11, 0.015, 0.29, "#374653");
  k.block(0.3, 0.46, 0.52, 0.12, 0.02, 0.43, "#903e54");
}
function landmark(k, kind) {
  if (kind === "arch") return arch(k);
  if (kind === "tower") return tower(k);
  if (kind === "spring") {
    k.beam([0, 0, 0], [0, 0, 0.17], 0.38, 0.42, stone, 10);
    k.globe([0, 0, 0.19], [0.32, 0.32, 0.045], "#75d9cf");
    k.beam([0, 0, 0.18], [0, 0, 0.58], 0.065, 0.024, "#bdf1e7");
    return;
  }
  if (kind === "chest" || kind === "open") {
    k.block(0, 0, 0.03, 0.64, 0.42, 0.26, wood);
    k.block(
      0,
      kind === "open" ? -0.17 : 0,
      0.29,
      0.64,
      kind === "open" ? 0.07 : 0.44,
      kind === "open" ? 0.25 : 0.12,
      "#946d49",
    );
    for (const x of [-0.2, 0.2])
      k.block(x, 0.215, 0.05, 0.055, 0.025, 0.27, gold);
    return;
  }
  if (kind === "relic") {
    k.block(0, 0, 0, 0.51, 0.51, 0.22, stone);
    k.beam([0, 0, 0.24], [0, 0, 0.46], 0.045, 0.18, gold, 5);
    k.beam([0, 0, 0.46], [0, 0, 0.74], 0.18, 0, "#ffdc7f", 5);
    return;
  }
  if (kind === "shrine") {
    k.beam([0, 0, 0], [0, 0, 0.2], 0.53, 0.47, stone, 8);
    k.beam([0, 0, 0.2], [0, 0, 0.91], 0.22, 0.13, "#b6b5b2", 6);
    k.globe([0, 0, 1.06], [0.2, 0.2, 0.21], "#83cbcd");
    return;
  }
  if (kind === "inn") {
    k.block(0, 0, 0, 0.94, 0.86, 0.63, "#d1b896");
    for (const x of [-0.38, 0.38]) k.block(x, 0.43, 0, 0.07, 0.07, 0.66, wood);
    k.face(
      [
        [-0.6, -0.53, 0.62],
        [0.6, -0.53, 0.62],
        [0.6, 0, 1.13],
        [-0.6, 0, 1.13],
      ],
      "#9c524b",
    );
    k.face(
      [
        [-0.6, 0, 1.13],
        [0.6, 0, 1.13],
        [0.6, 0.53, 0.62],
        [-0.6, 0.53, 0.62],
      ],
      "#b96853",
    );
    k.block(0, 0.432, 0, 0.24, 0.02, 0.44, wood);
    return;
  }
}
function terrain(k, region, hash) {
  if (region === "sewer") {
    k.block(0, 0, 0, 0.96, 0.96, 0.36, "#62746f");
    k.block(-0.23, 0, 0.37, 0.44, 0.88, 0.12, stone);
    k.block(0.24, 0, 0.37, 0.44, 0.88, 0.12, "#75837c");
    if (hash % 6 === 0)
      for (let i = -1; i <= 1; i++)
        k.block(i * 0.17, 0.46, 0.08, 0.05, 0.05, 0.3, "#35474b");
  } else if (region === "mine") {
    k.globe([0, 0, 0.14], [0.52, 0.47, 0.35], "#88765c", 7, 3);
    if (hash % 5 === 0) {
      for (let x of [-0.33, 0.33]) k.block(x, 0, 0, 0.13, 0.16, 0.75, wood);
      k.block(0, 0, 0.72, 0.88, 0.21, 0.17, "#a07950");
    } else if (hash % 3 === 0)
      k.beam([0, 0, 0.25], [0.1, 0.04, 0.57], 0.13, 0.025, "#d2a554", 5);
  } else if (region === "shame") {
    k.block(0, 0, 0, 0.88, 0.91, 0.33, "#6b6076");
    if (hash % 3 === 0) {
      k.beam([0, 0, 0.26], [0, 0, 0.84], 0.24, 0.16, "#998aa3", 7);
      k.block(0, 0, 0.78, 0.39, 0.38, 0.07, gold);
    } else k.beam([0.1, 0.04, 0.26], [0.22, 0.09, 0.55], 0.15, 0.01, gold, 5);
  } else {
    k.globe([0, 0, 0.09], [0.49, 0.47, 0.2], "#606d48", 7, 3);
    for (let i = 0; i < 3; i++) {
      let x = i * 0.14 - 0.14,
        y = (((hash + i * 7) % 7) - 3) * 0.06;
      k.beam(
        [x, y, 0.14],
        [x + 0.07, y, 0.58 + i * 0.1],
        0.024,
        0.012,
        "#8e9f53",
      );
      k.beam(
        [x + 0.065, y, 0.51 + i * 0.1],
        [x + 0.08, y, 0.65 + i * 0.1],
        0.032,
        0.024,
        "#806344",
      );
    }
  }
}
module.exports = { landmark, terrain };
