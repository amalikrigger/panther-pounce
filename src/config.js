// =============================================================================
// PANTHER POUNCE: GAME CONFIG
// =============================================================================
// This is the one file to edit if you want to change how the game looks or
// plays. Every value has a comment saying what it does. Change one thing, save,
// reload the page, and see what happens!
//
// Units:
//   - Positions and sizes are in "world units". One unit is about one metre.
//     The panther is about 1.3 units wide. The ground is at y = 0 and y goes UP,
//     so a block with y = 3 sits 3 units above the ground.
//   - Times are in seconds. Speeds are units per second.
// =============================================================================

export const THEME = {
  // School colors (from ghcds.org; not yet confirmed as official).
  gold: '#F6BC1B',
  maroon: '#701114',
  charcoal: '#58595B',

  // Halloween colors (from the Boo Bash 2026 flyer).
  skyTop: '#12051f', // top of the night sky
  skyBottom: '#3d1466', // horizon glow
  moon: '#ffd75e', // giant harvest moon
  pumpkin: '#ff7a1a',
  silhouette: '#0a0410', // haunted house, trees, hills
  ground: '#1c0f24', // the dirt you stand on
  groundEdge: '#3b2a1a', // the strip of dead grass on top

  // Fonts. These are bundled in assets/fonts so they work offline.
  displayFont: '"Creepster", "Impact", fantasy',
  uiFont: '"Fredoka", "Trebuchet MS", system-ui, sans-serif',
};

// -----------------------------------------------------------------------------
// PHYSICS: how the world feels.
// -----------------------------------------------------------------------------
export const PHYSICS = {
  gravity: 10, // units per second², pulls everything down
  // The physics runs in fixed steps so it behaves the same on every device.
  stepsPerSecond: 60,
  // Ignore the first moment of a level while blocks settle onto each other,
  // so nothing breaks before you even shoot.
  settleSeconds: 1.0,
  // Bodies further than this outside the level are removed (they fell off).
  removeMargin: 8,
};

// -----------------------------------------------------------------------------
// THE SLINGSHOT AND THE PANTHER
// -----------------------------------------------------------------------------
export const SLINGSHOT = {
  x: 4, // where the panther sits, ready to launch
  y: 3.4,
  maxPull: 2.6, // how far back you can pull (units)
  minPull: 0.45, // pulls shorter than this cancel the shot
  launchSpeed: 19, // speed at full pull. Bigger = more power!
  // How far the dotted aiming line reaches, in seconds of flight.
  // Longer makes the game easier.
  trajectorySeconds: 0.9,
};

export const PANTHER = {
  art: 'drawn:panther', // or a PNG path, see README "Add your own art"
  radius: 0.62,
  density: 5, // heavier panthers smash harder
  friction: 0.6,
  bounce: 0.3, // 0 = no bounce, 1 = super bouncy
  rollingDrag: 6, // slows rolling so a shot ends soon after the panther lands
};

// -----------------------------------------------------------------------------
// MATERIALS: what structures are built from.
// -----------------------------------------------------------------------------
// shape    'box' (use width/height in the level) or 'circle' (use radius)
// density  how heavy it is for its size
// health   how hard it is to break (bigger = tougher)
// points   score for breaking it
// explodes optional: { radius, power } makes it blow up when it breaks
export const MATERIALS = {
  wood: { art: 'drawn:wood', shape: 'box', density: 0.7, friction: 0.7, bounce: 0.1, health: 45, points: 100 },
  stone: { art: 'drawn:stone', shape: 'box', density: 2.2, friction: 0.8, bounce: 0.05, health: 160, points: 250 },
  tombstone: { art: 'drawn:tombstone', shape: 'box', density: 2.2, friction: 0.8, bounce: 0.05, health: 110, points: 300 },
  pumpkin: {
    art: 'drawn:jackolantern',
    shape: 'circle',
    density: 0.6,
    friction: 0.6,
    bounce: 0.2,
    health: 12,
    points: 500,
    explodes: { radius: 3.6, power: 14 },
  },
};

// -----------------------------------------------------------------------------
// ENEMIES: the spooks you have to clear.
// -----------------------------------------------------------------------------
// Enemies are round bodies. Each type has a different SHAPE (not just color)
// so everyone can tell them apart.
export const ENEMIES = {
  ghost: { art: 'drawn:ghost', radius: 0.55, density: 1, health: 14, points: 1000 },
  bat: { art: 'drawn:bat', radius: 0.42, density: 0.8, health: 9, points: 1500 },
  // The boss: big and tough. Hit it hard or drop something heavy on it.
  phantom: { art: 'drawn:phantom', radius: 0.95, density: 1.2, health: 75, points: 5000 },
};

// -----------------------------------------------------------------------------
// DAMAGE: how hits turn into broken blocks.
// -----------------------------------------------------------------------------
export const DAMAGE = {
  // Small bumps (like blocks resting on each other) do no damage. Only the
  // part of a hit above this counts.
  ignoreBelow: 1.2,
  // Hits from the panther itself count this many times more.
  pantherMultiplier: 1,
  // Hits harder than this make a "crunch" sound and shake the screen.
  bigHit: 25,
};

// -----------------------------------------------------------------------------
// TURNS: when does a shot end?
// -----------------------------------------------------------------------------
export const TURNS = {
  // A shot ends when everything has nearly stopped moving for this long...
  quietSeconds: 0.9,
  quietSpeed: 0.25, // "nearly stopped" means slower than this
  // ...or after this many seconds, whichever comes first.
  maxShotSeconds: 9,
};

// -----------------------------------------------------------------------------
// SCORING
// -----------------------------------------------------------------------------
// Points for breaking blocks and clearing enemies come from MATERIALS and
// ENEMIES above. You also get a bonus for every panther you didn't need.
export const SCORING = {
  unusedPanther: 5000,
};

// -----------------------------------------------------------------------------
// EFFECTS
// -----------------------------------------------------------------------------
export const EFFECTS = {
  maxParticles: 220, // hard cap so older tablets stay smooth
  screenShake: true, // gentler automatically if the device asks for reduced motion
};
