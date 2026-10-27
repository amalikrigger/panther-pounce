// The fullscreen button.
//
// Most browsers support the Fullscreen API. iPhones don't let web pages go
// fullscreen at all, so there we hide the button and show a tip about "Add to
// Home Screen", which opens the game without the browser bars (see the
// apple-mobile-web-app tags in index.html).

const root = document.documentElement;

const request = root.requestFullscreen || root.webkitRequestFullscreen;
const exit = document.exitFullscreen || document.webkitExitFullscreen;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

/** Already running from the home screen, with no browser bars? */
const isStandalone = () =>
  window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;

export function setupFullscreen({ button, iosHint }) {
  if (typeof request === 'function') {
    button.hidden = false;
    button.addEventListener('click', toggleFullscreen);
  } else if (!isStandalone()) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    iosHint.hidden = !isIOS;
  }
}

export function toggleFullscreen() {
  if (fullscreenElement()) {
    exit?.call(document);
    return;
  }
  try {
    const result = request.call(root, { navigationUI: 'hide' });
    // Lock to landscape where the browser allows it (Android); ignore if not.
    result
      ?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {}))
      .catch?.(() => {});
  } catch {
    // Not worth stopping the game over.
  }
}
