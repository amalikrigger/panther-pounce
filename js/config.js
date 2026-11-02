/*
 * Panther Pounce - settings students can tweak.
 * Colors and fonts live in css/theme.css. This file holds behaviour knobs.
 */
window.PP = window.PP || {};

PP.config = {
  // Camera. zoom < 1 draws the game world smaller so the slingshot and the
  // targets fit on screen together. 1 = original close-up camera.
  view: {
    zoom: 0.57
  },

  // Slingshot. You have to press on the panther to pull it back; grabMargin
  // is how many screen pixels outside the panther still count as touching it.
  // Bigger = easier on small screens and for little fingers.
  sling: {
    grabMargin: 18
  },

  // Enemies can't roll off the screen: they stay between these game-world x
  // positions (the slingshot is at 190). null for maxX = the right edge of
  // the screen when the camera is at the slingshot.
  enemyArea: {
    minX: 900,
    maxX: null
  },

  // Breakable blocks. Wood has 2000 health; a hit takes impulse x woodScale.
  // Hits softer than the min impulse do nothing (so towers don't crumble on
  // their own). Glass shatters on the first hit above glassMinImpulse.
  // Stone can be pushed around but is heavy (stoneDensity, wood is 1), grips
  // the ground (stoneFriction, wood is 0.5) and takes about 3 times as many
  // hits as wood to break. Raise density/friction to make it harder to move.
  damage: {
    woodScale: 3,
    woodMinImpulse: 8,
    glassMinImpulse: 4,
    stoneHealth: 6000,
    stoneMinImpulse: 15,
    stoneDensity: 4,
    stoneFriction: 0.9
  },

  // Background music. The first file that exists plays on a loop.
  // "Spooky Season (Riddim).m4a" goes in the sound folder; until it is there
  // the generated ragtime (tools/make_sounds.py) plays instead.
  // volume 0 to 1. 0 turns the music off.
  music: {
    volume: 0.3,
    files: ["sound/Spooky Season (Riddim).m4a", "sound/music_theme.wav"]
  },

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
  },

  // From world 3 on every level has its own mix of panthers. It is picked
  // once per level (the same every try) to suit the level: more pumpkin bombs
  // for stone and vaults, more split cats for glass (js/levels/generator.js ->
  // PP.levels.lineup). These are the base weights: bigger = more often.
  // How many you get is set per level (3 to 10, more for harder levels).
  //   bird       - the panther
  //   bird_split - tap while flying to split into three
  //   boulder    - pumpkin bomb: flies the same arc but hits much harder.
  //                Tap while it flies to make it explode!
  randomBirds: {
    weights: { bird: 5, bird_split: 3, boulder: 2 },
    pumpkinWeight: 2.5, // how many times heavier the pumpkin bomb hits
    blastRadius: 340,   // how far the explosion reaches (game pixels)
    blastPower: 220,    // how hard it throws things (heavy stone moves less)
    blastDamage: 4500   // damage right next to the blast. Wood has 2000 health,
                        // stone 6000, glass breaks on any hit, zombies 600-1500
  },

  // Hills in world 3 (colors live in css/theme.css: --pp-hill-*)
  hills: {
    friction: 0.9 // how much things grip the hills (wood is 0.5)
  }
};
