// Sound effects, made live with the Web Audio API. There are no sound files,
// so there is nothing to download and nothing to license.
//
// Browsers block sound until the player touches the page, so main.js calls
// unlock() on the first tap.
//
// Want to record your own sounds (a real panther roar, a "BOO!")? See
// docs/student-tasks.md.

let context = null;
let master = null;
let muted = false;
let noiseBuffer = null;

export function unlock() {
  // Only a real tap or key press can start sound. Trying earlier just makes
  // the browser print a warning.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(context.destination);
    // One second of random noise, reused for whooshes, crunches and booms.
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (context.state === 'suspended') context.resume();
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.7;
}

export const isMuted = () => muted;

const ready = () => context && context.state === 'running' && !muted;

/** A tone that glides from one pitch to another and fades out. */
function tone({ type = 'sine', from, to = from, duration, volume = 0.3, delay = 0 }) {
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** A burst of filtered noise: whooshes, thuds, crunches. */
function noise({ duration, volume = 0.3, filter = 'lowpass', from = 1000, to = from, q = 1, delay = 0 }) {
  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  const shape = context.createBiquadFilter();
  shape.type = filter;
  shape.Q.value = q;
  shape.frequency.setValueAtTime(from, start);
  shape.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(shape).connect(gain).connect(master);
  source.start(start, Math.random() * 0.5);
  source.stop(start + duration + 0.05);
}

// Don't play the same sound more than once in a short burst; dozens of
// blocks hitting at once would just be noise.
const lastPlayed = new Map();
function throttle(name, seconds) {
  const now = performance.now() / 1000;
  if (now - (lastPlayed.get(name) ?? 0) < seconds) return false;
  lastPlayed.set(name, now);
  return true;
}

export const sounds = {
  stretch() {
    if (!ready() || !throttle('stretch', 0.15)) return;
    tone({ type: 'triangle', from: 180, to: 260, duration: 0.12, volume: 0.08 });
  },
  launch() {
    if (!ready()) return;
    noise({ duration: 0.45, volume: 0.35, filter: 'bandpass', from: 400, to: 2400, q: 2 });
    tone({ type: 'sawtooth', from: 220, to: 90, duration: 0.18, volume: 0.06 });
  },
  hit(strength, materials) {
    if (!ready() || !throttle('hit', 0.06)) return;
    const loud = Math.min(1, strength / 30);
    const stony = materials.some((m) => m === 'stone' || m === 'tombstone');
    if (stony) {
      noise({ duration: 0.12, volume: 0.15 + loud * 0.25, from: 1800, to: 300, q: 3, filter: 'bandpass' });
    } else {
      noise({ duration: 0.1, volume: 0.15 + loud * 0.3, from: 700, to: 150 });
    }
    tone({ from: 120 + Math.random() * 30, to: 60, duration: 0.12, volume: 0.1 + loud * 0.2 });
  },
  breakBlock(material) {
    if (!ready() || !throttle('break', 0.05)) return;
    if (material === 'stone' || material === 'tombstone') {
      noise({ duration: 0.35, volume: 0.4, from: 2500, to: 200, filter: 'bandpass', q: 1.5 });
    } else {
      // Wood snaps: a sharp crack, then a crunch.
      noise({ duration: 0.05, volume: 0.5, from: 4000, filter: 'highpass' });
      noise({ duration: 0.25, volume: 0.3, from: 1200, to: 300, delay: 0.03 });
    }
  },
  ghostGone() {
    if (!ready()) return;
    // A wobbly "boo-oo-oo" sliding down.
    const start = context.currentTime;
    const osc = context.createOscillator();
    const wobble = context.createOscillator();
    const wobbleDepth = context.createGain();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, start);
    osc.frequency.exponentialRampToValueAtTime(180, start + 0.7);
    wobble.frequency.value = 9;
    wobbleDepth.gain.value = 25;
    wobble.connect(wobbleDepth).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
    osc.connect(gain).connect(master);
    osc.start(start);
    wobble.start(start);
    osc.stop(start + 0.8);
    wobble.stop(start + 0.8);
  },
  explosion() {
    if (!ready()) return;
    noise({ duration: 0.9, volume: 0.7, from: 1500, to: 60 });
    tone({ from: 110, to: 35, duration: 0.6, volume: 0.45 });
  },
  win() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, duration: 0.3, volume: 0.22, delay: i * 0.11 }));
  },
  lose() {
    if (!ready()) return;
    [392, 370, 349, 294].forEach((f, i) => tone({ type: 'sawtooth', from: f, to: f * 0.97, duration: 0.38, volume: 0.08, delay: i * 0.3 }));
  },
  star(index) {
    if (!ready()) return;
    tone({ type: 'triangle', from: 880 * (1 + index * 0.25), duration: 0.25, volume: 0.2 });
  },
  pounce() {
    if (!ready()) return;
    // A short growly roar: a rough low tone sliding down, plus breathy noise.
    tone({ type: 'sawtooth', from: 160, to: 70, duration: 0.45, volume: 0.22 });
    tone({ type: 'square', from: 82, to: 55, duration: 0.4, volume: 0.08 });
    noise({ duration: 0.4, volume: 0.25, filter: 'bandpass', from: 900, to: 300, q: 1.2 });
  },
  click() {
    if (!ready()) return;
    tone({ type: 'triangle', from: 660, to: 880, duration: 0.07, volume: 0.12 });
  },
};
