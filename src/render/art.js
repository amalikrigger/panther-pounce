// Everything in the game that's drawn with code instead of a picture file.
//
// Every function draws ONE thing centered on (0, 0), in world units, with y
// pointing DOWN (like normal canvas drawing). The renderer moves, rotates and
// flips the canvas first, so these functions don't have to think about where
// the thing is in the world.
//
// Want to change how something looks? Edit its function here and reload.
// Want to use your own drawing instead? See "Add your own art" in README.md.

import { THEME } from '../config.js';
import { quality } from './quality.js';

const TAU = Math.PI * 2;

// A tiny repeatable random number generator. Given the same seed it always
// gives the same numbers, so a block's wood grain doesn't flicker every frame.
function seeded(seed) {
  let state = Math.floor(seed * 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

// --- The panther -----------------------------------------------------------

/** The hero: a round black panther. `blink` (0..1) closes the eyes. */
export function drawPanther(ctx, r, { blink = 0, squint = false } = {}) {
  // Ears first, so the head covers their bottoms.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.95, -r * 0.2);
    ctx.lineTo(side * r * 0.78, -r * 1.12);
    ctx.lineTo(side * r * 0.2, -r * 0.82);
    ctx.closePath();
    ctx.fillStyle = '#16121c';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * r * 0.78, -r * 0.4);
    ctx.lineTo(side * r * 0.72, -r * 0.92);
    ctx.lineTo(side * r * 0.38, -r * 0.74);
    ctx.closePath();
    ctx.fillStyle = THEME.maroon;
    ctx.fill();
  }

  // Head, with a soft purple rim light from the moon.
  const head = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  head.addColorStop(0, '#3a3046');
  head.addColorStop(0.7, '#1a1520');
  head.addColorStop(1, '#0c0910');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = head;
  ctx.fill();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'rgba(199, 125, 255, 0.55)';
  ctx.stroke();

  // Gold eyes with cat-slit pupils.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.38, -r * 0.12);
    const open = squint ? 0.35 : 1 - blink;
    ctx.scale(1, Math.max(0.08, open));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.21, side * -0.25, 0, TAU);
    ctx.fillStyle = THEME.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.02 * side, 0, r * 0.06, r * 0.18, 0, 0, TAU);
    ctx.fillStyle = '#120a06';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.07, -r * 0.08, r * 0.045, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  // Muzzle, nose and a determined little grin with fangs.
  ctx.beginPath();
  ctx.ellipse(0, r * 0.38, r * 0.36, r * 0.24, 0, 0, TAU);
  ctx.fillStyle = '#2a2230';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.22);
  ctx.lineTo(r * 0.1, r * 0.22);
  ctx.lineTo(0, r * 0.33);
  ctx.closePath();
  ctx.fillStyle = '#d9667a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.42);
  ctx.quadraticCurveTo(0, r * 0.56, r * 0.2, r * 0.42);
  ctx.lineWidth = r * 0.05;
  ctx.strokeStyle = '#0c0910';
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.13, r * 0.46);
    ctx.lineTo(side * r * 0.08, r * 0.6);
    ctx.lineTo(side * r * 0.04, r * 0.47);
    ctx.fillStyle = '#fff6d6';
    ctx.fill();
  }

  // Whiskers.
  ctx.strokeStyle = 'rgba(255, 246, 214, 0.75)';
  ctx.lineWidth = r * 0.03;
  for (const side of [-1, 1]) {
    for (const tilt of [-0.12, 0.06]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.32, r * 0.36);
      ctx.lineTo(side * r * 0.95, r * (0.3 + tilt));
      ctx.stroke();
    }
  }
}

// --- Enemies ---------------------------------------------------------------

/** A bed-sheet ghost. The wavy hem is its shape signature. */
export function drawGhost(ctx, r, { time = 0, hurt = 0 } = {}) {
  const wobble = Math.sin(time * 3) * r * 0.05;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.1);
  ctx.arc(0, -r * 0.05, r, Math.PI, 0);
  ctx.lineTo(r, r * 0.75);
  // Wavy bottom edge.
  const waves = 4;
  for (let i = 0; i < waves; i++) {
    const x1 = r - ((i + 0.5) * 2 * r) / waves;
    const x2 = r - ((i + 1) * 2 * r) / waves;
    ctx.quadraticCurveTo(x1, r * (i % 2 ? 1.15 : 0.75) + wobble, x2, r * 0.9);
  }
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(1, '#cfd8ff');
  ctx.fillStyle = body;
  ctx.shadowColor = 'rgba(200, 220, 255, 0.8)';
  ctx.shadowBlur = quality.glow ? 12 : 0;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = '#7d6aa8';
  ctx.stroke();

  // Face: big hollow eyes and a surprised "O". Hurt ghosts get X eyes.
  ctx.fillStyle = '#1b1028';
  if (hurt > 0.5) {
    ctx.strokeStyle = '#1b1028';
    ctx.lineWidth = r * 0.1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.35 - r * 0.12, -r * 0.3);
      ctx.lineTo(side * r * 0.35 + r * 0.12, -r * 0.06);
      ctx.moveTo(side * r * 0.35 + r * 0.12, -r * 0.3);
      ctx.lineTo(side * r * 0.35 - r * 0.12, -r * 0.06);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.35, -r * 0.18, r * 0.15, r * 0.22, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.14, r * 0.2, 0, 0, TAU);
  ctx.fill();
}

/** A bat: round body with pointy wings and ears, so it's easy to tell from a ghost. */
export function drawBat(ctx, r, { time = 0, hurt = 0 } = {}) {
  const flap = Math.sin(time * 10) * 0.35;
  ctx.fillStyle = '#2a1640';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.2);
    ctx.lineTo(r * 1.9, -r * 0.9);
    ctx.lineTo(r * 1.75, r * 0.05);
    ctx.lineTo(r * 1.4, -r * 0.1);
    ctx.lineTo(r * 1.2, r * 0.35);
    ctx.lineTo(r * 0.9, r * 0.1);
    ctx.lineTo(r * 0.6, r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = '#7b3fc4';
    ctx.stroke();
    ctx.restore();
  }
  // Ears.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.25, -r * 0.7);
    ctx.lineTo(side * r * 0.55, -r * 1.3);
    ctx.lineTo(side * r * 0.75, -r * 0.5);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = '#3d2058';
  ctx.fill();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = '#a259ff';
  ctx.stroke();
  // Glowing eyes and fangs.
  ctx.fillStyle = hurt > 0.5 ? '#ffffff' : '#ffd75e';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.35, -r * 0.15, r * 0.18, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.08, r * 0.3);
    ctx.lineTo(side * r * 0.2, r * 0.3);
    ctx.lineTo(side * r * 0.14, r * 0.55);
    ctx.fill();
  }
}

/** The boss: a big green phantom in a witch hat. */
export function drawPhantom(ctx, r, { time = 0, hurt = 0 } = {}) {
  ctx.save();
  ctx.scale(1, 1);
  drawGhostBody(ctx, r, time, '#c9ffd8', '#6bd38a');
  ctx.restore();
  // Angry glowing eyes.
  ctx.fillStyle = hurt > 0.5 ? '#ff3355' : '#29ff7a';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = quality.glow ? 10 : 0;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.12, -r * 0.18);
    ctx.lineTo(side * r * 0.55, -r * 0.32);
    ctx.lineTo(side * r * 0.45, -r * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#123a20';
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.1, r * 0.35, r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.55, -r * 0.35, r * 0.25);
  ctx.fill();
  // Witch hat.
  ctx.fillStyle = '#1a0d2b';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.82, r * 0.9, r * 0.16, -0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.85);
  ctx.lineTo(r * 0.25, -r * 1.85);
  ctx.lineTo(r * 0.5, -r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = THEME.pumpkin;
  ctx.fillRect(-r * 0.42, -r * 1.02, r * 0.88, r * 0.14);
}

function drawGhostBody(ctx, r, time, light, dark) {
  const wobble = Math.sin(time * 2) * r * 0.05;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.arc(0, -r * 0.05, r, Math.PI, 0);
  ctx.lineTo(r, r * 0.7);
  for (let i = 0; i < 5; i++) {
    const x1 = r - ((i + 0.5) * 2 * r) / 5;
    const x2 = r - ((i + 1) * 2 * r) / 5;
    ctx.quadraticCurveTo(x1, r * (i % 2 ? 1.1 : 0.72) + wobble, x2, r * 0.88);
  }
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, light);
  body.addColorStop(1, dark);
  ctx.fillStyle = body;
  ctx.shadowColor = dark;
  ctx.shadowBlur = quality.glow ? 16 : 0;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = '#1f5a33';
  ctx.stroke();
}

// --- Blocks ----------------------------------------------------------------

/** Cracks that grow as a block takes damage (0 = new, 1 = about to break). */
function drawCracks(ctx, width, height, seed, damage, color) {
  if (damage < 0.25) return;
  const random = seeded(seed + 0.37);
  const count = damage > 0.65 ? 3 : damage > 0.45 ? 2 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.min(width, height) * 0.08 + 0.02;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = (random() - 0.5) * width * 0.8;
    let y = (random() - 0.5) * height * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (random() - 0.5) * width * 0.5;
      y += (random() - 0.5) * height * 0.5;
      ctx.lineTo(Math.max(-width / 2, Math.min(width / 2, x)), Math.max(-height / 2, Math.min(height / 2, y)));
    }
    ctx.stroke();
  }
}

export function drawWood(ctx, width, height, { seed = 0, damage = 0 } = {}) {
  const thin = Math.min(width, height);
  const edge = Math.min(0.08, thin * 0.15);
  roundedRect(ctx, -width / 2, -height / 2, width, height, thin * 0.18);
  const along = width >= height;
  const grad = along
    ? ctx.createLinearGradient(0, -height / 2, 0, height / 2)
    : ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  grad.addColorStop(0, '#c98a4b');
  grad.addColorStop(0.5, '#a8682f');
  grad.addColorStop(1, '#7a4620');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = edge;
  ctx.strokeStyle = '#3b1f0c';
  ctx.stroke();

  // Wood grain lines along the long side.
  const random = seeded(seed);
  ctx.strokeStyle = 'rgba(59, 31, 12, 0.45)';
  ctx.lineWidth = thin * 0.05;
  for (let i = 0; i < 3; i++) {
    const offset = (random() - 0.5) * thin * 0.6;
    ctx.beginPath();
    if (along) {
      ctx.moveTo(-width / 2 + 0.1, offset);
      ctx.bezierCurveTo(-width / 6, offset + random() * 0.1, width / 6, offset - random() * 0.1, width / 2 - 0.1, offset);
    } else {
      ctx.moveTo(offset, -height / 2 + 0.1);
      ctx.bezierCurveTo(offset + random() * 0.1, -height / 6, offset - random() * 0.1, height / 6, offset, height / 2 - 0.1);
    }
    ctx.stroke();
  }
  // Nails at each end.
  ctx.fillStyle = '#2b2b33';
  const nail = thin * 0.09;
  const inset = Math.max(width, height) / 2 - thin * 0.35;
  for (const end of [-1, 1]) {
    ctx.beginPath();
    if (along) ctx.arc(end * inset, 0, nail, 0, TAU);
    else ctx.arc(0, end * inset, nail, 0, TAU);
    ctx.fill();
  }
  drawCracks(ctx, width, height, seed, damage, '#2a1407');
}

export function drawStone(ctx, width, height, { seed = 0, damage = 0 } = {}) {
  roundedRect(ctx, -width / 2, -height / 2, width, height, Math.min(width, height) * 0.12);
  const grad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  grad.addColorStop(0, '#8e86a3');
  grad.addColorStop(1, '#4f4863');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = '#231d33';
  ctx.stroke();

  // Brick lines, so stone reads as stone even without color.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(35, 29, 51, 0.6)';
  ctx.lineWidth = 0.05;
  const row = 0.55;
  const brick = 1.1;
  let rowIndex = 0;
  for (let y = -height / 2 + row; y < height / 2; y += row, rowIndex++) {
    ctx.beginPath();
    ctx.moveTo(-width / 2, y);
    ctx.lineTo(width / 2, y);
    ctx.stroke();
  }
  rowIndex = 0;
  for (let y = -height / 2; y < height / 2; y += row, rowIndex++) {
    for (let x = -width / 2 + (rowIndex % 2 ? brick / 2 : brick); x < width / 2; x += brick) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(y + row, height / 2));
      ctx.stroke();
    }
  }
  ctx.restore();
  drawCracks(ctx, width, height, seed, damage, '#120d1c');
}

export function drawTombstone(ctx, width, height, { seed = 0, damage = 0 } = {}) {
  const r = width / 2;
  ctx.beginPath();
  ctx.moveTo(-width / 2, height / 2);
  ctx.lineTo(-width / 2, -height / 2 + r);
  ctx.arc(0, -height / 2 + r, r, Math.PI, 0);
  ctx.lineTo(width / 2, height / 2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  grad.addColorStop(0, '#a49cb8');
  grad.addColorStop(1, '#5d5573');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = '#231d33';
  ctx.stroke();
  // "RIP" carved in. Some browsers draw tiny font sizes badly, so we draw the
  // text 100 times bigger on a canvas shrunk 100 times.
  ctx.fillStyle = 'rgba(35, 29, 51, 0.75)';
  ctx.save();
  ctx.scale(0.01, 0.01);
  ctx.font = `700 ${width * 34}px ${THEME.uiFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RIP', 0, -height * 8);
  ctx.restore();
  ctx.fillRect(-width * 0.28, height * 0.12, width * 0.56, 0.05);
  drawCracks(ctx, width, height, seed, damage, '#120d1c');
}

/** A carved jack-o'-lantern. It flickers, and it explodes when broken! */
export function drawJackOLantern(ctx, r, { time = 0, seed = 0, damage = 0 } = {}) {
  // Ribs: three overlapping ovals.
  for (const [x, w, shade] of [
    [-r * 0.45, r * 0.62, '#d9580f'],
    [r * 0.45, r * 0.62, '#d9580f'],
    [0, r * 0.68, THEME.pumpkin],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, r * 0.05, w, r * 0.92, 0, 0, TAU);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = '#7a2a05';
    ctx.stroke();
  }
  // Stem.
  ctx.fillStyle = '#3f6b2a';
  ctx.fillRect(-r * 0.1, -r * 1.05, r * 0.2, r * 0.3);

  // Glowing carved face that flickers like a candle.
  const flicker = 0.75 + 0.25 * Math.sin(time * 13 + seed * 50) * Math.sin(time * 7.3);
  ctx.fillStyle = `rgba(255, 225, 77, ${flicker})`;
  ctx.shadowColor = '#ffe14d';
  ctx.shadowBlur = quality.glow ? 14 * flicker : 0;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.5, -r * 0.05);
    ctx.lineTo(side * r * 0.2, -r * 0.05);
    ctx.lineTo(side * r * 0.35, -r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, r * 0.2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.55 + (i * r * 1.1) / 6, r * (i % 2 ? 0.32 : 0.2));
  ctx.quadraticCurveTo(0, r * 0.85, -r * 0.55, r * 0.2);
  ctx.fill();
  ctx.shadowBlur = 0;
  drawCracks(ctx, r * 1.6, r * 1.6, seed, damage, '#5a1e02');
}

// --- The slingshot -----------------------------------------------------------

/**
 * A slingshot made from a gnarled dead branch. `part` is 'back' (drawn behind
 * the panther) or 'front' (drawn in front of it). (0, 0) is where the panther
 * sits. `height` is the distance from there down to the ground.
 */
export function drawSlingshot(ctx, height, part) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bark = (width, color) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  if (part === 'back') {
    // Trunk and back prong.
    ctx.beginPath();
    ctx.moveTo(0.05, height);
    ctx.quadraticCurveTo(-0.15, height * 0.6, 0, height * 0.42);
    ctx.quadraticCurveTo(0.7, height * 0.25, 0.78, -0.35);
    bark(0.42, '#1a0f0a');
    bark(0.28, '#4a2f1c');
    // A little knot.
    ctx.beginPath();
    ctx.arc(-0.02, height * 0.7, 0.07, 0, TAU);
    ctx.fillStyle = '#1a0f0a';
    ctx.fill();
  } else {
    // Front prong.
    ctx.beginPath();
    ctx.moveTo(0, height * 0.42);
    ctx.quadraticCurveTo(-0.75, height * 0.25, -0.78, -0.3);
    bark(0.42, '#1a0f0a');
    bark(0.28, '#5c3b22');
    // Maroon wraps where the band ties on.
    ctx.fillStyle = THEME.maroon;
    ctx.fillRect(-0.97, -0.38, 0.38, 0.2);
    ctx.fillRect(0.59, -0.43, 0.38, 0.2);
  }
}

/** The stretchy band from the prong tip to the panther. */
export function drawBand(ctx, fromX, fromY, toX, toY, stretch) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineCap = 'round';
  // The band gets thinner as it stretches.
  ctx.lineWidth = 0.22 - stretch * 0.1;
  ctx.strokeStyle = THEME.maroon;
  ctx.stroke();
  ctx.lineWidth = 0.07 - stretch * 0.03;
  ctx.strokeStyle = THEME.gold;
  ctx.stroke();
}

// --- Lookup table ----------------------------------------------------------

// Maps the "drawn:<name>" values in config.js to the functions above.
// Round things take a radius; boxes take a width and height.
export const DRAWN_ART = {
  panther: { round: true, draw: drawPanther },
  ghost: { round: true, draw: drawGhost },
  bat: { round: true, draw: drawBat },
  phantom: { round: true, draw: drawPhantom },
  jackolantern: { round: true, draw: drawJackOLantern },
  wood: { round: false, draw: drawWood },
  stone: { round: false, draw: drawStone },
  tombstone: { round: false, draw: drawTombstone },
};
