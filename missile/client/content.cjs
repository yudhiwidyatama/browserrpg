"use strict";
// Display text for ids defined by the simulation core. Rules live in core/missile.mcl;
// the numbers quoted here are for level 1 and are checked against the core by the tests.

const PERKS = [
  { id: 0, name: "Cluster", text: "Each interceptor bursts into 3 smaller blasts (60% radius)." },
  { id: 1, name: "Lingering", text: "Blasts last twice as long but are 20% smaller." },
  { id: 2, name: "Magnetic", text: "While growing, blasts drift toward the nearest warhead." },
  { id: 3, name: "Shield dome", text: "Your leftmost city absorbs one hit each wave." },
  { id: 4, name: "EMP field", text: "Warheads near a blast fly at half speed for 2 seconds." },
  { id: 5, name: "Salvo", text: "Every tap fires 2 interceptors for the price of 1." },
  { id: 6, name: "Recycler", text: "Every 5th kill refunds an interceptor." },
  { id: 7, name: "Chain amplifier", text: "Secondary blasts can create one more secondary blast." },
];

const PASSIVES = [
  { id: 0, letter: "P", name: "Power plant", text: "Blast radius +10%" },
  { id: 1, letter: "L", name: "Laboratory", text: "Interceptor speed +10%" },
  { id: 2, letter: "B", name: "Bank", text: "Funds +15%" },
  { id: 3, letter: "R", name: "Radar", text: "Shows a lead marker ahead of each warhead" },
  { id: 4, letter: "D", name: "Depot", text: "Every battery starts each wave with +1 interceptor" },
  { id: 5, letter: "H", name: "Harbour", text: "First rebuild each wave is half price" },
  { id: 6, letter: "K", name: "Barracks", text: "A destroyed battery returns after 10 seconds" },
  { id: 7, letter: "O", name: "Observatory", text: "Shows warheads in fog" },
];

const MUTATORS = {
  1: { name: "Wind", text: "Interceptors drift sideways. Aim into the wind." },
  2: { name: "Fog", text: "Warheads are hidden until they are 40% of the way down." },
  4: { name: "Low ammo", text: "6 interceptors per battery. Every 4th kill refunds one." },
};

const BATTERIES = [
  { name: "Skirmisher", text: "fast, small blast" },
  { name: "Artillery", text: "slow, large blast" },
  { name: "Salvo", text: "two interceptors per tap" },
];

const HINTS = {
  1: "Click or tap the sky to fire. Interceptors take time to arrive, so aim ahead of each warhead.",
  2: "Press D, right-click or use the DETONATE button to explode your latest interceptor early.",
  3: "A warhead hit by a blast makes a small secondary blast. Chain kills score much more.",
};

const MODES = { 0: "Campaign", 1: "Daily seed", 2: "Endless" };

module.exports = { PERKS, PASSIVES, MUTATORS, BATTERIES, HINTS, MODES };
