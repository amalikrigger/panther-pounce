// Shows one menu screen at a time (title, levels, pause, results...) and
// fills in their text. The screens themselves are plain HTML in index.html.

const $ = (selector) => document.querySelector(selector);

let current = null;

// Only move focus for keyboard users. Moving it after a tap would show a
// focus ring around a button nobody pressed.
let usingKeyboard = false;
window.addEventListener('keydown', () => (usingKeyboard = true), { capture: true });
window.addEventListener('pointerdown', () => (usingKeyboard = false), { capture: true });

/** Show the screen with id "screen-<name>", or hide all screens with null. */
export function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.classList.toggle('active', screen.id === `screen-${name}`);
  }
  current = name;
  if (usingKeyboard && name) $(`#screen-${name} button:not([disabled])`)?.focus({ preventScroll: true });
}

export const currentScreen = () => current;

/**
 * Call `handler(action, button)` when a button with data-action="..." is
 * pressed. We use "click" so a finger that starts on a button and slides off
 * doesn't press it by accident.
 */
export function onAction(handler) {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    handler(button.dataset.action, button);
  });
}

export function setText(selector, text) {
  const element = $(selector);
  if (element && element.textContent !== String(text)) element.textContent = text;
}

export function setHidden(selector, hidden) {
  const element = $(selector);
  if (element) element.hidden = hidden;
}

/** Fill a <dl> with label/value pairs. */
export function setStats(selector, pairs) {
  $(selector).replaceChildren(
    ...pairs.map(([label, value]) => {
      const item = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      item.append(dt, dd);
      return item;
    }),
  );
}

/** A row of 3 stars as inline SVG; earned ones are filled, the rest are outlines. */
export function starsMarkup(earned, size = 'small') {
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<svg class="star star-${size} ${i < earned ? 'earned' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`;
  }
  return html;
}
