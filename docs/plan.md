# Panther Pounce: rebuild plan

This is the plan of record for the Boo Bash 2026 rebuild. It holds current
state only. When something changes, edit it here instead of adding a new
section.

**Target:** event-ready by the evening of **Thursday Oct 29, 2026**. The
event is **Friday Oct 30**, which Amali confirmed on Oct 27 (the brief's
"Thursday, October 30" was a typo).

**Booth devices:** Mac/Windows laptops, Chromebooks and iPads/tablets, so
offline play needs both a local server (laptops) and the hosted site plus a
service worker (Chromebooks and iPads).

## Orientation (Phase 0, Oct 27)

**What is in the repo.** cocos2d-html5 **v2.0.0** (2012) plus Box2DWeb 2.1a
(2011). `game.js` un-minifies to about 1,770 lines, but only about 250 of
them are logic. The rest is 15 hard-coded level arrays.

**How the old engine works.**
- **Rendering:** cocos2d draws every sprite on a fixed 2400×600 canvas. The
  "camera" is the canvas's CSS `margin-left`, slid between 0 and -1200 px.
  The whole 1000×600 `#main_div` is shrunk with a CSS `transform: scale()`.
- **Physics:** a Box2D world at 30 px per metre, stepped once per frame at a
  fixed 1/60 s (so the speed depends on the screen's refresh rate). The
  contact listener's `PostSolve` reads the impulse:
  - Enemies take that much damage and die at 0 health.
  - Hits from the bird or a boulder above 15 add impulse points (capped at
    1000) and show smoke.
  - An enemy kill is worth +1000.
- **Aiming:** start a drag within 80 px of the sling. The pull is clamped to
  20–80 px. On release the bird gets a circle body with impulse =
  (start − pull) × 12.
- **Turns:** a bird's turn ends on its first contact. Three birds per level.
- **Stars:** 4 − birds used. The level is lost 4 s after the last bird lands.
- **Progress:** `localStorage["ab_level_N"] = "score:stars"`. It saves and
  unlocks the next level.
- **Screens:** DOM overlays (title, level grid, win and lose popups) on top
  of the canvas.

**Confirmed in headless Chrome:**

| Check | Result |
|---|---|
| Desktop mouse aim and launch | Works |
| Touch on a phone at 844×390 | **Broken**: the drag never grabs the sling, because the scaled coordinates don't match |
| Phone landscape | Letterboxed, with a blank band beside the game |
| Phone portrait | Rotate prompt only |
| Device pixel ratio | None (blurry on retina screens) |
| Fullscreen | None |
| Audio unlock | None |
| Pause when the tab is hidden | None |
| Console | One 404 (favicon) |

**IP inventory.** These came from Rovio's Angry Birds and must go:

- **Art:** `logo.jpg`, `bird.png`, `enemy.png` (the pig), `bg.png`,
  `ground.png`, the sling sprites, the popups, `play.png`, the cursors and
  `turndevice.png`. None of the files have a known license.
- **Font:** `komika.ttf` (license unknown).
- **Sounds:** the two mp3s (unknown origin).
- **Code:** the old code uses `ab_` storage keys and calls the characters
  "Bird" and "Enemy".

Nothing here is kept. The level layouts are re-authored rather than copied.

## Engine decision (approved by Amali, Oct 27)

**Recommendation: port to plain Canvas 2D + Planck.js 1.5.0** (MIT, a
maintained Box2D port, vendored as one readable ES module, `planck.mjs`,
about 400 KB). Same module layout as Panther Slash.

Why switching is the *faster and safer* route here, not just the cleaner one:

1. **Every Phase 1 requirement fights cocos2d v2.0.0:**
   - full-viewport responsive rendering and DPR scaling
   - Pointer Events (its broken touch scaling is the bug above)
   - camera zoom
   - a world-coordinate camera instead of CSS margins

   We would be patching a 535 KB minified engine from 2012 that no one
   documents any more.
2. **There is little to carry over.** The logic is about 250 lines. Every
   sprite is being replaced, and the levels are being rewritten as data
   anyway. Nothing of value is locked inside cocos2d.
3. **The physics model carries over 1:1.** Planck uses the same Box2D
   concepts: bodies, fixtures, `post-solve` impulses, sleeping. The old
   tuning still applies:
   - 30 px per metre
   - gravity −10
   - impulse damage
   - launch power 12

   It also adds a real fixed timestep with interpolation and good sleeping.
4. **Students** get one architecture across the arcade, and a physics
   library with current docs they can search.

**Fallback if you'd rather not add a dependency:** the same Canvas 2D port, but
keep the already-vendored Box2DWeb 2.1a (zlib license). Same effort. Its API is
clunkier and it is unmaintained, but it works today.

**Not recommended:** keep cocos2d. It is the slowest route to responsive touch
and full-screen, and the result is one students can't read.

Three.js or Pixi: no concrete need. Canvas 2D handles a few hundred sprites
at 60 fps.

## Architecture (planned, mirrors Panther Slash)

- `index.html`: one full-viewport `<canvas>`, plus an HTML overlay for the
  screens (title, level select, results, prize, leaderboard, staff).
- `src/config.js`: theme, physics feel, launch power, scoring, prize tiers,
  staff settings. Everything a student tweaks.
- `src/levels/*.js`: one plain object per level (blocks, enemies, panthers,
  par scores), listed in `src/levels/index.js`.
- `src/core/`: the rules without the DOM (scoring, stars, turn and win/lose
  state, prize tiers, verification code). Tested with `node --test`.
- `src/physics/`: the Planck world, body factory, contact damage and debris
  sleep/cleanup.
- `src/engine/`: the loop (fixed 1/60 s step with render interpolation,
  paused when hidden) and the camera (world units, fit-to-structure zoom,
  pan).
- `src/render/`: sky, moon and silhouettes, plus blocks, the panther, enemies
  and particles, all drawn in code. A student PNG can replace any of them
  through config.
- `src/input/pointer.js`: Pointer Events for drag-anywhere aiming. The camera
  frames the whole level automatically, so there's no manual pan.
- `src/audio/`: Web Audio synthesized effects, unlocked on the first tap.
- `src/storage/`: versioned `localStorage` keys (`pantherPounce.v1.*`):
  progress, leaderboard, prize log, booth settings.
- `src/ui/`: the screens, HUD, fullscreen, prize, initials, leaderboard,
  staff and kiosk.
- **Offline:** ES modules need http, not `file://`. Booth devices run a local
  server or the hosted site. A service worker is a Phase 3 item, the same as
  in Slash.

## Winning (built in Phase 2, same scheme as Panther Slash)

- **Boo Bash Challenge:** a fixed run of levels (default Graveyard Gate →
  Haunted House → Phantom's Lair; staff can choose). Each level is played
  once, win or lose, and the scores add up. There are no retries, and a
  6-second auto-continue keeps the line moving.
- **Prize tiers** on the run total: Bronze 15k, Silver 25k, Gold 35k,
  Legendary 45k. These came from simulating 80 runs with the real physics:
  - wild flinging: median 18k
  - rough aiming: median 32k, 90th percentile 41k
  - best run: 48k

  Staff can retune them on the night.
- **Prize screen:**
  - tier, score, run time, a live ticking clock and a shimmering border
  - the run label (`B-047`) and a 4-character code:
    `hash(game, event word, station, run, score, tier, date)`
  - hold-to-claim stamps the run CLAIMED, and staff mode re-computes the
    code and flags mismatched scores or double claims
  - every prize is logged the moment the run ends
- **Leaderboard:** per device, top 10, Today / All time, with 3 initials from
  the shared blocklist. Today's best shows on the title.
- **Staff mode:** 5 moon taps + PIN, with a lockout after 5 wrong tries. It
  sets the station, event word, kiosk on/off and idle time, Free Play on/off,
  challenge levels, tier scores and PIN. It also has the code checker, the
  prize log and a two-tap leaderboard reset.
- **Kiosk:** idle screens return to the title. An unclaimed prize waits 4×
  longer, and an abandoned level waits 4× longer.
- **Booth runbook:** `docs/booth-guide.md`.

**Online shared leaderboard:** not built. Panther Slash's
`docs/online-leaderboard-proposal.md` already covers the whole arcade, and I
agree with its recommendation: don't build it for the event. If it's built
later, use **one** table for all three games with a `game` column, rather
than three services.

## Phases

Times are working hours of build, not calendar time.

| Phase | Scope | Estimate | Target |
|---|---|---|---|
| 1. Event-ready core | Canvas+Planck port, responsive/DPR/fullscreen/rotate prompt, pointer aiming with trajectory preview, camera pan/zoom, 3+ new levels as data, drawn-in-code art, theme and fonts, title/level/win/lose screens, saved progress, synthesized sound | ~7–9 h | Tue Oct 27 night |
| 2. Winning | Challenge mode (3 levels), prize tiers + prize screen + code, top-10 initials leaderboard + today's best, staff PIN + kiosk | ~5 h | Wed Oct 28 midday |
| 3. Polish | juice (shake, debris, chain reactions), abilities (pounce dash), explosive jack-o'-lanterns, more levels, reduced motion, low-end perf, service worker | ~4–6 h | Wed Oct 28 night |
| Rehearsal | play on the real booth devices, fix what breaks | ~1–2 h | Thu Oct 29 by afternoon |

Post-event, approval needed: shared online leaderboard, deploy to
thinkinbits.site, shared arcade shell, school logo once permission is
confirmed, in-browser level editor.

## Risks

1. **Little time for real-device testing.** Plan a 30-minute booth rehearsal on
   the actual hardware on Thursday.
2. **Chromebooks and iPads can't run `python3`.** They need either the hosted
   site with a service worker (needs deploy approval), or a booth laptop serving
   the game over a local hotspot. Decide by Wednesday.
3. **Physics feel** needs hands-on tuning, and the prize thresholds need
   real kids. Staff mode can adjust the thresholds on the spot.
4. **Low-end performance** with many bodies. Mitigations:
   - cap body counts per level
   - sleep debris and remove it
   - verify under a 4× CPU throttle

## Status

- [x] Phase 0: orientation and plan (Oct 27). Approved: Canvas 2D + Planck
  1.5.0, event Fri Oct 30, all three device types, the four Slash prize tiers.
- [x] Phase 1: built Oct 27 on branch `pounce-rebuild`.
  - Five data levels: graveyard, pumpkin patch, haunted house, clocktower,
    Phantom boss.
  - Everything drawn in code, synthesized sound, saved progress and stars.
  - Verified in headless Chrome at 1280×800, 1440×900, 1024×768 touch,
    844×390 touch and 390×844 portrait (rotate prompt). Mouse and touch
    launches clear level 1. The console is clean.
  - Holds 60 fps under a 4× CPU throttle at 1024×768 @2×.
  - `node --test`: 17/17.
  - Committed with the legacy files removed (approved by Amali, Oct 27).
- [x] Phase 2: built Oct 27 on `pounce-rebuild`.
  - A 23-step scripted booth flow passes at 844×390 touch, 667×375 touch and
    1280×800 mouse. It covers:
    - moon taps, PIN and staff save
    - a real touch launch
    - auto-continue
    - the prize screen with a ticking clock, and hold-to-claim
    - initials, the leaderboard and today's best
    - the staff code check, including flagging a fake score
    - the kiosk idle return and wrong-PIN rejection
    - a clean console
  - The prize screen and initials fit without scrolling at 667×375.
  - The staff form scrolls by touch.
  - `node --test`: 29/29.
  - **Waiting on Amali:** checkpoint review and commit approval.
- [ ] Phase 3: next
  - service worker for offline (Chromebooks and iPads)
  - juice and sound polish
  - a pounce-dash ability
  - more levels
  - low-end tuning and an accessibility pass
