// Panther Pounce: where everything gets connected.
//
// Startup order:
//   1. load fonts and any student pictures
//   2. create the canvas, camera, input, renderer and effects
//   3. start the game loop and show the title screen
//
// The app is always on one screen (app.screen): 'loading', 'title',
// 'levels', 'playing', 'paused', 'result', 'run', 'prize', 'initials',
// 'leaderboard', 'pin' or 'staff'. Buttons in index.html send "actions"
// (like "play-challenge") that move between them.
//
// Two ways to play:
//   'challenge'  the Boo Bash Challenge: a fixed run of levels, scores add up,
//                prizes and the leaderboard. This is the paid booth game.
//   'free'       Free Play: pick any unlocked level, retry as much as you like.
//
// Who does what:
//   PhysicsWorld (physics/world.js)  bodies, hits, breaking. Reports events.
//   Round        (core/round.js)     one level: turns, score, stars, win/lose.
//   Challenge    (core/challenge.js) a whole booth run of several levels.
//   this file                        turns events into score, sound and sparkle,
//                                    and handles aiming and screens.

import { THEME, PHYSICS, SLINGSHOT, PANTHER, MATERIALS, ENEMIES, DAMAGE, TURNS, SCORING, EFFECTS, CHALLENGE, STAFF } from './config.js';
import { LEVELS } from './levels/index.js';
import { PhysicsWorld } from './physics/world.js';
import { Round } from './core/round.js';
import { Challenge, formatDuration } from './core/challenge.js';
import { tierFor, nextTier, verificationCode } from './core/prizes.js';
import { localDate } from './core/leaderboard.js';
import { Camera } from './engine/camera.js';
import { startLoop } from './engine/loop.js';
import { PointerInput } from './input/pointer.js';
import { Renderer, predictPath } from './render/renderer.js';
import { Effects } from './render/effects.js';
import { moonCircle } from './render/background.js';
import { loadArt } from './render/sprites.js';
import { sounds, unlock as unlockAudio, setMuted, isMuted } from './audio/sound.js';
import { showScreen, onAction, setText, setHidden, setStats, starsMarkup } from './ui/screens.js';
import { setupFullscreen } from './ui/fullscreen.js';
import { showPrize, hidePrize } from './ui/prize.js';
import { showInitials, hideInitials, stepLetter, validInitialsOrNull } from './ui/initials.js';
import { renderBoard } from './ui/board.js';
import { showPin, pressPinDigit, pressPinBack, submitPin, showStaff, saveStaff, pressResetScores } from './ui/staff.js';
import { idleSeconds, resetIdle } from './ui/kiosk.js';
import { load, save } from './storage/store.js';
import { scoreQualifies, addScore, todaysBest, nextRoundNumber, logPrize, markClaimed } from './storage/scores.js';
import { getSettings, prizeTiers, challengeLevelIds } from './storage/settings.js';

const PHYSICS_SETTINGS = { physics: PHYSICS, materials: MATERIALS, enemies: ENEMIES, panther: PANTHER, damage: DAMAGE };
const STEP_SECONDS = 1 / PHYSICS.stepsPerSecond;
// Seconds to wait after a level ends before the results appear, so you can
// enjoy the last crash.
const RESULT_DELAY = 0.9;
// The moon taps that open staff mode must all happen within this many seconds.
const SECRET_TAP_WINDOW = 2.5;
// Staff screens close by themselves if left open this long (seconds).
const STAFF_IDLE_SECONDS = 90;

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
// The rotate-your-device message shows on touch screens held upright (CSS).
// While it's showing, the game holds still.
const portraitTouch = window.matchMedia?.('(orientation: portrait) and (pointer: coarse)');

const canvas = document.getElementById('game');
const camera = new Camera();
const renderer = new Renderer(canvas);
const effects = new Effects();

const app = {
  screen: 'loading',
  mode: 'free', // 'free' or 'challenge'
  levelIndex: 0,
  physics: null,
  round: null,
  challenge: null,
  run: null, // { station, number, date } for the current challenge run
  prize: null, // the prize won by the current run, if any
  savedEntry: null, // the leaderboard entry saved for the current run
  shot: { time: 0, quietTime: 0 },
  aim: { active: false, start: null, pull: { x: 0, y: 0 } },
  reload: 1, // 0..1 while the next panther hops onto the slingshot
  resultTimer: null,
  autoNextAt: null, // when the challenge "level done" screen moves on by itself
  moonTaps: [],
  time: 0,
  progress: load('progress', {}), // { [levelId]: { best, stars } }
};

const levelIndexById = (id) => LEVELS.findIndex((level) => level.id === id);

/** Switch screens. 'playing' shows no menu, just the game. */
function goTo(screen) {
  app.screen = screen;
  document.body.dataset.screen = screen;
  document.body.classList.toggle('in-game', screen === 'playing' || screen === 'paused');
  setHidden('#hud', !(screen === 'playing' || screen === 'paused'));
  showScreen(screen === 'playing' ? null : screen);
  if (screen !== 'prize') hidePrize();
  if (screen !== 'initials') hideInitials();
  resetIdle();
}

// --- Screen size -------------------------------------------------------------

// Drawing at more than 2× pixel density costs a lot on phones and is hard to see.
const MAX_PIXEL_RATIO = 2;

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  camera.setScreen(width, height, pixelRatio);
  if (app.physics) camera.frame(cameraRect(), { instant: true });
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
// Mobile browsers change the visible size when the address bar hides.
window.visualViewport?.addEventListener('resize', resize);

// --- Camera framing ----------------------------------------------------------

/** The part of the world that should be on screen right now. */
function cameraRect() {
  const bounds = app.physics.bounds;
  const rect = {
    // Leave room on the left for the panther when it's pulled all the way back.
    left: SLINGSHOT.x - SLINGSHOT.maxPull - 1.6,
    right: Math.max(bounds.right + 2, SLINGSHOT.x + 24),
    bottom: -1,
    top: Math.max(bounds.top, SLINGSHOT.y + 2) + 2.5,
  };
  // While a panther flies, widen the view to keep it in sight (up to a limit,
  // so a wild shot doesn't shrink the whole level to nothing).
  for (const entity of app.physics.entities) {
    if (entity.kind !== 'panther') continue;
    const { x, y } = entity.body.getPosition();
    rect.right = Math.min(Math.max(rect.right, x + 3), rect.right + 12);
    rect.top = Math.min(Math.max(rect.top, y + 3), rect.top + 10);
  }
  return rect;
}

// --- Starting levels -----------------------------------------------------------

/** Build a level's world. Used for play, and as the backdrop behind the menus. */
function loadLevel(index) {
  app.levelIndex = index;
  app.physics = new PhysicsWorld(LEVELS[index], PHYSICS_SETTINGS);
  app.round = new Round(LEVELS[index], SCORING);
  app.shot = { time: 0, quietTime: 0 };
  app.aim = { active: false, start: null, pull: { x: 0, y: 0 } };
  app.reload = 1;
  effects.particles = [];
  effects.texts = [];
}

function startLevel(index) {
  clearTimeout(app.resultTimer);
  app.autoNextAt = null;
  loadLevel(index);
  // Fly-in: start close on the structure, then glide back to show everything.
  const bounds = app.physics.bounds;
  if (reducedMotion?.matches) {
    camera.frame(cameraRect(), { instant: true });
  } else {
    camera.frame({ left: bounds.left - 2, right: bounds.right + 2, bottom: -1, top: bounds.top + 3 }, { instant: true });
  }
  app.reload = 0;
  const label = app.mode === 'challenge'
    ? `Level ${app.challenge.index + 1} of ${app.challenge.levelIds.length}: ${LEVELS[index].name}`
    : `${index + 1}. ${LEVELS[index].name}`;
  setText('#hud-level', label);
  setHidden('#pause-retry', app.mode === 'challenge');
  goTo('playing');
  updateHud();
}

function startFreePlay(index) {
  app.mode = 'free';
  app.challenge = null;
  startLevel(index);
}

/** A new paid Boo Bash Challenge run. */
function startChallenge() {
  const { station } = getSettings();
  app.mode = 'challenge';
  app.challenge = new Challenge(challengeLevelIds(), Date.now());
  // Every run gets a number on this device, so its prize screen is unique.
  app.run = { station, number: nextRoundNumber(), date: localDate() };
  app.prize = null;
  app.savedEntry = null;
  startLevel(levelIndexById(app.challenge.currentLevelId));
}

// --- The game loop -------------------------------------------------------------

function step(dt) {
  if (app.screen !== 'playing' || portraitTouch?.matches) return;
  app.time += dt;
  if (app.reload < 1) app.reload = Math.min(1, app.reload + dt * 1.6);

  for (const event of app.physics.step(dt)) handleEvent(event);

  const round = app.round;
  if (round.state === 'flying' || round.state === 'cleared') {
    app.shot.time += dt;
    app.shot.quietTime = app.physics.isQuiet(TURNS.quietSpeed) ? app.shot.quietTime + dt : 0;
    const maxSeconds = round.state === 'cleared' ? 4 : TURNS.maxShotSeconds;
    const settled = app.shot.quietTime >= TURNS.quietSeconds && app.shot.time > 1;
    if (settled || app.shot.time >= maxSeconds) endShot();
  }
}

function frame(elapsed, alpha) {
  if (app.screen !== 'playing') app.time += elapsed;
  if (app.physics) camera.frame(cameraRect());
  camera.update(elapsed);
  effects.update(app.screen === 'paused' ? 0 : elapsed);
  updateAutoNext();
  checkIdle();

  const aiming = app.aim.active && pullLength() >= SLINGSHOT.minPull;
  const round = app.round;
  renderer.draw({
    camera,
    effects,
    setting: LEVELS[app.levelIndex].setting,
    time: app.time,
    alpha: app.screen === 'playing' ? alpha : 1,
    physics: app.physics,
    sling: {
      pantherVisible: round?.state === 'ready' && app.screen !== 'loading',
      pull: app.aim.pull,
      aiming: app.aim.active,
      reload: app.reload,
    },
    trajectory: aiming ? predictPath(launchStart(), launchVelocity(), SLINGSHOT.trajectorySeconds) : null,
  });
}

// --- What happens when things hit, break and vanish ---------------------------

function handleEvent(event) {
  const shake = reducedMotion?.matches ? 0.3 : 1;
  switch (event.type) {
    case 'hit':
      sounds.hit(event.strength, event.materials);
      if (event.big) {
        effects.sparks(event.x, event.y, 8);
        if (EFFECTS.screenShake) camera.shake(Math.min(10, event.strength / 6) * shake);
      }
      break;

    case 'block-broken': {
      const { entity } = event;
      const points = MATERIALS[entity.material].points;
      app.round.blockBroken(points);
      effects.debris(event.x, event.y, entity.material, Math.max(entity.width, entity.height), event.vx, event.vy);
      effects.text(event.x, event.y + 0.5, `+${points}`, '#fff6d6');
      sounds.breakBlock(entity.material);
      updateHud();
      break;
    }

    case 'enemy-defeated': {
      const points = ENEMIES[event.entity.type].points;
      app.round.enemyDefeated(points);
      effects.puff(event.x, event.y, event.entity.radius * 1.6);
      effects.sparks(event.x, event.y, 10, '#c77dff', 4);
      effects.text(event.x, event.y + 1, `+${points}`, THEME.gold, true);
      sounds.ghostGone();
      updateHud();
      break;
    }

    case 'explosion':
      effects.shockwave(event.x, event.y, event.radius);
      effects.sparks(event.x, event.y, 24, '#ffe14d', 9);
      effects.puff(event.x, event.y, 1.6, 'rgba(255, 140, 40, 0.7)');
      sounds.explosion();
      if (EFFECTS.screenShake) camera.shake(14 * shake);
      break;
  }
}

/** Everything stopped moving after a shot (or time ran out). */
function endShot() {
  for (const entity of [...app.physics.entities]) {
    if (entity.kind !== 'panther') continue;
    const { x, y } = entity.body.getPosition();
    effects.puff(x, y, 1, 'rgba(18, 5, 31, 0.8)');
    app.physics.destroy(entity, 'cleanup');
  }
  app.shot = { time: 0, quietTime: 0 };

  const state = app.round.shotSettled();
  if (state === 'ready') {
    app.reload = 0; // the next panther hops on
  } else if (state === 'won' || state === 'lost') {
    app.resultTimer = setTimeout(() => levelFinished(state === 'won'), RESULT_DELAY * 1000);
  }
  updateHud();
}

// --- Aiming ----------------------------------------------------------------------

function pullLength() {
  return Math.hypot(app.aim.pull.x, app.aim.pull.y);
}

const launchStart = () => ({ x: SLINGSHOT.x + app.aim.pull.x, y: SLINGSHOT.y + app.aim.pull.y });

/** Pulling back further launches faster, in the opposite direction. */
function launchVelocity() {
  const scale = SLINGSHOT.launchSpeed / SLINGSHOT.maxPull;
  return { x: -app.aim.pull.x * scale, y: -app.aim.pull.y * scale };
}

const canAim = () => app.screen === 'playing' && app.round.state === 'ready' && app.reload >= 1;

new PointerInput(canvas, {
  onStart(point) {
    unlockAudio();
    if (app.screen === 'title') return checkMoonTap(point);
    if (!canAim()) return;
    // Drag ANYWHERE to aim. Small screens make the slingshot tiny, so
    // requiring a touch right on the panther would be frustrating.
    app.aim = { active: true, start: point, pull: { x: 0, y: 0 } };
  },
  onMove(point) {
    if (!app.aim.active) return;
    if (!canAim()) {
      app.aim = { active: false, start: null, pull: { x: 0, y: 0 } };
      return;
    }
    // A full pull is at least 110 CSS px of finger movement, so phones get
    // the same fine control as big screens.
    const fullPullPixels = Math.max(110, SLINGSHOT.maxPull * camera.zoom);
    let x = ((point.x - app.aim.start.x) / fullPullPixels) * SLINGSHOT.maxPull;
    let y = (-(point.y - app.aim.start.y) / fullPullPixels) * SLINGSHOT.maxPull;
    const length = Math.hypot(x, y);
    if (length > SLINGSHOT.maxPull) {
      x *= SLINGSHOT.maxPull / length;
      y *= SLINGSHOT.maxPull / length;
    }
    // Don't pull the panther into the ground.
    y = Math.max(y, PANTHER.radius + 0.1 - SLINGSHOT.y);
    const before = pullLength();
    app.aim.pull = { x, y };
    if (Math.abs(pullLength() - before) > 0.05) sounds.stretch();
  },
  onEnd(_point, cancelled) {
    if (!app.aim.active) return;
    const tooShort = pullLength() < SLINGSHOT.minPull;
    if (!cancelled && !tooShort && canAim()) {
      app.physics.launchPanther(launchStart(), launchVelocity());
      app.round.launch();
      app.shot = { time: 0, quietTime: 0 };
      sounds.launch();
      updateHud();
    }
    app.aim = { active: false, start: null, pull: { x: 0, y: 0 } };
  },
});

// --- HUD -------------------------------------------------------------------------

const PAW_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5.2" ry="4.4"/><ellipse cx="5.2" cy="10.2" rx="2.2" ry="2.8"/><ellipse cx="9.4" cy="6" rx="2.2" ry="2.9"/><ellipse cx="14.6" cy="6" rx="2.2" ry="2.9"/><ellipse cx="18.8" cy="10.2" rx="2.2" ry="2.8"/></svg>';

function updateHud() {
  const round = app.round;
  if (!round) return;
  // In the Challenge, the score shown is the whole run so far.
  const runSoFar = app.mode === 'challenge' ? app.challenge.total : 0;
  setText('#hud-score', (runSoFar + round.score).toLocaleString());
  const tokens = document.getElementById('hud-panthers');
  const total = LEVELS[app.levelIndex].panthers;
  if (tokens.childElementCount !== total || tokens.dataset.left !== String(round.panthersLeft)) {
    tokens.dataset.left = round.panthersLeft;
    tokens.setAttribute('aria-label', `${round.panthersLeft} panthers left`);
    tokens.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="paw ${i < round.panthersLeft ? '' : 'used'}">${PAW_SVG}</span>`).join('');
  }
}

// --- Title and level select --------------------------------------------------------

function showTitle() {
  clearTimeout(app.resultTimer);
  app.autoNextAt = null;
  app.challenge = null;
  app.mode = 'free';
  loadLevel(0);
  camera.frame(cameraRect(), { instant: true });

  const settings = getSettings();
  const levelCount = challengeLevelIds().length;
  setText('#challenge-sub', `${levelCount} level${levelCount === 1 ? '' : 's'} · win prizes!`);
  setHidden('#free-play-button', !settings.allowFreePlay);
  const best = todaysBest();
  setText('#best-line', best ? `Today's best: ${best.initials} · ${best.score.toLocaleString()}` : '');
  goTo('title');
}

function showLevels() {
  clearTimeout(app.resultTimer);
  const grid = document.getElementById('level-grid');
  grid.innerHTML = LEVELS.map((level, index) => {
    const record = app.progress[level.id];
    const unlocked = index === 0 || Boolean(app.progress[LEVELS[index - 1].id]);
    return `<button class="level-card" data-action="play-level" data-index="${index}" ${unlocked ? '' : 'disabled'}
      aria-label="Level ${index + 1}: ${level.name}${unlocked ? '' : ' (locked)'}">
      <span class="level-number">${unlocked ? index + 1 : '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>'}</span>
      <span class="level-name">${level.name}</span>
      <span class="level-stars">${starsMarkup(record?.stars ?? 0)}</span>
    </button>`;
  }).join('');
  goTo('levels');
}

// --- End of a level ----------------------------------------------------------------

function levelFinished(won) {
  const round = app.round;
  const level = LEVELS[app.levelIndex];

  // Stars and bests are saved in both modes, so a challenge win also
  // unlocks the level in Free Play.
  const previous = app.progress[level.id];
  const isNewBest = won && round.score > (previous?.best ?? 0);
  if (won) {
    app.progress[level.id] = { best: Math.max(round.score, previous?.best ?? 0), stars: Math.max(round.stars, previous?.stars ?? 0) };
    save('progress', app.progress);
  }

  if (app.mode === 'challenge') {
    app.challenge.finishLevel({ score: round.score, won, stars: round.stars }, Date.now());
    if (app.challenge.isFinished) recordPrize();
  }
  showResult(won, isNewBest);
}

function showResult(won, isNewBest) {
  const round = app.round;
  const level = LEVELS[app.levelIndex];
  const inChallenge = app.mode === 'challenge';

  setText('#result-title', won ? 'Level Cleared!' : inChallenge ? 'Spooks escaped!' : 'The spooks win!');
  const left = `${round.enemiesLeft} spook${round.enemiesLeft === 1 ? '' : 's'} still haunting.`;
  setText('#result-reason', won ? level.name : inChallenge ? `${left} On to the next one!` : `${left} Try again!`);
  document.getElementById('result-stars').innerHTML = won ? starsMarkup(round.stars, 'big') : '';
  setText('#result-score', round.score.toLocaleString());
  setHidden('#result-new-best', !isNewBest || inChallenge);
  setStats('#result-stats', won
    ? [['Destruction', round.breakdown.destruction.toLocaleString()], ['Spooks cleared', round.breakdown.enemies.toLocaleString()], ['Panther bonus', round.breakdown.pantherBonus.toLocaleString()]]
    : [['Destruction', round.breakdown.destruction.toLocaleString()], ['Spooks cleared', round.breakdown.enemies.toLocaleString()]]);

  setHidden('#result-free-menu', inChallenge);
  setHidden('#result-challenge-menu', !inChallenge);
  setHidden('#result-run', !inChallenge);
  if (inChallenge) {
    const challenge = app.challenge;
    setText('#result-run', `Challenge total: ${challenge.total.toLocaleString()}`);
    setText('#challenge-continue-title', challenge.isFinished ? 'See your score!' : 'Next level');
    // Keep the line moving at the booth: continue by itself after a few seconds.
    app.autoNextAt = performance.now() + CHALLENGE.autoNextSeconds * 1000;
  } else {
    setHidden('#result-next', !won || app.levelIndex >= LEVELS.length - 1);
    document.getElementById('result-retry').classList.toggle('button-primary', !won);
    document.getElementById('result-retry').classList.toggle('button-secondary', won);
  }
  goTo('result');

  if (won) {
    sounds.win();
    // Pop the stars in one at a time.
    document.querySelectorAll('#result-stars .star.earned').forEach((star, i) => {
      star.style.animationDelay = `${0.25 + i * 0.3}s`;
      setTimeout(() => sounds.star(i), 250 + i * 300);
    });
  } else {
    sounds.lose();
  }
}

/** Counts down the "Next level" button in the Challenge, then presses it. */
function updateAutoNext() {
  if (app.autoNextAt === null || app.screen !== 'result') return;
  const secondsLeft = Math.ceil((app.autoNextAt - performance.now()) / 1000);
  setText('#challenge-continue-sub', secondsLeft > 0 ? `Starting in ${secondsLeft}…` : '');
  if (secondsLeft <= 0) challengeContinue();
}

function challengeContinue() {
  app.autoNextAt = null;
  const challenge = app.challenge;
  if (!challenge) return showTitle();
  if (challenge.isFinished) {
    afterRun();
  } else {
    startLevel(levelIndexById(challenge.currentLevelId));
  }
}

// --- End of a Challenge run: prize, results, initials, leaderboard -----------------

/**
 * Work out and record the prize as soon as the run ends, so it's logged even
 * if the player walks off before the prize screen appears.
 */
function recordPrize() {
  const total = app.challenge.total;
  const tier = tierFor(total, prizeTiers());
  if (!tier) return;
  const { station, number, date } = app.run;
  const code = verificationCode({ eventWord: getSettings().eventWord, station, round: number, score: total, tierId: tier.id, date });
  app.prize = { tier, score: total, seconds: app.challenge.seconds(Date.now()), station, round: number, code, date, claimedAt: null };
  logPrize({ station, round: number, score: total, tierId: tier.id, code, date, time: Date.now(), claimedAt: null });
}

function afterRun() {
  if (app.prize) {
    showPrize(app.prize, () => {
      const logged = markClaimed(app.prize.station, app.prize.round);
      app.prize.claimedAt = logged?.claimedAt ?? Date.now();
      return app.prize;
    });
    sounds.win();
    goTo('prize');
  } else {
    showRun();
  }
}

function showRun() {
  const challenge = app.challenge;
  const total = challenge.total;
  setText('#run-score', total.toLocaleString());
  setText('#run-reason', `${challenge.levelsCleared} of ${challenge.levelIds.length} levels cleared · ${challenge.stars} ★ · ${formatDuration(challenge.seconds(Date.now()))}`);

  // Encourage another go: how far to the next prize?
  const next = nextTier(total, prizeTiers());
  setHidden('#run-next-tier', !next);
  if (next) setText('#run-next-tier', `${(next.minScore - total).toLocaleString()} more points for ${next.name}!`);

  setStats('#run-stats', challenge.results.map((result) => {
    const level = LEVELS[levelIndexById(result.levelId)];
    return [level.name, `${result.score.toLocaleString()}${result.won ? '' : ' ✗'}`];
  }));

  const canSave = !app.savedEntry && scoreQualifies(total);
  setHidden('#run-save', !canSave);
  setHidden('#run-play-again', canSave);
  goTo('run');
}

function openInitials() {
  showInitials();
  goTo('initials');
}

function saveInitials() {
  const initials = validInitialsOrNull();
  if (!initials) return;
  app.savedEntry = addScore({ initials, score: app.challenge.total });
  showLeaderboard({ todayOnly: true });
}

function showLeaderboard(options = {}) {
  renderBoard({ ...options, highlight: app.savedEntry, tiers: prizeTiers() });
  goTo('leaderboard');
}

// --- Staff mode and kiosk --------------------------------------------------------------

/** Five quick taps on the moon, on the title screen, opens the staff PIN. */
function checkMoonTap(point) {
  const moon = moonCircle(camera.screenWidth, camera.screenHeight);
  if (Math.hypot(point.x - moon.x, point.y - moon.y) > moon.radius) return;
  const now = performance.now() / 1000;
  app.moonTaps = [...app.moonTaps.filter((t) => now - t < SECRET_TAP_WINDOW), now];
  if (app.moonTaps.length >= STAFF.secretTaps) {
    app.moonTaps = [];
    showPin();
    goTo('pin');
  }
}

function checkIdle() {
  const idle = idleSeconds();
  const { kiosk, kioskIdleSeconds } = getSettings();
  if ((app.screen === 'pin' || app.screen === 'staff') && idle > STAFF_IDLE_SECONDS) return showTitle();
  if (!kiosk) return;
  // Give volunteers longer on an unclaimed prize screen, and players longer
  // mid-level.
  const limits = {
    result: kioskIdleSeconds,
    run: kioskIdleSeconds,
    levels: kioskIdleSeconds,
    leaderboard: kioskIdleSeconds,
    initials: kioskIdleSeconds * 2,
    prize: app.prize?.claimedAt ? kioskIdleSeconds : kioskIdleSeconds * 4,
    paused: kioskIdleSeconds * 2,
    playing: kioskIdleSeconds * 4,
  };
  if (limits[app.screen] && idle > limits[app.screen]) showTitle();
}

// --- Pause -------------------------------------------------------------------------------

function pause() {
  if (app.screen !== 'playing') return;
  app.aim = { active: false, start: null, pull: { x: 0, y: 0 } };
  goTo('paused');
}

function resume() {
  if (app.screen === 'paused') goTo('playing');
}

// --- Buttons and keys -----------------------------------------------------------------

onAction((action, button) => {
  unlockAudio();
  sounds.click();
  switch (action) {
    case 'play-challenge':
      return startChallenge();
    case 'show-levels':
      return showLevels();
    case 'play-level':
      return startFreePlay(Number(button.dataset.index));
    case 'pause':
      return pause();
    case 'resume':
      return resume();
    case 'retry':
      return app.mode === 'challenge' ? undefined : startFreePlay(app.levelIndex);
    case 'next':
      return startFreePlay(Math.min(app.levelIndex + 1, LEVELS.length - 1));
    case 'challenge-continue':
      return challengeContinue();
    case 'prize-continue':
      return showRun();
    case 'enter-initials':
      return openInitials();
    case 'initial-up':
      return stepLetter(Number(button.dataset.slot), 1);
    case 'initial-down':
      return stepLetter(Number(button.dataset.slot), -1);
    case 'initials-save':
      return saveInitials();
    case 'initials-skip':
      return showRun();
    case 'leaderboard':
      return showLeaderboard({ todayOnly: true });
    case 'board-today':
      return renderBoard({ todayOnly: true });
    case 'board-all':
      return renderBoard({ todayOnly: false });
    case 'pin-digit':
      return pressPinDigit(button.dataset.digit);
    case 'pin-back':
      return pressPinBack();
    case 'pin-enter':
      if (submitPin()) {
        showStaff();
        goTo('staff');
      }
      return;
    case 'staff-save':
      return saveStaff();
    case 'staff-reset-scores':
      return pressResetScores();
    case 'menu':
      return showTitle();
  }
});

// Pause automatically when the tab is hidden or the device is turned upright.
document.addEventListener('visibilitychange', () => document.hidden && pause());
portraitTouch?.addEventListener?.('change', (event) => event.matches && pause());
window.addEventListener('keydown', (event) => {
  if (app.screen === 'initials' && event.key === 'Enter') {
    event.preventDefault();
    saveInitials();
  } else if (app.screen === 'pin' && /^\d$/.test(event.key)) {
    pressPinDigit(event.key);
  } else if (app.screen === 'pin' && event.key === 'Backspace') {
    pressPinBack();
  } else if (app.screen === 'pin' && event.key === 'Enter' && submitPin()) {
    showStaff();
    goTo('staff');
  } else if (event.key === 'Escape' || event.key === 'p') {
    if (app.screen === 'playing') pause();
    else if (app.screen === 'paused') resume();
  }
});

// --- Mute and fullscreen buttons -----------------------------------------------

const muteButton = document.getElementById('mute-button');
setMuted(load('muted', false));
muteButton.setAttribute('aria-pressed', String(isMuted()));
muteButton.addEventListener('click', () => {
  unlockAudio();
  setMuted(!isMuted());
  save('muted', isMuted());
  muteButton.setAttribute('aria-pressed', String(isMuted()));
});
setupFullscreen({ button: document.getElementById('fullscreen-button'), iosHint: document.getElementById('ios-hint') });

// --- Start up ----------------------------------------------------------------------

async function loadFonts() {
  if (!document.fonts?.load) return;
  const fonts = Promise.all([document.fonts.load('400 40px Creepster'), document.fonts.load('700 40px Fredoka')]);
  // Never let a font problem stop the game from starting.
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([fonts.catch(() => {}), timeout]);
}

async function start() {
  resize();
  const artValues = [PANTHER.art, ...Object.values(MATERIALS).map((m) => m.art), ...Object.values(ENEMIES).map((e) => e.art)];
  await Promise.all([loadFonts(), loadArt(artValues)]);
  showTitle();
  startLoop({ stepSeconds: STEP_SECONDS, step, frame });
}

// Extra hooks for automated checks. Only exposed with ?debug in the address.
if (new URLSearchParams(location.search).has('debug')) {
  window.pantherPounce = { app, camera, startLevel, startFreePlay, startChallenge, LEVELS, SLINGSHOT, getSettings };
}

start();
