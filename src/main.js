// Panther Pounce: where everything gets connected.
//
// Startup order:
//   1. load fonts and any student pictures
//   2. create the canvas, camera, input, renderer and effects
//   3. start the game loop and show the title screen
//
// The app is always on one screen: 'loading', 'title', 'levels', 'playing',
// 'paused' or 'result'. Buttons in index.html send "actions" (like
// "play-level") that move between them.
//
// Who does what:
//   PhysicsWorld (physics/world.js)  bodies, hits, breaking. Reports events.
//   Round        (core/round.js)     turns, score, stars, win/lose.
//   this file                        turns events into score, sound and sparkle,
//                                    and handles aiming and screens.

import { THEME, PHYSICS, SLINGSHOT, PANTHER, MATERIALS, ENEMIES, DAMAGE, TURNS, SCORING, EFFECTS } from './config.js';
import { LEVELS } from './levels/index.js';
import { PhysicsWorld } from './physics/world.js';
import { Round } from './core/round.js';
import { Camera } from './engine/camera.js';
import { startLoop } from './engine/loop.js';
import { PointerInput } from './input/pointer.js';
import { Renderer, predictPath } from './render/renderer.js';
import { Effects } from './render/effects.js';
import { loadArt } from './render/sprites.js';
import { sounds, unlock as unlockAudio, setMuted, isMuted } from './audio/sound.js';
import { showScreen, onAction, setText, setHidden, setStats, starsMarkup } from './ui/screens.js';
import { setupFullscreen } from './ui/fullscreen.js';
import { load, save } from './storage/store.js';

const PHYSICS_SETTINGS = { physics: PHYSICS, materials: MATERIALS, enemies: ENEMIES, panther: PANTHER, damage: DAMAGE };
const STEP_SECONDS = 1 / PHYSICS.stepsPerSecond;
// Seconds to wait after a level ends before the results appear, so you can
// enjoy the last crash.
const RESULT_DELAY = 0.9;

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
  levelIndex: 0,
  physics: null,
  round: null,
  shot: { time: 0, quietTime: 0 },
  aim: { active: false, start: null, pull: { x: 0, y: 0 } },
  reload: 1, // 0..1 while the next panther hops onto the slingshot
  resultTimer: null,
  time: 0,
  progress: load('progress', {}), // { [levelId]: { best, stars } }
};

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
  loadLevel(index);
  // Fly-in: start close on the structure, then glide back to show everything.
  const bounds = app.physics.bounds;
  const fullView = cameraRect();
  if (reducedMotion?.matches) {
    camera.frame(fullView, { instant: true });
  } else {
    camera.frame({ left: bounds.left - 2, right: bounds.right + 2, bottom: -1, top: bounds.top + 3 }, { instant: true });
  }
  app.reload = 0;
  app.screen = 'playing';
  showScreen(null);
  setHidden('#hud', false);
  document.body.classList.add('in-game');
  setText('#hud-level', `${index + 1}. ${LEVELS[index].name}`);
  updateHud();
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
    app.resultTimer = setTimeout(() => showResult(state === 'won'), RESULT_DELAY * 1000);
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

// --- HUD and screens -----------------------------------------------------------

const PAW_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5.2" ry="4.4"/><ellipse cx="5.2" cy="10.2" rx="2.2" ry="2.8"/><ellipse cx="9.4" cy="6" rx="2.2" ry="2.9"/><ellipse cx="14.6" cy="6" rx="2.2" ry="2.9"/><ellipse cx="18.8" cy="10.2" rx="2.2" ry="2.8"/></svg>';

function updateHud() {
  const round = app.round;
  if (!round) return;
  setText('#hud-score', round.score.toLocaleString());
  const tokens = document.getElementById('hud-panthers');
  const total = LEVELS[app.levelIndex].panthers;
  if (tokens.childElementCount !== total || tokens.dataset.left !== String(round.panthersLeft)) {
    tokens.dataset.left = round.panthersLeft;
    tokens.setAttribute('aria-label', `${round.panthersLeft} panthers left`);
    tokens.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="paw ${i < round.panthersLeft ? '' : 'used'}">${PAW_SVG}</span>`).join('');
  }
}

function showTitle() {
  clearTimeout(app.resultTimer);
  document.body.classList.remove('in-game');
  loadLevel(0);
  camera.frame(cameraRect(), { instant: true });
  app.screen = 'title';
  setHidden('#hud', true);
  showScreen('title');
}

function showLevels() {
  clearTimeout(app.resultTimer);
  document.body.classList.remove('in-game');
  app.screen = 'levels';
  setHidden('#hud', true);
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
  showScreen('levels');
}

function showResult(won) {
  const round = app.round;
  const level = LEVELS[app.levelIndex];
  app.screen = 'result';
  setHidden('#hud', true);
  document.body.classList.remove('in-game');

  const previous = app.progress[level.id];
  const isNewBest = won && round.score > (previous?.best ?? 0);
  if (won) {
    app.progress[level.id] = { best: Math.max(round.score, previous?.best ?? 0), stars: Math.max(round.stars, previous?.stars ?? 0) };
    save('progress', app.progress);
  }

  setText('#result-title', won ? 'Level Cleared!' : 'The spooks win!');
  setText('#result-reason', won ? level.name : `${round.enemiesLeft} spook${round.enemiesLeft === 1 ? '' : 's'} still haunting. Try again!`);
  document.getElementById('result-stars').innerHTML = won ? starsMarkup(round.stars, 'big') : '';
  setText('#result-score', round.score.toLocaleString());
  setHidden('#result-new-best', !isNewBest);
  setStats('#result-stats', won
    ? [['Destruction', round.breakdown.destruction.toLocaleString()], ['Spooks cleared', round.breakdown.enemies.toLocaleString()], ['Panther bonus', round.breakdown.pantherBonus.toLocaleString()]]
    : [['Destruction', round.breakdown.destruction.toLocaleString()], ['Spooks cleared', round.breakdown.enemies.toLocaleString()]]);

  const hasNext = app.levelIndex < LEVELS.length - 1;
  setHidden('#result-next', !won || !hasNext);
  document.getElementById('result-retry').classList.toggle('button-primary', !won);
  document.getElementById('result-retry').classList.toggle('button-secondary', won);
  showScreen('result');

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

function pause() {
  if (app.screen !== 'playing') return;
  app.screen = 'paused';
  app.aim = { active: false, start: null, pull: { x: 0, y: 0 } };
  showScreen('pause');
}

function resume() {
  app.screen = 'playing';
  showScreen(null);
}

onAction((action, button) => {
  unlockAudio();
  sounds.click();
  switch (action) {
    case 'show-levels':
      return showLevels();
    case 'play-level':
      return startLevel(Number(button.dataset.index));
    case 'pause':
      return pause();
    case 'resume':
      return resume();
    case 'retry':
      return startLevel(app.levelIndex);
    case 'next':
      return startLevel(Math.min(app.levelIndex + 1, LEVELS.length - 1));
    case 'menu':
      return showTitle();
  }
});

// Pause automatically when the tab is hidden or the device is turned upright.
document.addEventListener('visibilitychange', () => document.hidden && pause());
portraitTouch?.addEventListener?.('change', (event) => event.matches && pause());
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' || event.key === 'p') {
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
  window.pantherPounce = { app, camera, startLevel, showResult, LEVELS, SLINGSHOT };
}

start();
