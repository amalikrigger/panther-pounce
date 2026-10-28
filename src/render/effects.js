// Particles and floating text: wood splinters, stone chips, ghost puffs,
// sparks and "+1000" scores. They only look nice; the physics never sees them.
//
// All particles live in world units (y up). There's a hard cap (EFFECTS.maxParticles)
// so a giant explosion can't slow an old tablet down.

import { EFFECTS, THEME } from '../config.js';
import { quality } from './quality.js';

const TAU = Math.PI * 2;
const GRAVITY = 12;

// Colors of the bits that fly off when each thing breaks.
const CHIP_COLORS = {
  wood: ['#c98a4b', '#a8682f', '#7a4620'],
  stone: ['#8e86a3', '#6a6282', '#4f4863'],
  tombstone: ['#a49cb8', '#6a6282'],
  pumpkin: [THEME.pumpkin, '#d9580f', '#ffe14d'],
};

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
  }

  add(particle) {
    // In low-power mode, skip some of the small bits (never the shockwave rings).
    if (particle.kind !== 'ring' && Math.random() > quality.particleScale) return;
    if (this.particles.length >= EFFECTS.maxParticles * quality.particleScale) this.particles.shift();
    this.particles.push(particle);
  }

  /** A fading dot left behind the flying panther. */
  trail(x, y, pounced) {
    this.add({
      kind: 'trail',
      x,
      y,
      vx: 0,
      vy: 0,
      size: pounced ? 0.32 : 0.18,
      color: pounced ? THEME.gold : 'rgba(199, 125, 255, 0.8)',
      life: pounced ? 0.6 : 0.45,
      age: 0,
    });
  }

  /** The burst when the panther pounces: gold streaks flying backwards. */
  pounceBurst(x, y, vx, vy) {
    const speed = Math.hypot(vx, vy) || 1;
    for (let i = 0; i < 16; i++) {
      const spread = (Math.random() - 0.5) * 1.2;
      const back = 4 + Math.random() * 6;
      const angle = Math.atan2(-vy, -vx) + spread;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * back + (vx / speed) * 2,
        vy: Math.sin(angle) * back + (vy / speed) * 2,
        size: 0.08 + Math.random() * 0.1,
        color: i % 3 ? THEME.gold : '#fff6d6',
        life: 0.4 + Math.random() * 0.3,
        age: 0,
      });
    }
    this.shockwave(x, y, 2);
  }

  /** Pieces flying off a broken block. */
  debris(x, y, material, size, vx = 0, vy = 0) {
    const colors = CHIP_COLORS[material] ?? CHIP_COLORS.wood;
    const count = Math.min(14, 5 + Math.round(size * 4));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 2 + Math.random() * 5;
      this.add({
        kind: 'chip',
        x: x + (Math.random() - 0.5) * size,
        y: y + (Math.random() - 0.5) * size,
        vx: Math.cos(angle) * speed + vx * 0.3,
        vy: Math.sin(angle) * speed + 2 + vy * 0.3,
        spin: (Math.random() - 0.5) * 12,
        rotation: Math.random() * TAU,
        size: 0.12 + Math.random() * 0.22,
        color: colors[i % colors.length],
        life: 0.9 + Math.random() * 0.6,
        age: 0,
      });
    }
  }

  /** A soft puff of spooky smoke (enemies vanishing, panther leaving). */
  puff(x, y, radius, color = 'rgba(220, 210, 255, 0.85)') {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TAU;
      const speed = 1 + Math.random() * 2;
      this.add({
        kind: 'puff',
        x: x + Math.cos(angle) * radius * 0.3,
        y: y + Math.sin(angle) * radius * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.8,
        size: radius * (0.4 + Math.random() * 0.4),
        color,
        life: 0.7 + Math.random() * 0.4,
        age: 0,
      });
    }
  }

  /** Bright sparks for big hits and explosions. */
  sparks(x, y, count, color = THEME.gold, speed = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        size: 0.06 + Math.random() * 0.08,
        color,
        life: 0.35 + Math.random() * 0.35,
        age: 0,
      });
    }
  }

  /** An expanding ring of light (explosions). */
  shockwave(x, y, radius) {
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, size: radius, color: '#ffe14d', life: 0.45, age: 0 });
  }

  /** Floating score text like "+1000". */
  text(x, y, label, color = THEME.gold, big = false) {
    this.texts.push({ x, y, label, color, big, age: 0, life: 1.1 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'chip' || p.kind === 'spark') p.vy -= GRAVITY * dt;
      if (p.kind === 'puff') {
        p.vx *= 1 - dt * 2.5;
        p.vy *= 1 - dt * 2.5;
      }
      // Chips bounce once on the ground and slide to a stop.
      if (p.kind === 'chip' && p.y < p.size / 2) {
        p.y = p.size / 2;
        p.vy = Math.abs(p.vy) * 0.3;
        p.vx *= 0.6;
      }
      if (p.rotation !== undefined) p.rotation += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const t of this.texts) {
      t.age += dt;
      t.y += dt * 1.2;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
  }

  /** Draw with the camera transform already applied (world units, y up). */
  draw(ctx) {
    for (const p of this.particles) {
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      if (p.kind === 'chip') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.25 * fade;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - fade * 0.8), 0, TAU);
        ctx.stroke();
      } else {
        const size = p.kind === 'puff' ? p.size * (1.4 - fade * 0.4) : p.size;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const t of this.texts) {
      const progress = t.age / t.life;
      // Pop in big, then shrink a little and fade away.
      const pop = progress < 0.15 ? 0.6 + (progress / 0.15) * 0.5 : 1.1 - progress * 0.2;
      ctx.save();
      ctx.translate(t.x, t.y);
      // Text is drawn 100× big on a canvas shrunk 100× (tiny font sizes look bad),
      // and flipped because the world's y axis points up.
      ctx.scale(0.01 * pop, -0.01 * pop);
      ctx.globalAlpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
      ctx.font = `${t.big ? 120 : 80}px ${THEME.displayFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = THEME.maroon;
      ctx.strokeText(t.label, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.label, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
