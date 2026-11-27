# Lantern Below

A small, offline, isometric turn-based RPG. Cross the Salt Archive, Ember Foundry and Crown Vault, recover each floor's seal, and defeat the Crown Warden. Enemies move only after you spend a turn. Low-poly scenery, characters, and equipment are drawn from procedurally generated XYZ mesh rings using an orthographic camera and Canvas 2D; no engine, textures, models, external fonts or network services are required.

**Play:** Download `Lantern-Below.html` from [the latest release](https://github.com/yudhiwidyatama/browserrpg/releases/latest) and open it in a modern browser. Alternatively download the source ZIP, extract it, and open `index.html` next to `game.js` and `view.js`. For static web hosting, deploy those three files together.

**Controls:** WASD/arrows move along the isometric grid. Walk into a foe to attack. F flares within two walking steps; it takes four other turns to recharge. H spends a vial for up to 10 HP. Period waits. E uses a gold-ring exit when you have its seal. On floor 3, defeat the Warden first. Tap adjacent floor tiles or use the on-screen controls on touch devices. Three defeated foes earn a rank. The expedition autosaves when browser storage is available.

**Development:** `node tests/rules.cjs` runs deterministic generation and campaign tests. `node package.cjs` produces the standalone HTML. CI opens that exact build in headless Chrome and checks rendering, button and keyboard actions, and saving. No runtime or build dependencies beyond Node's standard library.
