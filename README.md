# Lantern Below — Harbor Market expedition

Download **[the standalone HTML](https://github.com/yudhiwidyatama/browserrpg/releases/latest/download/Lantern-Below.html)** and open it locally, or run `npm ci && npm run build` in the extracted source tree and open `index.html`. No server, engine, external fonts or asset downloads required. The isometric camera follows the player; a minimap shows the whole floor.

## Expedition
All three floors are 21 × 21. Find the crystal seal and leave via the gold ring. In the Crown Vault also defeat the Warden. Enemies act after successful dungeon actions. Steel and magic use the equipped weapon's bonus; stronger finds equip automatically. Each third defeat earns a rank. The expanded campaign uses a separate versioned save slot and does not overwrite the original release's save.

| Floor | Foe | Signature weapon | Spring healing per drink |
|---|---|---|---|
| Salt Archive | Salt Scribe | Brine Knife (+2) | 8 HP |
| Ember Foundry | Furnace Brute (slower to notice you, hits harder) | Ember Cleaver (+4) | 11 HP |
| Crown Vault | Amethyst Shade (longer pursuit), Crown Warden | Prism Glaive (+6) | 14 HP |

Every floor has four single-use chests, loose coins and a weapon, three vials, and three springs placed in different distance bands. Each spring holds two drinks; using it at full health costs nothing. Foes drop coins where they fall. Walk onto loose loot; use **E** on a chest, spring, or exit. Orange chests and blue live springs appear on the minimap.

**R** recalls you to Harbor Market when no foe is within two tiles. Walk west from the central lift to Tide Smith (Hookblade: 5 coins, Tide Sabre: 14), or east to Crown Forge (Sun Hammer: 26, Dawn Pike: 44). Stand on a stall and select the purchase button. Return to the gold ring and press **R**; the dungeon, opened chests, spring charges, and your position are preserved.

**Controls:** WASD/arrows move or bump-attack; F flares within two walking steps; H drinks a vial; period waits. Buttons support touch. Autosave needs browser storage access.

**Development:** See [CONTRIBUTING.md](CONTRIBUTING.md) for module boundaries, formatting, build instructions, save compatibility and test commands. Players only need the release HTML.
