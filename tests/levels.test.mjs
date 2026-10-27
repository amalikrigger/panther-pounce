// Checks every level in src/levels/ with the real physics:
//   - it only uses materials and enemies that exist in config.js
//   - its structure stands up by itself (nothing falls or breaks before you shoot)
//   - its par scores make sense
//
// If you made a new level and this test fails, it tells you which level and why.
// Run all tests with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels/index.js';
import { PHYSICS, MATERIALS, ENEMIES, PANTHER, DAMAGE } from '../src/config.js';
import { PhysicsWorld } from '../src/physics/world.js';

const settings = { physics: PHYSICS, materials: MATERIALS, enemies: ENEMIES, panther: PANTHER, damage: DAMAGE };

test('level ids are unique', () => {
  const ids = LEVELS.map((level) => level.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const level of LEVELS) {
  test(`${level.name}: valid data`, () => {
    assert.ok(level.panthers >= 1, 'needs at least one panther');
    assert.ok(level.enemies.length >= 1, 'needs at least one enemy');
    assert.ok(level.par.threeStars > level.par.twoStars, 'threeStars must be more than twoStars');
    for (const block of level.blocks) assert.ok(MATERIALS[block.material], `unknown material "${block.material}"`);
    for (const enemy of level.enemies) assert.ok(ENEMIES[enemy.type], `unknown enemy "${enemy.type}"`);
  });

  test(`${level.name}: stands up by itself for 10 seconds`, () => {
    const world = new PhysicsWorld(level, settings);
    const start = world.entities.map((entity) => ({ entity, ...entity.body.getPosition() }));
    const events = [];
    for (let i = 0; i < 600; i++) events.push(...world.step(1 / 60));

    const broken = events.filter((event) => event.type !== 'hit');
    assert.equal(broken.length, 0, `something broke or fell on its own: ${broken.map((e) => e.type).join(', ')}`);
    for (const { entity, x, y } of start) {
      const now = entity.body.getPosition();
      const moved = Math.hypot(now.x - x, now.y - y);
      assert.ok(moved < 0.2, `a ${entity.material ?? entity.type} at x=${x.toFixed(1)} slid ${moved.toFixed(2)} units. Is it resting on something?`);
    }
  });
}
