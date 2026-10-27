// The game loop.
//
// Physics must run in equal-sized steps (1/60 s) to behave the same on every
// device. Screens refresh at different speeds (60 Hz tablets, 120 Hz phones),
// so each frame we run however many whole steps fit in the time that passed,
// then draw. `alpha` tells the renderer how far we are between the last two
// steps, so motion looks smooth even when a frame falls between steps.

// After a long hiccup, don't try to catch up more than this (it would freeze).
const MAX_FRAME_SECONDS = 0.1;

export function startLoop({ stepSeconds, step, frame }) {
  let lastTime = null;
  let leftover = 0;
  let running = true;

  function tick(now) {
    if (!running) return;
    const elapsed = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = now;

    leftover += elapsed;
    while (leftover >= stepSeconds) {
      step(stepSeconds);
      leftover -= stepSeconds;
    }
    frame(elapsed, leftover / stepSeconds);
    requestAnimationFrame(tick);
  }

  // Stop completely while the tab is hidden: saves battery, and avoids a giant
  // catch-up when the player comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastTime = null;
      requestAnimationFrame(tick);
    }
  });

  requestAnimationFrame(tick);
}
