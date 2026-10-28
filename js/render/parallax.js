/*
 * Panther Pounce - animated Halloween background.
 *
 * Draws the night scene behind the game canvas, back to front:
 *   sky -> stars -> blood moon + glow -> clouds -> witch + bats
 *   -> far hills + haunted carnival -> haunted house -> graveyard -> fog
 *
 * Why it looks retro: everything is drawn on a small 250x150 canvas
 * (one "retro pixel" = 4x4 screen pixels) and CSS scales it up with
 * `image-rendering: pixelated`. A small canvas is also cheap to redraw,
 * which keeps old school Chromebooks smooth.
 *
 * It doesn't change game.js. The old engine scrolls the world by moving
 * the game canvas's `margin-left`, so we read that to find the camera.
 *
 * Colors come from css/theme.css; speeds and counts from js/config.js.
 */
(function () {
  'use strict';

  var PP = (window.PP = window.PP || {});
  var cfg = PP.config.background;
  var depth = cfg.depth;

  var PIXEL = 4;                               // screen pixels per retro pixel
  var W = 1000 / PIXEL, H = 600 / PIXEL;       // 250 x 150
  var MAX_CAM = (2400 - 1000) / PIXEL;         // furthest the world scrolls (350)
  var GROUND_Y = Math.floor((600 - 87) / PIXEL); // top edge of ground.png (128)
  var FOG_W = 400;

  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  // Pixel art: '#' uses the main color, other letters use the map passed in.
  var BAT_FRAMES = [
    ['#.....#', '##.#.##', '.#####.', '...#...'], // wings up
    ['.......', '..###..', '#######', '#.....#']  // wings down
  ];
  var WITCH = [
    '......#.........',
    '.....##.........',
    '....###.........',
    '..#######.......',
    '....##..........',
    '...####......#.#',
    '################',
    '....###.....###.',
    '.....#.......#..'
  ];
  var PUMPKIN = ['..g..', '.ooo.', 'oyoyo', '.ooo.'];

  var C = {};          // colors read from CSS
  var calm = false;    // prefers-reduced-motion
  var canvas, ctx, viewport;
  var sky, moonImg, farLayer, midLayer, nearLayer, fogStrips, clouds;
  var stars = [], bats = [], windows = [], lanterns = [];
  var witch = { active: false, x: 0, y: 0, nextAt: 0 };
  var MOON = { x: 185, y: 40, r: 20 };
  var WHEEL = { x: 230, y: 88, r: 17 };

  // Add-ons (like js/render/spectators.js) register a draw function here.
  // It runs every frame, after the graveyard and before the fog, as
  // fn(ctx, timeSeconds, api). See `api` in init() for what it gets.
  var addOns = [];
  PP.parallax = {
    addLayer: function (fn) { addOns.push(fn); }
  };
  var api;

  // ------------------------------------------------------------ helpers

  // Seeded random numbers, so the scenery is the same on every load.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbaStr(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  // Crisp, non-antialiased filled circle.
  function disc(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (var y = Math.floor(cy - r); y < cy + r; y++) {
      var dy = y + 0.5 - cy;
      var half = Math.sqrt(Math.max(0, r * r - dy * dy));
      var x0 = Math.round(cx - half), x1 = Math.round(cx + half);
      if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
    }
  }

  // Crisp line (Bresenham), t pixels thick.
  function line(g, x0, y0, x1, y1, t, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    g.fillStyle = color;
    for (;;) {
      g.fillRect(x0, y0, t, t);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Stepped pixel triangle (roofs, spires) sitting on y = base.
  function roof(g, x, base, w, color) {
    for (var r = 0; r * 2 < w; r++) rect(g, x + r, base - r - 1, w - r * 2, 1, color);
  }

  function pixelArt(g, x, y, rows, map) {
    for (var j = 0; j < rows.length; j++) {
      for (var i = 0; i < rows[j].length; i++) {
        var color = map[rows[j][i]];
        if (color) rect(g, x + i, y + j, 1, 1, color);
      }
    }
  }

  function wrap(v, span) {
    return ((v % span) + span) % span;
  }

  function cameraX() {
    var m = parseFloat(viewport.style.marginLeft);
    if (isNaN(m)) return 0;
    return Math.min(MAX_CAM, Math.max(0, -m / PIXEL));
  }

  function readColors() {
    var style = getComputedStyle(document.documentElement);
    ['ink', 'night', 'purple', 'violet', 'plum', 'gold-hi', 'maroon', 'pumpkin', 'toxic',
     'ghost', 'window', 'moon', 'moon-hi', 'moon-crater', 'moon-glow',
     'sil-far', 'sil-mid', 'sil-near', 'fog', 'charcoal', 'skin', 'skin-shade'].forEach(function (name) {
      C[name] = style.getPropertyValue('--pp-' + name).trim();
    });
  }

  // ------------------------------------------------------------ build (once)

  function buildSky() {
    var c = makeCanvas(W, H), g = c.getContext('2d');
    var img = g.createImageData(W, H), d = img.data;
    var stops = ['ink', 'night', 'purple', 'violet', 'plum'].map(function (k) { return hexToRgb(C[k]); });
    var segs = stops.length - 1;
    for (var y = 0; y < H; y++) {
      var t = Math.min(1, y / GROUND_Y) * segs;
      var k = Math.min(Math.floor(t), segs - 1), f = t - k;
      for (var x = 0; x < W; x++) {
        var col = f > (BAYER[y & 3][x & 3] + 0.5) / 16 ? stops[k + 1] : stops[k];
        var i = (y * W + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function buildStars() {
    var r = rng(7), span = W + MAX_CAM * depth.stars + 4;
    for (var i = 0; i < 90; i++) {
      stars.push({
        x: r() * span,
        y: r() * GROUND_Y * 0.6,
        color: r() < 0.75 ? '#ffffff' : C['gold-hi'],
        big: r() < 0.08,
        phase: r() * 6.28,
        speed: 1 + r() * 3
      });
    }
  }

  function buildMoon() {
    var R = MOON.r, size = R * 2 + 2, c = makeCanvas(size, size), g = c.getContext('2d');
    var cx = R + 1, cy = R + 1;
    disc(g, cx, cy, R, C['moon-hi']);
    g.globalCompositeOperation = 'source-atop'; // keep everything inside the moon
    disc(g, cx + 1.5, cy + 1.5, R - 1, C.moon);
    [[0.3, -0.2, 0.2], [-0.35, 0.3, 0.13], [0.15, 0.45, 0.1], [-0.2, -0.45, 0.08]].forEach(function (k) {
      disc(g, cx + k[0] * R, cy + k[1] * R, k[2] * R, C['moon-crater']);
    });
    return c;
  }

  function buildClouds() {
    var r = rng(21), list = [];
    for (var i = 0; i < 4; i++) {
      var w = 44 + Math.floor(r() * 30), h = 10, c = makeCanvas(w, h), g = c.getContext('2d');
      var puffs = [];
      for (var p = 0; p < 7; p++) {
        var px = 5 + r() * (w - 10), edge = 1 - Math.abs(px / w - 0.5) * 2; // taller in the middle
        puffs.push([px, 8, 2 + edge * 3 + r() * 1.5]);
      }
      // long, flat wisps: moonlit rim first, then the body shifted down a pixel
      rect(g, 2, 7, w - 4, 2, C.plum);
      puffs.forEach(function (q) { disc(g, q[0], q[1] - 1, q[2], C.plum); });
      rect(g, 3, 8, w - 6, 2, C.night);
      puffs.forEach(function (q) { disc(g, q[0], q[1], q[2], C.night); });
      g.clearRect(0, 9, w, 1); // flat cloud bottom
      list.push({ img: c, x: r() * (W + 80), y: 12 + r() * 40, speed: 0.6 + r() * 0.8 });
    }
    return list;
  }

  function buildBats() {
    var r = rng(5);
    for (var i = 0; i < cfg.bats; i++) {
      bats.push({ x: r() * (W + 20), y: 20 + r() * 50, speed: 8 + r() * 10, amp: 2 + r() * 4, phase: r() * 6.28 });
    }
  }

  function hillLine(g, width, base, amp, freq, seed, color) {
    var r = rng(seed), p1 = r() * 6, p2 = r() * 6;
    for (var x = 0; x < width; x++) {
      var top = Math.round(base - amp * (0.6 * Math.sin(x * freq + p1) + 0.4 * Math.sin(x * freq * 2.3 + p2)));
      rect(g, x, top, 1, H - top, color);
    }
  }

  function deadTree(g, x, y, len, angle, levels, t, color, r) {
    if (!levels || len < 2) return;
    var x2 = x + Math.cos(angle) * len, y2 = y - Math.sin(angle) * len;
    line(g, x, y, x2, y2, t, color);
    deadTree(g, x2, y2, len * (0.55 + r() * 0.2), angle - 0.5 + (r() - 0.5) * 0.4, levels - 1, Math.max(1, t - 1), color, r);
    deadTree(g, x2, y2, len * (0.55 + r() * 0.2), angle + 0.45 + (r() - 0.5) * 0.4, levels - 1, Math.max(1, t - 1), color, r);
  }

  // Far layer: rolling hills, a circus tent and the ferris wheel's legs.
  function buildFar() {
    var width = Math.ceil(W + MAX_CAM * depth.far) + 2;
    var c = makeCanvas(width, H), g = c.getContext('2d'), col = C['sil-far'];
    hillLine(g, width, 112, 6, 0.05, 1, col);
    // ferris wheel legs (the spinning wheel is drawn every frame)
    line(g, WHEEL.x, WHEEL.y, WHEEL.x - 10, WHEEL.y + WHEEL.r + 10, 2, col);
    line(g, WHEEL.x, WHEEL.y, WHEEL.x + 10, WHEEL.y + WHEEL.r + 10, 2, col);
    // striped circus tent
    var tx = 40, base = 112, tw = 22, th = 9;
    for (var i = 0; i < tw; i++) rect(g, tx + i, base - th, 1, th, (Math.floor(i / 3) % 2) ? C.maroon : col);
    roof(g, tx - 2, base - th, tw + 4, col);
    rect(g, tx + tw / 2, base - th - 18, 1, 6, col);
    rect(g, tx + tw / 2 + 1, base - th - 18, 3, 2, C.pumpkin);
    return c;
  }

  // Mid layer: hill, haunted house (windows glow per frame) and dead trees.
  function buildMid() {
    var width = Math.ceil(W + MAX_CAM * depth.mid) + 2;
    var c = makeCanvas(width, H), g = c.getContext('2d'), col = C['sil-mid'], r = rng(3);
    hillLine(g, width, 123, 3, 0.08, 2, col);
    var x = 150, base = 121;
    rect(g, x + 6, base - 40, 4, 10, col);   // chimney
    rect(g, x, base - 26, 40, 26, col);      // house
    roof(g, x - 3, base - 26, 46, col);
    rect(g, x + 28, base - 46, 12, 20, col); // tower
    roof(g, x + 26, base - 46, 16, col);
    rect(g, x + 33, base - 58, 1, 5, col);   // spire
    [[6, 20], [16, 20], [31, 40], [31, 28]].forEach(function (w) {
      windows.push({ x: x + w[0], y: base - w[1], seed: r() * 10 });
    });
    deadTree(g, 60, 124, 10, Math.PI / 2, 4, 2, col, r);
    deadTree(g, 290, 123, 8, Math.PI / 2 + 0.15, 4, 2, col, r);
    return c;
  }

  // Near layer: graveyard with tombstones, crosses, fences and pumpkins.
  function buildNear() {
    var width = Math.ceil(W + MAX_CAM * depth.near) + 2;
    var c = makeCanvas(width, H), g = c.getContext('2d'), col = C['sil-near'], r = rng(11);
    var G = GROUND_Y + 1, x = 30;
    rect(g, 0, G - 1, width, H, col);
    deadTree(g, 10, G, 14, Math.PI / 2 - 0.1, 5, 3, col, r);
    while (x < width - 10) {
      var kind = r(), w;
      if (kind < 0.4) {                       // rounded tombstone
        w = 5 + Math.floor(r() * 3);
        var h = 6 + Math.floor(r() * 5);
        rect(g, x, G - h, w, h, col);
        disc(g, x + w / 2, G - h, w / 2, col);
      } else if (kind < 0.62) {               // cross
        w = 6;
        rect(g, x + 2, G - 12, 2, 12, col);
        rect(g, x, G - 9, 6, 2, col);
      } else if (kind < 0.8) {                // iron fence
        w = 20;
        for (var px = x; px < x + w; px += 3) rect(g, px, G - 11, 1, 11, col);
        rect(g, x, G - 8, w, 1, col);
        rect(g, x, G - 3, w, 1, col);
      } else if (kind < 0.9) {                // obelisk
        w = 5;
        rect(g, x + 1, G - 16, 3, 16, col);
        roof(g, x, G - 16, 5, col);
      } else {                                // jack-o'-lantern (glow drawn per frame)
        w = 5;
        pixelArt(g, x, G - 4, PUMPKIN, { g: col, o: C.pumpkin, y: C['gold-hi'] });
        lanterns.push({ x: x + 2.5, y: G - 2, seed: r() * 10 });
      }
      x += w + 6 + Math.floor(r() * 14);
    }
    return c;
  }

  // Soft fog strip that tiles horizontally.
  function buildFog(seed, alpha) {
    var c = makeCanvas(FOG_W, 50), g = c.getContext('2d'), r = rng(seed);
    for (var i = 0; i < 14; i++) {
      var x = r() * FOG_W, y = 18 + r() * 26, rad = 12 + r() * 20;
      [x - FOG_W, x, x + FOG_W].forEach(function (bx) {
        var grad = g.createRadialGradient(bx, y, 0, bx, y, rad);
        grad.addColorStop(0, rgbaStr(C.fog, alpha));
        grad.addColorStop(1, rgbaStr(C.fog, 0));
        g.fillStyle = grad;
        g.fillRect(bx - rad, y - rad, rad * 2, rad * 2);
      });
    }
    return c;
  }

  // ------------------------------------------------------------ draw (every frame)

  function drawStars(t, cam) {
    var span = W + MAX_CAM * depth.stars + 4;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], x = Math.round(wrap(s.x - cam * depth.stars, span) - 2);
      ctx.globalAlpha = calm ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(t * s.speed * 0.5 + s.phase));
      rect(ctx, x, s.y, 1, 1, s.color);
      if (s.big) {
        rect(ctx, x - 1, s.y, 3, 1, s.color);
        rect(ctx, x, s.y - 1, 1, 3, s.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(t, cam) {
    var x = MOON.x - cam * depth.moon, y = MOON.y;
    var pulse = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 0.8);
    var grad = ctx.createRadialGradient(x, y, MOON.r * 0.8, x, y, MOON.r * 2.6);
    grad.addColorStop(0, rgbaStr(C['moon-glow'], 0.45 * pulse));
    grad.addColorStop(1, rgbaStr(C['moon-glow'], 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - MOON.r * 3, y - MOON.r * 3, MOON.r * 6, MOON.r * 6);
    ctx.drawImage(moonImg, Math.round(x - MOON.r - 1), Math.round(y - MOON.r - 1));
  }

  function drawClouds(t, cam) {
    var drift = calm ? 0.3 : 1;
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i], span = W + cl.img.width * 2;
      var x = wrap(cl.x - t * cfg.cloudSpeed * cl.speed * drift - cam * depth.clouds, span) - cl.img.width;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cl.img, Math.round(x), Math.round(cl.y));
    }
    ctx.globalAlpha = 1;
  }

  function drawBats(t, cam) {
    var map = { '#': C['sil-near'] };
    for (var i = 0; i < bats.length; i++) {
      var b = bats[i];
      var x = wrap(b.x - t * b.speed - cam * depth.bats, W + 20) - 10;
      var y = b.y + Math.sin(t * 1.5 + b.phase) * b.amp;
      pixelArt(ctx, Math.round(x), Math.round(y), BAT_FRAMES[Math.floor(t * 6 + b.phase) % 2], map);
    }
  }

  function drawWitch(t) {
    if (!witch.active && t >= witch.nextAt) {
      witch.active = true;
      witch.x = W + 20;
      witch.y = 18 + Math.random() * 30;
      witch.startedAt = t;
    }
    if (!witch.active) return;
    var x = witch.x - (t - witch.startedAt) * cfg.witch.speed;
    if (x < -30) {
      witch.active = false;
      witch.nextAt = t + cfg.witch.minSec + Math.random() * (cfg.witch.maxSec - cfg.witch.minSec);
      return;
    }
    pixelArt(ctx, Math.round(x), Math.round(witch.y + Math.sin(t * 2) * 3), WITCH, { '#': C['sil-near'] });
  }

  function drawWheel(t, cam) {
    var cx = WHEEL.x - cam * depth.far, cy = WHEEL.y, r = WHEEL.r, col = C['sil-far'];
    var spin = calm ? 0 : t * 0.25;
    var bulbs = [C.pumpkin, C.toxic, C['gold-hi']];
    var steps = Math.round(2 * Math.PI * r * 1.5);
    ctx.fillStyle = col;
    for (var k = 0; k < steps; k++) {
      var a = (k / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    for (var i = 0; i < 8; i++) {
      var ang = spin + (i / 8) * Math.PI * 2;
      var ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
      line(ctx, cx, cy, ex, ey, 1, col);
      rect(ctx, ex - 1, ey, 3, 3, col);                       // gondola
      var lit = calm || (Math.floor(t * 3) + i) % 3 !== 0;   // chasing lights
      if (lit) rect(ctx, ex, ey - 1, 1, 1, bulbs[i % 3]);
    }
  }

  function flicker(t, seed) {
    if (calm) return 1;
    return 0.7 + 0.2 * Math.sin(t * 7 + seed * 3) + 0.1 * Math.sin(t * 23 + seed);
  }

  function drawWindows(t, cam) {
    var off = cam * depth.mid;
    for (var i = 0; i < windows.length; i++) {
      var w = windows[i];
      ctx.globalAlpha = flicker(t, w.seed);
      rect(ctx, w.x - off, w.y, 4, 5, C.window);
      ctx.globalAlpha = 1;
      rect(ctx, w.x - off + 1, w.y, 1, 5, C['sil-mid']);  // window frame
      rect(ctx, w.x - off, w.y + 2, 4, 1, C['sil-mid']);
    }
  }

  // Soft candle glow around the graveyard pumpkins.
  function drawLanterns(t, cam) {
    var off = cam * depth.near;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < lanterns.length; i++) {
      var l = lanterns[i], x = l.x - off;
      if (x < -10 || x > W + 10) continue;
      var grad = ctx.createRadialGradient(x, l.y, 0, x, l.y, 7);
      grad.addColorStop(0, rgbaStr(C.pumpkin, 0.35 * flicker(t, l.seed)));
      grad.addColorStop(1, rgbaStr(C.pumpkin, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(x - 7, l.y - 7, 14, 14);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFog(t, cam) {
    var drift = calm ? 0.3 : 1;
    for (var i = 0; i < fogStrips.length; i++) {
      var speed = cfg.fogSpeed * (i ? 1.6 : 1) * drift;
      var x = -wrap(t * speed + cam * depth.fog * (i ? 1.2 : 1), FOG_W);
      var y = GROUND_Y - 38 + i * 8;
      ctx.drawImage(fogStrips[i], Math.round(x), y);
      ctx.drawImage(fogStrips[i], Math.round(x) + FOG_W, y);
    }
  }

  function draw(t) {
    var cam = cameraX();
    ctx.drawImage(sky, 0, 0);
    drawStars(t, cam);
    drawMoon(t, cam);
    drawClouds(t, cam);
    if (!calm) {
      drawWitch(t);
      drawBats(t, cam);
    }
    ctx.drawImage(farLayer, -Math.round(cam * depth.far), 0);
    drawWheel(t, cam);
    ctx.drawImage(midLayer, -Math.round(cam * depth.mid), 0);
    drawWindows(t, cam);
    ctx.drawImage(nearLayer, -Math.round(cam * depth.near), 0);
    drawLanterns(t, cam);
    api.cam = cam;
    for (var i = 0; i < addOns.length; i++) addOns[i](ctx, t, api);
    drawFog(t, cam);
  }

  // ------------------------------------------------------------ start

  var lastFrame = 0;
  function loop(now) {
    requestAnimationFrame(loop); // the browser pauses this while the tab is hidden
    if (now - lastFrame < 1000 / cfg.fps - 1) return;
    lastFrame = now;
    draw(now / 1000);
  }

  function init() {
    var gameDiv = document.getElementById('game_div');
    viewport = document.getElementById('viewport');
    if (!gameDiv || !viewport) return;

    calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    readColors();

    canvas = makeCanvas(W, H);
    canvas.id = 'bg_canvas';
    canvas.setAttribute('aria-hidden', 'true');
    gameDiv.insertBefore(canvas, gameDiv.firstChild);
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    sky = buildSky();
    buildStars();
    moonImg = buildMoon();
    clouds = buildClouds();
    buildBats();
    farLayer = buildFar();
    midLayer = buildMid();
    nearLayer = buildNear();
    fogStrips = [buildFog(31, 0.16), buildFog(47, 0.12)];
    witch.nextAt = performance.now() / 1000 + cfg.witch.firstSec;

    api = {
      W: W, H: H,
      groundY: GROUND_Y,  // top of the game's ground strip, in retro pixels
      depth: depth,       // parallax speeds from config
      cam: 0,             // camera position, updated every frame
      calm: calm,         // true if the player prefers reduced motion
      colors: C,          // palette from css/theme.css
      rect: rect
    };

    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
