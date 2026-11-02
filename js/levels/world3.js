/*
 * Panther Pounce - World 3 "PUMPKIN HILLS": 15 hard levels built on hills.
 *
 * Hills are solid ground: panthers bounce off them and towers stand on their
 * flat tops. Every level also says how many panthers you get (4 to 6, more
 * for the harder levels); which kinds is picked once per level to suit it
 * (PP.levels.lineup). Most structures come from the templates in
 * js/levels/generator.js (PP.levels.T).
 *
 * Same rules as js/levels/world2.js: x = centre, b = bottom edge, ground top
 * at y = 87. Enemies must stay between x 940 and 1710.
 *
 * game.js gets the level list and panthers through PP.levels.load
 * (js/levels/generator.js).
 */
window.PP = window.PP || {};
PP.levels = PP.levels || {};

(function() {
  var G = 87; // ground top

  // Height of a hill's surface at x (game-world pixels). Flat top topW wide,
  // smooth slopes `slope` wide on each side.
  PP.levels.hillTop = function(h, x) {
    var d = h.topW / 2 + h.slope - Math.abs(x - h.x);
    if (d <= 0) return G;
    var t = Math.min(1, d / h.slope);
    return G + h.h * t * t * (3 - 2 * t)
  };

  function Builder() {
    var l = PP.levels.Builder();
    // flat-topped hill. Returns the height of its flat top.
    l.hill = function(x, topW, h, slope) {
      l.list.push({
        hill: true,
        x: x,
        topW: topW,
        h: h,
        slope: slope
      });
      return G + h
    };
    // round bump with no flat top (good for blocking low shots)
    l.mound = function(x, w, h) {
      return l.hill(x, 0, h, w / 2)
    };
    // the old ghoul enemy. scale 1 = 78 px wide.
    l.ghoul = function(x, b, hp, scale) {
      scale = scale || 1;
      l.list.push({
        name: "enemy",
        x: x,
        y: b + 38.5 * scale,
        scale: scale,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, hp)
      });
      return b + 77 * scale
    };
    // unbreakable, immovable iron block (portal vaults). 81x81.
    l.iron = function(x, b) {
      l.list.push({
        name: "iron",
        x: x,
        y: b + 40.5,
        type: "static",
        shape: "box"
      });
      return b + 81
    };
    // pair of portals glowing the same color (worlds 5+). Not solid:
    // game.js moves a panther that flies into one over to the other.
    l.portal = function(x1, y1, pair, x2, y2) {
      l.list.push({
        portal: true,
        pair: pair,
        x: x1,
        y: y1,
        to: { x: x2, y: y2 }
      });
    };
    return l
  }
  PP.levels.Builder3 = Builder;

  // birds: how many panthers the level gives you.
  // T.* are the structures from js/levels/generator.js; o holds this level's
  // random-but-fixed choices (materials, zombie or ghoul) and enemy health.
  var LEVELS = [
    // 1. Over the hill
    { birds: 4, build: function(l, o, T) {
      l.mound(620, 360, 110);
      T.pillar.build(l, 1000, G, o, 2);
      var t = l.hill(1300, 220, 60, 100);
      T.tower.build(l, 1300, t, o, 2);
      T.tower.build(l, 1630, G, o, 1);
    }},
    // 2. Hilltop fort
    { birds: 4, build: function(l, o, T) {
      l.mound(700, 240, 100);
      var t = l.hill(1290, 340, 110, 130);
      T.house.build(l, 1225, t, o);
      T.pillar.build(l, 1410, t, o, 2);
      T.pillar.build(l, 1660, G, o, 3);
    }},
    // 3. The valley
    { birds: 5, build: function(l, o, T) {
      l.mound(650, 280, 110);
      var a = l.hill(1070, 160, 120, 100);
      T.tower.build(l, 1070, a, o, 2);
      l.zombie(1340, G, o.hp * 2, 1.2);
      var b = l.hill(1590, 220, 120, 90);
      T.house.build(l, 1590, b, o);
    }},
    // 4. Stairway hills
    { birds: 5, build: function(l, o, T) {
      var s1 = l.hill(1350, 640, 50, 80),
        s2 = l.hill(1430, 480, 120, 60),
        s3 = l.hill(1520, 300, 190, 60);
      l.mound(700, 220, 90);
      T.pillar.build(l, 1080, s1, o, 2);
      T.pillar.build(l, 1250, s2, o, 3);
      T.house.build(l, 1480, s3, o);
      T.pillar.build(l, 1625, s3, o, 2);
    }},
    // 5. Twin peaks
    { birds: 5, build: function(l, o) {
      l.mound(650, 300, 100);
      l.mound(850, 160, 70);
      var a = l.hill(1120, 140, 170, 120);
      l.hill(1580, 140, 170, 120);
      l.zombie(1350, G, o.hp * 2);
      var r = l.plank(1350, a, 2.3);
      l.zombie(1250, l.glass(1250, r), o.hp, .7);
      l.zombie(1450, l.glass(1450, r), o.hp, .7);
      l.zombie(1350, r, o.hp, .9);
      l.zombie(1080, a, o.hp, .8);
      l.zombie(1620, a, o.hp, .8);
    }},
    // 6. Scarecrow tower
    { birds: 5, build: function(l, o, T) {
      l.mound(700, 220, 90);
      T.pillar.build(l, 1050, G, o, 2);
      var t = l.hill(1400, 220, 80, 140);
      T.tower.build(l, 1400, t, o, 3);
      T.pillar.build(l, 1690, G, o, 2);
    }},
    // 7. Cliff fort
    { birds: 5, build: function(l, o, T) {
      l.mound(760, 200, 80);
      var a = l.hill(1050, 130, 60, 80);
      T.tower.build(l, 1050, a, o, 1);
      var t = l.hill(1520, 340, 190, 90);
      T.fortress.build(l, 1520, t, o);
    }},
    // 8. Glasshouse ridge
    { birds: 6, build: function(l, o, T) {
      l.mound(480, 160, 60);
      l.mound(700, 260, 130);
      var t = l.hill(1340, 700, 70, 90);
      T.tower.build(l, 1070, t, o, 1);
      T.pyramid.build(l, 1300, t, o);
      T.tower.build(l, 1535, t, o, 2);
      T.pillar.build(l, 1650, t, o, 2);
    }},
    // 9. Hill king
    { birds: 6, build: function(l, o, T) {
      l.mound(800, 240, 90);
      var t = l.hill(1400, 440, 100, 110);
      T.pillar.build(l, 1225, t, o, 2);
      T.bunker.build(l, 1400, t, o);
      T.pillar.build(l, 1575, t, o, 2);
    }},
    // 10. Barricades
    { birds: 6, build: function(l, o, T) {
      l.mound(620, 200, 80);
      l.mound(820, 200, 120);
      for (var w = G, k = 0; k < 4; k++) w = l.stone(1000, w);
      var t = l.hill(1400, 300, 90, 110);
      T.pyramid.build(l, 1400, t, o);
      T.pillar.build(l, 1690, G, o, 1);
    }},
    // 11. Windmill
    { birds: 6, build: function(l, o, T) {
      l.mound(700, 200, 120);
      var a = l.hill(1080, 120, 40, 60);
      T.pillar.build(l, 1080, a, o, 2);
      var t = l.hill(1450, 200, 130, 120);
      T.tower.build(l, 1450, t, o, 3);
      T.pillar.build(l, 1700, G, o, 3);
    }},
    // 12. Three hills
    { birds: 6, build: function(l) {
      [[1050, 60], [1340, 140], [1620, 220]].forEach(function(p, i) {
        var t = l.hill(p[0], 140, p[1], 70);
        var r = l.floor(p[0], t, 130, 121, i == 1);
        l.zombie(p[0], t, 850, .9);
        r = l.stone(p[0], r);
        l.zombie(p[0], r, 850, .8);
      });
    }},
    // 13. Moat and keep
    { birds: 6, build: function(l) {
      l.mound(700, 220, 100);
      var a = l.hill(1060, 120, 100, 80);
      var t = l.hill(1560, 260, 160, 100);
      l.zombie(1265, G, 900);
      a = l.glass(1060, a);
      a = l.glass(1060, a);
      l.zombie(1060, a, 900, .9);
      l.stone(1468, t);
      l.stone(1468, t + 81);
      var r = l.floor(1600, t, 180, 121);
      l.zombie(1565, t, 900, .8);
      l.zombie(1635, t, 900, .8);
      r = l.floor(1600, r, 180, 121, true);
      l.zombie(1600, r, 900, .8);
    }},
    // 14. Pumpkin pyramid
    { birds: 6, build: function(l) {
      l.mound(650, 240, 110);
      var s1 = l.hill(1380, 640, 60, 70),
        s2 = l.hill(1380, 380, 130, 60),
        s3 = l.hill(1380, 140, 200, 40);
      l.zombie(1095, s1, 900, .8);
      l.zombie(1665, s1, 900, .8);
      l.zombie(1230, s2, 900, .8);
      l.zombie(1530, s2, 900, .8);
      var r = l.floor(1380, s3, 140, 121);
      l.zombie(1380, s3, 1500, 1.2);
      r = l.glass(1380, r);
      l.zombie(1380, r, 900, .9);
    }},
    // 15. Harvest moon finale
    { birds: 6, build: function(l) {
      l.mound(650, 260, 120);
      l.mound(860, 140, 70);
      var a = l.hill(1040, 120, 90, 70);
      var t = l.hill(1520, 340, 150, 90);
      l.zombie(1215, G, 900, .9);
      a = l.stone(1040, a);
      a = l.stone(1040, a);
      l.zombie(1040, a, 900, .9);
      l.stone(1392, t);
      l.stone(1392, t + 81);
      l.stone(1392, t + 162);
      var r = l.floor(1520, t, 160, 121, true);
      l.zombie(1520, t, 1600, 1.1);
      l.zombie(1520, r, 900, .9);
      r = l.floor(1520, r, 160, 121);
      r = l.glass(1520, r);
      l.zombie(1520, r, 900, .8);
      r = l.crate(1650, t);
      r = l.crate(1650, r);
      l.ghoul(1650, r, 900, .8);
    }}
  ];

  PP.levels.world3 = function(i) {
    var l = Builder();
    LEVELS[i].build(l, PP.levels.opts(3000 + i * 53, i / 14 * .3), PP.levels.T);
    return l.list
  };

  // How many panthers level i gives (which ones: PP.levels.lineup in
  // js/levels/generator.js picks them once per level).
  PP.levels.world3Count = function(i) {
    return LEVELS[i].birds
  };
})();
