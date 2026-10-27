# Good first tasks

Pick one, tell the class you're on it, and keep the change small. Read
`README.md` first; it explains the folders, making levels, and the git workflow.

## Levels (no coding experience needed)

- **Design a level.** Copy a level file, build something new, and make
  `node --test` pass. Ideas: a bridge of planks over a ghost, a pyramid of
  tombstones, a pumpkin "minefield".
- **Tune the par scores** of an existing level so 3 stars feels earned. Play it
  five times and write down your scores first.
- **A boss level** with two Phantoms.

## Feel and balance (`src/config.js`)

- **Tune the launch power** (`SLINGSHOT.launchSpeed`) and the aiming line
  length (`SLINGSHOT.trajectorySeconds`). What's too easy? Too hard?
- **Make wood tougher or weaker** (`MATERIALS.wood.health`) and see how it
  changes the levels.
- **Bigger explosions:** change `MATERIALS.pumpkin.explodes`.
- **Change the colors** in `THEME`, and the matching ones in `src/styles.css`.

## Art

- **Draw a new enemy** as a PNG (see "Add your own art" in the README for
  the exact size rules) and give it its own entry in `ENEMIES`.
- **Draw the panther** as a PNG and swap it in with `PANTHER.art`.
- **Draw block textures:** wood planks, crypt stone, a cracked tombstone.
- **Design a prize-tier badge** (Bronze, Silver, Gold, Legendary Panther) for
  the prize screen, as a square PNG.

## Sound

- **Record sound effects:** a panther roar for the launch, a "BOO!" for when
  a ghost disappears, a crunch for breaking wood. Record on a phone, trim them
  short, save them as `.mp3`, and ask for help hooking them into
  `src/audio/sound.js`.
- **Tweak the made-with-code sounds** in `src/audio/sound.js`: change the
  pitch (`from`, `to`) or length (`duration`) numbers.

## Code (a bit more challenging)

- **A new material**, like glass (light and very fragile) or bone. Add it to
  `MATERIALS`, draw it in `src/render/art.js`, and use it in a level.
- **Show the level's best score and stars** on the pause screen.
- **A new background setting** in `src/render/background.js`, like a swamp or a
  witch's cottage.
- **Write a test** in `tests/round.test.mjs` for a rule that isn't tested yet.

## Always

- Add anything you made or downloaded to `assets/CREDITS.md`.
- Never add players' names, emails or photos to the game.
