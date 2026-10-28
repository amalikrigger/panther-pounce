// Booth settings that staff can change in staff mode. They're saved on each
// device and start from the values in config.js.

import { CHALLENGE, PRIZE_TIERS, STAFF } from '../config.js';
import { LEVELS } from '../levels/index.js';
import { load, save } from './store.js';

function defaults() {
  return {
    challengeLevels: CHALLENGE.levels,
    tierScores: Object.fromEntries(PRIZE_TIERS.map((t) => [t.id, t.minScore])),
    station: 'A', // set a different letter on each booth device
    eventWord: STAFF.defaultEventWord,
    pin: STAFF.defaultPin,
    kiosk: false,
    kioskIdleSeconds: STAFF.kioskIdleSeconds,
    allowFreePlay: true,
  };
}

let current = { ...defaults(), ...load('settings', {}) };
// Make sure tiers added to config.js later still get a score.
current.tierScores = { ...defaults().tierScores, ...current.tierScores };

export function getSettings() {
  return current;
}

export function updateSettings(patch) {
  current = { ...current, ...patch };
  save('settings', current);
  return current;
}

/** The prize tiers from config.js with the staff-set scores, lowest first. */
export function prizeTiers() {
  return PRIZE_TIERS.map((tier) => ({ ...tier, minScore: current.tierScores[tier.id] ?? tier.minScore })).sort(
    (a, b) => a.minScore - b.minScore,
  );
}

/**
 * The challenge levels, skipping any id that no longer exists (for example,
 * a level a student renamed). Falls back to the config list, then level 1.
 */
export function challengeLevelIds() {
  const known = new Set(LEVELS.map((level) => level.id));
  for (const list of [current.challengeLevels, CHALLENGE.levels]) {
    const valid = (list ?? []).filter((id) => known.has(id));
    if (valid.length) return valid;
  }
  return [LEVELS[0].id];
}
