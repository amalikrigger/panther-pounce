// The spooky backdrop: night sky, stars, a giant harvest moon, and black
// silhouettes that change with the level's setting.
//
// It doesn't move, so we paint it once into a hidden canvas and copy that to
// the screen every frame. Repainting all these shapes 60 times a second would
// be slow on older tablets. It's repainted only when the screen size or the
// setting changes.
//
// Settings: 'graveyard', 'haunted-house', 'pumpkin-patch', 'campus'.
// These are made-up places; nothing here shows real school buildings.

import { THEME } from '../config.js';

const TAU = Math.PI * 2;

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export class Background {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.key = '';
  }

  /** Get the painted backdrop, repainting only if something changed. */
  get(width, height, pixelRatio, setting) {
    const key = `${width}x${height}@${pixelRatio}:${setting}`;
    if (key !== this.key) {
      this.key = key;
      this.canvas.width = Math.round(width * pixelRatio);
      this.canvas.height = Math.round(height * pixelRatio);
      const ctx = this.canvas.getContext('2d');
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      paint(ctx, width, height, setting);
    }
    return this.canvas;
  }
}

/**
 * Where the moon is on a screen of this size (CSS pixels). Staff mode is
 * opened by tapping it, so main.js needs to know.
 */
export function moonCircle(w, h) {
  return { x: w * 0.72, y: h * 0.3, radius: Math.min(w, h) * 0.2 };
}

function paint(ctx, w, h, setting) {
  const random = seeded(1031);
  const unit = Math.min(w, h);

  // Sky, darkest at the top with an orange glow along the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, THEME.skyTop);
  sky.addColorStop(0.6, THEME.skyBottom);
  sky.addColorStop(1, '#7a2a4f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars.
  for (let i = 0; i < 90; i++) {
    const size = random() * 1.6 + 0.4;
    ctx.globalAlpha = 0.35 + random() * 0.6;
    ctx.fillStyle = '#fff6d6';
    ctx.beginPath();
    ctx.arc(random() * w, random() * h * 0.6, size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The harvest moon with a soft glow.
  const { x: moonX, y: moonY, radius: moonR } = moonCircle(w, h);
  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 2.6);
  glow.addColorStop(0, 'rgba(255, 215, 94, 0.45)');
  glow.addColorStop(1, 'rgba(255, 215, 94, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const moon = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, moonR * 0.1, moonX, moonY, moonR);
  moon.addColorStop(0, '#fff3b0');
  moon.addColorStop(1, THEME.moon);
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(214, 160, 40, 0.35)';
  for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1], [0.35, -0.35, 0.07]]) {
    ctx.beginPath();
    ctx.arc(moonX + dx * moonR, moonY + dy * moonR, r * moonR, 0, TAU);
    ctx.fill();
  }

  // Bats flying past the moon.
  ctx.fillStyle = THEME.silhouette;
  for (const [dx, dy, s] of [[-0.6, -0.5, 1], [0.1, -0.9, 0.7], [0.9, -0.2, 0.85], [-1.4, 0.1, 0.6]]) {
    drawBatSilhouette(ctx, moonX + dx * moonR, moonY + dy * moonR, moonR * 0.16 * s);
  }

  // A spiderweb in the top-left corner, like on the Boo Bash flyer.
  drawSpiderweb(ctx, unit * 0.32);

  // Two layers of rolling hills.
  drawHills(ctx, w, h, h * 0.72, '#2a0f45', random, 3);
  drawSetting(ctx, w, h, setting, random);
  drawHills(ctx, w, h, h * 0.84, '#160828', random, 4);

  // Low fog along the ground.
  const fog = ctx.createLinearGradient(0, h * 0.75, 0, h);
  fog.addColorStop(0, 'rgba(180, 150, 220, 0)');
  fog.addColorStop(1, 'rgba(180, 150, 220, 0.18)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}

function drawHills(ctx, w, h, baseY, color, random, bumps) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  const step = w / bumps;
  for (let i = 0; i < bumps; i++) {
    const peak = baseY - (0.03 + random() * 0.06) * h;
    ctx.quadraticCurveTo(i * step + step / 2, peak, (i + 1) * step, baseY + (random() - 0.5) * h * 0.03);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawBatSilhouette(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - s * 1.2, y - s * 1.1, x - s * 2.6, y - s * 0.4);
  ctx.quadraticCurveTo(x - s * 1.6, y - s * 0.2, x - s * 1.5, y + s * 0.4);
  ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.1, x, y + s * 0.5);
  ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.1, x + s * 1.5, y + s * 0.4);
  ctx.quadraticCurveTo(x + s * 1.6, y - s * 0.2, x + s * 2.6, y - s * 0.4);
  ctx.quadraticCurveTo(x + s * 1.2, y - s * 1.1, x, y);
  ctx.fill();
}

function drawSpiderweb(ctx, size) {
  ctx.strokeStyle = 'rgba(255, 246, 214, 0.22)';
  ctx.lineWidth = 1.2;
  const spokes = 6;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.stroke();
  }
  for (let ring = 1; ring <= 5; ring++) {
    const r = (ring / 5) * size;
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * (Math.PI / 2);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Sag the thread toward the corner between spokes.
        const mid = ((i - 0.5) / spokes) * (Math.PI / 2);
        ctx.quadraticCurveTo(Math.cos(mid) * r * 0.85, Math.sin(mid) * r * 0.85, x, y);
      }
    }
    ctx.stroke();
  }
}

// --- One silhouette scene per setting --------------------------------------

function drawSetting(ctx, w, h, setting, random) {
  ctx.fillStyle = THEME.silhouette;
  const ground = h * 0.78;
  const unit = Math.min(w, h);
  switch (setting) {
    case 'haunted-house':
      drawHouse(ctx, w * 0.3, ground, unit * 0.55);
      drawDeadTree(ctx, w * 0.08, ground, unit * 0.4);
      break;
    case 'pumpkin-patch':
      drawScarecrow(ctx, w * 0.25, ground, unit * 0.3);
      for (let i = 0; i < 9; i++) drawPumpkinSilhouette(ctx, w * (0.05 + i * 0.11), ground + unit * 0.02 * (i % 2), unit * (0.035 + random() * 0.02));
      drawDeadTree(ctx, w * 0.92, ground, unit * 0.35);
      break;
    case 'campus':
      drawClockTower(ctx, w * 0.32, ground, unit * 0.6);
      drawDeadTree(ctx, w * 0.07, ground, unit * 0.32);
      break;
    case 'graveyard':
    default:
      drawDeadTree(ctx, w * 0.12, ground, unit * 0.45);
      for (let i = 0; i < 8; i++) drawGraveSilhouette(ctx, w * (0.22 + i * 0.1), ground + unit * 0.01, unit * (0.04 + random() * 0.03), i % 3 === 0);
      drawFence(ctx, w * 0.55, ground, w * 0.45, unit * 0.08);
  }
}

function drawDeadTree(ctx, x, groundY, size) {
  ctx.strokeStyle = THEME.silhouette;
  ctx.lineCap = 'round';
  const branch = (bx, by, angle, length, width, depth) => {
    const ex = bx + Math.cos(angle) * length;
    const ey = by + Math.sin(angle) * length;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(angle + 0.3) * length * 0.5, by + Math.sin(angle + 0.3) * length * 0.5, ex, ey);
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, angle - 0.5, length * 0.7, width * 0.6, depth - 1);
      branch(ex, ey, angle + 0.45, length * 0.62, width * 0.6, depth - 1);
    }
  };
  branch(x, groundY, -Math.PI / 2, size * 0.45, size * 0.07, 4);
}

function drawGraveSilhouette(ctx, x, groundY, size, cross) {
  if (cross) {
    ctx.fillRect(x - size * 0.12, groundY - size * 1.6, size * 0.24, size * 1.6);
    ctx.fillRect(x - size * 0.5, groundY - size * 1.2, size, size * 0.24);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, groundY);
    ctx.lineTo(x - size * 0.5, groundY - size * 0.9);
    ctx.arc(x, groundY - size * 0.9, size * 0.5, Math.PI, 0);
    ctx.lineTo(x + size * 0.5, groundY);
    ctx.fill();
  }
}

function drawFence(ctx, x, groundY, width, height) {
  const gap = height * 0.45;
  ctx.fillRect(x, groundY - height * 0.75, width, height * 0.07);
  ctx.fillRect(x, groundY - height * 0.3, width, height * 0.07);
  for (let px = x; px < x + width; px += gap) {
    ctx.beginPath();
    ctx.moveTo(px - height * 0.05, groundY);
    ctx.lineTo(px - height * 0.05, groundY - height * 0.9);
    ctx.lineTo(px, groundY - height * 1.05);
    ctx.lineTo(px + height * 0.05, groundY - height * 0.9);
    ctx.lineTo(px + height * 0.05, groundY);
    ctx.fill();
  }
}

function drawHouse(ctx, x, groundY, size) {
  const s = size;
  ctx.beginPath();
  // Main house, a crooked roof, and a tall tower on the right.
  ctx.moveTo(x - s * 0.45, groundY);
  ctx.lineTo(x - s * 0.45, groundY - s * 0.45);
  ctx.lineTo(x - s * 0.52, groundY - s * 0.45);
  ctx.lineTo(x - s * 0.1, groundY - s * 0.82);
  ctx.lineTo(x + s * 0.2, groundY - s * 0.55);
  ctx.lineTo(x + s * 0.2, groundY - s * 0.75);
  ctx.lineTo(x + s * 0.15, groundY - s * 0.75);
  ctx.lineTo(x + s * 0.32, groundY - s * 1.1);
  ctx.lineTo(x + s * 0.49, groundY - s * 0.75);
  ctx.lineTo(x + s * 0.44, groundY - s * 0.75);
  ctx.lineTo(x + s * 0.44, groundY);
  ctx.closePath();
  ctx.fill();
  // Lit windows.
  ctx.fillStyle = '#ffd75e';
  for (const [wx, wy] of [[-0.3, -0.33], [-0.1, -0.33], [-0.2, -0.55], [0.3, -0.62], [0.3, -0.4]]) {
    ctx.fillRect(x + wx * s - s * 0.035, groundY + wy * s - s * 0.05, s * 0.07, s * 0.1);
  }
  ctx.fillStyle = THEME.silhouette;
}

function drawPumpkinSilhouette(ctx, x, groundY, r) {
  ctx.beginPath();
  ctx.ellipse(x, groundY - r * 0.8, r * 1.2, r * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - r * 0.1, groundY - r * 1.9, r * 0.2, r * 0.4);
  ctx.fillStyle = 'rgba(255, 122, 26, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, groundY - r * 0.7);
  ctx.quadraticCurveTo(x, groundY - r * 0.2, x + r * 0.5, groundY - r * 0.7);
  ctx.fill();
  ctx.fillStyle = THEME.silhouette;
}

function drawScarecrow(ctx, x, groundY, size) {
  ctx.fillRect(x - size * 0.03, groundY - size, size * 0.06, size);
  ctx.fillRect(x - size * 0.35, groundY - size * 0.75, size * 0.7, size * 0.05);
  ctx.beginPath();
  ctx.arc(x, groundY - size * 0.95, size * 0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.2, groundY - size * 1.02);
  ctx.lineTo(x, groundY - size * 1.25);
  ctx.lineTo(x + size * 0.2, groundY - size * 1.02);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.2, groundY - size * 0.72);
  ctx.lineTo(x + size * 0.2, groundY - size * 0.72);
  ctx.lineTo(x + size * 0.14, groundY - size * 0.4);
  ctx.lineTo(x - size * 0.14, groundY - size * 0.4);
  ctx.fill();
}

function drawClockTower(ctx, x, groundY, size) {
  const s = size;
  ctx.fillRect(x - s * 0.5, groundY - s * 0.32, s * 1.0, s * 0.32);
  ctx.fillRect(x - s * 0.1, groundY - s * 0.75, s * 0.2, s * 0.45);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.13, groundY - s * 0.75);
  ctx.lineTo(x, groundY - s * 0.95);
  ctx.lineTo(x + s * 0.13, groundY - s * 0.75);
  ctx.fill();
  // Clock face stuck at almost midnight.
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(x, groundY - s * 0.6, s * 0.06, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = THEME.silhouette;
  ctx.lineWidth = s * 0.01;
  ctx.beginPath();
  ctx.moveTo(x, groundY - s * 0.6);
  ctx.lineTo(x, groundY - s * 0.65);
  ctx.moveTo(x, groundY - s * 0.6);
  ctx.lineTo(x - s * 0.02, groundY - s * 0.64);
  ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - s * 0.42 + i * s * 0.15, groundY - s * 0.22, s * 0.06, s * 0.09);
  ctx.fillStyle = THEME.silhouette;
}
