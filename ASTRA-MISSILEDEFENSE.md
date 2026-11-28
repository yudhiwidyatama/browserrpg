# Astra Missile Defense

Astra is a city on the dark side of a moon. Its three lantern towers keep the streets lit, and dawn is five waves away. In this single-player arcade game, you draw brief circles of light in the sky to catch incoming missiles before they reach the towers.

## A wave of play

Click or tap the sky to spend one of four charges. A shield ring blooms at that spot, expands for a beat, then fades. Any missile the ring touches turns into a harmless spark. Missiles leave bright trails, so you can spend a charge early to catch a lone streak or wait for several trails to cross and catch them with one ring. With a keyboard, move the reticle with the arrow keys and press Space to place the ring.

Charges refill at the start of each wave. Each tower starts with two lit windows; a hit darkens one window, and a tower with no light goes offline. Later waves introduce pairs and clusters of missiles. A darkened window stays dark, so the cost of letting a missile through carries into the next wave.

## Dawn and replay

Keep at least one tower lit through the fifth wave to see the sunrise. If all three go dark first, the run ends. The end screen shows the skyline you saved, your remaining lit windows, and your best catch with a single ring. Replay the same wave patterns to try for a fully lit city.

## Browser target

The game targets **WebAssembly (Wasm)**. The Wasm module owns wave timing, ring interactions, tower state, and scoring. A small JavaScript host passes in player input and draws the playfield with Canvas 2D. **WebGPU is optional**: it may add glow and spark trails, but the complete game must remain playable with Canvas 2D alone. Both renderers use the same game state and show the same timing cues.

## Graphics requirements

- **Skyline:** Build the moonlit city from a seeded strip of low rooftops. Give the three lantern towers distinct crowns: a dome, a spire, and a flat roof. Each tower has two window cutouts. A lit window is filled; a lost window is crossed out so damage remains legible without color.
- **Playfield:** Draw incoming missiles as bright arrowheads with short tapered trails. Draw the aiming reticle as four corner ticks, not a circle. Reserve the solid circle for an active shield: its visible edge must match the radius reported by Wasm. Catch sparks are decorative and cannot cause another catch.
- **HUD and motion:** Show the wave number out of five and four charge slots, using filled and hollow shapes. On resize, fit the entire playfield without cropping a tower and map input to the same coordinates. Reduced-motion mode removes twinkle, shake, and spark bursts but retains the missile trail and active shield edge.

## Audio requirements

The JavaScript host plays cues from Wasm events, not from draw calls. Offer a master mute and separate effects and ambience levels. Start audio only after player interaction; pause it when the run is paused or the tab is hidden. Missing samples must not delay a wave.

| Game event | Procedural Web Audio cue | Visible equivalent |
| --- | --- | --- |
| Shield placed | Short rising sine sweep | Ring opens; one charge slot empties |
| Missiles caught | One bell tone per catch group, higher for a larger group | Spark at the ring edge and a catch count |
| Tower hit | Low, damped thud | One window changes from filled to crossed out |
| Wave starts | Two soft notes over an optional low city hum | Wave number advances and charge slots refill |
| Dawn / final tower lost | Resolve the lantern motif upward for dawn or downward for loss | Show the sunrise or the dark skyline and result text |

## Free assets and when to use them

The procedural skyline, arrowheads, rings, and synthesized cues are the baseline. No model or sample download is needed to play. For a sprite or sampled-sound edition, use these creator-published packs:

| Source and license | Selection for Astra |
| --- | --- |
| Kenney — [Space Shooter Extension (250+)](https://opengameart.org/content/space-shooter-extension-250), CC0. Includes 270 separate PNGs, spritesheets, vector files, and additional retina sizes. | Pick a missile silhouette to replace the arrowhead. Keep the procedural trail and original hit shape; sprite padding must not affect catches. |
| Kenney — [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), CC0. Includes 70 separate OGG files with normalized volume. | Audition a short laser for shield placement and a subdued explosion for tower damage. Keep the synthesized bell for catches so the player can hear group size. |

Bundle only selected files locally. Record the original filename, source link, license, and any edits with each import. Kenney makes attribution optional; credit **Kenney.nl** if either pack ships.

**Acceptance check:** With WebGPU disabled, imported assets unavailable, audio muted, and reduced motion enabled, play through the fifth wave. Verify that shield contact, charges, window loss, and the final outcome are readable. Replay with sound on: a paused run must stay silent, and resuming must not replay old cues.
