// The rules for playing one level: turns, score, stars, and winning or losing.
//
// This file knows nothing about physics, drawing or the screen. main.js tells
// it what happened ("a panther was launched", "an enemy was defeated", "the
// shot is over") and it decides what that means. That keeps the rules easy to
// read and lets us test them with `node --test`.
//
// A round is always in exactly one of these states:
//
//   'ready'    a panther is on the slingshot, waiting for you
//   'flying'   a shot is in progress
//   'cleared'  every enemy is gone; we wait for the dust to settle (more points!)
//   'won'      level complete
//   'lost'     out of panthers with enemies left

export class Round {
  /**
   * @param level    the level object ({ panthers, enemies, par })
   * @param scoring  SCORING from config.js
   */
  constructor(level, scoring) {
    this.level = level;
    this.scoring = scoring;
    this.state = 'ready';
    this.panthersLeft = level.panthers;
    this.enemiesLeft = level.enemies.length;
    this.score = 0;
    this.breakdown = { destruction: 0, enemies: 0, pantherBonus: 0 };
    this.stars = 0;
  }

  /** The player let go of the slingshot. */
  launch() {
    if (this.state !== 'ready') return false;
    this.panthersLeft -= 1;
    this.state = 'flying';
    return true;
  }

  blockBroken(points) {
    if (this.isOver()) return;
    this.breakdown.destruction += points;
    this.score += points;
  }

  enemyDefeated(points) {
    if (this.isOver()) return;
    this.breakdown.enemies += points;
    this.score += points;
    this.enemiesLeft = Math.max(0, this.enemiesLeft - 1);
    if (this.enemiesLeft === 0) this.state = 'cleared';
  }

  /** Everything stopped moving after a shot. Returns the new state. */
  shotSettled() {
    if (this.state === 'cleared') {
      this.finishWin();
    } else if (this.state === 'flying') {
      this.state = this.panthersLeft > 0 ? 'ready' : 'lost';
    }
    return this.state;
  }

  finishWin() {
    const bonus = this.panthersLeft * this.scoring.unusedPanther;
    this.breakdown.pantherBonus = bonus;
    this.score += bonus;
    this.stars = starsFor(this.score, this.level.par);
    this.state = 'won';
  }

  isOver() {
    return this.state === 'won' || this.state === 'lost';
  }
}

/**
 * Stars for a winning score. Clearing the level always earns 1 star; the
 * level's par scores decide 2 and 3.
 */
export function starsFor(score, par) {
  if (score >= par.threeStars) return 3;
  if (score >= par.twoStars) return 2;
  return 1;
}
