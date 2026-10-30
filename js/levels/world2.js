/*
 * Panther Pounce - World 2 "WITCHING HOUR": 15 harder levels with zombies,
 * glass that shatters on the first hit, and heavy stone that takes many hits.
 *
 * Coordinates are final game-world pixels (no offsets added later):
 * x = centre of the object, b = the height its BOTTOM edge sits at.
 * The ground's top is at y = 87. Keep things between x 1000 and 1750 so the
 * slingshot and the targets fit on screen together, and below y = 600.
 *
 * game.js calls PP.levels.world2(i) for level i (0-14) and gets a fresh list.
 */
window.PP = window.PP || {};
PP.levels = PP.levels || {};

(function() {
  var G = 87; // ground top

  function body(name, x, y, role, health, extra) {
    var o = {
      name: name,
      x: x,
      y: y,
      type: role == GameObjectRoll.Dirt ? "static" : "dynamic",
      shape: "box",
      userData: new BodyUserData(role, health)
    };
    for (var k in extra || {}) o[k] = extra[k];
    return o
  }

  // A level is built by calling these on a fresh list.
  function Builder() {
    var L = [];
    var api = {
      list: L,
      // 81x81 blocks
      crate: function(x, b) {
        L.push(body("wood1", x, b + 40.5, GameObjectRoll.Wood, 2000));
        return b + 81
      },
      glass: function(x, b) {
        L.push(body("glass1", x, b + 40.5, GameObjectRoll.Glass, 1));
        return b + 81
      },
      stone: function(x, b) {
        L.push(body("dirt", x, b + 40.5, GameObjectRoll.Dirt, 2000));
        return b + 81
      },
      // flat plank, width 202 * sx
      plank: function(x, b, sx, glass) {
        L.push(body(glass ? "glass2" : "wood2", x, b + 9.5, glass ? GameObjectRoll.Glass : GameObjectRoll.Wood, glass ? 1 : 2000, {
          scaleX: sx
        }));
        return b + 19
      },
      // standing plank, height 202 * sx
      post: function(x, b, sx, glass) {
        L.push(body(glass ? "glass2" : "wood2", x, b + 101 * sx, glass ? GameObjectRoll.Glass : GameObjectRoll.Wood, glass ? 1 : 2000, {
          scaleX: sx,
          rotation: 90
        }));
        return b + 202 * sx
      },
      // two posts with a roof: a room w wide and h tall. Returns the roof top.
      floor: function(x, b, w, h, glass) {
        api.post(x - (w / 2 - 9.5), b, h / 202, glass);
        api.post(x + (w / 2 - 9.5), b, h / 202, glass);
        return api.plank(x, b + h, w / 202, glass)
      },
      // zombie head. scale 1 = 78 px wide.
      zombie: function(x, b, hp, scale) {
        scale = scale || 1;
        L.push({
          name: "zombie",
          x: x,
          y: b + 38.5 * scale,
          scale: scale,
          type: "dynamic",
          shape: "circle",
          userData: new BodyUserData(GameObjectRoll.Enemy, hp)
        });
        return b + 77 * scale
      }
    };
    return api
  }

  var LEVELS = [
    // 1. Greenhouse
    function(l) {
      var t = l.floor(1150, G, 160, 121, true);
      l.zombie(1150, G, 300);
      l.zombie(1150, t, 300);
      t = l.glass(1380, G);
      t = l.crate(1380, t);
      l.zombie(1380, t, 300);
    },
    // 2. Twin towers
    function(l) {
      [1180, 1450].forEach(function(x) {
        var t = l.floor(x, G, 160, 121);
        l.zombie(x, G, 350);
        l.zombie(x, t, 350);
        l.floor(x, t, 160, 121, true);
      });
    },
    // 3. Crypt bunker
    function(l) {
      l.stone(1200, G);
      l.stone(1200, G + 81);
      l.stone(1480, G);
      l.stone(1480, G + 81);
      var t = l.plank(1340, G + 162, 1.8);
      l.zombie(1295, G, 400);
      l.zombie(1385, G, 400);
      l.glass(1250, t);
      l.glass(1430, t);
      l.zombie(1340, t, 400);
    },
    // 4. Pyramid
    function(l) {
      l.crate(1150, G);
      l.crate(1320, G);
      l.crate(1490, G);
      l.zombie(1235, G, 400);
      l.zombie(1405, G, 400);
      var t = l.plank(1235, G + 81, .8);
      l.plank(1405, G + 81, .8);
      l.crate(1190, t);
      l.glass(1320, t);
      l.crate(1450, t);
      l.zombie(1320, t + 81, 400);
    },
    // 5. Glass tower
    function(l) {
      var t = G;
      l.crate(1170, G);
      l.crate(1170, G + 81);
      l.crate(1170, G + 162);
      l.zombie(1380, t, 400);
      t = l.floor(1380, t, 160, 121, true);
      l.zombie(1380, t, 400);
      t = l.floor(1380, t, 160, 121, true);
      l.zombie(1380, t, 400);
      t = l.floor(1380, t, 160, 121);
      l.zombie(1380, t, 400, .8);
    },
    // 6. Bridges
    function(l) {
      [1150, 1400, 1650].forEach(function(x) {
        l.stone(x, G);
        l.stone(x, G + 81);
      });
      var t = l.plank(1275, G + 162, 1.22, true);
      l.plank(1525, G + 162, 1.22, true);
      l.zombie(1275, t, 450);
      l.zombie(1525, t, 450);
      l.zombie(1275, G, 450);
      l.zombie(1525, G, 450);
    },
    // 7. Fort
    function(l) {
      [1220, 1420].forEach(function(x, i) {
        var t = l.floor(x, G, 160, 121, i == 1);
        l.zombie(x, G, 450);
        l.zombie(x, t, 450);
        t = l.floor(x, t, 160, 121, i == 0);
        l.glass(x, t);
      });
    },
    // 8. Zombie king
    function(l) {
      l.stone(1340, G);
      l.stone(1340, G + 81);
      l.stone(1560, G);
      l.stone(1560, G + 81);
      l.zombie(1450, G, 900, 1.3);
      var t = l.plank(1450, G + 162, 1.5, true);
      l.zombie(1400, t, 450, .8);
      l.zombie(1500, t, 450, .8);
      l.floor(1170, G, 140, 121);
      l.zombie(1170, G, 450, .8);
    },
    // 9. Stairway
    function(l) {
      [1, 2, 3, 4].forEach(function(n, i) {
        var x = 1150 + i * 82,
          t = G;
        for (var k = 0; k < n; k++) t = (k == n - 1 && i % 2 ? l.glass : l.crate)(x, t);
        l.zombie(x, t, 450, .9);
      });
    },
    // 10. Castle
    function(l) {
      l.stone(1300, G);
      l.stone(1382, G);
      l.stone(1464, G);
      var t = l.floor(1382, G + 81, 240, 121);
      l.zombie(1335, G + 81, 500, .8);
      l.zombie(1429, G + 81, 500, .8);
      l.floor(1382, t, 160, 121, true);
      l.zombie(1382, t, 500);
      t = l.crate(1160, G);
      t = l.crate(1160, t);
      t = l.glass(1160, t);
      l.zombie(1160, t, 500, .9);
    },
    // 11. Behind the wall
    function(l) {
      for (var t = G, k = 0; k < 4; k++) t = l.stone(1220, t);
      t = l.floor(1450, G, 160, 121, true);
      l.zombie(1450, G, 500);
      l.zombie(1450, t, 500);
      l.floor(1450, t, 160, 121);
      t = l.floor(1630, G, 160, 121);
      l.zombie(1630, G, 500);
      l.zombie(1630, t, 500);
    },
    // 12. Three towers
    function(l) {
      [1150, 1380, 1610].forEach(function(x, i) {
        var t = G;
        i != 1 && l.zombie(x, t, 500, .9);
        t = l.floor(x, t, 140, 121, i == 1);
        i == 1 && l.zombie(x, t, 500, .9);
        t = l.floor(x, t, 140, 121, i != 1);
        t = l.floor(x, t, 140, 121);
        i != 1 && l.zombie(x, t, 500, .9);
      });
    },
    // 13. Glass maze
    function(l) {
      [3, 2, 3, 2, 3].forEach(function(n, i) {
        for (var x = 1250 + i * 82, t = G, k = 0; k < n; k++) t = l.glass(x, t);
        n == 2 && l.zombie(x, t, 550, .9);
      });
      var t = l.plank(1332, G + 243.5, .8);
      l.plank(1496, G + 243.5, .8);
      l.zombie(1332, t, 550);
      l.zombie(1496, t, 550);
    },
    // 14. The king's ring
    function(l) {
      l.stone(1300, G);
      l.stone(1300, G + 81);
      l.stone(1600, G);
      l.stone(1600, G + 81);
      l.zombie(1450, G, 1100, 1.4);
      var t = l.plank(1450, G + 162, 1.9, true);
      t = l.floor(1450, t, 200, 121);
      l.zombie(1415, G + 181, 550, .7);
      l.zombie(1485, G + 181, 550, .7);
      t = l.glass(1450, t);
      l.zombie(1450, t, 550, .9);
    },
    // 15. Midnight finale
    function(l) {
      var t;
      l.stone(1120, G);
      l.stone(1120, G + 81);
      l.stone(1120, G + 162);
      t = l.floor(1300, G, 160, 121, true);
      l.zombie(1300, G, 600);
      l.zombie(1300, t, 600);
      l.floor(1300, t, 160, 121);
      l.stone(1450, G);
      l.stone(1450, G + 81);
      l.stone(1620, G);
      l.stone(1620, G + 81);
      l.zombie(1535, G, 1200, 1.1);
      t = l.plank(1535, G + 162, 1.25, true);
      l.zombie(1535, t, 600, .8);
      t = l.crate(1700, G);
      t = l.glass(1700, t);
      t = l.crate(1700, t);
      l.zombie(1700, t, 600, .9);
    }
  ];

  PP.levels.world2 = function(i) {
    var l = Builder();
    LEVELS[i](l);
    return l.list
  };
  PP.levels.world2Count = LEVELS.length;
  // World 3 (js/levels/world3.js) builds on the same blocks.
  PP.levels.Builder = Builder;
})();
