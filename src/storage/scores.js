// Saves leaderboard entries and the prize log on this device.
//
// Leaderboard entry: { initials, score, mode, date, time }
// Prize log entry:   { station, round, score, tierId, code, date, time, claimedAt }
// No names or personal details, ever.

import { LEADERBOARD } from '../config.js';
import { topEntries, qualifies, trimEntries, localDate } from '../core/leaderboard.js';
import { load, save, remove } from './store.js';

// Only the Boo Bash Challenge has a leaderboard (free play saves per-level
// bests instead). The mode is still stored so a second board could be added.
export const MODE = 'challenge';

// How many all-time scores to keep (today's are always kept).
const KEEP_PER_MODE = 50;
const PRIZE_LOG_SIZE = 200;

let entries = load('scores', []);
let prizeLog = load('prizes', []);

// --- Leaderboard -----------------------------------------------------------------

export function board({ todayOnly = false } = {}) {
  return topEntries(entries, { mode: MODE, size: LEADERBOARD.size, date: todayOnly ? localDate() : undefined });
}

export function scoreQualifies(score) {
  return qualifies(entries, { mode: MODE, size: LEADERBOARD.size, date: localDate(), score });
}

export function addScore({ initials, score }) {
  const time = Date.now();
  const entry = { initials, score, mode: MODE, date: localDate(time), time };
  entries = trimEntries([...entries, entry], { keepPerMode: KEEP_PER_MODE, date: localDate(time) });
  save('scores', entries);
  return entry;
}

/** The best entry today, or null. */
export const todaysBest = () => board({ todayOnly: true })[0] ?? null;

export function resetScores() {
  entries = [];
  remove('scores');
}

// --- Round numbers and the prize log -----------------------------------------------

/** Each Challenge run on this device gets the next number, for the prize screen. */
export function nextRoundNumber() {
  const round = load('roundCounter', 0) + 1;
  save('roundCounter', round);
  return round;
}

export function logPrize(prize) {
  prizeLog = [prize, ...prizeLog].slice(0, PRIZE_LOG_SIZE);
  save('prizes', prizeLog);
}

export function findPrize(station, round) {
  return prizeLog.find((p) => p.station === station && p.round === round) ?? null;
}

export function markClaimed(station, round) {
  const prize = findPrize(station, round);
  if (!prize || prize.claimedAt) return prize;
  prize.claimedAt = Date.now();
  save('prizes', prizeLog);
  return prize;
}

export function recentPrizes(count = 20) {
  return prizeLog.slice(0, count);
}
