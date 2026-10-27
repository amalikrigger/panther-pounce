// Level 4: a tall, wobbly clock tower. Knock it over and let gravity help.

export default {
  id: 'clocktower',
  name: 'Moonlit Clocktower',
  setting: 'campus',
  panthers: 4,
  par: { twoStars: 18000, threeStars: 25000 },

  blocks: [
    // Bottom floor
    { material: 'wood', x: 25, y: 0, width: 0.5, height: 2.5 },
    { material: 'wood', x: 28, y: 0, width: 0.5, height: 2.5 },
    { material: 'wood', x: 26.5, y: 2.5, width: 4, height: 0.4 },
    // Middle floor
    { material: 'wood', x: 25.4, y: 2.9, width: 0.45, height: 2.2 },
    { material: 'wood', x: 27.6, y: 2.9, width: 0.45, height: 2.2 },
    { material: 'wood', x: 26.5, y: 5.1, width: 3.2, height: 0.4 },
    // Top floor: heavy stone
    { material: 'stone', x: 25.7, y: 5.5, width: 0.5, height: 1.8 },
    { material: 'stone', x: 27.3, y: 5.5, width: 0.5, height: 1.8 },
    { material: 'stone', x: 26.5, y: 7.3, width: 2.4, height: 0.5 },
    // The "clock": a jack-o'-lantern on the very top
    { material: 'pumpkin', x: 26.5, y: 7.8, radius: 0.6 },
    // A stone pedestal off to the side
    { material: 'stone', x: 33, y: 0, width: 1.2, height: 2 },
  ],

  enemies: [
    { type: 'ghost', x: 26.5, y: 0 },
    { type: 'bat', x: 26.5, y: 2.9 },
    { type: 'ghost', x: 26.5, y: 5.5 },
    { type: 'bat', x: 33, y: 2 },
  ],
};
