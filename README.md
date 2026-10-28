# Panther Pounce

A Halloween slingshot game for the **GHCDS Boo Bash 2026** (Good Hope Country
Day School, St. Croix). Pull back the slingshot, launch the panther, and
knock down haunted towers until every ghost, bat and Phantom is gone.
**#PantherPride**

Part of the Panther Arcade, with
[Panther Slash](https://github.com/amalikrigger/panther-slash) and
[Panther Prowl](https://github.com/amalikrigger/panther-prowl).

## Run it on your computer

You need Python 3 (already on Macs). In a terminal, from this folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in Chrome, Edge, Firefox or Safari.

The game must be served like this. Double-clicking `index.html` won't work,
because browsers block JavaScript modules opened straight from a file.
If port 8000 is busy (another Panther game might be running), pick another
number, like 8001.

To play on a phone or tablet on the same Wi-Fi, use your computer's IP
address instead of `localhost`, for example `http://192.168.1.20:8000`.

## How to play

1. **Drag back** anywhere on the screen to pull the slingshot. The dotted line
   shows where the panther will start flying.
2. **Let go** to launch.
3. Clear every enemy before you run out of panthers. Unused panthers are
   worth bonus points.
4. **POUNCE!** Tap again while the panther is flying for a burst of speed
   (once per shot, before it hits anything).
5. Break blocks for extra points. **Jack-o'-lanterns explode!**

Works with a mouse, a finger or a pen. **Keyboard:** ← → aim up and down,
↑ ↓ change the power, **Space** launches (and pounces), **P** or **Esc**
pauses.

Two ways to play:

- **Boo Bash Challenge** (the booth game): 3 levels in a row, no retries,
  and the scores add up. A high enough total wins a prize (Bronze, Silver,
  Gold or Legendary Panther), and a top-10 score can go on the leaderboard
  with 3 initials.
- **Free Play:** pick any unlocked level and replay it as much as you like.
  Beat a level to unlock the next. Earn up to 3 stars per level.

Running the booth (staff mode, prizes, kiosk mode): see
[docs/booth-guide.md](docs/booth-guide.md).

## Playing with no internet (offline)

When the game is on a real website (https), `sw.js` (a "service worker")
saves a copy of every file on the first visit. After that, the game loads and
plays even with no Wi-Fi. On your own computer (`http://localhost`) this is
switched off on purpose, so a refresh always shows your latest changes.
(Add `?sw` to the address to test it locally.)

## How the code is organized

```
index.html             the page: canvas + menus
src/config.js          ⭐ every number you might want to change
src/levels/            ⭐ one file per level
src/main.js            connects everything: aiming, screens, events
src/core/round.js      the rules for one level: turns, score, stars, win/lose
src/core/challenge.js  the Boo Bash Challenge run (several levels in a row)
src/core/prizes.js     prize tiers and the verification code
src/core/leaderboard.js  ranking scores and checking initials
src/physics/world.js   builds the level with Planck.js physics, reports hits and breaks
src/engine/            the game loop and the camera
src/input/pointer.js   mouse/touch/pen dragging
src/render/            all the drawing: art.js (characters, blocks), background.js, effects.js
src/audio/sound.js     sound effects made with code
src/ui/                menu screens, prize screen, initials, leaderboard, staff mode
src/storage/           saves progress, scores, prizes and booth settings on this device
tests/                 automatic checks (run with: node --test)
sw.js                  offline support (see above)
manifest.webmanifest   name and icons for "Add to Home Screen"
vendor/planck-1.5.0/   the physics library (don't edit)
```

The world uses **units** (about one metre each). The ground is at `y = 0` and
`y` goes **up**. The slingshot is at `x = 4`. Structures usually sit between
`x = 18` and `x = 36`.

## Make a level

1. Copy `src/levels/01-graveyard-gate.js` to a new file, like
   `src/levels/06-my-level.js`.
2. Change `id` (unique, no spaces) and `name`.
3. Add blocks and enemies. Each block needs:
   - `material`: `'wood'`, `'stone'`, `'tombstone'` or `'pumpkin'`
   - `x`: the middle of the block
   - `y`: where its **bottom** sits. `0` is the ground. To stack a block on a
     post that is 2.5 tall, use `y: 2.5`.
   - `width` and `height` for boxes, or `radius` for pumpkins
   - optional: `angle` (degrees) and `fixed: true` (never moves or breaks)
4. Enemies need `type` (`'ghost'`, `'bat'` or `'phantom'`), `x` and `y`
   (the bottom of the enemy).
5. Add it to the list in `src/levels/index.js`. (To put it in the Boo Bash
   Challenge, add its `id` to `CHALLENGE.levels` in `src/config.js`, or pick
   it in staff mode.)
6. Run `node --test`. It checks that your level stands up by itself and tells
   you which block slides if it doesn't.
7. Play it and set `par` so a good run earns 2 stars and a great run earns 3.

## Add a new enemy

1. In `src/config.js`, add an entry to `ENEMIES`, for example
   `zombie: { art: 'drawn:ghost', radius: 0.6, density: 1, health: 12, points: 1500 }`.
2. Use it in a level: `{ type: 'zombie', x: 25, y: 0 }`.
3. Give it its own look, either:
   - **drawn in code:** add a `drawZombie` function to `src/render/art.js`, add it to
     `DRAWN_ART` at the bottom, and set `art: 'drawn:zombie'`; or
   - **a picture:** see below.

Enemies must look different by **shape**, not just color, so everyone can
tell them apart.

## Add your own art

Any `art` value in `src/config.js` can be a picture instead of `'drawn:...'`.

1. Draw it, and save it as a **PNG with a transparent background**.
2. Put it in `assets/art/` (make the folder if needed), for example `assets/art/zombie.png`.
3. Set `art: 'assets/art/zombie.png'` (no `/` at the start).
4. Add a row to `assets/CREDITS.md` with your name.

Sprite rules (how the picture lines up with the physics):

- **Round things** (the panther, enemies, pumpkins): make the picture
  **square**. The physics circle touches the middle of each edge. Leave
  ears, wings and hats inside the square, or they'll be cut off. 512×512 is
  plenty.
- **Box things** (wood, stone, tombstone): the picture is stretched to fill the
  block exactly, so draw it the same shape as the block. A 4 × 0.4 plank wants a
  long, thin picture, like 800×80.
- If a picture is missing or misspelled, the game uses the drawn art instead
  and prints a warning in the browser console.

## Change how the game feels

Everything is in `src/config.js`, with comments. Good things to try:
`SLINGSHOT.launchSpeed` (power), `PHYSICS.gravity`, `PANTHER.density`
(heavier = smashier), `MATERIALS.wood.health`, `SCORING.unusedPanther`, and
the colors in `THEME`.

## Student git workflow

```sh
git pull                      # 1. always start by getting everyone's latest work
# ... make one small change, test it in the browser ...
node --test                   # 2. make sure the checks still pass
git add -A
git commit -m "Add zombie enemy (Jordan)"   # 3. small commits, your name in the message
git push                      # 4. share it
```

If `git push` is rejected, someone else pushed first. Run `git pull`, check
the game still works, then push again.

## Rules for this project

- **No personal data.** Players are mostly kids. Never add names, emails or
  photos of players. Leaderboards will use 3-letter initials only.
- **Only art and sound we're allowed to use.** Draw it in code, make it
  yourself, or use CC0 / openly licensed files. List everything in
  `assets/CREDITS.md`. No school logos until permission is confirmed.
- **No new libraries or online services** without your teacher's OK.
- **Relative paths only** (`assets/...`, never `/assets/...`), so the game works
  wherever it's hosted.

Good first tasks: [docs/student-tasks.md](docs/student-tasks.md).
