/*
 * Panther Pounce - aiming assist (dotted trajectory arc).
 *
 * While the player pulls the slingshot, game.js sends "sling:aim" with the
 * launch impulse and physics settings. We run the same maths Box2D will
 * run (one step at a time, same gravity and step size), so the dots show
 * the real path. Bounces off blocks aren't predicted, on purpose.
 *
 * How it looks:
 *   - the arc fades in when you grab the panther and fades out on release
 *   - dots shrink and fade the further along the path they are
 *   - dot color shows power: gold -> pumpkin -> toxic green at full stretch
 *
 * It draws on its own transparent canvas (#fx_canvas) on top of the game.
 * The AIM button (top-left) switches it on/off and remembers the choice.
 */
(function () {
  'use strict';

  var PP = window.PP;
  var cfg = PP.config.aim;

  var W = 1000, H = 600;     // the visible game window, in game pixels
  var WORLD_W = 2400;        // full level width
  var GROUND_TOP = 87;       // height of sprites/ground.png
  var PREF_KEY = 'pp_aim';   // on/off choice in localStorage (not personal data)

  var canvas, ctx, viewport, button;
  var enabled = cfg.enabledByDefault;
  var aiming = false;
  var dots = [];      // [{x, y}] in world pixels (y up, like cocos2d)
  var power = 0;
  var alpha = 0;      // whole-arc fade, 0..1
  var running = false, lastTime = 0;
  var C = {};

  // ------------------------------------------------------------ prediction

  // Mirrors Box2D: velocity += gravity * dt, then position += velocity * dt.
  function predict(d) {
    var m = d.pxPerMetre;
    var r = d.radius / m;
    var mass = d.density * Math.PI * r * r;   // circle body, same as Box2D
    var vx = d.impulseX / mass, vy = d.impulseY / mass;
    var x = d.x / m, y = d.y / m;
    var steps = Math.round(cfg.seconds / d.step);
    var out = [];
    var portalWait = 0;
    for (var i = 1; i <= steps; i++) {
      vy -= d.gravity * d.step;
      x += vx * d.step;
      y += vy * d.step;
      // portals (game.js sets PP.portals): jump to the twin, like the real panther
      if (PP.portals && --portalWait < 0) {
        for (var k = 0; k < PP.portals.length; k++) {
          var e = PP.portals[k], ex = x * m - e.x, ey = y * m - e.y;
          if (ex * ex + ey * ey < e.r * e.r) {
            x = e.partner.x / m;
            y = e.partner.y / m;
            portalWait = 36;
            break;
          }
        }
      }
      // world 3 hills: game.js sets PP.groundAt(x) = height of the ground there
      var floor = ((PP.groundAt ? PP.groundAt(x * m) : GROUND_TOP) + d.radius) / m;
      if (y < floor || x * m > WORLD_W) break;
      if (i % cfg.dotEvery === 0) out.push({ x: x * m, y: y * m });
    }
    return out;
  }

  // ------------------------------------------------------------ drawing

  function powerColor() {
    if (power >= 0.98) return C.toxic;
    return power > 0.6 ? C.pumpkin : C['gold-hi'];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (alpha <= 0 || !dots.length) return;
    var camera = parseFloat(viewport.style.marginLeft) || 0;
    var zoom = (PP.config.view && PP.config.view.zoom) || 1;
    var color = powerColor();
    for (var i = 0; i < dots.length; i++) {
      var t = i / Math.max(1, dots.length - 1);  // 0 at the slingshot, 1 at the end
      var size = Math.round(10 - t * 5) & ~1;    // even sizes keep it on the pixel grid
      var x = Math.round((dots[i].x * zoom + camera - size / 2) / 2) * 2;
      var y = Math.round((H - dots[i].y * zoom - size / 2) / 2) * 2;
      if (x < -size || x > W) continue;
      ctx.globalAlpha = alpha * (1 - t * 0.8);
      ctx.fillStyle = C.ink;                       // dark outline so it reads on any sky
      ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Runs only while the arc is visible or fading.
  function loop(now) {
    var dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    var target = aiming && enabled ? 1 : 0;
    var speed = 1 / (target ? cfg.fadeInSec : cfg.fadeOutSec);
    alpha = target > alpha ? Math.min(1, alpha + dt * speed) : Math.max(0, alpha - dt * speed);
    draw();
    if (alpha > 0 || target > 0) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }

  function wake() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ on/off button

  function savePref() {
    try { localStorage.setItem(PREF_KEY, enabled ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function loadPref() {
    try {
      var v = localStorage.getItem(PREF_KEY);
      if (v === '0' || v === '1') enabled = v === '1';
    } catch (e) { /* private mode */ }
  }

  function updateButton() {
    button.textContent = 'AIM: ' + (enabled ? 'ON' : 'OFF');
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.classList.toggle('is-off', !enabled);
  }

  // ------------------------------------------------------------ start

  function init() {
    var gameDiv = document.getElementById('game_div');
    viewport = document.getElementById('viewport');
    if (!gameDiv || !viewport) return;

    var style = getComputedStyle(document.documentElement);
    ['ink', 'gold-hi', 'pumpkin', 'toxic'].forEach(function (k) {
      C[k] = style.getPropertyValue('--pp-' + k).trim();
    });

    canvas = document.createElement('canvas');
    canvas.id = 'fx_canvas';
    canvas.width = W;
    canvas.height = H;
    canvas.setAttribute('aria-hidden', 'true');
    gameDiv.insertBefore(canvas, document.getElementById('score_div'));
    ctx = canvas.getContext('2d');

    loadPref();
    button = document.createElement('button');
    button.id = 'aim_toggle';
    button.type = 'button';
    button.title = 'Show or hide the aiming arc';
    button.addEventListener('click', function () {
      enabled = !enabled;
      savePref();
      updateButton();
      wake();
    });
    gameDiv.appendChild(button);
    updateButton();

    PP.on('sling:aim', function (d) {
      aiming = true;
      power = d.power;
      dots = predict(d);
      wake();
    });
    PP.on('sling:release', function () {
      aiming = false; // dots stay put and fade out
    });
    PP.on('level:start', function () {
      aiming = false;
      alpha = 0;
      dots = [];
      if (ctx) ctx.clearRect(0, 0, W, H);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
