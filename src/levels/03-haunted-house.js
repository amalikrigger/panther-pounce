// Level 3: a two-story haunted house with a stone ground floor and an attic.

export default {
  id: 'haunted-house',
  name: 'Haunted House',
  setting: 'haunted-house',
  panthers: 4,
  par: { twoStars: 16000, threeStars: 22000 },

  blocks: [
    // Ground floor: stone walls and a stone ceiling
    { material: 'stone', x: 22, y: 0, width: 0.8, height: 2.4 },
    { material: 'stone', x: 27, y: 0, width: 0.8, height: 2.4 },
    { material: 'stone', x: 24.5, y: 2.4, width: 6.2, height: 0.5 },
    // Second floor: wood
    { material: 'wood', x: 22.4, y: 2.9, width: 0.45, height: 2.2 },
    { material: 'wood', x: 26.6, y: 2.9, width: 0.45, height: 2.2 },
    { material: 'wood', x: 24.5, y: 5.1, width: 5.2, height: 0.4 },
    // Attic
    { material: 'wood', x: 23.3, y: 5.5, width: 0.4, height: 1.4 },
    { material: 'wood', x: 25.7, y: 5.5, width: 0.4, height: 1.4 },
    { material: 'wood', x: 24.5, y: 6.9, width: 3, height: 0.35 },
    // A jack-o'-lantern by the front door, and a grave out back
    { material: 'pumpkin', x: 20.4, y: 0, radius: 0.55 },
    { material: 'tombstone', x: 30, y: 0, width: 1, height: 1.6 },
  ],

  enemies: [
    { type: 'ghost', x: 24.5, y: 0 },
    { type: 'bat', x: 24.5, y: 2.9 },
    { type: 'ghost', x: 24.5, y: 5.5 },
  ],
};
