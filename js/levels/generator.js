/*
 * Panther Pounce - level generator for worlds 4 to 10 (and the structure
 * templates world 3 uses too).
 *
 * Every generated level comes from a fixed seed, so level 5-3 is the same
 * every time you play it. Difficulty climbs from world 4 level 1 to world 10
 * level 15: tougher zombies, more stone, taller towers, more hills, bigger
 * barriers in front, more panthers (up to 10) and, from world 5 on, portals.
 *
 * Portals come in pairs that glow the same color: a panther that flies into
 * one comes out of the other at the same speed (game.js -> checkPortals).
 *
 * game.js calls PP.levels.load(world, i) (world 0-based) and gets
 * { list: [...], birds: [...] or undefined }.
 */
window.PP = window.PP || {};
PP.levels = PP.levels || {};

(function() {
  var G = 87; // ground top
  var PORTAL_COLORS = PP.levels.portalColors = ["#ff7a1a", "#4fc3ff", "#7cff4f", "#ff4fd8"];

  function rng(seed) {
    return function() {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // o = { r: random fn, d: difficulty 0-1, hp, glassP, stoneP }
  PP.levels.opts = function(seed, d) {
    return {
      r: rng(seed),
      d: d,
      hp: Math.round(600 + 900 * d),
      glassP: .45 - .3 * d,
      stoneP: .1 + .45 * d
    }
  };

  // one 81x81 block of a random material
  function block(l, x, b, o) {
    var v = o.r();
    return v < o.stoneP ? l.stone(x, b) : v < o.stoneP + o.glassP ? l.glass(x, b) : l.crate(x, b)
  }

  function foe(l, x, b, o, scale, hp) {
    return (o.r() < .3 ? l.ghoul : l.zombie)(x, b, hp || o.hp, scale)
  }

  // Structures. w = width they need; build(l, centre x, bottom, opts, extra)
  // returns the height of their top.
  var T = PP.levels.T = {
    // stack of 2-4 blocks with an enemy on top
    pillar: { w: 81, build: function(l, x, b, o, n) {
      n = n || 2 + Math.floor(o.r() * (1 + o.d * 2.5));
      for (var k = 0; k < n; k++) b = block(l, x, b, o);
      return foe(l, x, b, o, .8)
    }},
    // rooms stacked up, an enemy in each
    tower: { w: 140, build: function(l, x, b, o, n) {
      n = n || 1 + Math.floor(o.r() * (1.5 + o.d * 2));
      while (n-- > 0 && b < 600) {
        foe(l, x, b, o, .9);
        b = l.floor(x, b, 140, 121, o.r() < o.glassP);
      }
      return o.r() < .5 ? foe(l, x, b, o, .8) : foe(l, x, block(l, x, b, o), o, .7)
    }},
    // wide room with two enemies, a smaller room on its roof
    house: { w: 200, build: function(l, x, b, o) {
      foe(l, x - 40, b, o, .8);
      foe(l, x + 40, b, o, .8);
      b = l.floor(x, b, 200, 121, o.r() < o.glassP);
      foe(l, x, b, o, .9);
      b = l.floor(x, b, 140, 121, o.r() < o.glassP);
      return o.r() < .5 ? block(l, x, b, o) : foe(l, x, b, o, .8)
    }},
    // stone pillars, a big enemy between them, a roof with more on top
    bunker: { w: 262, build: function(l, x, b, o) {
      l.stone(x - 90, b);
      l.stone(x - 90, b + 81);
      l.stone(x + 90, b);
      l.stone(x + 90, b + 81);
      foe(l, x, b, o, 1.15, Math.round(o.hp * 1.8));
      var t = l.plank(x, b + 162, 1.25);
      l.glass(x - 85, t);
      l.glass(x + 85, t);
      return foe(l, x, t, o, .8)
    }},
    // two blocks, a plank, a block on that, enemies everywhere
    pyramid: { w: 262, build: function(l, x, b, o) {
      block(l, x - 90, b, o);
      block(l, x + 90, b, o);
      foe(l, x, b, o, 1);
      var t = l.plank(x, b + 81, 1.3);
      foe(l, x - 88, t, o, .8);
      foe(l, x + 88, t, o, .8);
      return foe(l, x, block(l, x, t, o), o, .8)
    }},
    // stone walls around a two-room tower
    fortress: { w: 330, build: function(l, x, b, o) {
      var n = 2 + (o.r() < o.d ? 1 : 0), k, wl = b, wr = b;
      for (k = 0; k < n; k++) wl = l.stone(x - 125, wl), wr = l.stone(x + 125, wr);
      return T.tower.build(l, x, b, o, 2)
    }},
    // two block pillars holding a long plank, a room on the bridge
    bridge: { w: 334, build: function(l, x, b, o) {
      var k, p = b;
      for (k = 0; k < 2; k++) p = block(l, x - 125, p, o), block(l, x + 125, b + k * 81, o);
      foe(l, x, b, o, 1.1);
      var t = l.plank(x, p, 1.65);
      foe(l, x, t, o, .9);
      t = l.floor(x, t, 160, 121, o.r() < o.glassP);
      return foe(l, x, t, o, .8)
    }},
    // Sealed iron vault: nothing gets in except through a portal whose exit
    // is inside (o.vaultExit). Pumpkin blasts don't go through iron either.
    vault: { w: 405, build: function(l, x, b, o) {
      var k, top = b, hp = Math.round(o.hp * .4); // a portal shot is the only way in, so they're weaker
      for (k = 0; k < 4; k++) l.iron(x - 162, b + k * 81), top = l.iron(x + 162, b + k * 81);
      for (k = -2; k <= 2; k++) l.iron(x + k * 81, top);
      foe(l, x - 80, b, o, .8, hp);
      foe(l, x + 80, b, o, .8, hp);
      o.d > .5 ? foe(l, x, b, o, 1, hp * 2) : l.glass(x, b);
      o.vaultExit = { x: x, y: top - 48 };
      return top + 81
    }}
  };
  var NAMES = ["pillar", "tower", "house", "bunker", "pyramid", "fortress", "bridge"];

  // Rough top of everything built so far (to keep portals clear of it).
  function highest(list) {
    var top = G;
    list.forEach(function(o) {
      if (o.hill) top = Math.max(top, G + o.h);
      else if (o.y) top = Math.max(top, o.y + 60);
    });
    return top
  }

  // Ground height at x from the hills built so far.
  function groundAt(list, x) {
    return list.reduce(function(y, h) { return h.hill ? Math.max(y, PP.levels.hillTop(h, x)) : y }, G)
  }

  // Portal pairs: one in the open air in front, its twin either inside the
  // vault (first pair, when there is one) or up above the targets.
  function addPortals(l, pairs, r, vaultExit) {
    var top = highest(l.list), placed = [], k, a, b, tries;
    function clear(p) {
      return placed.every(function(q) { return Math.abs(q.x - p.x) > 90 || Math.abs(q.y - p.y) > 110 })
    }
    for (k = 0; k < pairs; k++) {
      for (tries = 0; tries < 20; tries++) {
        a = { x: 430 + r() * 380, y: 0 };
        a.y = Math.max(260 + r() * 260, groundAt(l.list, a.x) + 90);
        if (clear(a)) break
      }
      if (k == 0 && vaultExit) b = vaultExit;
      else
        for (tries = 0; tries < 20; tries++) {
          b = { x: 1000 + r() * 640, y: Math.min(950, top + 120 + r() * 140) };
          if (clear(b)) break
        }
      placed.push(a, b);
      l.portal(a.x, a.y, k, b.x, b.y);
    }
  }

  // Panthers per level: grows with the world and through each world.
  function birdCount(world, i) {
    var lo = [4, 4, 5, 5, 6, 6, 7][world - 3],
      hi = Math.min(10, lo + 3);
    return lo + Math.round(i / 14 * (hi - lo))
  }

  function portalPairs(world, r) {
    if (world < 4) return 0;
    if (world < 6) return 1;
    if (world < 8) return 1 + (r() < .5 ? 1 : 0);
    return 2 + (r() < .4 ? 1 : 0)
  }

  // Levels the checker (tools/check_levels.js) couldn't beat get rebuilt from
  // another seed, a little easier each time. level_number -> variant that
  // the checker proved can be beaten. Re-run the checker after changing the
  // generator and update this list (PP.check.fix finds new variants).
  PP.levels.tune = {
    62: 1, 66: 1, 68: 1, 70: 1, 73: 2, 81: 2, 85: 3, 90: 1, 93: 1, 95: 1,
    104: 1, 106: 1, 109: 2, 110: 1, 112: 1, 114: 2, 128: 1, 132: 1, 135: 1, 146: 1
  };

  // world: 3-9 (worlds 4-10), i: 0-14
  PP.levels.generate = function(world, i) {
    var v = PP.levels.tune[world * 15 + i] || 0,
      d = Math.max(0, ((world - 3) * 15 + i) / 104 - .04 * v),
      o = PP.levels.opts(world * 1000 + i * 37 + 11 + v * 7919, d),
      r = o.r,
      l = PP.levels.Builder3(),
      x = 960,
      END = 1720,
      SLOPE = 50,
      k, fits, name, s, onHill, h, cx, base, n;

    // barriers in front
    if (r() < .3 + .5 * d) l.mound(520 + r() * 220, 160 + r() * 140, Math.round(50 + r() * 100 * (.5 + d)));
    if (d > .4 && r() < .5) l.mound(760 + r() * 80, 120 + r() * 80, Math.round(40 + r() * 80 * d));
    // stone wall, only where the ground is flat
    var flat = l.list.every(function(h) { return !h.hill || PP.levels.hillTop(h, 846) <= G && PP.levels.hillTop(h, 934) <= G });
    if (world >= 5 && flat && r() < .25 + .4 * d)
      for (base = G, n = 2 + Math.floor(r() * 3 * d + .5), k = 0; k < n; k++) base = l.stone(890, base);

    // portal levels: a sealed vault you can only get into through a portal,
    // on the left or right end of the target area
    var pairs = portalPairs(world, r), V = T.vault.w;
    if (pairs) {
      if (r() < .5) T.vault.build(l, x + V / 2, G, o), x += V + 25;
      else T.vault.build(l, END - V / 2, G, o), END -= V + 25;
    }

    // structures left to right, some of them up on hills. More of them later on.
    var most = 2 + Math.round(d * 2) - (pairs ? 1 : 0), enemies = 0;
    for (k = 0; k < most; k++) {
      fits = NAMES.filter(function(nm) { return T[nm].w <= END - x });
      if (!fits.length) break;
      name = fits[Math.floor(r() * fits.length)], s = T[name];
      onHill = r() < .3 + .4 * d && s.w + 10 + 2 * SLOPE <= END - x;
      if (onHill) {
        h = Math.round(40 + r() * (60 + 140 * d));
        cx = x + SLOPE + (s.w + 10) / 2;
        base = l.hill(cx, s.w + 10, h, SLOPE);
        x = cx + (s.w + 10) / 2 + SLOPE;
      } else {
        cx = x + s.w / 2, base = G, x += s.w;
      }
      s.build(l, cx, base, o);
      x += Math.round(15 + r() * 40);
    }

    addPortals(l, pairs, r, o.vaultExit);
    // enough panthers for the crowd: at least 7 for every 10 enemies
    l.list.forEach(function(e) {
      e.userData && e.userData.getObjectRoll() == GameObjectRoll.Enemy && enemies++
    });
    return {
      list: l.list,
      count: Math.max(birdCount(world, i), Math.min(10, Math.ceil(enemies * .7)))
    }
  };

  // The level's panthers: picked once from its own seed, so they're the same
  // every try, and picked to suit it. Lots of stone or a vault -> pumpkin
  // bombs (a vault always gets one), lots of glass -> split cats, and always
  // at least one plain panther. js/config.js -> randomBirds.weights is the base.
  PP.levels.lineup = function(list, count, n, v) {
    var r = rng(90001 + n * 131 + (v || 0) * 7919),
      w = {},
      stone = 0,
      glass = 0,
      vault = !1,
      out = [],
      k, name, total, x;
    list.forEach(function(o) {
      o.name == "dirt" && stone++, (o.name == "glass1" || o.name == "glass2") && glass++, o.name == "iron" && (vault = !0)
    });
    for (name in PP.config.randomBirds.weights) w[name] = PP.config.randomBirds.weights[name];
    w.boulder = (w.boulder || 0) + stone * .4 + (vault ? 2 : 0);
    w.bird_split = (w.bird_split || 0) + glass * .3;
    total = 0;
    for (name in w) total += w[name];
    for (k = 0; k < count; k++) {
      x = r() * total;
      for (name in w)
        if ((x -= w[name]) < 0) break;
      out.push(name)
    }
    out.indexOf("bird") < 0 && (out[0] = "bird");
    vault && out.indexOf("boulder") < 0 && (out[out.length > 1 ? 1 : 0] = "boulder");
    return out
  };

  // Every world in one place. world is 0-based; world 0 lives in game.js.
  // Returns { list, birds } (birds undefined = the world's fixed line-up).
  PP.levels.load = function(world, i) {
    var n = world * 15 + i,
      v = PP.levels.tune[n] || 0,
      L;
    if (world == 1) return { list: PP.levels.world2(i) };
    L = world == 2 ? { list: PP.levels.world3(i), count: PP.levels.world3Count(i) } : PP.levels.generate(world, i);
    return { list: L.list, birds: PP.levels.lineup(L.list, L.count, n, v) }
  };
})();
