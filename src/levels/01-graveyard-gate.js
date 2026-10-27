// Level 1: a gentle first level. Two wooden gates with a ghost under each.
//
// How level files work (see README "Make a level"):
//   x        the middle of the block, in world units (the slingshot is at x = 4)
//   y        where the BOTTOM of the block sits (0 = on the ground)
//   width, height   size of box blocks
//   radius   size of round blocks (pumpkins)
//   angle    tilt in degrees (optional)
//   fixed    true = it never moves or breaks (optional)

export default {
  id: 'graveyard-gate',
  name: 'Graveyard Gate',
  setting: 'graveyard',
  panthers: 3,
  // Clearing the level is 1 star. Reach these scores for 2 or 3 stars.
  par: { twoStars: 9000, threeStars: 13000 },

  blocks: [
    // Bottom gate
    { material: 'wood', x: 20, y: 0, width: 0.5, height: 2.6 },
    { material: 'wood', x: 24, y: 0, width: 0.5, height: 2.6 },
    { material: 'wood', x: 22, y: 2.6, width: 5, height: 0.45 },
    // Top gate
    { material: 'wood', x: 20.6, y: 3.05, width: 0.5, height: 2 },
    { material: 'wood', x: 23.4, y: 3.05, width: 0.5, height: 2 },
    { material: 'wood', x: 22, y: 5.05, width: 3.8, height: 0.45 },
    // Graves on either side
    { material: 'tombstone', x: 17, y: 0, width: 1, height: 1.5 },
    { material: 'tombstone', x: 27, y: 0, width: 1.1, height: 1.7 },
  ],

  enemies: [
    { type: 'ghost', x: 22, y: 0 },
    { type: 'ghost', x: 22, y: 3.05 },
  ],
};
