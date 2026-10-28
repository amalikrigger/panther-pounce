// Level 6: a long bridge between two crypt pillars. Snap the bridge, or
// skim a pounce under it to set off the jack-o'-lantern.

export default {
  id: 'bone-bridge',
  name: 'Bone Bridge',
  setting: 'haunted-house',
  panthers: 4,
  par: { twoStars: 18000, threeStars: 25000 },

  blocks: [
    // Two stone pillars
    { material: 'stone', x: 22, y: 0, width: 0.9, height: 3 },
    { material: 'stone', x: 30, y: 0, width: 0.9, height: 3 },
    // The bridge
    { material: 'wood', x: 26, y: 3, width: 9.4, height: 0.45 },
    // Graves on top of each pillar end
    { material: 'tombstone', x: 22, y: 3.45, width: 0.8, height: 1.2 },
    { material: 'tombstone', x: 30, y: 3.45, width: 0.8, height: 1.2 },
    // Under the bridge
    { material: 'pumpkin', x: 25.2, y: 0, radius: 0.6 },
    { material: 'wood', x: 34, y: 0, width: 0.5, height: 2 },
  ],

  enemies: [
    { type: 'ghost', x: 24.4, y: 3.45 },
    { type: 'ghost', x: 27.6, y: 3.45 },
    { type: 'bat', x: 26.6, y: 0 },
    { type: 'bat', x: 34, y: 2 },
  ],
};
