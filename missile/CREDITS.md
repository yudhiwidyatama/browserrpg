# Credits — Missile Defense

**No third-party assets are bundled.** All graphics (skyline, terrain, stars, trails, blasts, particles, interface) are drawn by code from the run seed, and all sound and music is synthesised with the Web Audio API. Text uses the player's system font stack; nothing is downloaded. The WebAssembly core is built from `core/missile.mcl` by the in-repo compiler `tools/mcl.cjs`.

## Shipped third-party assets

| Title | Author | URL | Licence | Date checked | File |
|---|---|---|---|---|---|

_None._ `tests/credits.cjs` fails if the packaged game contains an embedded image, audio or font that is not listed in this table.

## Adding an asset

1. Prefer CC0 or public-domain sources (see "Free assets and procedural sources" in [MISSILE_DEFENSE.md](../MISSILE_DEFENSE.md)).
2. Re-read the licence on the publisher's page on the day you download it. OpenGameArt files are licensed one by one, so check the file page, not only a collection.
3. Add a row above with the title, author, URL, licence, the date you checked, and the file it became.
4. Keep the package within its size budget (see `build.cjs`).
