# Astra Missile Defense

Astra is a city on the dark side of a moon. Its three lantern towers keep the streets lit, and dawn is five waves away. In this single-player arcade game, you draw rings of light in the sky to catch incoming missiles. The choice is whether to spend a charge on a lone streak or wait until several paths cross.

## A wave of play

Click or tap to place a shield at that spot. With a keyboard, move the reticle with the arrow keys and press Space to place it. Each wave starts with four charges; placing a ring spends one. Unused charges do not carry over. Each tower starts the run with two lit windows. A hit darkens one window permanently; a tower with no light goes offline.

### What counts as a catch

Only the expanding **rim** catches a missile. The hollow interior, glow, trail, sparks, and fading arcs do not. Use these starting values for the first playtest, not as final balance: on a logical playfield 540 units high, expand the rim's centerline uniformly from radius 0 to 72 units over 36 simulation ticks (600 ms at 60 ticks/second). The solid stroke is 6 units wide, centered on that line. After the last active interval, replace it with broken arcs for 12 ticks (200 ms); they cannot catch anything. Scale the stroke and scene together on resize.

Use the arrowhead tip as the contact point. Count the first instant the moving tip touches the active stroke, including a crossing between ticks. A tip behind the rim is safe from that ring unless it touches the stroke again. Resolve simultaneous contacts consistently: a catch wins a tie with a tower hit; if two rings catch the same tip at once, credit the earlier-placed ring. Remove the caught missile once. Update that ring's visible count and the run's best single-ring count immediately, even if the wave ends before the ring fades.

## Five waves to dawn

| Wave | Pattern | Player decision |
| --- | --- | --- |
| 1 — First light | Isolated streaks above the towers | Learn where the solid edge will meet a streak. |
| 2 — Crossing | A pair crosses above one tower | Spend early on one or wait to catch both. |
| 3 — Split sky | Two separated lanes threaten different rooftops | Choose which lane gets the first ring. |
| 4 — Hold one back | Early singles precede a late cluster | Catch efficiently enough to save a charge for the cluster. |
| 5 — Daybreak | Crossings and separated lanes alternate as the horizon brightens | Recognize the earlier patterns and choose when to group catches. |

Keep the wave patterns fixed for replay. If all three towers go dark, the run ends; if at least one tower is lit after the fifth wave, the sun rises. The end screen shows the skyline you saved, remaining lit windows, and your best catch with a single ring. Protecting all six windows is an intended, testable challenge.

## Browser target and timing

The game targets **WebAssembly (Wasm)**. Wasm owns the 60-tick-per-second simulation, wave schedule, contacts, ring IDs, tower state, and scoring. A small JavaScript host timestamps input and draws the playfield with Canvas 2D. Record replay inputs as simulation tick, placement order, and logical coordinates. Advance the simulation from elapsed active time, not draw calls. Both renderers read the same state and timing cues; neither decides whether a catch happened.

**WebGPU is optional** and may add glow or decorative trails. Canvas 2D alone must support the complete game. Pausing or hiding the tab freezes both simulation and audio. On return, wait for the player to resume, discard hidden elapsed time, and do not replay stale cues.

## Graphics requirements

- **Skyline:** Build a seeded strip of low rooftops. Give the towers distinct crowns: a dome, a spire, and a flat roof. Each lit window casts its own pool of light on a nearby roof. A lost window stays crossed out and its reflection disappears for the rest of the run. Both cues must work without color, glow, or motion.
- **Playfield:** Draw incoming missiles as arrowheads with short tapered trails. Draw the aiming reticle as four corner ticks. Render the active rim using the radius and width from Wasm; only its solid stroke indicates contact. At a catch, show the running count beside its ring without covering the edge.
- **HUD and motion:** Show the wave number out of five and four filled or hollow charge slots. On resize, fit the whole playfield without cropping a tower and map input to the same coordinates. Reduced-motion mode removes twinkle, shake, and spark bursts but retains the missile trail, solid rim, broken fade arcs, and catch count.

## Audio requirements

Play Web Audio cues from Wasm events, not draw calls. Offer master mute and separate effects and ambience levels. Start audio only after player interaction. Missing samples must not delay a wave.

| Game event | Procedural sound | Visible equivalent |
| --- | --- | --- |
| Shield placed | Short rising sine sweep | Ring opens; one charge slot empties. |
| Ring catches and closes | Accumulate catches silently; at the end of the active phase, play one bell for a nonempty ring. Raise its pitch with the ring's final count. An empty ring has no bell. | Increment the count at each contact and retain the total beside the broken arcs. |
| Tower hit or lost | Low damped thud. If a closing bell coincides, soften the bell so the thud is clear. Remove the tower's note from the city hum when it goes offline. | Cross out the lost window and remove its roof reflection. |
| Wave starts | Two soft notes over an optional hum, with one sustained note per surviving tower | Wave number advances and charge slots refill. |
| Dawn / final tower lost | Resolve the lantern motif upward for dawn or downward for loss | Show the sunrise or dark skyline with result text. |

## Free assets and when to use them

The procedural skyline, arrowheads, rings, and synthesized cues are the baseline. No model or sample download is needed to play. For a sprite or sampled-sound edition, use these creator-published packs:

| Source and license | Selection for Astra |
| --- | --- |
| Kenney — [Space Shooter Extension (250+)](https://opengameart.org/content/space-shooter-extension-250), CC0. Includes 270 separate PNGs, spritesheets, vector files, and additional retina sizes. | Align a missile silhouette's tip to the procedural arrowhead tip. Keep the procedural trail; sprite padding must not affect catches. |
| Kenney — [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), CC0. Includes 70 separate OGG files with normalized volume. | Audition a short laser for placement and a subdued explosion for tower damage. Keep the synthesized closing bell for ring totals. |

Bundle only selected files locally. Record the original filename, source link, license, and any edits with each import. Kenney makes attribution optional; credit **Kenney.nl** if either pack ships.

## Playtest and acceptance checks

1. **First prototype:** Put one crossing pair above one tower in Canvas 2D. With sound and glow off, ask a new player to explain a narrow miss and then deliberately catch both on replay. Tune the starting rim values against this test before locking wave patterns.
2. **Contact:** Demonstrate a catch at the solid edge, a miss just inside it that never retouches the edge, and a crossing through broken arcs. Only the first scores. Run the same fixtures on each available renderer.
3. **Timing:** Replay identical tick-stamped inputs at 60 Hz and 120 Hz rendering. Require identical catch counts, charge use, and window states. Hide the tab mid-wave, then resume: the same inputs must give the same result, with no background damage or burst of queued audio.
4. **Wave balance:** Record a full five-wave replay that keeps all six windows lit without exceeding four charges in any wave. Keep the replay as a regression fixture when tuning the rim or wave timing.
5. **Damage and multi-catch:** With HUD hidden, sound muted, and reduced motion on, verify a player can identify the damaged tower from its windows and roof. With sound on, catch three streaks at different moments with one ring: it must count up to 3, play one closing bell, and record a best catch of 3 in a fresh run. Confirm a simultaneous tower hit remains audible.
6. **Baseline:** Play to dawn in Canvas 2D with WebGPU disabled, imported assets unavailable, audio muted, and reduced motion enabled. Shield state, charges, window loss, and final outcome must remain readable.
