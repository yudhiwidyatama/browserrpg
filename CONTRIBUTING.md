# Working on Lantern Below

Use Node.js 22 and `npm ci`. Run `npm test` for deterministic rules, economy, turn-cost, camera, purchase, and save-contract checks. `npm run format` formats source files; `npm run format:check` checks the same files in CI. `npm run build` makes `dist/lantern.js` for `index.html` and the distributable `Lantern-Below.html`. Open the latter directly: players do not need Node or internet access. Generated files are not source files.

## Where changes belong
- `src/content.cjs`: floors, weapon definitions, shop offers, and surface landmarks. A shop offer is `{ weaponId, priceInCoins }`; there is no UI slot limit. Stable IDs identify offers; display names used in version-2 inventory are persistence keys, so renaming a released weapon requires a migration.
- `game.js`: route intent to a domain handler. `src/turns.cjs` is the only place that advances the turn, ticks the flare cooldown, collects defeated enemies and runs their response. Rejected actions cost nothing; market, travel and transitions are quiet turns; dungeon actions permit an enemy response.
- `src/world.cjs`, `grid.cjs`, `combat.cjs`, `interactions.cjs`, `market.cjs`: deterministic rules. Do not import DOM, storage, real time or renderer code here. Keep RNG draw order stable when refactoring old floors.
- `view.js`: browser wiring. `src/client/camera.cjs` owns projection and hit testing; `renderer.cjs` paints geometry; `hud.cjs` and `shop-controls.cjs` render text and offers; `input.cjs` translates keyboard, buttons and pointer gestures to commands.
- `src/client/save.cjs`: the v2 storage boundary. Disk `hero.cd` maps to runtime `hero.flareCooldown`. `tests/fixtures/v2-market.json` is a real legacy expedition and should not be regenerated during routine tests.

## Review checklist
Verify that actions spend exactly the intended turns; test a save from before your change; test shop stock through the HUD and rules, not only the price calculation. CI runs a browser smoke test on the packaged offline HTML. If changing gameplay, keep that diff separate from formatting and pure refactors.
