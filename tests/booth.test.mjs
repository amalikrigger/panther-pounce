// Tests for the Boo Bash booth rules: the challenge run, prize tiers, the
// verification code, and the leaderboard.
// Run all tests with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Challenge, formatDuration } from '../src/core/challenge.js';
import { tierFor, nextTier, verificationCode, roundLabel, CODE_LENGTH } from '../src/core/prizes.js';
import { topEntries, qualifies, trimEntries, checkInitials } from '../src/core/leaderboard.js';
import { PRIZE_TIERS, CHALLENGE, LEADERBOARD } from '../src/config.js';
import { LEVELS } from '../src/levels/index.js';

// --- Challenge run ----------------------------------------------------------

test('a challenge plays every level once, win or lose, and adds the scores', () => {
  const run = new Challenge(['a', 'b', 'c'], 0);
  run.finishLevel({ score: 12000, won: true, stars: 2 }, 30000);
  assert.equal(run.currentLevelId, 'b');
  run.finishLevel({ score: 3000, won: false, stars: 0 }, 60000);
  assert.equal(run.isFinished, false);
  run.finishLevel({ score: 20000, won: true, stars: 3 }, 135000);

  assert.equal(run.isFinished, true);
  assert.equal(run.total, 35000);
  assert.equal(run.stars, 5);
  assert.equal(run.levelsCleared, 2);
  assert.equal(run.seconds(999999), 135, 'the clock stops when the run ends');
  assert.equal(formatDuration(135), '2:15');
});

test('extra results after the run ends are ignored', () => {
  const run = new Challenge(['a'], 0);
  run.finishLevel({ score: 100, won: true, stars: 1 }, 1000);
  run.finishLevel({ score: 99999, won: true, stars: 3 }, 2000);
  assert.equal(run.total, 100);
});

test('the default challenge levels all exist', () => {
  const ids = new Set(LEVELS.map((level) => level.id));
  for (const id of CHALLENGE.levels) assert.ok(ids.has(id), `CHALLENGE.levels names "${id}", which isn't in src/levels/`);
});

// --- Prize tiers ------------------------------------------------------------

test('the prize is the highest tier reached', () => {
  assert.equal(tierFor(PRIZE_TIERS[0].minScore - 1, PRIZE_TIERS), null);
  assert.equal(tierFor(PRIZE_TIERS[0].minScore, PRIZE_TIERS).id, 'bronze');
  assert.equal(tierFor(PRIZE_TIERS[2].minScore + 1, PRIZE_TIERS).id, 'gold');
  assert.equal(tierFor(10 ** 9, PRIZE_TIERS).id, 'legendary');
  assert.equal(nextTier(PRIZE_TIERS[1].minScore, PRIZE_TIERS).id, 'gold');
  assert.equal(nextTier(10 ** 9, PRIZE_TIERS), null);
});

test('prize tiers go up in order', () => {
  for (let i = 1; i < PRIZE_TIERS.length; i++) assert.ok(PRIZE_TIERS[i].minScore > PRIZE_TIERS[i - 1].minScore);
});

// --- Verification code ------------------------------------------------------

const prize = { eventWord: 'Pumpkins', station: 'B', round: 47, score: 31200, tierId: 'silver', date: '2026-10-30' };

test('the same prize always gets the same code, on any device', () => {
  const code = verificationCode(prize);
  assert.equal(code.length, CODE_LENGTH);
  assert.match(code, /^[ACDEFGHJKMNPQRTUVWXY34679]+$/, 'only easy-to-read characters');
  assert.equal(verificationCode({ ...prize }), code);
  assert.equal(verificationCode({ ...prize, eventWord: '  pumpkins ' }), code, 'event word ignores case and spaces');
});

test('changing anything about the prize changes the code', () => {
  const code = verificationCode(prize);
  for (const change of [{ score: 31300 }, { round: 48 }, { station: 'C' }, { tierId: 'gold' }, { date: '2026-10-31' }, { eventWord: 'BATS' }]) {
    assert.notEqual(verificationCode({ ...prize, ...change }), code, `changing ${Object.keys(change)[0]} should change the code`);
  }
});

test('round labels are padded', () => {
  assert.equal(roundLabel('B', 7), 'B-007');
});

// --- Leaderboard ------------------------------------------------------------

const entry = (initials, score, date = '2026-10-30', time = score) => ({ initials, score, mode: 'challenge', date, time });

test('the board is highest first, and the earlier score wins a tie', () => {
  const entries = [entry('AAA', 100, '2026-10-30', 5), entry('BBB', 300), entry('CCC', 100, '2026-10-30', 1)];
  assert.deepEqual(topEntries(entries, { mode: 'challenge', size: 10 }).map((e) => e.initials), ['BBB', 'CCC', 'AAA']);
});

test('a score qualifies for today even when it misses the all-time board', () => {
  const old = Array.from({ length: 10 }, (_, i) => entry('OLD', 50000 + i, '2026-10-29'));
  assert.equal(qualifies(old, { mode: 'challenge', size: 10, date: '2026-10-30', score: 100 }), true);
  assert.equal(qualifies(old, { mode: 'challenge', size: 10, date: '2026-10-30', score: 0 }), false, 'zero never qualifies');
});

test('trimming keeps all of today plus the best of all time', () => {
  const entries = [entry('OLD', 1, '2026-10-01'), entry('TOP', 999, '2026-10-01'), entry('NEW', 2, '2026-10-30')];
  const kept = trimEntries(entries, { keepPerMode: 1, date: '2026-10-30' }).map((e) => e.initials);
  assert.deepEqual(kept.sort(), ['NEW', 'TOP']);
});

test('initials must be 3 letters and not on the blocked list', () => {
  assert.equal(checkInitials('ABC', LEADERBOARD.blockedInitials), 'ok');
  assert.equal(checkInitials('AB', LEADERBOARD.blockedInitials), 'too-short');
  assert.equal(checkInitials('A1C', LEADERBOARD.blockedInitials), 'too-short');
  assert.equal(checkInitials(LEADERBOARD.blockedInitials[0], LEADERBOARD.blockedInitials), 'blocked');
});
