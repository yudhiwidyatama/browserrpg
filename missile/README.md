# Missile Defense

A real-time defense game that runs offline in the browser. The rules live in a **WebAssembly** core; a thin JavaScript layer draws, plays sound and handles input. Design: [MISSILE_DEFENSE.md](../MISSILE_DEFENSE.md).

## Play and build
```
node missile/build.cjs        # writes missile/dist/Missile-Defense.html (about 90 KB, fully offline)
npm run test:missile          # compiler, core, audio, renderer, session, packaged-game and credits tests
```
Open `missile/dist/Missile-Defense.html` directly. Only Node is needed: there are no dependencies, no network access and no external assets.

## Controls
| Input | Action |
|---|---|
| Click / tap | Fire an interceptor at that point (nearest battery with ammunition) |
| Touch: drag, then release | The reticle floats 80 px above your finger; releasing fires |
| Right-click, **D**, or the DETONATE button (touch) | Detonate your latest interceptor early |
| **Space** / Enter, arrow keys | Fire at the reticle, move the reticle |
| **1** / **2** / **3** | Force battery 1 / 2 / 3 for your next shots (press again to clear) |
| **P** / Esc | Pause (also pauses when the tab is hidden) |
| **M** | Toggle music and sound effects (both start off) |

## How it is built
| Part | File | Notes |
|---|---|---|
| Simulation core | `core/missile.mcl` | Compiled to a ~10 KB WebAssembly module. All state is in linear memory. Integer maths only, fixed 60 Hz step, four separate seeded random streams (waves, perk offers, city passives, mutators). |
| Compiler | `tools/mcl.cjs` | A small integer-only language that emits WebAssembly directly. It exists because this environment has no Rust or other Wasm toolchain; see "Why not Rust" below. |
| Session | `client/session.cjs` | Clock, speed, slow motion, hit-stop, saving, resuming, replays and statistics. No DOM. |
| Renderer | `client/render.cjs` | Canvas 2D. Procedural skyline, terrain and stars from the run seed. |
| Audio | `client/audio.cjs`, `client/audio-cues.cjs` | Web Audio synthesis: effects from core events, layered procedural music. |
| Interface | `client/app.cjs`, `client/index.html` | Menus, perk draft, settings, input. |
| Bundler | `build.cjs` | Embeds the Wasm (base64) and all client code in one HTML file. |

Saves and replays work by recording every input with its step number. Because the core is deterministic, replaying the inputs reproduces a run exactly; a saved run is restored by replaying it up to the start of the current wave.

## What is implemented (version 1 of the spec)
Warheads, splitters (wave 4+) and fast warheads (wave 6+); three batteries with different roles; manual detonation; chains with secondary blasts and the 12-kill cap; style bonuses; funds, rebuilds and rerolls; the 8-perk draft; 6 of 8 city passives per run; wind, fog and low-ammo mutators; calm waves; the 30-wave campaign with a victory screen, endless mode, daily seed with a share code, replay export and import, resume, restart wave; tutorial hints; assists (game speed, lead marker); reduced motion, reduced flashing, high contrast; procedural sound effects and music.

## Differences from the spec, and gaps
- **Detonation control.** The spec says to "tap again" to detonate, but a tap fires. This build uses right-click, **D** or a button instead, and the spec should be updated to match.
- **Mutator schedule.** The spec did not say when mutators appear before wave 21. This build gives one every third wave from wave 5 (5, 8, 11, ...), one every wave from 21, and two from 26.
- **Shield dome** protects the leftmost standing cities; there is no city choice yet.
- **Renderer.** Canvas 2D only. The optional WebGPU renderer is not implemented.
- **Not implemented ("Later" in the spec):** decoys, bombers, armoured, evasive, EMP and MIRV warheads, bonus UFO, boss waves, meteors, ghost races, challenge waves, zen mode. The near-miss highlight is also missing.
- **Fonts.** The system font stack is used, so nothing is downloaded, but no font is embedded.
- **Assets.** None bundled (see [CREDITS.md](CREDITS.md)); the free CC0 packs listed in the spec are an optional later step.
- **Colour-blind palette** is designed (shapes differ as well as colours) but has not been checked with a simulator.

## Testing, and what it does not cover
`tests/` covers the compiler, every rule in the core (including determinism, replay round trip, resume and random-stream independence), the audio cues and limits, the renderer, the session, and the packaged game running against a DOM stand-in. The audio and renderer tests use recording stand-ins for Web Audio and Canvas, so they check scheduling, limits and error-free drawing, **not how anything looks or sounds**. The game has not been opened in a real browser; do that before release, with touch and keyboard.

The bot in `tests/bot.cjs` is a deterministic stand-in for an average player, used for balance checks. It aims perfectly, so human play will be harder than its results suggest.

## Why not Rust
The spec recommends Rust. The environment this was written in has no Rust, Go or Emscripten toolchain and no network, so a Rust core could not be compiled or tested there. The core is instead written in `mcl`, which is deliberately plain (integers, memory, loops). Porting it to Rust later is straightforward: the state layout is the list of `const` offsets at the top of `core/missile.mcl`, and the tests drive the core only through that layout and the exported API (`init`, `step`, `input`, `pump`, `hash`, `replay_begin`, `replay_end`, `clear_events`).
