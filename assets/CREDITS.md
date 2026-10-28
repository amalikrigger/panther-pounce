# Credits and licenses

Every file the game uses must be listed here with where it came from and its
license. If you add art, sound, a font or a library, add a row in the same commit.

## Fonts

| File | Source | Author | License |
|---|---|---|---|
| `fonts/creepster-latin.woff2` | [Google Fonts: Creepster](https://fonts.google.com/specimen/Creepster) | Font Diner (Sideshow) | SIL Open Font License 1.1 (`fonts/OFL-Creepster.txt`) |
| `fonts/fredoka-latin-variable.woff2` | [Google Fonts: Fredoka](https://fonts.google.com/specimen/Fredoka) | The Fredoka Project Authors (Milena Brandão, Hafontia) | SIL Open Font License 1.1 (`fonts/OFL-Fredoka.txt`) |

These are the same Latin-subset files Panther Slash bundles (downloaded from
Google Fonts on Oct 27, 2026), so the whole Panther Arcade uses identical fonts.
They are bundled so the game works offline.

## Code libraries

| File | Version | Source | License |
|---|---|---|---|
| `../vendor/planck-1.5.0/planck.mjs` | Planck.js 1.5.0 (npm, sha256 of the package tarball `e67f906f…acf5`) | [github.com/piqnt/planck.js](https://github.com/piqnt/planck.js) | MIT (`../vendor/planck-1.5.0/LICENSE.txt`) |

The source-map comment at the end of `planck.mjs` was removed (the map file
isn't shipped). Nothing else was changed.

## Art drawn in code (no image files)

Original work for Panther Pounce, made with Canvas drawing code. These are
part of this project's own code and carry no third-party license.

| What | Where |
|---|---|
| Panther, ghost, bat, Phantom, jack-o'-lantern, wood, stone, tombstone, slingshot | `src/render/art.js` |
| Night sky, harvest moon, bats, spiderweb, hills, and the graveyard / haunted house / pumpkin patch / clock tower silhouettes | `src/render/background.js` |
| Splinters, smoke puffs, sparks, shockwaves, floating scores | `src/render/effects.js` |
| Paw, star, lock and button icons | inline SVG in `index.html`, `src/main.js` and `src/ui/screens.js` |
| App icons `icons/icon-*.png` | rendered from the panther drawing in `src/render/art.js`, on a moon and sky drawn in code |
| Prize medal | the panther drawing, painted at runtime in `src/ui/prize.js` |

The "campus" setting is a made-up clock tower, not a real school building.

## Sound

All sound effects are synthesized live with the Web Audio API in
`src/audio/sound.js`. There are no sound files.

## Student contributions

| File | Made by | Notes |
|---|---|---|
| *(none yet)* | | |

## Removed legacy files

The project started from an HTML5 port of Rovio's *Angry Birds* (Rovio's art,
plus a font and sounds with no known license). All of those files were
deleted on Oct 27, 2026, and nothing from them is used. They are still in the
git history before that date, so don't restore them.
