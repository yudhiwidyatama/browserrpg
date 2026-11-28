# Missile Defense — game description

A real-time, single-screen defense game. Incoming missiles fall toward your cities; you launch interceptors that detonate into expanding blast zones. Stop enough warheads to protect your cities and survive every wave.

This document is a design description, not an implementation. It defines the game, its rules, its graphics and audio requirements, and the technical target: **WebAssembly in the browser**, with **WebGPU as an optional renderer**.

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

## Graphics requirements

### Visual style
- Stylised night-time vector look: dark gradient sky, silhouetted skyline, bright glowing trails and blasts. Original and abstract; no real-world maps, flags or weapon systems.
- Readability comes first. Warheads, interceptors and blasts must be distinguishable from each other and from the background at a glance, using shape and brightness, not colour alone.
- Palette (proposed): background `#05070d` to `#101a33`; warheads red-orange; interceptors cyan; blasts white core fading to amber; cities and batteries pale blue-grey silhouettes.

### Display and performance
| Requirement | Value |
|---|---|
| Logical resolution | 1280 × 720 (16:9), letterboxed to fit any window |
| Pixel density | Honour `devicePixelRatio`, capped at 2 for performance |
| Frame rate | 60 fps target; stay playable at 30 fps on low-end devices |
| Simulation | Fixed 60 Hz step, independent of render rate; the renderer interpolates |
| Entity budget (proposed) | 256 warheads, 64 live blasts, 8,000 particles on screen |
| Frame budget | 16.6 ms total, of which the renderer uses at most 8 ms on a mid-range laptop |
| Memory | No per-frame allocation in the render loop |

### Renderers
- **Canvas 2D (baseline, required):** draws every entity from the shared state buffer. Trails are fading polylines, blasts are radial gradients, particles are sprites from one atlas. This renderer must work on every browser that supports WebAssembly.
- **WebGPU (optional enhancement):** used only when `navigator.gpu` is available and the player has not disabled it. It adds instanced particles, additive glow, bloom and a compute pass for particle motion. It must not change gameplay or any simulation result.
- The player can force the Canvas 2D renderer in settings. Both renderers must be covered by the browser smoke test.

### Procedural graphics and models
Everything below is generated from code, so no model or texture downloads are needed. Generators take the run seed, so a given seed always looks the same.
| Element | Procedural method |
|---|---|
| **Skyline** | Seeded row of rectangles of varying width and height, with randomly lit windows, drawn as one silhouette per city. Destroyed cities swap to a rubble silhouette. |
| **Terrain** | Seeded 1D noise for the ground line, with a flat pad under each city and battery. |
| **Sky and stars** | Vertical gradient plus seeded star points that twinkle slowly. Optional distant moon disc. |
| **Warhead and interceptor** | Small triangle or capsule body with a glowing head. In the optional WebGPU path, a low-poly mesh built at start-up (cone nose, cylinder body, three fins). |
| **Trails** | Ring buffer of the last N positions, drawn as a polyline that fades in alpha and width. |
| **Blasts** | A radial gradient in Canvas 2D; a signed-distance-field circle in the WebGPU shader, with a noisy edge for a fireball look. |
| **Shockwave ring** | An expanding thin circle with fading alpha, spawned at detonation. |
| **Debris and sparks** | Particle bursts with seeded velocities and gravity. |

### Interface
- A heads-up display with score, wave number, funds and interceptors left per battery, drawn at the top of the playfield. Text size at least 16 logical pixels.
- A reticle that follows the pointer.
- Menus for start, pause, upgrades and game over.
- Fonts must be embedded, with no external font downloads.

### Accessibility
- Colour-blind-safe palette checked against the common deficiency types; shape and motion carry meaning as well as colour.
- High-contrast mode, reduced-motion option (no screen shake, fewer particles) and reduced-flash option (dimmer blasts, no full-screen flashes).
- No effect may flash more than 3 times per second.

## Audio requirements

### Approach
The default is **procedural synthesis with the Web Audio API**, the same approach as the existing game described in [AUDIO.md](AUDIO.md): no recordings, no external audio files and no runtime downloads. Optional free sample packs (see the asset list below) may be added later, but any recording added to the package is a deliberate change to that convention and must be recorded in the credits file.

### Sound events
| Event | Sound |
|---|---|
| Interceptor launch | Short rising whoosh: filtered noise burst with a rising band-pass sweep |
| Interceptor in flight | Quiet thin tone, rising in pitch with altitude (optional) |
| Blast | Low thump plus filtered-noise decay; pitch and length scale with blast radius |
| Warhead destroyed | Short crack plus a pitched "ping" |
| Chain reaction | Each further kill in a chain raises the ping by one semitone, up to one octave |
| City hit | Heavy low boom, a falling tone and a short rumble |
| Battery hit | A sharper boom and a short electrical crackle |
| Battery empty / no ammo | Dry click |
| Incoming warning | Soft repeating beep when a warhead is within range of a city, at most 2 per second |
| Wave start / end | Short rising or falling arpeggio |
| Upgrade / purchase | Bright two-note chime |
| Game over | Slow descending line |
| Menu | Short click and blip |

### Music
- Procedural, sparse and low-key: a slow bass pulse and a soft pad. Intensity rises with the wave number, by adding a faster pulse layer after wave 5 and a second layer after wave 10.
- Music and sound effects have separate toggles, and both start off on page load, matching the existing game.
- Music pauses when the page is hidden.

### Technical requirements
- Web Audio only; the audio context starts after the first user gesture, as browsers require.
- Sound effects are triggered from **game events emitted by the Wasm core**, not from rendering. The audio layer reads an event list from shared memory after each step.
- Voice limit of 24 simultaneous sounds. When the limit is reached, the quietest or oldest voice is dropped. Identical sounds within 30 ms are merged.
- Apply small random pitch variation (±3%) so repeated blasts do not sound identical. The variation uses a presentation-only random generator, **not** the seeded simulation generator.
- Master level limited so overlapping blasts never clip. A single limiter or compressor sits on the master output.
- Audio must never affect game state: with sound off or unavailable, the game plays identically.

### Testing
- The audio job renders each cue with `OfflineAudioContext` and checks that it is non-silent, below clipping level and no longer than its maximum duration.
- Control tests cover the toggles, the first-gesture start and pausing on page hide. As with the existing game, this is not a subjective listening test.

## Free assets and procedural sources
All sources below were checked against the publisher's own page or a catalogue of it. **Licences must be re-read at download time** and the result recorded in a `CREDITS.md` file (title, author, URL, licence, date checked) in the repo. Prefer CC0 or public-domain material, so no attribution is legally required, though crediting is polite.

### Graphics
| Source | What it offers | Licence | Use in this game |
|---|---|---|---|
| [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) | 80 particle and light-mask sprites, 512 × 512 PNG | CC0 | Glow, spark and smoke textures for blasts and trails |
| [Kenney Smoke Particles](https://kenney.nl/assets/smoke-particles) | 70 smoke and explosion frames | CC0 | Optional flipbook for blasts and city destruction |
| [Kenney Crosshair Pack](https://kenney-assets.itch.io/crosshair-pack) | 200+ crosshair sprites in white, black, retina and outline versions, plus vector files | CC0 | Reticle and cursor |
| [Kenney Space Shooter Redux](https://opengameart.org/content/space-shooter-redux) | 295+ sprites, 4 backgrounds, 2 TTF fonts | CC0 | Optional icons, HUD pieces and an embeddable font |
| Procedural generators (above) | Skyline, terrain, stars, trails, blasts, meshes | Our own code | Primary source for all core art |

### Audio
| Source | What it offers | Licence | Use in this game |
|---|---|---|---|
| Web Audio synthesis (our own code) | All cues and music described above | Our own code | **Default** and primary source |
| [jsfxr / sfxr.me](https://sfxr.me/) | Browser generator of retro effects. Presets include `explosion`, `laserShoot`, `powerUp`, `hitHurt`, `blipSelect`; sounds export as WAV or as a short parameter string | Source repository contains an Unlicense (public domain) file | Design cues quickly, then keep the parameter strings in the repo and re-render them at start-up; no WAV needs shipping |
| [Kenney Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) | 70 OGG files: engines, explosions, lasers; normalised volume | CC0 | Optional sample layer for launches and blasts |
| [Kenney Digital Audio](https://opengameart.org/content/free-sounds) (listed as "63 Digital sound effects") | Lasers, phasers and space effects | CC0 | Optional UI and warning beeps |
| Kenney Interface Sounds and Impact Sounds | UI and impact effects | CC0 | Optional menu clicks and city-hit impacts |
| Kenney "85 Short music jingles" | Short jingles | CC0 | Optional wave-start and game-over stingers |
| qubodup "Explosion and Shockwave 1" and "2" on OpenGameArt | Explosion recordings of about 3.3 s and 4.6 s | CC0 (per the Selekt catalogue) | Optional heavy blast sample |
| [Pixabay sound effects](https://pixabay.com/sound-effects/search/missile%20launch/) | Many missile launch and explosion clips | Pixabay's own royalty-free licence, no attribution required | **Not CC0.** Use only after reading Pixabay's current licence terms; lowest preference |

### Licence notes
- The `jsfxr` GitHub repository carries an **Unlicense** file, but one third-party listing shows Apache-2.0 and its npm page shows no licence. Check the `LICENSE`/`UNLICENSE` file in the exact version bundled before shipping any of its code. Sounds designed with the web tool are our own output.
- Kenney reports 70 files in Sci-Fi Sounds; a community index counts 73. Use the count in the downloaded archive.
- OpenGameArt files are licensed individually. Confirm CC0 on each file page, not only in a collection.

### Package size budget (proposed)
| Part | Budget |
|---|---|
| Wasm module | under 300 KB |
| Textures (one particle atlas, optional smoke sheet) | under 400 KB |
| Audio samples (optional) | under 600 KB, OGG, mono, 22–44 kHz |
| Total standalone HTML | under 2 MB |

With only the procedural defaults, the total is the Wasm module plus a few kilobytes of script.

## Technical target: WebAssembly
The game targets browsers through **WebAssembly**. The simulation core is compiled to a Wasm module; a thin JavaScript layer handles the page, input and rendering.

### Architecture
| Layer | Responsibility | Runs as |
|---|---|---|
| **Simulation core** | Entities, physics, collisions, waves, scoring, seeded RNG, game events | WebAssembly |
| **Platform layer** | Canvas, input events, audio, storage, timing | JavaScript |
| **Renderer** | Draws the state exported by the core | Canvas 2D by default; WebGPU optional |

### Simulation core
- Written in a language that compiles to `wasm32` (Rust is the recommended choice).
- **Deterministic**: fixed time step of 60 updates per second, integer or fixed-point-safe maths where results must match across machines, and no use of wall-clock time or platform APIs inside the core.
- The core exposes a small API: `init(seed)`, `step(inputs)`, `snapshot()`, `events()`, `save()` and `load()`.
- State is exported to JavaScript through a **shared linear-memory buffer** of plain structs (positions, radii, types, flags), so no per-frame allocation or copying is needed. `events()` returns the cues that the audio layer plays.
- This mirrors the repository's existing rule that rules code does not import DOM, storage, real time or renderer code (see [CONTRIBUTING.md](CONTRIBUTING.md)).

### Build and delivery
- A single build step produces the `.wasm` module plus a small JavaScript loader.
- The module is embedded in the distributable HTML (base64) so that the game still runs **offline from a single file**, as the current release does. No server, external fonts or asset downloads are required. Any optional textures or samples are embedded the same way.
- Size budgets are listed under the asset section.
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
- **Rendering test:** the procedural skyline and terrain generators return identical geometry for the same seed.
- **Audio test:** see the audio section.
- **Browser smoke test** on the packaged offline HTML, run with WebGPU both available and unavailable.
- **Credits check:** a CI step fails if a shipped asset has no entry in `CREDITS.md`.

## Out of scope for the first release
- Multiplayer and online leaderboards.
- Nuclear-war narrative, real-world maps or real weapon systems; the setting is abstract and stylised.
- Mobile app packaging.
- Full 3D scenes and recorded voice-over.

## Open questions
- Should interceptor travel time be tuned per difficulty setting, or fixed?
- Should decoys be added earlier to teach target discrimination?
- Is a 60 Hz fixed step enough, or should the core run at 120 Hz on high-refresh displays?
- Should the game stay fully synthesised like Lantern Below, or ship a small optional CC0 sample layer for the heavy blast sound?
