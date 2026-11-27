// Stable IDs are for rules and UI commands; names remain the v2 save keys.
const weapons = {
  "lantern-staff": { name: "Lantern Staff", attackBonus: 0 },
  hookblade: { name: "Hookblade", attackBonus: 1 },
  "brine-knife": { name: "Brine Knife", attackBonus: 2 },
  "tide-sabre": { name: "Tide Sabre", attackBonus: 3 },
  "ember-cleaver": { name: "Ember Cleaver", attackBonus: 4 },
  "sun-hammer": { name: "Sun Hammer", attackBonus: 5 },
  "prism-glaive": { name: "Prism Glaive", attackBonus: 6 },
  "dawn-pike": { name: "Dawn Pike", attackBonus: 8 },
};
const themes = [
  {
    id: "salt",
    name: "The Salt Archive",
    mob: "Salt Scribe",
    hp: 5,
    atk: 2,
    range: 6,
    rooms: 9,
    weaponId: "brine-knife",
    water: 8,
  },
  {
    id: "ember",
    name: "The Ember Foundry",
    mob: "Furnace Brute",
    hp: 10,
    atk: 4,
    range: 4,
    rooms: 5,
    weaponId: "ember-cleaver",
    water: 11,
  },
  {
    id: "crown",
    name: "The Crown Vault",
    mob: "Amethyst Shade",
    hp: 9,
    atk: 3,
    range: 9,
    rooms: 13,
    weaponId: "prism-glaive",
    water: 14,
  },
].map((floor) => ({
  ...floor,
  weapon: weapons[floor.weaponId].name,
  bonus: weapons[floor.weaponId].attackBonus,
}));
const surface = {
  lift: { x: 10, y: 10 },
  bounds: { minX: 7, maxX: 13, minY: 8, maxY: 12 },
};
const shops = [
  {
    id: "tide-smith",
    name: "Tide Smith",
    x: 8,
    y: 10,
    color: "#3e999d",
    stock: [
      { weaponId: "hookblade", priceInCoins: 5 },
      { weaponId: "tide-sabre", priceInCoins: 14 },
    ],
  },
  {
    id: "crown-forge",
    name: "Crown Forge",
    x: 12,
    y: 10,
    color: "#c36d59",
    stock: [
      { weaponId: "sun-hammer", priceInCoins: 26 },
      { weaponId: "dawn-pike", priceInCoins: 44 },
    ],
  },
];
module.exports = { weapons, themes, surface, shops };
