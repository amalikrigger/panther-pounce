// Draws one frame: backdrop, ground, slingshot, every block and enemy, the
// panther, the aiming dots and the effects.
//
// The renderer only READS the game; it never changes it. `alpha` (0..1) says
// how far we are between the last two physics steps, so we can draw bodies
// in between and keep motion smooth on fast screens.

import { THEME, PANTHER, MATERIALS, ENEMIES, SLINGSHOT, PHYSICS } from '../config.js';
import { Background } from './background.js';
import { drawSlingshot, drawBand } from './art.js';
import { drawRound, drawBox } from './sprites.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.background = new Background();
  }

  /**
   * @param scene {
   *   camera, effects, setting, time, alpha,
   *   physics      the PhysicsWorld (or null on menus)
   *   sling        { pantherVisible, pull: {x, y}, aiming, reload (0..1) }
   *   trajectory   list of {x, y} points, or null
   * }
   */
  draw(scene) {
    const { ctx, canvas } = this;
    const { camera } = scene;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.background.get(camera.screenWidth, camera.screenHeight, camera.pixelRatio, scene.setting), 0, 0, canvas.width, canvas.height);

    camera.applyTransform(ctx);
    const view = camera.visibleRect();
    this.drawGround(ctx, view);
    this.drawSling(ctx, scene, 'back');
    if (scene.physics) this.drawEntities(ctx, scene);
    this.drawSling(ctx, scene, 'front');
    if (scene.trajectory) this.drawTrajectory(ctx, scene.trajectory);
    scene.effects.draw(ctx);
  }

  drawGround(ctx, view) {
    const left = view.left - 2;
    const width = view.right - view.left + 4;
    const depth = Math.max(2, -view.bottom + 2);
    const soil = ctx.createLinearGradient(0, 0, 0, -depth);
    soil.addColorStop(0, '#2b1830');
    soil.addColorStop(1, THEME.ground);
    ctx.fillStyle = soil;
    ctx.fillRect(left, -depth, width, depth);

    // A strip of dead grass with little tufts on top.
    ctx.fillStyle = THEME.groundEdge;
    ctx.fillRect(left, -0.18, width, 0.18);
    ctx.fillStyle = '#4d3a20';
    for (let x = Math.floor(left); x < view.right + 2; x += 0.7) {
      // The tuft pattern depends only on x, so it doesn't move.
      const h = 0.12 + ((Math.sin(x * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.18;
      ctx.beginPath();
      ctx.moveTo(x - 0.08, 0);
      ctx.lineTo(x, h);
      ctx.lineTo(x + 0.08, 0);
      ctx.fill();
    }
  }

  drawSling(ctx, scene, part) {
    const { sling } = scene;
    const anchorX = SLINGSHOT.x;
    const anchorY = SLINGSHOT.y;
    // Prong tips, relative to where the panther sits.
    const backTip = { x: anchorX + 0.78, y: anchorY + 0.3 };
    const frontTip = { x: anchorX - 0.78, y: anchorY + 0.25 };
    const pantherX = anchorX + (sling?.pull?.x ?? 0);
    const pantherY = anchorY + (sling?.pull?.y ?? 0);
    const stretch = Math.hypot(sling?.pull?.x ?? 0, sling?.pull?.y ?? 0) / SLINGSHOT.maxPull;

    if (part === 'back') {
      this.withLocal(ctx, anchorX, anchorY, 0, () => drawSlingshot(ctx, anchorY, 'back'));
      if (sling?.pantherVisible) {
        // The band wraps behind the panther, from the back prong.
        drawBand(ctx, backTip.x, backTip.y, pantherX - PANTHER.radius * 0.6, pantherY, stretch);
        const hop = sling.reload < 1 ? Math.sin(sling.reload * Math.PI) * 1.2 : 0;
        const pantherInterp = { x: pantherX, y: pantherY + hop };
        this.withLocal(ctx, pantherInterp.x, pantherInterp.y, sling.aiming ? 0 : Math.sin(scene.time * 2) * 0.05, () =>
          drawRound(ctx, PANTHER.art, 'panther', PANTHER.radius, { blink: blinkAmount(scene.time), squint: sling.aiming }),
        );
      }
    } else {
      if (sling?.pantherVisible) drawBand(ctx, frontTip.x, frontTip.y, pantherX - PANTHER.radius * 0.6, pantherY, stretch);
      this.withLocal(ctx, anchorX, anchorY, 0, () => drawSlingshot(ctx, anchorY, 'front'));
    }
  }

  drawEntities(ctx, scene) {
    const { physics, alpha, time } = scene;
    for (const entity of physics.entities) {
      const pos = entity.body.getPosition();
      const angle = entity.body.getAngle();
      const x = entity.prev.x + (pos.x - entity.prev.x) * alpha;
      const y = entity.prev.y + (pos.y - entity.prev.y) * alpha;
      const a = entity.prev.angle + (angle - entity.prev.angle) * alpha;
      const damage = entity.maxHealth === Infinity ? 0 : 1 - Math.max(0, entity.health) / entity.maxHealth;
      const options = { time: time + entity.seed * 10, seed: entity.seed, damage, hurt: damage };

      this.withLocal(ctx, x, y, a, () => {
        if (entity.kind === 'panther') {
          drawRound(ctx, PANTHER.art, 'panther', entity.radius, { squint: true });
        } else if (entity.kind === 'enemy') {
          // Enemies stay upright so their faces are readable while they roll.
          ctx.rotate(-a);
          drawRound(ctx, ENEMIES[entity.type].art, entity.type, entity.radius, options);
        } else if (entity.shape === 'circle') {
          drawRound(ctx, MATERIALS[entity.material].art, 'jackolantern', entity.radius, options);
        } else {
          drawBox(ctx, MATERIALS[entity.material].art, entity.material, entity.width, entity.height, options);
        }
      });
    }
  }

  drawTrajectory(ctx, points) {
    for (let i = 0; i < points.length; i++) {
      const fade = 1 - i / points.length;
      ctx.globalAlpha = 0.25 + fade * 0.75;
      ctx.fillStyle = i % 2 ? THEME.gold : '#fff6d6';
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 0.06 + fade * 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Move to (x, y), rotate, and flip y so art functions can draw "normally"
   * (y down) around (0, 0).
   */
  withLocal(ctx, x, y, angle, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, -1);
    draw();
    ctx.restore();
  }
}

/** The panther blinks for a moment every few seconds. */
function blinkAmount(time) {
  const phase = time % 3.7;
  return phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : 0;
}

/** Points along the path a panther launched with this speed would follow. */
export function predictPath(start, velocity, seconds) {
  const points = [];
  const step = 0.05;
  for (let t = step; t <= seconds; t += step) {
    points.push({
      x: start.x + velocity.x * t,
      y: start.y + velocity.y * t - 0.5 * PHYSICS.gravity * t * t,
    });
  }
  return points;
}
