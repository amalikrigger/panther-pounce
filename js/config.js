/*
 * Panther Pounce - settings students can tweak.
 * Colors and fonts live in css/theme.css. This file holds behaviour knobs.
 */
window.PP = window.PP || {};

PP.config = {
  // Animated Halloween background (js/render/parallax.js)
  background: {
    fps: 30, // redraw rate. 30 looks smooth for a sky and saves battery on tablets.

    // How much each layer follows the camera when the world scrolls sideways.
    // 0 = painted on the sky, 1 = glued to the game world. Small = far away.
    depth: {
      stars: 0.02,
      moon: 0.03,
      clouds: 0.05,
      bats: 0.06,
      far: 0.12,  // hills + haunted carnival
      mid: 0.25,  // haunted house + dead trees
      near: 0.45, // graveyard
      fog: 0.6
    },

    cloudSpeed: 1.2, // retro pixels per second
    fogSpeed: 2.5,
    bats: 5,

    // A witch flies across the moon now and then (seconds).
    witch: { firstSec: 8, minSec: 20, maxSec: 45, speed: 28 }
  },

  // Easter egg: two spectators peeking over a graveyard fence (js/render/spectators.js)
  spectators: {
    enabled: true,
    x: 112,          // where they stand, in retro pixels along the graveyard
    waveMinSec: 6,   // someone waves every 6-15 seconds
    waveMaxSec: 15,
    bothChance: 0.3  // how often they wave together
  },

  // Aiming assist: dotted arc showing where the panther will fly (js/fx/trajectory.js)
  aim: {
    enabledByDefault: true, // players can switch it with the AIM button
    seconds: 1.2,           // how much of the flight to show. Shorter = harder.
    dotEvery: 4,            // one dot every N physics steps (60 steps = 1 second)
    fadeInSec: 0.15,
    fadeOutSec: 0.35
  }
};
