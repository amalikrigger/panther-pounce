// Loads student-made pictures and draws any "art" value from config.js.
//
// An art value is either:
//   'drawn:ghost'                  draw it with code (see art.js)
//   'assets/art/my-ghost.png'      draw this picture instead
//
// Picture rules (also in README "Add your own art"):
//   - PNG with a transparent background.
//   - Round things (panther, enemies, pumpkins): a SQUARE picture. The circle
//     the physics uses touches the middle of each edge of the square.
//   - Box things (wood, stone...): any size. It's stretched to fill the block exactly.

import { DRAWN_ART } from './art.js';

const images = new Map();

/** Start loading every picture mentioned in the art values. Never fails: a missing picture falls back to drawn art. */
export async function loadArt(artValues) {
  const paths = [...new Set(artValues)].filter((art) => art && !art.startsWith('drawn:'));
  await Promise.all(
    paths.map(
      (path) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            images.set(path, image);
            resolve();
          };
          image.onerror = () => {
            console.warn(`Couldn't load the picture "${path}". Using drawn art instead. Check the path in config.js.`);
            resolve();
          };
          image.src = path;
        }),
    ),
  );
}

/**
 * Draw a round thing of radius `r` centered on (0, 0).
 * `fallback` is the drawn art to use if a picture is missing.
 */
export function drawRound(ctx, art, fallback, r, options) {
  const image = images.get(art);
  if (image) {
    ctx.drawImage(image, -r, -r, r * 2, r * 2);
    return;
  }
  DRAWN_ART[drawnName(art, fallback)].draw(ctx, r, options);
}

/** Draw a box of `width` × `height` centered on (0, 0). */
export function drawBox(ctx, art, fallback, width, height, options) {
  const image = images.get(art);
  if (image) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    return;
  }
  DRAWN_ART[drawnName(art, fallback)].draw(ctx, width, height, options);
}

function drawnName(art, fallback) {
  const name = art?.startsWith('drawn:') ? art.slice(6) : fallback;
  return DRAWN_ART[name] ? name : fallback;
}
