# Astra Missile Defense

Astra is a city on the dark side of a moon. Its three lantern towers keep the streets lit, and dawn is five waves away. In this single-player arcade game, you draw brief circles of light in the sky to catch incoming missiles before they reach the towers.

## A wave of play

Click or tap the sky to spend one of four charges. A shield ring blooms at that spot, expands for a beat, then fades. Any missile the ring touches turns into a harmless spark. Missiles leave bright trails, so you can spend a charge early to catch a lone streak or wait for several trails to cross and catch them with one ring. With a keyboard, move the reticle with the arrow keys and press Space to place the ring.

Charges refill at the start of each wave. Each tower starts with two lit windows; a hit darkens one window, and a tower with no light goes offline. Later waves introduce pairs and clusters of missiles. A darkened window stays dark, so the cost of letting a missile through carries into the next wave.

## Dawn and replay

Keep at least one tower lit through the fifth wave to see the sunrise. If all three go dark first, the run ends. The end screen shows the skyline you saved, your remaining lit windows, and your best catch with a single ring. Replay the same wave patterns to try for a fully lit city.

## Browser target

The game targets **WebAssembly (Wasm)**. The Wasm module owns wave timing, ring interactions, tower state, and scoring. A small JavaScript host passes in player input and draws the playfield with Canvas 2D. **WebGPU is optional**: it may add glow and spark trails, but the complete game must remain playable with Canvas 2D alone. Both renderers use the same game state and show the same timing cues.
