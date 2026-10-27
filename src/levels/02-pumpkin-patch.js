// Level 2: jack-o'-lanterns EXPLODE when they break. Use them!

export default {
  id: 'pumpkin-patch',
  name: 'Pumpkin Patch',
  setting: 'pumpkin-patch',
  panthers: 3,
  par: { twoStars: 12000, threeStars: 16000 },

  blocks: [
    // A little table with a jack-o'-lantern on top
    { material: 'wood', x: 20, y: 0, width: 0.5, height: 2.2 },
    { material: 'wood', x: 23, y: 0, width: 0.5, height: 2.2 },
    { material: 'wood', x: 21.5, y: 2.2, width: 3.8, height: 0.4 },
    { material: 'pumpkin', x: 21.5, y: 2.6, radius: 0.6 },
    // A stone pedestal guarded by two jack-o'-lanterns
    { material: 'pumpkin', x: 26.2, y: 0, radius: 0.6 },
    { material: 'stone', x: 28, y: 0, width: 2, height: 1.2 },
    { material: 'pumpkin', x: 29.8, y: 0, radius: 0.6 },
    // A tall post with a lookout on top
    { material: 'wood', x: 32.5, y: 0, width: 0.6, height: 3 },
    { material: 'wood', x: 32.5, y: 3, width: 2.2, height: 0.35 },
  ],

  enemies: [
    { type: 'ghost', x: 21.5, y: 0 },
    { type: 'ghost', x: 28, y: 1.2 },
    { type: 'bat', x: 32.5, y: 3.35 },
  ],
};
