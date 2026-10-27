# Panther Pounce: kickoff prompt

You are taking over **Panther Pounce**, a browser slingshot-physics game we are rebuilding for the **Good Hope Country Day School (GHCDS) Boo Bash** Halloween event. I teach at GHCDS. My students will clone this repo and keep improving the game with me, so the code is also a teaching codebase. Read this whole brief, orient yourself in the repo, give me a plan, and then start building Phase 0 right away. Stop only at the checkpoints below or for a decision that really is mine.

---

## 1. The event (hard deadline)

- **Boo Bash 2026:** Thursday, **October 30, 2026, 4–7 PM**, on the GHCDS campus in Kingshill, St. Croix, USVI. "All of Saint Croix is welcome."
- Activities: student-led games ($2/game), a creepy haunted house ($5), trunk-or-treat, prizes, and a food/bake sale. Hashtags: #BooBash #PantherPride #SpookySeason.
- Sources: https://www.ghcds.org/apps/news/article/2234832?categoryId=22434 (the 2026 flyer) and https://www.ghcds.org/apps/news/article/2129005 (the 2025 event).
- Check today's date. The game must be **event-ready by the evening of Oct 29**. Anything that can't be finished and tested by then is post-event work, so plan scope against the time we actually have.
- Likely event setup (confirm with me): one or more school laptops/tablets as play stations at a booth, plus visitors possibly playing on their own phones. Event Wi-Fi is not reliable, so **the core game must work fully offline.**
- **Where it will live:** the game will eventually be hosted on my website, **thinkinbits.site**, for the school. It will probably be served from a subpath (for example `thinkinbits.site/panther-pounce/`), so use **relative URLs only**: no root-absolute `/assets/...` paths and no assumptions about the domain. Keep the game a self-contained static folder that can be dropped into any static host. Don't touch the website's own repo or deploy anything without my approval.

## 2. The Panther Arcade (sibling games)

Panther Pounce is one of three Boo Bash games being rebuilt in parallel from the same brief:
- **Panther Slash**: a slicing game (`~/Developer/panther-slash`, github.com/amalikrigger/panther-slash).
- **Panther Pounce**: this repo, the slingshot game.
- **Panther Prowl**: a maze game (`~/Developer/panther-prowl`, github.com/amalikrigger/panther-prowl).

Players should feel they're playing one arcade. Keep these consistent across the three games:
- The color tokens and fonts.
- The prize-tier names (Bronze / Silver / Gold / Legendary Panther).
- The leaderboard and initials-entry flow, and how staff/admin mode works.

You may **read** the sibling repos to match decisions already made there. **Never edit them** from this session. Each game stays self-contained with no shared code dependency for now. If you think a shared "arcade shell" (one landing page linking all three, shared theme file) is worth it, propose it; don't build it.

## 3. Identity and visual direction

**School:** GHCDS, home of the **Panthers** (#PantherPride).
- Colors seen on ghcds.org (confirm with me before treating them as official): gold `#F6BC1B`, maroon `#701114`, charcoal `#58595B`.
- The school logo is a gold tree silhouette: https://www.ghcds.org/pics/school_logo.png. **Do not use the school logo or other school marks in the game** until I confirm we have permission. Use the colors and the panther theme freely.

**Halloween / Boo Bash:** the 2026 flyer uses deep purple skies, a huge harvest-moon yellow, pumpkin orange, black silhouettes (haunted house, bats, spiderweb), and a drippy horror display font (Creepster on Google Fonts is a close match).

**Game concept:**
- A slingshot launches a **panther** at haunted structures (rickety wood, tombstones, crypt stone, jack-o'-lanterns) that shelter ghosts, bats and other spooky enemies. Knock the structures down and clear every enemy.
- Level settings could include a graveyard, a haunted house, a pumpkin patch and a moonlit campus. Use stylized settings only; nothing should depict real school buildings without permission.
- Unlockable launchables later (pumpkin, candy corn) are a nice extra, not a requirement.

**Direction:** a modern, polished game, not a 2013 HTML5 port. Combine the Panther gold/maroon with the Halloween purple/orange into one coherent theme. The UI should feel bold and juicy: smooth transitions, good typography, satisfying impacts and destruction, and clear contrast for a booth with crowds and outdoor light.

## 4. What is in the repo today

- Static site, no build step. Run it with `python3 -m http.server <port>` from the repo root; pick a free port, since sibling games may be running too.
- It started as a copy of an "Angry Birds HTML5" port built on **cocos2d-html5** (a very old release: `cocos2d/cocos2dx.min.js`, about 535 KB minified) with **Box2D** physics (`box2d/box2d.js`, about 222 KB).
- Boot chain: `index.html` → `cocos2d.js` (loader config) → `main.js` (the `cocos2dApp` setup) → `game.js`. **`game.js` is about 37 KB of minified code on a single line.**
- The UI is a mix of DOM overlays and the canvas. `index.html` and `style.css` contain the front page, level select, a score div, smoke, and win/lose popups. `#main_div` is a fixed **1000×600**, and the `viewport` canvas is **2400×600** (a wide, scrolling world).
- The code mentions level select, `level_up`, `localStorage` and window resize handling. Verify what actually works and what gets saved.
- Sprites in `sprites/`:
  - Characters and blocks: `bird.png`, `enemy.png`, `wood1/2.png`, `boulder.png`, `platform.png`, `ground.png`, `dirt.png`.
  - The slingshot: `sling1-3.png`.
  - UI: `smoke*.png`, `win_popup.png`, `lose_popup.png`, `play.png`, `lock.png`, `menu_back.png`, `menu_refresh.png`, `turndevice.png` (a "rotate your device" prompt).
  - `logo.jpg`, the Angry Birds logo with the red bird.
  - Custom `.cur` cursors and the `komika.ttf` font (license unknown).
- Sounds: only `sound/sound_hit.mp3` and `sound/sound_launch.mp3`.
- **IP:** the name, the logo, the bird and pig characters and their art come from Rovio's Angry Birds, and this repo is **public**. Replacing every Rovio-derived asset and name, and the font if its license can't be confirmed, with original or properly licensed material is a real requirement, not polish. Do it before the event if at all possible.

## 5. Technical approach

- **Start simple with what we have.** The game must open from a static server with no build step and work offline.
- First, un-minify `game.js` into readable source and understand how it uses cocos2d and Box2D.
- **The key Phase 0 decision is the engine.** This cocos2d-html5 build is ancient and unmaintained. Compare two options and recommend one with reasons, weighing the Oct 29 deadline heavily:
  - **Keep cocos2d + Box2D** and modernize around them.
  - **Port to plain Canvas 2D plus a maintained physics library,** vendored with exact pinned versions (for example Planck.js, a Box2D port, or Matter.js).
  - Don't switch engines just because it's cleaner. Switch only if it's the faster or safer route to an event-ready game.
- Three.js, Pixi or another rendering framework is allowed **only if** you can show a concrete need. Propose it with the trade-off; don't just add it.
- Make levels **data**: one readable JSON or JS object per level, describing blocks, enemies, the number of shots and par scores. Students should be able to design a level without touching engine code. A simple in-browser level editor is a stretch goal.
- Keep anything a student might want to tweak (colors, fonts, physics feel, launch power, scoring, prize thresholds) in one well-commented config/theme file.
- Responsive and full-screen across desktop, tablet and phone:
  - Fill the viewport and scale for `devicePixelRatio`.
  - Use world coordinates so physics and aiming feel the same at any size.
  - Handle resizes and orientation; the game is landscape-first, so show a good-looking rotate prompt in portrait.
  - Add a full-screen button using the Fullscreen API, with a fallback for iOS Safari.
  - Use **Pointer Events** so drag-to-aim works the same with mouse, touch and pen. Prevent scrolling, zooming and the context menu during play.
  - Unlock audio on the first tap.
- Camera: on small screens, pan and zoom so the whole structure is readable, and show a trajectory preview while aiming.
- Performance target: smooth on an older school tablet or Chromebook. Use a fixed physics timestep, put debris to sleep and remove it, and pause when the tab is hidden.
- Accessibility: big touch targets, readable text, `prefers-reduced-motion` support (gentler screen shake), and enemies that are distinguishable by shape, not just color.

## 6. Winning, prizes, and leaderboard

Boo Bash charges $2 per game and gives prizes, so the game needs a fair, booth-friendly way to win:

- **Boo Bash Challenge mode:** a fixed run of event levels (start with 3, configurable) with a limited number of panthers per level. Total score counts destruction, enemies cleared and unused panthers, and each level awards 1–3 stars. Every paid play gets the same levels. Keep the free level-select mode as well.
- **Prize tiers:** score or star thresholds such as Bronze / Silver / Gold / Legendary Panther, all configurable. At the end of a run, show a big, clear **prize screen** a booth volunteer can verify at a glance: tier, score, time, and a short verification code. It must be hard for a kid to fake with a screenshot of someone else's win. Propose a simple scheme.
- **Leaderboard:** offline-first and local to each device, using `localStorage`. Show the top 10 with **arcade-style 3-letter initials only. Never collect names, emails or other personal data; most players are minors.** Include "today's best" for the event night.
- **Staff/admin mode:** behind a hidden gesture plus a PIN. Lets staff reset the board, set prize thresholds, choose the challenge levels, and switch to kiosk mode (auto-return to the title screen after inactivity).
- **Shared online leaderboard across devices:** design for it but **don't build it without my approval**. When you propose it, cover the service (for example Supabase or Firebase), the cost, how to moderate initials, anti-cheat basics, and keeping minors' data out.
- Gameplay depth beyond that is welcome: special panther abilities (a pounce dash, a roar shockwave), explosive jack-o'-lanterns, a boss ghost tower, and satisfying chain reactions. Event-night clarity comes before features.

## 7. Assets: where they come from

Every asset must have a known source and license. Keep `assets/CREDITS.md` (or `sprites/CREDITS.md` if you keep the folder layout) up to date with the file, source, author, license and link.

In order of preference:
1. **Drawn in code** (Canvas/SVG shapes, gradients, particles). No licensing risk, and great for the sky, the moon, silhouettes, debris and the UI.
2. **CC0 / openly licensed sources:** Kenney.nl (CC0; its physics and platformer packs suit this game well) and OpenGameArt (check each file's license). Google Fonts (OFL): Creepster for display text, plus a clean sans-serif for UI. Sounds: generate effects with jsfxr/sfxr, or use CC0 sounds from Freesound.
3. **Student-made art:** the panther, ghosts, block textures, voice recordings of a panther roar or a "BOO!". This is the best option for the classroom. Build the asset pipeline so a student can drop in a PNG with a transparent background and register it in the config. Write down the exact sprite specs, including how the art lines up with each physics body.
4. **AI-generated images:** acceptable for placeholders or with my sign-off. Note it in CREDITS.

School marks are off-limits until permission is confirmed (see section 3).

## 8. Students and maintainability

- Code should be readable by a motivated high-school student: clear names, small files, and comments that explain *why* where it isn't obvious.
- Write or refresh `README.md`: what the game is, how to run it locally, how to play, and the student git workflow (`git pull` first, small commits with your name in the message, then `git push`), plus how to add a new level and a new enemy.
- Write a project `CLAUDE.md` that captures the durable context from this brief (event, identity, sibling games, constraints, architecture, asset rules, privacy rules), so future sessions, including ones on the school computer, start fully informed. Keep it concise and point to the docs instead of duplicating them.
- Keep a `docs/student-tasks.md` list of good first tasks for students, for example: design a level, draw a new enemy, tune the launch power, design a prize-tier badge, record sound effects.

## 9. Phases and checkpoints

**Phase 0: orient and plan (do this first, then keep going).** Un-minify and read the code, run the game, and confirm what works and what doesn't. Give me a short orientation report (how the engine works, the engine recommendation, what to keep and what to replace, risks) and a phased plan with rough time estimates checked against the Oct 29 event-ready target. Ask me only the questions that block work. Likely questions: what the actual prizes are, what devices the booth will use, and whether we have school-logo permission. Use sensible, clearly labeled defaults for everything else and continue. **If you recommend switching engines, wait for my go-ahead before starting the port.**

**Phase 1: event-ready core.** Readable modular code, responsive full-screen on all devices, unified pointer aiming, saved progress and high scores, full Panther Pounce rebrand with every Angry Birds name and asset replaced, new title/level-select/win/lose screens, at least 3 good event levels, and the new color theme. → **Checkpoint:** show it working at phone, tablet and desktop sizes.

**Phase 2: winning.** Challenge mode, prize tiers and the prize screen, local leaderboard with initials, and staff/admin plus kiosk mode. → **Checkpoint.**

**Phase 3: polish.** Juice, sound, special abilities, more levels, accessibility, and performance tuning on low-end devices. → **Checkpoint.**

**Later, only with my approval:** an online shared leaderboard, deploying to thinkinbits.site so visitors can play on their phones (propose how it fits into the site, and whether a GitHub Pages preview is useful before then), a shared arcade shell, and frameworks such as Three.js.

At each checkpoint, report what changed, how you verified it (actually run it in a browser at several viewport sizes, test touch aiming, and check the console for errors), what is still rough, and what's next.

## 10. Ground rules

- My standing rules apply: **ask before any commit, push, deploy, new external service or account, or deleting/moving files.** Group work into logical commits and propose each one with its message when ready.
- Don't add dependencies or services I haven't approved. Pin exact versions and vendor the files into the repo. Do not use CDN-only loading, because the game has to work offline.
- Never collect personal data from players.
- If something in this brief turns out to be wrong once you read the code, tell me and adjust. Don't silently work around it.

Start now with Phase 0.
