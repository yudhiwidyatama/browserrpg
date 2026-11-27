const bone = "#e4d8ae",
  iron = "#879ca6",
  wood = "#785536",
  skin = "#c89872",
  dark = "#292835";
function vermin(k, mouse = false) {
  const fur = mouse ? "#a28774" : "#715e55";
  k.globe([-0.07, 0, 0.24], [0.35, 0.2, 0.2], fur);
  k.globe([0.22, 0.02, 0.31], [0.22, 0.15, 0.15], fur);
  k.beam([0.29, 0.04, 0.3], [0.49, 0.07, 0.23], 0.13, 0.035, fur);
  for (const y of [-0.12, 0.12]) {
    k.globe([0.18, y, 0.43], [0.075, 0.045, 0.09], "#d6a394");
    k.globe([0.32, y, 0.33], [0.034, 0.025, 0.03], dark);
    k.beam([-0.16, y, 0.18], [-0.11, y * 1.6, 0.035], 0.065, 0.045, fur);
  }
  k.beam([-0.34, 0, 0.23], [-0.54, -0.06, 0.1], 0.052, 0.035, "#c38c82");
  k.beam([-0.54, -0.06, 0.1], [-0.61, -0.22, 0.06], 0.035, 0.007, "#c38c82");
}
function humanoid(k, member, kind) {
  const skeleton = kind === "skeleton",
    troll = kind === "troll",
    flesh = skeleton ? bone : troll ? "#82936c" : skin;
  const fabric =
    {
      mage: "#725591",
      ranger: "#517651",
      healer: "#e1cf9d",
      bard: "#aa6654",
      scout: "#627d74",
      guard: "#657789",
    }[member?.role] || "#397e83";
  const armor = member?.equipped?.body?.id === "chain";
  for (const side of [-1, 1]) {
    const y = 0.12 * side;
    k.beam(
      [0, y, 0.07],
      [0.01, y, 0.47],
      skeleton ? 0.045 : 0.085,
      skeleton ? 0.052 : 0.1,
      skeleton ? bone : "#544746",
    );
    k.globe([0.05, y, 0.065], [0.13, 0.093, 0.07], skeleton ? bone : "#483b31");
  }
  k.globe(
    [0, 0, 0.63],
    [troll ? 0.28 : 0.18, troll ? 0.33 : 0.22, 0.25],
    skeleton ? dark : armor ? iron : fabric,
  );
  if (skeleton) {
    for (let i = 0; i < 4; i++)
      k.globe(
        [0.04, 0, 0.56 + i * 0.075],
        [0.13, 0.18 - i * 0.015, 0.025],
        bone,
      );
  } else {
    k.beam([0, 0, 0.41], [0, 0, 0.47], 0.2, 0.19, "#77503a");
    k.face(
      [
        [-0.1, -0.18, 0.82],
        [-0.14, 0.18, 0.82],
        [-0.29, 0.22, 0.3],
        [-0.25, -0.23, 0.27],
      ],
      "#54435f",
    );
  }
  for (const side of [-1, 1]) {
    const y = side * 0.22;
    k.globe(
      [0, y, 0.79],
      [0.13, 0.13, 0.11],
      armor ? iron : skeleton ? bone : fabric,
    );
    k.beam([0.01, y, 0.76], [0.1, y * 1.25, 0.6], 0.067, 0.057, flesh);
    k.beam([0.1, y * 1.25, 0.6], [0.21, y * 1.25, 0.63], 0.057, 0.05, flesh);
  }
  k.globe([0.025, 0, 1.0], [0.16, 0.145, 0.19], flesh);
  for (const side of [-1, 1])
    k.globe([0.155, 0.076 * side, 1.03], [0.025, 0.035, 0.025], dark);
  if (member?.equipped?.head) k.globe([0, 0, 1.14], [0.177, 0.16, 0.12], iron);
  else if (member?.role === "mage")
    k.beam([0, 0, 1.1], [-0.08, 0, 1.49], 0.24, 0.006, fabric);
  else if (!skeleton)
    k.globe(
      [-0.03, 0, 1.14],
      [0.16, 0.15, 0.09],
      troll ? "#48593c" : "#594030",
    );
  if (member?.equipped?.left)
    k.globe([0.13, 0.29, 0.63], [0.18, 0.05, 0.22], "#ad8d58");
  if (member?.role === "mage" || troll) {
    k.beam(
      [0.2, -0.26, 0.13],
      [0.2, -0.26, 1.18],
      0.035,
      troll ? 0.105 : 0.042,
      wood,
    );
    if (!troll) k.globe([0.2, -0.26, 1.19], [0.075, 0.075, 0.09], "#ac9edc");
  } else {
    k.beam([0.2, -0.26, 0.55], [0.23, -0.26, 0.75], 0.035, 0.03, wood);
    k.block(0.23, -0.26, 0.72, 0.16, 0.065, 0.04, "#c79c58");
    k.beam([0.23, -0.26, 0.76], [0.36, -0.26, 1.16], 0.058, 0.005, iron, 4);
  }
}
function spider(k) {
  k.globe([-0.13, 0, 0.38], [0.28, 0.21, 0.23], "#72516b");
  k.globe([0.18, 0, 0.33], [0.15, 0.16, 0.14], "#493b4e");
  for (let i = 0; i < 4; i++)
    for (const side of [-1, 1]) {
      const x = -0.22 + i * 0.13;
      const knee = [x + (i - 1.5) * 0.09, side * 0.35, 0.46];
      k.beam([x, side * 0.11, 0.31], knee, 0.041, 0.036, "#55445c");
      k.beam(
        knee,
        [x + (i - 1.5) * 0.14, side * 0.49, 0.04],
        0.036,
        0.01,
        "#8b6975",
      );
    }
  for (const y of [-0.08, 0.08])
    k.globe([0.305, y, 0.36], [0.036, 0.032, 0.03], "#f4af65");
}
function reptile(k, kind) {
  const flying = kind === "drake",
    bat = kind === "bat";
  const color = bat ? "#5e4d68" : flying ? "#a55a45" : "#687f50";
  k.globe([-0.05, 0, 0.28], [0.36, 0.19, 0.16], color);
  k.globe([0.24, 0, 0.37], [0.19, 0.15, 0.12], color);
  k.beam([0.28, 0, 0.36], [0.59, 0.02, 0.31], 0.13, 0.075, color);
  k.beam([-0.3, 0, 0.28], [-0.64, -0.1, 0.12], 0.13, 0.015, color);
  for (const side of [-1, 1]) {
    k.globe([0.34, side * 0.105, 0.43], [0.03, 0.026, 0.032], "#f3d37b");
    k.beam(
      [-0.16, side * 0.14, 0.25],
      [-0.1, side * 0.28, 0.04],
      0.06,
      0.038,
      color,
    );
    if (flying || bat) {
      const tip = [-0.14, side * 0.57, 0.76];
      k.beam([0.06, side * 0.12, 0.37], tip, 0.045, 0.014, color);
      for (let i = 0; i < 3; i++) {
        const a = [-0.48 + i * 0.16, side * (0.33 + i * 0.04), 0.27];
        k.face(
          [[0.06, side * 0.12, 0.38], tip, a],
          i % 2 ? "#ab766d" : "#886272",
        );
        k.beam(tip, a, 0.018, 0.006, color);
      }
    } else
      k.beam(
        [0.2, side * 0.12, 0.27],
        [0.25, side * 0.29, 0.04],
        0.07,
        0.04,
        color,
      );
  }
  if (!bat)
    for (let i = 0; i < 5; i++)
      k.beam(
        [-0.3 + i * 0.1, 0, 0.39],
        [-0.33 + i * 0.1, 0, 0.51],
        0.045,
        0.005,
        "#a8a077",
      );
}
function creature(k, kind) {
  if (kind === "rat") return vermin(k);
  if (kind === "spider") return spider(k);
  if (["troll", "skeleton"].includes(kind)) return humanoid(k, null, kind);
  if (["drake", "bat", "gator"].includes(kind)) return reptile(k, kind);
  if (kind === "snake") {
    const chain = [
      [-0.42, -0.22, 0.08],
      [-0.2, 0.12, 0.1],
      [0.07, 0.19, 0.12],
      [0.19, -0.03, 0.24],
      [0.26, -0.12, 0.39],
    ];
    for (let i = 1; i < chain.length; i++)
      k.beam(
        chain[i - 1],
        chain[i],
        0.025 + i * 0.015,
        0.05 + i * 0.012,
        "#899653",
      );
    k.globe(chain.at(-1), [0.14, 0.11, 0.08], "#b2aa61");
    return;
  }
  if (kind === "gazer") {
    k.globe([0, 0, 0.7], [0.29, 0.28, 0.3], "#957990");
    k.globe([0.18, 0.15, 0.7], [0.18, 0.15, 0.18], bone);
    k.globe([0.28, 0.24, 0.7], [0.08, 0.055, 0.1], "#272238");
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257,
        b = [Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0.9],
        t = [b[0] * 1.6, b[1] * 1.6, 1.1];
      k.beam(b, t, 0.035, 0.02, "#a88999");
      k.globe(t, [0.052, 0.052, 0.055], "#e9c58f");
    }
    return;
  }
  k.globe([0, 0, 0.2], [0.4, 0.33, 0.23], "#65aa86");
  k.globe([0.12, 0.02, 0.34], [0.24, 0.21, 0.18], "#83c69d");
  for (const y of [-0.09, 0.09])
    k.globe([0.28, y, 0.37], [0.04, 0.03, 0.038], dark);
}
function adventurer(k, member) {
  if (member.role === "mouse") vermin(k, true);
  else humanoid(k, member);
}
module.exports = { adventurer, creature };
