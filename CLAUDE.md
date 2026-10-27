# Panther Pounce: project instructions

A browser slingshot-physics game for the **GHCDS Boo Bash** Halloween event
(Good Hope Country Day School, Kingshill, St. Croix, USVI; the Panthers).
Amali teaches at GHCDS, and students clone and extend this repo, so it is
also a **teaching codebase**.

- Full brief: `docs/kickoff-prompt.md`. Current plan and status: `docs/plan.md`
  (the plan of record; update it there, don't fork it).
- How to run, play, add levels and enemies, and the student workflow:
  `README.md`.

## Hard constraints

- **Static and offline.** No bundler, no npm build, no CDN loading. Vendor
  any approved library with an exact pinned version. Must run from any static
  host **subpath** (e.g. `thinkinbits.site/panther-pounce/`), so use
  **relative URLs only**, never a leading `/`.
- **No new dependencies, frameworks or services** without Amali's approval.
  The online shared leaderboard and deployment are approval-gated.
- **Privacy:** players are mostly minors. Never collect names, emails or other
  personal data. Leaderboards store 3-letter initials, score and date only.
- **IP:** the repo is public. Every asset needs a known source and license,
  recorded in `assets/CREDITS.md`. Prefer art drawn in code, then CC0/OFL,
  then student-made. **No school logo or marks** until permission is
  confirmed. The legacy Angry Birds files (`sprites/`, `sound/`, `komika.ttf`)
  are Rovio-derived or of unknown origin and must not be used.
- **Approvals:** ask before any commit, push, deploy, new service or account,
  or deleting or moving files. Propose commits with their messages.

## The Panther Arcade

Panther Pounce is one of three sibling games: `~/Developer/panther-slash`
and `~/Developer/panther-prowl`. **Read them to match decisions, never edit
them.** Keep these shared across all three, and treat Slash's `src/config.js`
and `src/styles.css` as the reference:
- the color tokens and fonts (Creepster display, Fredoka UI)
- the prize tiers (Bronze / Silver / Gold / Legendary Panther)
- the initials leaderboard and blocklist
- the staff gesture, PIN and kiosk flow

## Identity

Theme: Panther gold `#F6BC1B`, maroon `#701114` and charcoal `#58595B` (from
ghcds.org, not yet confirmed as official), plus the Boo Bash purple night,
harvest moon and pumpkin orange.

## Architecture (README has the full file map)

- **Engine:** plain Canvas 2D + **Planck.js 1.5.0** (vendored ES module in
  `vendor/`). Vanilla JS ES modules, no build.
- `src/config.js` holds every value a student might tweak. Keep it that way.
- `src/levels/*.js` are plain data, listed in `src/levels/index.js`. The world
  uses units (~1 m), **y up, ground at 0**, and a block's `y` is its *bottom*.
- `src/core/round.js` holds the rules (turns, score, stars, win/lose). It is
  DOM-free and physics-free.
- `src/physics/world.js` owns all Planck calls. It reports events (`hit`,
  `block-broken`, `enemy-defeated`, `explosion`), and `src/main.js` maps them
  to score, effects and sound.
- The loop runs physics at a fixed 1/60 s step with render interpolation, and
  stops when the tab is hidden. The camera frames slingshot + structure to fit
  any screen.
- Art is drawn in code (`src/render/art.js`). Any `art` value can instead be a
  student PNG path (`src/render/sprites.js`).
- Tests: `node --test`. Each level must stand up by itself for 10 s.

The old cocos2d/Box2DWeb/Angry Birds files are unused legacy, pending deletion.

## Verifying changes

Serve with `python3 -m http.server <free port>` and check:
- desktop, tablet and phone sizes (portrait and landscape)
- touch drag-to-aim
- a clean console

Add `?debug` to expose `window.pantherPounce` for scripted checks. Run
`node --test`.
