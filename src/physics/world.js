// The physics world: turns a level (plain data) into Planck.js bodies, steps
// the simulation, and reports what happened as a list of events, for example
// { type: 'enemy-defeated', ... }. It never draws anything or plays sounds.
// main.js and the renderer decide what those events look and sound like.
//
// Coordinates are world units with y pointing UP and the ground at y = 0, the
// same as the level files.

import { World, Vec2, Box, Circle, Edge } from '../../vendor/planck-1.5.0/planck.mjs';

const DEG_TO_RAD = Math.PI / 180;

export class PhysicsWorld {
  /**
   * @param level      one level object from src/levels/
   * @param settings   { physics, materials, enemies, panther, damage }, from config.js
   */
  constructor(level, settings) {
    this.settings = settings;
    this.world = new World({ gravity: Vec2(0, -settings.physics.gravity) });
    this.entities = []; // every block, enemy and panther, for drawing
    this.events = [];
    this.pendingDamage = new Map(); // entity -> damage, applied after each step
    this.time = 0;
    this.nextId = 1;

    this.createGround();
    for (const block of level.blocks) this.addBlock(block);
    for (const enemy of level.enemies) this.addEnemy(enemy);

    this.bounds = this.measureBounds();
    this.world.on('post-solve', (contact, impulse) => this.onHit(contact, impulse));
  }

  // --- Building the level ---------------------------------------------------

  createGround() {
    const ground = this.world.createBody({ type: 'static' });
    ground.createFixture({ shape: new Edge(Vec2(-200, 0), Vec2(400, 0)), friction: 0.9 });
    ground.setUserData({ kind: 'ground' });
  }

  addBlock(spec) {
    const material = this.settings.materials[spec.material];
    if (!material) throw new Error(`Unknown material "${spec.material}" in a level. Check MATERIALS in config.js.`);

    const isCircle = material.shape === 'circle';
    const radius = spec.radius ?? 0.6;
    const width = isCircle ? radius * 2 : spec.width;
    const height = isCircle ? radius * 2 : spec.height;
    // Levels give the BOTTOM of each block (easier for stacking); Planck wants the center.
    const body = this.world.createBody({
      type: spec.fixed ? 'static' : 'dynamic',
      position: Vec2(spec.x, spec.y + height / 2),
      angle: (spec.angle ?? 0) * DEG_TO_RAD,
    });
    body.createFixture({
      shape: isCircle ? new Circle(radius) : new Box(width / 2, height / 2),
      density: material.density,
      friction: material.friction,
      restitution: material.bounce,
    });
    // Round blocks would roll for ages; a little drag lets shots end sooner.
    if (isCircle) body.setAngularDamping(1.5);
    return this.track(body, {
      kind: 'block',
      material: spec.material,
      shape: isCircle ? 'circle' : 'box',
      width,
      height,
      radius,
      fixed: Boolean(spec.fixed),
      health: spec.fixed ? Infinity : material.health,
      maxHealth: material.health,
    });
  }

  addEnemy(spec) {
    const type = this.settings.enemies[spec.type];
    if (!type) throw new Error(`Unknown enemy "${spec.type}" in a level. Check ENEMIES in config.js.`);
    const body = this.world.createBody({ type: 'dynamic', position: Vec2(spec.x, spec.y + type.radius) });
    body.createFixture({ shape: new Circle(type.radius), density: type.density, friction: 0.6, restitution: 0.15 });
    // Enemies roll less, so they sit nicely in their nooks.
    body.setAngularDamping(2);
    return this.track(body, {
      kind: 'enemy',
      type: spec.type,
      shape: 'circle',
      radius: type.radius,
      health: type.health,
      maxHealth: type.health,
    });
  }

  /** Launch a panther from `position` with `velocity` (both {x, y}). */
  launchPanther(position, velocity) {
    const p = this.settings.panther;
    const body = this.world.createBody({ type: 'dynamic', position: Vec2(position.x, position.y), bullet: true });
    body.createFixture({ shape: new Circle(p.radius), density: p.density, friction: p.friction, restitution: p.bounce });
    body.setAngularDamping(p.rollingDrag);
    body.setLinearVelocity(Vec2(velocity.x, velocity.y));
    // A little spin looks more alive than a sliding ball.
    body.setAngularVelocity(-velocity.x * 0.3);
    return this.track(body, { kind: 'panther', shape: 'circle', radius: p.radius, health: Infinity, maxHealth: Infinity });
  }

  track(body, entity) {
    entity.id = this.nextId++;
    entity.body = body;
    entity.alive = true;
    // A random number per entity so drawn details (wood grain, cracks) stay the same every frame.
    entity.seed = Math.random();
    const pos = body.getPosition();
    entity.prev = { x: pos.x, y: pos.y, angle: body.getAngle() };
    body.setUserData(entity);
    this.entities.push(entity);
    return entity;
  }

  /** The area the level's structure covers, used to frame the camera. */
  measureBounds() {
    let left = Infinity;
    let right = -Infinity;
    let top = 0;
    for (const e of this.entities) {
      const { x, y } = e.body.getPosition();
      const half = Math.max(e.width ?? e.radius * 2, e.height ?? e.radius * 2) / 2;
      left = Math.min(left, x - half);
      right = Math.max(right, x + half);
      top = Math.max(top, y + half);
    }
    return { left, right, top };
  }

  // --- Running the simulation -------------------------------------------------

  /** Advance one fixed step. Returns the events that happened during it. */
  step(dt) {
    for (const e of this.entities) {
      const pos = e.body.getPosition();
      e.prev.x = pos.x;
      e.prev.y = pos.y;
      e.prev.angle = e.body.getAngle();
    }

    this.world.step(dt, 8, 3);
    this.time += dt;

    // Bodies can't be destroyed inside Planck's callbacks, so damage collected
    // during the step is applied here, after it.
    for (const [entity, damage] of this.pendingDamage) this.damage(entity, damage);
    this.pendingDamage.clear();
    this.removeFallen();

    const events = this.events;
    this.events = [];
    return events;
  }

  /** Planck calls this after it resolves each contact, with how hard the two bodies pushed. */
  onHit(contact, impulse) {
    const a = contact.getFixtureA().getBody().getUserData();
    const b = contact.getFixtureB().getBody().getUserData();
    const strength = impulse.normalImpulses.reduce((sum, value) => sum + value, 0);
    const { ignoreBelow, pantherMultiplier, bigHit } = this.settings.damage;
    if (strength <= ignoreBelow) return;

    // Report the hit for sound and effects, even during the settle time.
    const anyPanther = a?.kind === 'panther' || b?.kind === 'panther';
    if (strength > 2.5 || anyPanther) {
      const point = contact.getWorldManifold(null)?.points?.[0] ?? a.body.getPosition();
      this.events.push({
        type: 'hit',
        x: point.x,
        y: point.y,
        strength,
        big: strength > bigHit,
        materials: [a?.material ?? a?.kind, b?.material ?? b?.kind],
      });
    }

    if (this.time < this.settings.physics.settleSeconds) return;
    const damage = (strength - ignoreBelow) * (anyPanther ? pantherMultiplier : 1);
    for (const entity of [a, b]) {
      if (entity?.alive && entity.health !== Infinity) {
        this.pendingDamage.set(entity, (this.pendingDamage.get(entity) ?? 0) + damage);
      }
    }
  }

  damage(entity, amount) {
    if (!entity.alive) return;
    entity.health -= amount;
    if (entity.health <= 0) this.destroy(entity, 'broken');
  }

  /** Remove an entity. `reason` is 'broken', 'fell' or 'cleanup'. */
  destroy(entity, reason) {
    if (!entity.alive) return;
    entity.alive = false;
    const { x, y } = entity.body.getPosition();
    const velocity = entity.body.getLinearVelocity();
    this.world.destroyBody(entity.body);
    this.entities.splice(this.entities.indexOf(entity), 1);

    const event = { x, y, vx: velocity.x, vy: velocity.y, angle: entity.body.getAngle(), entity, reason };
    if (entity.kind === 'enemy') {
      this.events.push({ type: 'enemy-defeated', ...event });
    } else if (entity.kind === 'block' && reason !== 'cleanup') {
      this.events.push({ type: 'block-broken', ...event });
      const explosion = this.settings.materials[entity.material].explodes;
      if (explosion && reason === 'broken') this.explode(x, y, explosion);
    }
  }

  /** Push and damage everything near (x, y). Jack-o'-lanterns use this. */
  explode(x, y, { radius, power }) {
    this.events.push({ type: 'explosion', x, y, radius });
    for (const entity of [...this.entities]) {
      if (!entity.alive || entity.fixed) continue;
      const pos = entity.body.getPosition();
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      // Closer things get pushed harder. The +0.5 avoids dividing by zero.
      const falloff = 1 - distance / radius;
      const push = power * falloff * entity.body.getMass();
      const nx = dx / (distance + 0.0001);
      const ny = dy / (distance + 0.0001) + 0.35; // a little upward kick looks better
      entity.body.applyLinearImpulse(Vec2(nx * push, ny * push), entity.body.getWorldCenter(), true);
      if (entity.health !== Infinity) {
        this.pendingDamage.set(entity, (this.pendingDamage.get(entity) ?? 0) + power * falloff * 1.5);
      }
    }
  }

  removeFallen() {
    const margin = this.settings.physics.removeMargin;
    for (const entity of [...this.entities]) {
      const { x, y } = entity.body.getPosition();
      if (y < -5 || x < this.bounds.left - margin - 20 || x > this.bounds.right + margin) {
        this.destroy(entity, entity.kind === 'enemy' ? 'fell' : 'cleanup');
      }
    }
  }

  /** True when nothing is moving faster than `speed`. */
  isQuiet(speed) {
    for (const entity of this.entities) {
      if (!entity.body.isAwake()) continue;
      const v = entity.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > speed || Math.abs(entity.body.getAngularVelocity()) > speed * 2) return false;
    }
    return true;
  }

  enemiesLeft() {
    return this.entities.filter((e) => e.kind === 'enemy').length;
  }
}
