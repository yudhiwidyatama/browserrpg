# Missile Defense — game description

A real-time, single-screen defense game. Incoming missiles fall toward your cities; you launch interceptors that detonate into expanding blast zones. Stop enough warheads to protect your cities and survive every wave.

This document is a design description, not an implementation. It defines the game, its rules, and the technical target: **WebAssembly in the browser**, with **WebGPU as an optional renderer**.

## Pitch
You command a small chain of batteries on the ground. Each wave sends more, faster and smarter warheads. You have limited interceptors, so every shot counts. Leading a target, chaining explosions and deciding which city to sacrifice are the core decisions.

## Core loop
1. A wave begins. Warheads appear at the top of the screen and fly toward cities or batteries.
2. The player aims and fires an interceptor from the nearest battery with ammunition.
3. The interceptor flies to the aim point and detonates, leaving a blast that grows, holds, then shrinks.
4. Any warhead that enters a live blast is destroyed. Its own explosion can also destroy other warheads, which allows chain reactions.
5. When all warheads are resolved, the wave ends. Surviving cities and unused interceptors convert into score and repair funds.
6. The player spends funds between waves, then the next wave begins.

## Playfield
- A flat 2D battlefield, rendered with a fixed logical resolution of 1280 × 720 and scaled to fit the window.
- **6 cities** along the ground and **3 batteries** (left, centre, right). Batteries and cities are separate targets.
- Each battery holds 10 interceptors at the start of a wave. A battery that is destroyed cannot fire for the rest of the wave.
- The sky has no obstacles. Weather and terrain are cosmetic only.

## Entities
| Entity | Behaviour |
|---|---|
| **Warhead** | Falls along a straight line from the top edge to a chosen target. Destroyed by any blast. |
| **Splitter** | Divides into 2–3 warheads at a set altitude. Appears from wave 4. |
| **Fast warhead** | Moves at roughly twice the base speed. Appears from wave 6. |
| **Decoy** | Looks like a warhead but is harmless on impact. Appears from wave 8. Wastes interceptors. |
| **Bomber** | Flies sideways and drops warheads along its path. Appears from wave 10. Must be hit directly. |
| **Interceptor** | Launched from a battery. Travels at fixed speed to the aim point, then detonates. |
| **Blast** | A circle with growing, holding and shrinking phases. Destroys warheads, not cities. |
| **City / Battery** | Static ground targets. Hit once to destroy, and can be rebuilt between waves. |

## Controls
- **Mouse / touch:** tap or click a point in the sky to fire at it. The nearest battery with ammunition fires.
- **Keyboard:** 1, 2, 3 select a specific battery; arrow keys move the reticle; Space fires.
- **P** pauses. **M** toggles sound.
- Touch controls use the same single-tap fire model; no on-screen buttons are required during play.

## Rules
- Interceptors take real flight time to reach the aim point. The player must **lead** moving warheads.
- Blast radius, hold time and interceptor speed are fixed per upgrade level, so the game is learnable and skill-based.
- A warhead destroyed by a blast creates a small secondary blast. This rewards chaining but cannot chain indefinitely: a secondary blast does not itself create another.
- The game ends when all cities are destroyed.
- Between waves, cities that were destroyed may be rebuilt for a price. A free city is rebuilt every 5 waves.

## Scoring and economy
- 25 points per warhead destroyed.
- Bonus multiplier increases with chain size: a blast that destroys *n* warheads awards *n* × 25 × *n* points.
- End-of-wave bonus: 100 points per surviving city and 5 points per unused interceptor.
- Funds equal 10% of the wave score and are spent on upgrades and repairs.

### Upgrades (between waves)
| Upgrade | Effect | Levels |
|---|---|---|
| Blast radius | Larger detonation circle | 5 |
| Interceptor speed | Shorter time to target | 5 |
| Magazine | More interceptors per battery | 5 |
| Rebuild | Restore a destroyed city or battery | — |

## Waves and difficulty
- Wave 1 sends 8 warheads at base speed; each wave adds warheads and shortens the gaps between them.
- New enemy types are introduced one at a time (see the entity table) so each can be learned.
- Targets are chosen by a deterministic pseudo-random generator seeded per run. The same seed gives the same game, which supports daily challenges and replays.
- The game is endless. A difficulty cap holds warhead speed at 3× base from wave 20.

## Presentation
- Original procedural vector art: glowing trails, silhouetted cities, a gradient night sky. No downloaded textures or models.
- Particle effects for explosions, debris and smoke trails.
- Synthesised audio for launches, blasts and alarms (compatible with the existing synth approach described in [AUDIO.md](AUDIO.md)). Music and sound effects can be toggled separately.
- Accessible by default: colour-blind-safe palette, a high-contrast mode, a reduced-motion option and a reduced-flash option.

## Technical target: WebAssembly
The game targets browsers through **WebAssembly**. The simulation core is compiled to a Wasm module; a thin JavaScript layer handles the page, input and rendering.

### Architecture
| Layer | Responsibility | Runs as |
|---|---|---|
| **Simulation core** | Entities, physics, collisions, waves, scoring, seeded RNG | WebAssembly |
| **Platform layer** | Canvas, input events, audio, storage, timing | JavaScript |
| **Renderer** | Draws the state exported by the core | Canvas 2D by default; WebGPU optional |

### Simulation core
- Written in a language that compiles to `wasm32` (Rust is the recommended choice).
- **Deterministic**: fixed time step of 60 updates per second, integer or fixed-point-safe maths where results must match across machines, and no use of wall-clock time or platform APIs inside the core.
- The core exposes a small API: `init(seed)`, `step(inputs)`, `snapshot()`, `save()` and `load()`.
- State is exported to JavaScript through a **shared linear-memory buffer** of plain structs (positions, radii, types, flags), so no per-frame allocation or copying is needed.
- This mirrors the repository's existing rule that rules code does not import DOM, storage, real time or renderer code (see [CONTRIBUTING.md](CONTRIBUTING.md)).

### Build and delivery
- A single build step produces the `.wasm` module plus a small JavaScript loader.
- The module is embedded in the distributable HTML (base64) so that the game still runs **offline from a single file**, as the current release does. No server, external fonts or asset downloads are required.
- Target size budget: under 300 KB for the Wasm module, optimised for size.
- Required browser features: WebAssembly (MVP), and no threads or SIMD, so the game runs everywhere.

### Optional: WebGPU
WebGPU is an **optional enhancement**, never a requirement.
- On start, the platform layer feature-detects `navigator.gpu`. If it is available, the WebGPU renderer is used; otherwise the **Canvas 2D renderer** is used. The simulation and gameplay are identical in both.
- WebGPU is used for the visual extras only: instanced rendering of trails and particles, glow and bloom post-processing, and a compute pass for particle simulation.
- The simulation core never depends on the GPU, and GPU results never feed back into the game state, so determinism and replays are unaffected.
- A setting lets the player force the Canvas 2D renderer.

## Persistence
- High score, upgrade state, settings and the last daily-challenge result are stored in browser storage under a versioned key, separate from the existing Lantern Below saves.
- Storage failures are non-fatal; the game plays normally without saving.

## Testing
- **Core unit tests** run natively (not in the browser) for collision, blast growth, chain reactions, scoring, economy and wave generation.
- **Determinism test:** the same seed and the same recorded inputs must produce identical snapshots after 10,000 steps, natively and under Wasm.
- **Save contract test:** a saved game from an earlier version must still load.
- **Browser smoke test** on the packaged offline HTML, run with WebGPU both available and unavailable.

## Out of scope for the first release
- Multiplayer and online leaderboards.
- Nuclear-war narrative, real-world maps or real weapon systems; the setting is abstract and stylised.
- Mobile app packaging.

## Open questions
- Should interceptor travel time be tuned per difficulty setting, or fixed?
- Should decoys be added earlier to teach target discrimination?
- Is a 60 Hz fixed step enough, or should the core run at 120 Hz on high-refresh displays?
