# Missile Defense — game description

A real-time, single-screen defense game. Incoming missiles fall toward your cities; you launch interceptors that detonate into expanding blast zones. Stop enough warheads to protect your cities and survive every wave.

This document is a design description, not an implementation. It defines the game, its rules, its replayability features, its graphics and audio requirements, and the technical target: **WebAssembly in the browser**, with **WebGPU as an optional renderer**. All numbers are **starting values for tuning**, not final.

## Pitch
You command a small chain of batteries on the ground. Each wave sends more, faster and smarter warheads. You have limited interceptors, so every shot counts. Leading a target, chaining explosions and deciding which city to sacrifice are the core decisions. Between waves you draft perks, so no two runs play the same.

## Scope: version 1 and later
| Area | **Version 1 (ship first)** | **Later** |
|---|---|---|
| Enemies | Warhead, splitter, fast warhead | Decoy, bomber, armoured, evasive, EMP warhead, MIRV, bonus UFO, boss waves |
| Player tools | Tap to fire, **manual detonation**, 3 batteries with distinct roles | More battery types |
| Progression | **Perk draft** (8 perks), **city passives** (6 of 8), rebuild purchases | More perks, unlocks, achievements, cosmetic palettes |
| Wave variety | **3 mutators** (wind, fog, low ammo) | More mutators |
| Modes | Campaign (30 waves), endless, **daily seed**, **replay export / import** | Hand-authored challenge waves, ghost races, zen mode |
| Rendering | Canvas 2D | WebGPU enhancement |
| Audio | Procedural synthesis | Optional CC0 sample layer |

Items marked "Later" are specified below so the design stays consistent, but they are not required for the first release.

## Core loop
1. A wave begins. If it has a mutator, it is announced for 2 seconds first. Warheads appear at the top of the screen and fly toward cities or batteries.
2. The player aims and fires an interceptor from a battery with ammunition.
3. The interceptor flies to the aim point and detonates (or is detonated early by a second tap), leaving a blast that grows, holds, then shrinks.
4. Any warhead that enters a live blast is destroyed. Its own explosion can destroy other warheads, which allows chain reactions.
5. When all warheads are resolved, the wave ends. Surviving cities and unused interceptors convert into score and funds.
6. The player drafts **1 perk from 3**, spends funds on rebuilds, then the next wave begins.

## Playfield
- A flat 2D battlefield, rendered with a fixed logical resolution of 1280 × 720 and scaled to fit the window.
- **6 cities** along the ground and **3 batteries** (left, centre, right). Batteries and cities are separate targets.
- Each battery holds 10 interceptors at the start of a wave. A battery that is destroyed cannot fire for the rest of the wave.
- The sky has no obstacles. Weather and terrain are cosmetic only; effects that change play are **mutators** (see below).

## Entities
| Entity | Behaviour | Version |
|---|---|---|
| **Warhead** | Falls along a straight line from the top edge to a chosen target. Destroyed by any blast. | 1 |
| **Splitter** | Divides into 2–3 warheads at a set altitude. Appears from wave 4. | 1 |
| **Fast warhead** | Moves at roughly twice the base speed. Appears from wave 6. | 1 |
| **Decoy** | Harmless on impact. Appears from wave 8. **Must show a tell**: a dimmer, dotted trail and no red target marker on its destination. Destroying a decoy gives no points but costs the player nothing; its purpose is to waste ammo. | Later |
| **Bomber** | Flies sideways across the screen and drops warheads. Appears from wave 10. It has a **circular hitbox of 24 logical pixels** and is destroyed by any blast that touches that hitbox, like any warhead. | Later |
| **Armoured warhead** | Needs 2 separate blasts; a damaged one shows a cracked outline. | Later |
| **Evasive warhead** | Weaves sideways within a 60 px band. | Later |
| **EMP warhead** | If it hits a battery, that battery cannot fire for 5 seconds instead of being destroyed. | Later |
| **MIRV** | Splits into 4 late, close to the ground. | Later |
| **Bonus UFO** | Crosses the sky; a hit drops 3 interceptors to the nearest battery. | Later |
| **Interceptor** | Launched from a battery. Travels at fixed speed to the aim point, then detonates. | 1 |
| **Blast** | A circle with growing, holding and shrinking phases. Destroys warheads, not cities. | 1 |
| **City / Battery** | Static ground targets. Hit once to destroy, and can be rebuilt between waves. | 1 |

### Batteries have roles
| Battery | Interceptor speed | Blast radius | Magazine |
|---|---|---|---|
| Left — **Skirmisher** | Fast (1.3×) | Small (0.8×) | 10 |
| Centre — **Artillery** | Slow (0.8×) | Large (1.3×) | 8 |
| Right — **Salvo** | Normal (1×) | Normal (1×) | 12, fires 2 interceptors 30 px apart per tap at the cost of 1 |

The multipliers apply to base values. A tap fires from the **nearest battery with ammunition** by default; keys 1, 2, 3 force a specific battery.

## Controls
- **Mouse / touch:** tap or click a point in the sky to fire at it.
- **Manual detonation:** tap or press Space again while an interceptor is in flight to **detonate the most recent live interceptor early**. The blast is centred where the interceptor is at that moment.
- **Touch aiming:** two modes, selectable in settings.
  - *Drag to aim* (default on touch screens): the reticle floats **80 logical pixels above the finger**, and lifting the finger fires.
  - *Tap to fire*: the interceptor aims at the tap point.
- **Keyboard:** 1, 2, 3 select a specific battery; arrow keys move the reticle; Space fires, and fires again to detonate.
- **P** pauses. **M** toggles sound.
- No on-screen buttons are required during play.

## Rules
- Interceptors take real flight time to reach the aim point. The player must **lead** moving warheads.
- Blast radius, hold time and interceptor speed are fixed per battery and perk level, so the game is learnable and skill-based.
- **Chains.** A warhead destroyed by a blast creates a small **secondary blast** (40% of the radius that destroyed it). A secondary blast can destroy more warheads, but does **not** create another blast, unless the **Chain amplifier** perk applies (see below). A **chain** is every warhead destroyed by blasts that descend from the same interceptor.
- The game ends when all cities are destroyed.
- Between waves, destroyed cities and batteries may be rebuilt for a price. A free city is rebuilt every 5 waves.
- Wave state is saved only **between waves**. Leaving mid-wave resumes at the start of that wave.

## Scoring and economy
- 25 points per warhead destroyed.
- **Chain bonus:** a chain that destroys *n* warheads awards *n* × 25 × *n* points, with *n* counted up to a **cap of 12** (maximum 3,600 points per chain).
- **Style bonuses:**
  - *Last-second save:* +50 points for a kill within 40 px of a city or battery.
  - *Clean wave:* +200 points if no city or battery is hit.
  - *Thrifty wave:* +150 points if at least half of the wave's interceptors are unused.
- End-of-wave bonus: 100 points per surviving city and 5 points per unused interceptor.
- **Funds** equal **25%** of the wave score, rounded down. Wave 1 pays roughly 200–250 funds.

### Spending funds (between waves)
| Purchase | Price |
|---|---|
| Rebuild a city | 300 |
| Rebuild a battery | 150 |
| Reroll the perk draft | 100, then +50 for each further reroll that wave |

Perks themselves are **free**; the draft is a choice, not a purchase.

### Ammunition pressure (tuning target)
- Warheads per wave: 8 + 2 per wave, up to a cap of 40 at wave 17.
- A battery's full magazine is 10 (see the battery table). With about 30 interceptors in total, the player should be using **60–90% of their ammunition by wave 10** with typical play. If testing shows otherwise, adjust the magazine or warhead count, not the perk values.

## Perks (draft)
After each wave the player is offered **3 perks chosen at random** and picks **1**. A perk already owned is upgraded, up to level 3. Offers come from a **separate seeded stream**, so the draft never changes how the waves themselves are generated.

| Perk | Level 1 effect |
|---|---|
| **Cluster** | The interceptor detonates as 3 blasts at 60% radius, spread 40 px apart. |
| **Lingering** | Blast hold time ×2, radius ×0.8. |
| **Magnetic** | The blast drifts toward the nearest warhead at 60 px/s while it grows. |
| **Shield dome** | One chosen city absorbs 1 hit per wave. Higher levels shield more cities. |
| **EMP field** | Warheads within 1.5× the blast radius move at 50% speed for 2 seconds. |
| **Salvo** | Every battery fires 2 interceptors per tap, 30 px apart. Costs 1 ammunition. |
| **Recycler** | Every 5th kill refunds 1 interceptor to the firing battery. |
| **Chain amplifier** | Secondary blasts can create one further secondary blast. |

Level 2 and 3 values are set during tuning. A perk's numbers must be listed in the content data, not hard-coded in the rules.

## City passives
Each run draws **6 of 8** passives from the run seed and assigns one to each city. A passive is active only while its city stands, and returns when the city is rebuilt. This makes "which city to sacrifice" a real choice.

| Passive | Effect while the city stands |
|---|---|
| **Power plant** | Blast radius +10% |
| **Laboratory** | Interceptor speed +10% |
| **Bank** | Funds +15% |
| **Radar** | Shows a dotted lead marker 0.5 s ahead of each warhead |
| **Depot** | Every battery starts each wave with +1 interceptor |
| **Harbour** | First rebuild each wave is half price |
| **Barracks** | Battery destroyed mid-wave comes back after 10 seconds |
| **Observatory** | Shows warheads in fog and reveals decoys |

## Wave mutators
A mutator is announced for 2 seconds before its wave and shown as an icon in the HUD.
| Mutator | Effect | Version |
|---|---|---|
| **Wind** | Interceptors drift sideways by up to ±40 px/s; arrow icons show direction and strength. | 1 |
| **Fog** | Warheads are invisible until they have travelled 40% of their path. | 1 |
| **Low ammo** | Batteries start with 6 interceptors, and every 4th kill refunds one. | 1 |
| **Meteors** | 10–20 harmless pale-blue streaks cross the sky. They have no target marker and are visibly different from warheads. | Later |

From wave 21 every wave has 1 mutator; from wave 26, 2.

## Waves and difficulty
- Wave 1 sends 8 warheads at base speed; each wave adds warheads and shortens the gaps between them.
- New enemy types are introduced one at a time, so each can be learned. **Waves 1–3 are a guided tutorial**, with short on-screen prompts for firing, leading a target, and manual detonation.
- **Pacing:** every 4th wave is a calm wave with fewer, slower warheads, followed by a harder wave; the rise in difficulty is not a straight ramp.
- Targets are chosen by a deterministic pseudo-random generator seeded per run. The same seed gives the same game, which supports the daily seed and replays.
- **Campaign:** 30 waves. Wave 30 is a double-sized wave; surviving it shows a victory screen and unlocks **endless** play.
- Warhead speed is capped at 3× base from wave 20. After the cap, pressure comes from mutators, new enemy types and boss waves, not from speed.
- **Boss waves** (later): every 10th wave has a carrier ship with 3 weak points that launch warheads in volleys.

## Modes
| Mode | Description | Version |
|---|---|---|
| **Campaign** | 30 waves, then a victory screen. | 1 |
| **Endless** | Continue past wave 30 until all cities fall. | 1 |
| **Daily seed** | The seed is derived from the **UTC date** (`YYYYMMDD`), so everyone gets the same waves, perk offers and city passives that day. The best score is kept locally. Finishing shows a **share code** containing the date, score and a hash of the replay. | 1 |
| **Replay** | Export a run as a short text string of seed, version and recorded inputs. Import to watch it back. | 1 |
| **Ghost race** | Play a daily seed alongside an imported replay as a translucent ghost. | Later |
| **Challenge waves** | Hand-authored puzzles, such as "clear this wave with 3 interceptors". | Later |
| **Zen / practice** | No game over; used for learning and accessibility. | Later |

## Game flow and screens
- **Start screen:** Campaign, Endless, Daily, Replays, Settings.
- **HUD:** score, wave, funds, interceptors per battery, active mutator icon, active perks.
- **Pause menu:** resume, restart wave, settings, quit to menu. Restart wave is allowed and costs nothing.
- **Between waves:** summary of score and bonuses, perk draft, rebuild choices.
- **Game over:** final score, wave reached, chains, best chain, accuracy (kills per interceptor), best score, an option to export the replay.
- **Stats** are stored locally per mode.

## Game feel
- **Slow motion:** chains of 5 or more warheads trigger a 0.4 s slow-down to 40% speed. This affects only presentation time, not the simulation step count, and is disabled by the reduced-motion option.
- **Hit-stop:** a 50 ms freeze on a kill in a chain of 3 or more.
- **Combo text:** a short on-screen label for each chain size, such as "Chain ×5".
- **Screen shake:** small and scaled to blast size; off in reduced-motion.
- **Feedback for near misses:** a brief highlight on a warhead that passes within 10 px of a blast edge.
- Every effect above must respect the accessibility options and must not affect the game state.

## Graphics requirements

### Visual style
- Stylised night-time vector look: dark gradient sky, silhouetted skyline, bright glowing trails and blasts. Original and abstract; no real-world maps, flags or weapon systems.
- Readability comes first. Warheads, interceptors, blasts, decoys and meteors must be distinguishable from each other and from the background at a glance, using shape, brightness and motion, not colour alone.
- Palette (proposed): background `#05070d` to `#101a33`; warheads red-orange; interceptors cyan; blasts white core fading to amber; cities and batteries pale blue-grey silhouettes; harmless objects (decoy trails, meteors) pale blue.

### Display and performance
| Requirement | Value |
|---|---|
| Logical resolution | 1280 × 720 (16:9), letterboxed to fit any window |
| Pixel density | Honour `devicePixelRatio`, capped at 2 for performance |
| Frame rate | 60 fps target; stay playable at 30 fps on low-end devices |
| Simulation | Fixed 60 Hz step, independent of render rate; the renderer interpolates |
| Entity budget | 256 warheads, 64 live blasts |
| Particle budget | **2,000 on screen with Canvas 2D; 8,000 with WebGPU.** The core emits the same events either way; the renderer drops particles beyond its own cap. |
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
| **Skyline** | Seeded row of rectangles of varying width and height, with randomly lit windows, drawn as one silhouette per city. Destroyed cities swap to a rubble silhouette. A city's passive shows as a small icon above it. |
| **Terrain** | Seeded 1D noise for the ground line, with a flat pad under each city and battery. |
| **Sky and stars** | Vertical gradient plus seeded star points that twinkle slowly. Optional distant moon disc. |
| **Warhead and interceptor** | Small triangle or capsule body with a glowing head. In the optional WebGPU path, a low-poly mesh built at start-up (cone nose, cylinder body, three fins). |
| **Trails** | Ring buffer of the last N positions, drawn as a polyline that fades in alpha and width. Decoys use a dotted trail. |
| **Blasts** | A radial gradient in Canvas 2D; a signed-distance-field circle in the WebGPU shader, with a noisy edge for a fireball look. |
| **Shockwave ring** | An expanding thin circle with fading alpha, spawned at detonation. |
| **Shield dome** | A thin translucent arc over the protected city that flashes when it absorbs a hit. |
| **Mutator effects** | Wind: animated arrow icons and drifting dust. Fog: a darkening gradient over the upper sky. |
| **Debris and sparks** | Particle bursts with seeded velocities and gravity. |

### Interface
- A heads-up display drawn at the top of the playfield. Text size at least 16 logical pixels.
- A reticle that follows the pointer (offset above the finger in drag mode).
- Menus for start, pause, perk draft, rebuilds and game over.
- Fonts must be embedded, with no external font downloads.

### Accessibility
- Colour-blind-safe palette checked against the common deficiency types; shape and motion carry meaning as well as colour.
- High-contrast mode, reduced-motion option (no screen shake, no slow motion, fewer particles) and reduced-flash option (dimmer blasts, no full-screen flashes).
- No effect may flash more than 3 times per second.
- **Assist options:** a slower game speed (75% or 50%) and an optional lead marker for every player, not only those with the Radar passive. Using either is recorded on the score and excluded from the daily leaderboard code.
- Zen mode (later) removes the game-over condition.

## Audio requirements

### Approach
The default is **procedural synthesis with the Web Audio API**, the same approach as the existing game described in [AUDIO.md](AUDIO.md): no recordings, no external audio files and no runtime downloads. Optional free sample packs (see the asset list below) may be added later, but any recording added to the package is a deliberate change to that convention and must be recorded in the credits file.

### Sound events
| Event | Sound |
|---|---|
| Interceptor launch | Short rising whoosh: filtered noise burst with a rising band-pass sweep |
| Interceptor in flight | Quiet thin tone, rising in pitch with altitude (optional) |
| Manual detonation | A sharper, shorter version of the blast cue |
| Blast | Low thump plus filtered-noise decay; pitch and length scale with blast radius |
| Warhead destroyed | Short crack plus a pitched "ping" |
| Chain reaction | Each further kill in a chain raises the ping by one semitone, up to one octave |
| Near miss | Quiet whoosh |
| City hit | Heavy low boom, a falling tone and a short rumble |
| Battery hit | A sharper boom and a short electrical crackle |
| Shield absorbs a hit | A short metallic ring |
| Battery empty / no ammo | Dry click |
| Incoming warning | Soft repeating beep when a warhead is within range of a city, at most 2 per second |
| Mutator announced | Short low sting, different for each mutator |
| Wave start / end | Short rising or falling arpeggio |
| Perk chosen / purchase | Bright two-note chime |
| Game over / victory | Slow descending line / short rising fanfare |
| Menu | Short click and blip |

### Music
- Procedural, sparse and low-key: a slow bass pulse and a soft pad. Intensity rises with the wave number, by adding a faster pulse layer after wave 5 and a second layer after wave 10. Calm waves drop back to the pad.
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
| **Simulation core** | Entities, physics, collisions, waves, perks, passives, scoring, seeded RNG, game events | WebAssembly |
| **Platform layer** | Canvas, input events, audio, storage, timing | JavaScript |
| **Renderer** | Draws the state exported by the core | Canvas 2D by default; WebGPU optional |

### Simulation core
- Written in a language that compiles to `wasm32` (Rust is the recommended choice).
- **Deterministic**: fixed time step of 60 updates per second and no use of wall-clock time or platform APIs inside the core.
- **Maths rule:** basic `f32` arithmetic in Wasm is deterministic, but maths-library functions (`sin`, `cos`, `sqrt` variants, `pow`) can differ between builds and platforms. Anything that affects the simulation must use **fixed-point arithmetic or a vendored maths routine** compiled into the module. Rendering and audio may use the platform's maths freely.
- **Random streams:** separate seeded generators for waves, perk offers, city passives and mutators, so one stream never shifts another. Presentation effects use a non-seeded generator.
- The core exposes a small API: `init(seed, mode)`, `step(inputs)`, `snapshot()`, `events()`, `save()`, `load()`, `record()` and `replay()`.
- State is exported to JavaScript through a **shared linear-memory buffer** of plain structs (positions, radii, types, flags), so no per-frame allocation or copying is needed. `events()` returns the cues that the audio layer plays.
- This mirrors the repository's existing rule that rules code does not import DOM, storage, real time or renderer code (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Perk, passive, mutator and battery values live in a **content data file**, as the repository does for floors and weapons, so tuning does not need rules changes.

### Replay format
- A replay is the **seed, game version, mode and the list of inputs with their step numbers**, encoded as a short text string. Because the core is deterministic, replaying the inputs reproduces the run exactly.
- A replay from an older game version is rejected with a clear message rather than played incorrectly.

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
- High scores, per-mode stats, settings, the last daily result and unlocks are stored in browser storage under a versioned key, separate from the existing Lantern Below saves.
- The between-wave state (perks, passives, cities, funds, wave number, seed and the input list so far) is saved after each wave.
- Replays are exported as text and are not stored automatically.
- Storage failures are non-fatal; the game plays normally without saving.

## Testing
- **Core unit tests** run natively (not in the browser) for collision, blast growth, chain definition and the chain cap, manual detonation, scoring, economy, perk effects, city passives, mutators and wave generation.
- **Determinism test:** the same seed and the same recorded inputs must produce identical snapshots after 10,000 steps, natively and under Wasm.
- **Random stream test:** drafting different perks must not change the generated waves for the same seed.
- **Replay round-trip test:** exporting then importing a replay reproduces the final score.
- **Daily seed test:** the same UTC date always gives the same waves, offers and passives.
- **Save contract test:** a saved game from an earlier version must still load.
- **Rendering test:** the procedural skyline and terrain generators return identical geometry for the same seed.
- **Audio test:** see the audio section.
- **Browser smoke test** on the packaged offline HTML, run with WebGPU both available and unavailable, and with touch input in both aiming modes.
- **Credits check:** a CI step fails if a shipped asset has no entry in `CREDITS.md`.

## Out of scope for the first release
- Multiplayer and online leaderboards.
- Nuclear-war narrative, real-world maps or real weapon systems; the setting is abstract and stylised.
- Mobile app packaging.
- Full 3D scenes and recorded voice-over.
- Everything marked "Later" in the scope table.

## Open questions
- Should interceptor travel time be tuned per difficulty setting, or fixed?
- Is a 60 Hz fixed step enough, or should the core run at 120 Hz on high-refresh displays?
- Should the game stay fully synthesised like Lantern Below, or ship a small optional CC0 sample layer for the heavy blast sound?
- Should assist options be allowed in the daily seed at all, or should the daily seed always use standard settings?
- Should perks be able to reach level 3, or is a maximum of 2 enough to keep choices meaningful?
