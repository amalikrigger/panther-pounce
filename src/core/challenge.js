// The Boo Bash Challenge: one paid run through a fixed list of levels.
//
// Every player gets the same levels in the same order. You play each level
// once; win or lose, you move on to the next, and your scores add up. There
// are no retries during a run, so every $2 play is fair.
//
// Like round.js, this knows nothing about the screen or physics.

export class Challenge {
  /**
   * @param {string[]} levelIds  which levels, in order
   * @param {number} startTime   when the run began (ms), for the prize screen
   */
  constructor(levelIds, startTime) {
    if (!levelIds.length) throw new Error('A challenge needs at least one level.');
    this.levelIds = [...levelIds];
    this.index = 0; // which level we're on
    this.results = []; // { levelId, score, won, stars } for each finished level
    this.startTime = startTime;
    this.endTime = null;
  }

  get currentLevelId() {
    return this.levelIds[this.index];
  }

  get isFinished() {
    return this.results.length === this.levelIds.length;
  }

  /** Score from the levels finished so far. */
  get total() {
    return this.results.reduce((sum, r) => sum + r.score, 0);
  }

  get stars() {
    return this.results.reduce((sum, r) => sum + r.stars, 0);
  }

  get levelsCleared() {
    return this.results.filter((r) => r.won).length;
  }

  /** Record the current level's result and move on. */
  finishLevel({ score, won, stars }, now) {
    if (this.isFinished) return;
    this.results.push({ levelId: this.currentLevelId, score, won, stars });
    if (this.isFinished) {
      this.endTime = now;
    } else {
      this.index += 1;
    }
  }

  /** Seconds from start to finish (or to now, if still going). */
  seconds(now) {
    return Math.round(((this.endTime ?? now) - this.startTime) / 1000);
  }
}

/** 135 → "2:15" */
export function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
