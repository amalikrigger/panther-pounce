// Drawing quality. Glows (canvas "shadowBlur") look great but are slow on
// older tablets and Chromebooks. main.js switches to low power by itself if
// the game starts running slowly.

export const quality = {
  glow: true, // soft glows around ghosts and jack-o'-lanterns
  particleScale: 1, // 1 = full particle effects, 0.5 = half as many
};

export function setLowPower(low) {
  quality.glow = !low;
  quality.particleScale = low ? 0.5 : 1;
}
