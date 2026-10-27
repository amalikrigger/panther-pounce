// Level 5: the Phantom hides in a stone crypt. It's tough! Blow up the
// jack-o'-lanterns inside, or drop the roof on it.

export default {
  id: 'phantoms-lair',
  name: "Phantom's Lair",
  setting: 'graveyard',
  panthers: 4,
  par: { twoStars: 22000, threeStars: 30000 },

  blocks: [
    // The crypt: thick stone walls and roof
    { material: 'stone', x: 24, y: 0, width: 0.8, height: 3.2 },
    { material: 'stone', x: 30, y: 0, width: 0.8, height: 3.2 },
    { material: 'stone', x: 27, y: 3.2, width: 7.2, height: 0.6 },
    // Jack-o'-lanterns inside, next to the Phantom
    { material: 'pumpkin', x: 25.2, y: 0, radius: 0.55 },
    { material: 'pumpkin', x: 28.8, y: 0, radius: 0.55 },
    // A wooden shack on the roof
    { material: 'wood', x: 25, y: 3.8, width: 0.45, height: 2 },
    { material: 'wood', x: 29, y: 3.8, width: 0.45, height: 2 },
    { material: 'wood', x: 27, y: 5.8, width: 5, height: 0.4 },
    // Graves in front
    { material: 'tombstone', x: 20.5, y: 0, width: 1, height: 1.5 },
    { material: 'tombstone', x: 22, y: 0, width: 0.9, height: 1.2 },
  ],

  enemies: [
    { type: 'phantom', x: 27, y: 0 },
    { type: 'ghost', x: 26.1, y: 3.8 },
    { type: 'ghost', x: 27.9, y: 3.8 },
    { type: 'bat', x: 27, y: 6.2 },
  ],
};
