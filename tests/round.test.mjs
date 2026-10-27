// Tests for the turn, score and star rules in src/core/round.js.
// Run all tests with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round, starsFor } from '../src/core/round.js';

const level = { panthers: 3, enemies: [{}, {}], par: { twoStars: 9000, threeStars: 13000 } };
const scoring = { unusedPanther: 5000 };

test('clearing every enemy wins after the dust settles, with a bonus for unused panthers', () => {
  const round = new Round(level, scoring);
  round.launch();
  round.enemyDefeated(1000);
  round.blockBroken(100);
  round.enemyDefeated(1000);
  assert.equal(round.state, 'cleared', 'waits for things to stop moving before winning');

  round.blockBroken(250); // debris still falling counts
  assert.equal(round.shotSettled(), 'won');
  assert.equal(round.breakdown.pantherBonus, 2 * 5000);
  assert.equal(round.score, 1000 + 100 + 1000 + 250 + 10000);
  assert.equal(round.stars, 2);
});

test('running out of panthers with enemies left loses', () => {
  const round = new Round(level, scoring);
  for (let shot = 0; shot < 3; shot++) {
    assert.ok(round.launch());
    round.blockBroken(100);
    round.shotSettled();
  }
  assert.equal(round.state, 'lost');
  assert.equal(round.panthersLeft, 0);
  assert.equal(round.stars, 0);
});

test('you cannot launch while a shot is in flight', () => {
  const round = new Round(level, scoring);
  assert.ok(round.launch());
  assert.equal(round.launch(), false);
  assert.equal(round.panthersLeft, 2);
});

test('a ghost that falls after the shot ended still wins the level', () => {
  const round = new Round(level, scoring);
  round.launch();
  round.enemyDefeated(1000);
  assert.equal(round.shotSettled(), 'ready');
  round.enemyDefeated(1000); // knocked loose by settling debris
  assert.equal(round.state, 'cleared');
  assert.equal(round.shotSettled(), 'won');
});

test('nothing scores after the round is over', () => {
  const round = new Round({ ...level, panthers: 1 }, scoring);
  round.launch();
  round.shotSettled();
  round.blockBroken(500);
  assert.equal(round.score, 0);
});

test('stars come from the par scores, and clearing always earns at least one', () => {
  const par = { twoStars: 9000, threeStars: 13000 };
  assert.equal(starsFor(0, par), 1);
  assert.equal(starsFor(8999, par), 1);
  assert.equal(starsFor(9000, par), 2);
  assert.equal(starsFor(13000, par), 3);
});
