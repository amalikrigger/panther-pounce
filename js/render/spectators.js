/*
 * Panther Pounce - easter egg: two bald spectators.
 *
 * Two small figures peek over a fence at the edge of the graveyard.
 * They breathe, blink and glance around, and every 6-15 seconds one of
 * them (sometimes both) waves at the player.
 *
 * Drawn through PP.parallax.addLayer(), so this file only has to know
 * how to draw itself. Delete this file's <script> tag to remove them.
 * Settings live in js/config.js (PP.config.spectators).
 */
(function () {
  'use strict';

  var PP = window.PP;
  var cfg = PP.config.spectators;
  if (!cfg || !cfg.enabled || !PP.parallax) return;

  var BODY_H = 13;     // head (6) + coat (7), in retro pixels
  var GAP = 10;        // distance between the two of them
  var WAVE_SEC = 1.8;  // how long one wave lasts

  // `mirror` flips a person so each one waves with his outer arm.
  var people = [
    { dx: 0, coat: 'charcoal', tie: 'pumpkin', mirror: true },
    { dx: GAP, coat: 'maroon', tie: 'gold-hi', mirror: false }
  ];
  var started = false;
  var nextWaveAt = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function start(t) {
    started = true;
    nextWaveAt = t + rand(2, 5); // first wave soon, so players notice them
    people.forEach(function (p) {
      p.waveUntil = 0;
      p.nextBlink = t + rand(1, 4);
      p.blinkUntil = 0;
      p.look = 0;
      p.nextLook = t + rand(3, 8);
      p.phase = Math.random() * 6;
    });
  }

  // Decide who waves, blinks or looks around this frame.
  function update(t) {
    if (t >= nextWaveAt) {
      if (Math.random() < cfg.bothChance) {
        people[0].waveUntil = people[1].waveUntil = t + WAVE_SEC;
      } else {
        people[Math.random() < 0.5 ? 0 : 1].waveUntil = t + WAVE_SEC;
      }
      nextWaveAt = t + WAVE_SEC + rand(cfg.waveMinSec, cfg.waveMaxSec);
    }
    people.forEach(function (p) {
      if (t >= p.nextBlink) {
        p.blinkUntil = t + 0.15;
        p.nextBlink = t + rand(2, 5);
      }
      if (t >= p.nextLook) {
        p.look = p.look ? 0 : (Math.random() < 0.5 ? -1 : 1); // glance, then look back
        p.nextLook = t + (p.look ? rand(0.8, 1.6) : rand(3, 8));
      }
    });
  }

  // Draws one person. (x, y) is the top-left of his head.
  // px() mirrors the drawing when p.mirror is set.
  function drawPerson(ctx, api, p, x, y, t) {
    var C = api.colors;
    function px(dx, dy, w, h, color) {
      api.rect(ctx, p.mirror ? x + 7 - dx - w : x + dx, y + dy, w, h, color);
    }
    var waving = t < p.waveUntil;
    var blink = !api.calm && t < p.blinkUntil;
    var look = waving ? 0 : p.look * (p.mirror ? -1 : 1);

    // coat + shirt collar + tie
    px(0, 6, 7, 7, C[p.coat]);
    px(2, 6, 3, 1, C.ghost);
    px(3, 7, 1, 3, C[p.tie]);

    // bald head with ears and a shiny spot from the moonlight
    px(2, 0, 3, 1, C.skin);
    px(1, 1, 5, 5, C.skin);
    px(5, 3, 1, 3, C['skin-shade']);
    px(0, 2, 1, 2, C['skin-shade']);
    px(6, 2, 1, 2, C['skin-shade']);
    px(2, 0, 1, 1, '#ffffff');

    // eyebrows (raised while waving), eyes, smile
    var eye = blink ? C['skin-shade'] : C.ink;
    px(2 + look, waving ? 0 : 1, 1, 1, C['skin-shade']);
    px(4 + look, waving ? 0 : 1, 1, 1, C['skin-shade']);
    px(2 + look, 2, 1, 1, eye);
    px(4 + look, 2, 1, 1, eye);
    if (waving) px(2, 4, 3, 1, C.maroon); // big grin while waving
    else px(3, 4, 1, 1, C.maroon);

    // waving arm, held out clear of the head; two frames, 5 swaps a second
    if (waving) {
      px(7, 6, 1, 2, C[p.coat]);
      px(8, 4, 1, 3, C[p.coat]);
      if (Math.floor(t * 5) % 2) {
        px(8, 2, 2, 2, C.skin);
      } else {
        px(9, 3, 1, 1, C[p.coat]);
        px(9, 1, 2, 2, C.skin);
      }
    }
  }

  // A short iron fence in front of them, so only their top halves show.
  function drawFence(ctx, api, x, ground) {
    var col = api.colors['sil-near'];
    var w = GAP + 7 + 8;
    for (var i = 0; i < w; i += 3) {
      api.rect(ctx, x + i, ground - 7, 1, 7, col);
      api.rect(ctx, x + i, ground - 8, 1, 1, col);
    }
    api.rect(ctx, x, ground - 6, w - 2, 1, col);
    api.rect(ctx, x, ground - 2, w - 2, 1, col);
  }

  // Make them wave right now, e.g. PP.spectators.wave(true) when a level is cleared.
  PP.spectators = {
    wave: function (both) {
      var t = performance.now() / 1000, pick = Math.random() < 0.5 ? 0 : 1;
      people.forEach(function (p, i) {
        if (both || i === pick) p.waveUntil = t + WAVE_SEC;
      });
    }
  };

  PP.parallax.addLayer(function (ctx, t, api) {
    if (!started) start(t);
    if (!api.calm) update(t);

    var x = Math.round(cfg.x - api.cam * api.depth.near);
    if (x < -30 || x > api.W + 10) return; // off screen

    var ground = api.groundY + 1;
    people.forEach(function (p) {
      var breathe = api.calm ? 0 : Math.floor(t * 0.7 + p.phase) % 2; // 1px bob
      drawPerson(ctx, api, p, x + p.dx, ground - BODY_H + breathe, t);
    });
    drawFence(ctx, api, x - 4, ground);
  });
})();
