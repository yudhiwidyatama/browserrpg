# Playing Astra

From the repository root, run `python3 -m http.server 8000 --bind 127.0.0.1` and open <http://localhost:8000/astra/>. No package install, build, asset download, or WebGPU adapter is needed. A modern browser with WebAssembly and Canvas 2D is required; Web Audio is optional.

Choose **Start watch**. Click or tap where a ring should open, or focus the playfield, move with the arrow keys, and press Space. P pauses and resumes. Returning from a hidden tab requires an explicit resume. After dawn or defeat, watch the last run again without supplying new inputs.

`engine.mjs` emits and instantiates the Wasm simulation. `play.mjs` owns input, display, and synthesized sound. Run `node astra/test.mjs` from the repository root for the five-wave golden replay, timing parity, loss, budget, and rim-contact fixtures. See [the design spec](../ASTRA-MISSILEDEFENSE.md).
