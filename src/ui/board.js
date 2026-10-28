// The leaderboard screen: Today / All time for the Boo Bash Challenge.

import { board } from '../storage/scores.js';
import { tierFor } from '../core/prizes.js';
import { setHidden } from './screens.js';

const list = document.querySelector('#board');

let view = { todayOnly: true, highlight: null, tiers: [] };

/**
 * @param {object} options
 * @param {boolean} [options.todayOnly]
 * @param {object | null} [options.highlight]  an entry to highlight (the one just saved)
 * @param {Array} [options.tiers]  prize tiers, for the badges
 */
export function renderBoard(options) {
  view = { ...view, ...options };
  const { todayOnly, highlight, tiers } = view;
  document.querySelector('#tab-today').setAttribute('aria-selected', String(todayOnly));
  document.querySelector('#tab-all').setAttribute('aria-selected', String(!todayOnly));

  const entries = board({ todayOnly });
  setHidden('#board-empty', entries.length > 0);
  list.replaceChildren(
    ...entries.map((entry, index) => {
      const item = document.createElement('li');
      if (highlight && entry.time === highlight.time && entry.initials === highlight.initials) item.classList.add('highlight');

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `${index + 1}.`;
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = entry.initials;
      const score = document.createElement('span');
      score.textContent = entry.score.toLocaleString();

      // Prize badge: the first letter of the tier, readable without color.
      const badge = document.createElement('span');
      const tier = tierFor(entry.score, tiers);
      if (tier) {
        badge.className = 'tier-badge';
        badge.style.setProperty('--tier', tier.color);
        badge.textContent = tier.name[0];
        badge.title = tier.name;
      }
      item.append(rank, who, score, badge);
      return item;
    }),
  );
}
