var storage = [];
try {
  storage = localStorage;
} catch (e) {};

// Launch physics. js/fx/trajectory.js receives these through the
// "sling:aim" event, so the aiming arc always matches the real flight.
var GRAVITY = 10, // metres per second squared (Box2D world)
  PHYSICS_STEP = 1 / 60,
  LAUNCH_POWER = 10.5, // impulse per pixel of slingshot pull (was 12; lower = slower panthers)
  BIRD_DENSITY = 15,
  // The split bird is smaller (radius 18 vs 22), so it is denser to weigh
  // the same and fly the same arc. Each of its three pieces weighs half.
  SPLIT_DENSITY = BIRD_DENSITY * (22 / 18) * (22 / 18),
  SPLIT_ANGLE = cc.DEGREES_TO_RADIANS(12);

// Breakable blocks (tweak in js/config.js -> damage).
var DAMAGE = window.PP && PP.config && PP.config.damage || {},
  WOOD_MIN_IMPULSE = DAMAGE.woodMinImpulse || 8, // softer bumps don't hurt wood
  WOOD_DAMAGE_SCALE = DAMAGE.woodScale || 5, // wood has 2000 health
  GLASS_MIN_IMPULSE = DAMAGE.glassMinImpulse || 4, // any real hit shatters glass
  // stone ("dirt") blocks: movable, heavy, and take about 3x the hits of wood
  STONE_HEALTH = DAMAGE.stoneHealth || 6000,
  STONE_MIN_IMPULSE = DAMAGE.stoneMinImpulse || 15,
  STONE_DENSITY = DAMAGE.stoneDensity || 4,
  STONE_FRICTION = DAMAGE.stoneFriction || .9,
  // how far outside the bird a click still grabs it (screen pixels)
  SLING_GRAB_MARGIN = window.PP && PP.config && PP.config.sling ? PP.config.sling.grabMargin : 18,
  // enemies must stay between these world x positions (js/config.js -> enemyArea).
  // The right edge defaults to the edge of the screen when the camera is at the slingshot.
  ENEMY_AREA = window.PP && PP.config && PP.config.enemyArea || {},
  ENEMY_MIN_X = ENEMY_AREA.minX || 900,
  ENEMY_MAX_X = ENEMY_AREA.maxX || 1000 / (window.PP && PP.config && PP.config.view ? PP.config.view.zoom : 1),
  // things with hurt looks: sprites/<name>_dmg1.png and <name>_dmg2.png
  HURT_LOOKS = {
    wood1: 1,
    wood2: 1,
    dirt: 1,
    enemy: 1,
    zombie: 1
  };

// Big levels. Each world has 15 levels; level_number counts through all of
// them (world 2 level 1 = level_number 15). Worlds 2 and 3 live in
// js/levels/, worlds 4-10 are made by js/levels/generator.js.
// birds: null = each level has its own line-up (world 3 on, PP.levels.lineup).
var LEVELS_PER_WORLD = 15,
  WORLDS = [{
    name: "GRAVEYARD",
    birds: ["bird", "bird", "bird"]
  }, {
    name: "WITCHING HOUR",
    birds: ["bird", "bird_split", "bird", "bird_split"]
  }, {
    name: "PUMPKIN HILLS",
    birds: null
  }, {
    name: "CORN MAZE",
    birds: null
  }, {
    name: "PORTAL PASS",
    birds: null
  }, {
    name: "BONE DESERT",
    birds: null
  }, {
    name: "FROZEN CRYPT",
    birds: null
  }, {
    name: "TOXIC SWAMP",
    birds: null
  }, {
    name: "BLOOD MOON",
    birds: null
  }, {
    name: "THE LAST NIGHT",
    birds: null
  }],
  current_world = 0;

// Panther kinds. boulder = the pumpkin bomb, drawn smaller so it fits the
// slingshot. It is heavier but gets a bigger push, so it flies the same arc
// and hits pumpkinWeight times harder (js/config.js -> randomBirds).
var BIRD_SCALE = {
    boulder: .6
  },
  PUMPKIN_WEIGHT = window.PP && PP.config && PP.config.randomBirds && PP.config.randomBirds.pumpkinWeight || 2.5,
  HILL_FRICTION = window.PP && PP.config && PP.config.hills && PP.config.hills.friction || .9;

// Tell the Halloween add-ons (js/) what is happening in the game.
function pp_emit(name, data) {
  if (window.PP && PP.emit) PP.emit(name, data);
}

// Camera zoom. Below 1 the whole world is drawn smaller so the slingshot and
// the structures fit on screen together (set in js/config.js -> view.zoom).
// World coordinates (physics, level data) never change; only the drawing does.
var VIEW_ZOOM = window.PP && PP.config && PP.config.view ? PP.config.view.zoom : 1,
  VIEW_W = 1000,
  WORLD_W = 2400,
  // furthest the camera can scroll left, in screen pixels (0 = slingshot end)
  MIN_SCROLL = Math.min(0, VIEW_W - WORLD_W * VIEW_ZOOM);

function camera_x() {
  return parseFloat(document.getElementById("viewport").style.marginLeft) || 0
}

// World 3 hills as a retro picture (3 px blocks, like sprites/ground.png):
// grass on top, then soil getting darker with depth. Drawn once per level
// into a canvas; colors come from css/theme.css (--pp-hill-*).
function make_hill_node(hills) {
  var css = getComputedStyle(document.documentElement),
    col = function(n) {
      return css.getPropertyValue(n ? "--pp-hill-" + n : "--pp-hill").trim()
    },
    P = 3,
    GROUND = 87,
    top = [],
    maxTop = GROUND,
    seed = 7,
    rnd = function() {
      return seed = (seed * 16807) % 2147483647, seed / 2147483647
    },
    c, g, x, y, k, H, node;
  for (x = 0; x < WORLD_W; x += P) {
    for (y = GROUND, k = 0; k < hills.length; k++) y = Math.max(y, PP.levels.hillTop(hills[k], x + P / 2));
    top.push(y = Math.round(y / P) * P), maxTop = Math.max(maxTop, y)
  }
  H = maxTop + P, c = document.createElement("canvas"), c.width = WORLD_W, c.height = H, g = c.getContext("2d");
  for (x = 0; x < top.length; x++) {
    if (top[x] <= GROUND) continue;
    var px = x * P,
      // canvas y for a world height (the canvas is drawn with its bottom at y = 0)
      cy = function(wy) {
        return H - wy
      },
      depth = top[x] - (GROUND - 6);
    g.fillStyle = col("lo"), g.fillRect(px, cy(top[x]), P, depth);
    g.fillStyle = col(""), g.fillRect(px, cy(top[x]), P, Math.min(depth, 60));
    g.fillStyle = col("hi"), g.fillRect(px, cy(top[x]), P, Math.min(depth, 18));
    g.fillStyle = col("grass"), g.fillRect(px, cy(top[x]), P, 2 * P);
    rnd() < .5 && (g.fillStyle = col("grass-hi"), g.fillRect(px, cy(top[x]), P, P));
    depth > 60 && rnd() < .3 && (g.fillStyle = col("lo"), g.fillRect(px, cy(top[x] - 24 - Math.floor(rnd() * 12) * P), P, P));
    rnd() < .06 && (g.fillStyle = col("grass-hi"), g.fillRect(px, cy(top[x] + P), P, P))
  }
  node = cc.Node.create();
  node.draw = function(ctx) {
    (ctx || cc.renderContext).drawImage(c, 0, -H)
  };
  return node
}

// Unbreakable iron block (portal vaults): riveted steel with a cross brace,
// drawn once in 3 px retro pixels like the other sprites.
var iron_canvas = null;

function iron_texture() {
  if (iron_canvas) return iron_canvas;
  var c = iron_canvas = document.createElement("canvas"),
    g = c.getContext("2d"),
    px = function(x, y, w, h, col) {
      g.fillStyle = col, g.fillRect(x * 3, y * 3, w * 3, h * 3)
    },
    k;
  c.width = c.height = 81;
  px(0, 0, 27, 27, "#3a3a44");
  px(0, 0, 27, 1, "#8a8a98"), px(0, 0, 1, 27, "#8a8a98");
  px(0, 26, 27, 1, "#16161c"), px(26, 0, 1, 27, "#16161c");
  for (k = 3; k < 24; k++) px(k, k, 2, 1, "#2a2a32"), px(26 - k - 1, k, 2, 1, "#2a2a32");
  [[2, 2], [23, 2], [2, 23], [23, 23], [12, 2], [12, 23], [2, 12], [23, 12]].forEach(function(r) {
    px(r[0], r[1], 2, 2, "#16161c"), px(r[0], r[1], 1, 1, "#b8b8c8")
  });
  return c
}

// Portals (worlds 5+). Each level entry is a pair; this gives one end each,
// linked to the end that glows the same color.
var PORTAL_R = 34; // how close (game pixels) a panther has to fly to go in

function make_portals(pairs) {
  var out = [];
  pairs.forEach(function(p) {
    var color = PP.levels.portalColors[p.pair % PP.levels.portalColors.length],
      a = {
        x: p.x,
        y: p.y,
        color: color,
        r: PORTAL_R
      },
      b = {
        x: p.to.x,
        y: p.to.y,
        color: color,
        r: PORTAL_R
      };
    a.partner = b, b.partner = a, out.push(a, b)
  });
  return out
}

// Glowing, swirling oval for every portal end, redrawn each frame.
function make_portal_node(ends) {
  var node = cc.Node.create();
  node.draw = function(ctx) {
    var g = ctx || cc.renderContext,
      t = Date.now() / 1e3,
      k, e, glow, spin;
    for (k = 0; k < ends.length; k++) {
      e = ends[k], spin = t * 3 + k;
      g.save(), g.translate(e.x, -e.y);
      glow = g.createRadialGradient(0, 0, 10, 0, 0, 80), glow.addColorStop(0, e.color), glow.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = .35 + .15 * Math.sin(t * 4 + k), g.fillStyle = glow, g.fillRect(-80, -80, 160, 160), g.globalAlpha = 1;
      g.beginPath(), g.ellipse(0, 0, 24, 40, 0, 0, Math.PI * 2), g.fillStyle = "rgba(11,4,24,0.85)", g.fill();
      g.lineWidth = 7, g.strokeStyle = e.color, g.stroke();
      g.lineWidth = 3;
      for (var s = 0; s < 3; s++) g.beginPath(), g.ellipse(0, 0, 17 - s * 5, 31 - s * 9, 0, spin * (s % 2 ? -1 : 1) + s * 2, spin * (s % 2 ? -1 : 1) + s * 2 + Math.PI * 1.1), g.stroke();
      g.restore()
    }
  };
  return node
}

// Engine touch point (canvas pixels) -> game world point.
function touch_to_world(touch) {
  var p = touch.getLocation();
  return cc.p(p.x / VIEW_ZOOM, p.y / VIEW_ZOOM)
}

// The engine finds the canvas on the page with offsetLeft/offsetTop, which
// ignores the screen-fit scaling of #main_div and mixes in the camera scroll.
// Give it the real numbers so clicks and touches land where the player sees.
cc.getHTMLElementPosition = (function(original) {
  return function(el) {
    if (el !== cc.canvas) return original(el);
    var box = document.getElementById("main_div").getBoundingClientRect(),
      scale = cc.Director.getInstance()._contentScaleFactor || 1;
    return {
      left: box.left + window.pageXOffset + camera_x() * scale,
      top: box.top + window.pageYOffset,
      height: el.height
    }
  }
})(cc.getHTMLElementPosition);

function resize_screen() {
  if (window.innerWidth < 100) return;
  var scaleval = window.innerHeight / 600;
  if (scaleval * 1000 > window.innerWidth) scaleval = window.innerWidth / 1000;
  document.getElementById("main_div").style.transform = "scale(" + scaleval + "," + scaleval + ")";
  cc.Director.getInstance()._contentScaleFactor = scaleval;
};

function show_frontpage(n) {
  document.getElementById("frontpage_div").style.display = n ? "block" : "none"
}

// w = world to show. Without a number (play button, popups) it shows the
// world of the level just played.
function show_level_select(w) {
  current_world = typeof w == "number" ? w : Math.floor(level_number / LEVELS_PER_WORLD);
  pp_emit("world:show", {
    world: current_world
  });
  for (var n = '<center>WORLD ' + (current_world + 1) + ": " + WORLDS[current_world].name + '<br><br><table class="world-' + (current_world + 1) + '">', t = current_world * LEVELS_PER_WORLD, o = !0, e, i, r, u, f = 0; f < 3; f++) {
    for (n += "<tr>", e = 0; e < 5; e++) {
      if (!storage["ab_level_" + t]) r = !1, i = "&nbsp;";
      else
        for (i = "", r = storage["ab_level_" + t].split(":")[1], u = 0; u <= 2; u++) i += r > u ? "&#9733;" : "&#9734;";
      n += '<td onclick="start_game(' + t + ');">' + (o ? t % LEVELS_PER_WORLD + 1 + '<div style="margin-top:-19px;">' + i + "<\/div><\/td>" : '<img src="sprites/lock.png">'), t++, r || (o = !1)
    }
    n += "<\/tr>"
  }
  n += "<\/table><\/center>";
  n += '<div id="player_tag" title="Change player" onclick="show_name_entry();">PLAYER<br><span>' + esc_html(player_name()) + '<\/span><\/div><div id="winners_button" class="pp_button" onclick="show_winners();">WINNERS<\/div>';
  current_world > 0 && (n += '<div class="world_arrow world_prev" title="Previous world" onclick="show_level_select(' + (current_world - 1) + ');"><\/div>');
  current_world < WORLDS.length - 1 && (n += '<div class="world_arrow world_next" title="Next world" onclick="show_level_select(' + (current_world + 1) + ');"><\/div>');
  document.getElementById("level_select_div").innerHTML = n, document.getElementById("level_select_div").style.display = "block"
}

// The first level of every world is always open; the rest unlock in order.
function start_game(n) {
  play_music();
  n % LEVELS_PER_WORLD != 0 && !storage["ab_level_" + (n - 1)] || (level_number = n, game.init())
}

// Spooky music loop. Browsers only allow sound after a click, so it starts
// when the player does something. Song list and volume: js/config.js -> music.
function play_music() {
  var v = window.PP && PP.config && PP.config.music ? PP.config.music.volume : .3;
  if (!v) return;
  music.ppWanted = !0;
  if (!music.paused) return;
  music.loop = !0, music.volume = v;
  var p = music.play();
  p && p.catch && p.catch(function() {})
}

// Player names and the winners log are shown on screen, so never trust them as HTML.
function esc_html(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]
  })
}

function player_name() {
  return storage.pp_player || "GUEST"
}

// "Who's pouncing?" screen: shown after PLAY, or by clicking the name on the level select.
function show_name_entry() {
  var i = document.getElementById("name_input");
  play_music();
  document.getElementById("level_select_div").style.display = "none";
  document.getElementById("name_div").style.display = "block";
  i.value = storage.pp_player || "";
  i.focus(), i.select()
}

function submit_name() {
  var i = document.getElementById("name_input"),
    v = i.value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 15);
  if (!v) return i.focus();
  storage.pp_player = v;
  document.getElementById("name_div").style.display = "none";
  show_level_select()
}

// Winners log: every level cleared on this computer (newest 50 kept).
function load_winners() {
  try {
    var w = JSON.parse(storage.pp_winners || "[]");
    return w instanceof Array ? w : []
  } catch (e) {
    return []
  }
}

function log_winner(score, stars) {
  var w = load_winners(),
    s = Math.round((Date.now() - game.levelStart) / 1e3),
    r = {
      level: Math.floor(level_number / LEVELS_PER_WORLD) + 1 + "-" + (level_number % LEVELS_PER_WORLD + 1),
      player: player_name(),
      score: score,
      stars: stars,
      time: Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2)
    };
  w.push(r), storage.pp_winners = JSON.stringify(w.slice(-50));
  return r
}

function show_winners() {
  var w = load_winners().slice(-10).reverse(),
    h = '<center>LEVEL WINNERS LOG<br><br><table class="winners_table"><tr><th>LEVEL<\/th><th>PLAYER<\/th><th>SCORE<\/th><th>TIME<\/th><\/tr>',
    k;
  for (k = 0; k < w.length; k++) h += "<tr><td>" + esc_html(w[k].level) + "<\/td><td>" + esc_html(w[k].player) + "<\/td><td>" + esc_html(w[k].score) + "<\/td><td>" + esc_html(w[k].time) + "<\/td><\/tr>";
  w.length || (h += '<tr><td colspan="4">NO WINNERS YET<\/td><\/tr>');
  h += '<\/table><\/center><div class="pp_button winners_back" onclick="document.getElementById(\'winners_div\').style.display=\'none\';">BACK<\/div>';
  document.getElementById("winners_div").innerHTML = h, document.getElementById("winners_div").style.display = "block"
}

function level_up() {
  level_number = (level_number + 1) % (LEVELS_PER_WORLD * WORLDS.length), game.init()
}

// Shake the game for a moment (pumpkin bomb). n = strength in pixels.
function shake_screen(n) {
  var el = document.getElementById("game_div");
  n > .5 ? (el.style.transform = "translate(" + (Math.random() - .5) * 2 * n + "px," + (Math.random() - .5) * 2 * n + "px)", setTimeout(function() {
    shake_screen(n * .8)
  }, 30)) : el.style.transform = ""
}

function show_smoke(n, t, i) {
  i == 0 && (document.getElementById("smoke_div").style.display = "block"), document.getElementById("smoke_div").style.left = n + "px", document.getElementById("smoke_div").style.top = t + "px", document.getElementById("smoke_div").style.backgroundPosition = "0px -" + i * 32 + "px", i++, i < 6 ? setTimeout("show_smoke(" + n + ", " + t + ", " + i + ");", 60) : document.getElementById("smoke_div").style.display = "none"
}

function pan_back(n) {
  if (game.focus_pos != n && !game_over) {
    var t = Math.floor(Date.now() / 1e3);
    if (t - last_hit < 3) return setTimeout("pan_back(" + n + ");", 1e3);
    game.focus_pos = n
  }
}

function leftClick(n) {
  return window.focus(), n || (n = event), typeof n.which == "undefined" ? n.button == 1 : n.which == 1 || n.button == 0
}

function nrc(n) {
  if (leftClick(n) == !1) return ce(n)
}

function cp(n) {
  n || (n = event), n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "undefined" && (n.cancelBubble = !0)
}

function ce(n) {
  return n || (n = event), typeof n.preventDefault != "undefined" ? n.preventDefault() : typeof n.cancelBubble != "undefined" && (n.returnValue = 0, n.cancelBubble = !0), !1
}
var g_resources = function() {
    for (var t = [], i = ["bg", "platform", "bird", "bird_split", "enemy", "enemy_dmg1", "enemy_dmg2", "zombie", "zombie_dmg1", "zombie_dmg2", "sling1", "sling2", "sling3", "ground", "wood1", "wood1_dmg1", "wood1_dmg2", "wood2", "wood2_dmg1", "wood2_dmg2", "glass1", "glass2", "dirt", "dirt_dmg1", "dirt_dmg2", "boulder", "smoke", "menu_refresh", "menu_back"], n = 0; n < i.length; n++) t.push({
      type: "image",
      src: "sprites/" + i[n] + ".png"
    });
    return t
  }(),
  MathH = {
    clamp: function(n, t, i) {
      return Math.min(i, Math.max(n, t))
    }
  },
  BodyUserData = function(n, t) {
    var i = this,
      r = t;
    this.isDead = !1, this.isContacted = !1, this.getObjectRoll = function() {
      return n
    }, this.getFullHealth = function() {
      return t
    }, this.getHealth = function() {
      return i.currentHealth
    }, this.getRemaining = function() {
      return r
    }, this.damage = function(n) {
      this.isDead = (r -= n) <= 0
    }
  },
  GameObjectRoll = {
    Enemy: "Enemy",
    Wood: "Wood",
    Glass: "Glass",
    Bird: "Bird",
    Boulder: "Boulder",
    Dirt: "Dirt"
  },
  j;
Object.freeze(GameObjectRoll);
var b2Body = Box2D.Dynamics.b2Body,
  b2BodyDef = Box2D.Dynamics.b2BodyDef,
  b2FixtureDef = Box2D.Dynamics.b2FixtureDef,
  b2CircleShape = Box2D.Collision.Shapes.b2CircleShape,
  b2EdgeChainDef = Box2D.Collision.Shapes.b2EdgeChainDef,
  b2EdgeShape = Box2D.Collision.Shapes.b2EdgeShape,
  b2MassData = Box2D.Collision.Shapes.b2MassData,
  b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
  b2Shape = Box2D.Collision.Shapes.b2Shape,
  b2Color = Box2D.Common.b2Color,
  b2internal = Box2D.Common.b2internal,
  b2Settings = Box2D.Common.b2Settings,
  b2Mat22 = Box2D.Common.Math.b2Mat22,
  b2Mat33 = Box2D.Common.Math.b2Mat33,
  b2Math = Box2D.Common.Math.b2Math,
  b2Sweep = Box2D.Common.Math.b2Sweep,
  b2Transform = Box2D.Common.Math.b2Transform,
  b2Vec2 = Box2D.Common.Math.b2Vec2,
  b2Vec3 = Box2D.Common.Math.b2Vec3,
  b2AABB = Box2D.Collision.b2AABB,
  b2Bound = Box2D.Collision.b2Bound,
  b2BoundValues = Box2D.Collision.b2BoundValues,
  b2Collision = Box2D.Collision.b2Collision,
  b2ContactID = Box2D.Collision.b2ContactID,
  b2ContactPoint = Box2D.Collision.b2ContactPoint,
  b2ContactListener = Box2D.Dynamics.b2ContactListener,
  b2Distance = Box2D.Collision.b2Distance,
  b2DistanceInput = Box2D.Collision.b2DistanceInput,
  b2DistanceOutput = Box2D.Collision.b2DistanceOutput,
  b2DistanceProxy = Box2D.Collision.b2DistanceProxy,
  b2DynamicTree = Box2D.Collision.b2DynamicTree,
  b2DynamicTreeBroadPhase = Box2D.Collision.b2DynamicTreeBroadPhase,
  b2DynamicTreeNode = Box2D.Collision.b2DynamicTreeNode,
  b2DynamicTreePair = Box2D.Collision.b2DynamicTreePair,
  b2DebugDraw = Box2D.Dynamics.b2DebugDraw,
  b2Manifold = Box2D.Collision.b2Manifold,
  b2ManifoldPoint = Box2D.Collision.b2ManifoldPoint,
  b2Point = Box2D.Collision.b2Point,
  b2RayCastInput = Box2D.Collision.b2RayCastInput,
  b2RayCastOutput = Box2D.Collision.b2RayCastOutput,
  b2Segment = Box2D.Collision.b2Segment,
  b2SeparationFunction = Box2D.Collision.b2SeparationFunction,
  b2Simplex = Box2D.Collision.b2Simplex,
  b2SimplexCache = Box2D.Collision.b2SimplexCache,
  b2SimplexVertex = Box2D.Collision.b2SimplexVertex,
  b2TimeOfImpact = Box2D.Collision.b2TimeOfImpact,
  b2TOIInput = Box2D.Collision.b2TOIInput,
  b2World = Box2D.Dynamics.b2World,
  b2WorldManifold = Box2D.Collision.b2WorldManifold,
  ClipVertex = Box2D.Collision.ClipVertex,
  Features = Box2D.Collision.Features,
  IBroadPhase = Box2D.Collision.IBroadPhase,
  b2 = function() {
    var l = this,
      f = 0,
      t = 0,
      n, s = !1,
      u = [],
      e = 30,
      i = function(n) {
        return n / e
      },
      o = function(n) {
        return n * e
      },
      h = function(n) {
        return -1 * cc.RADIANS_TO_DEGREES(n)
      },
      c = function(n) {
        return cc.DEGREES_TO_RADIANS(-1 * n)
      },
      r = new b2ContactListener;
    return r.BeginContact = function(n) {
      var i = n.GetFixtureA().GetBody(),
        r = n.GetFixtureB().GetBody(),
        u = i.GetUserData(),
        f = r.GetUserData(),
        t = function(n) {
          n && (n.isContacted = !0)
        };
      t(u), t(f)
    }, r.EndContact = function() {}, r.PreSolve = function() {}, r.PostSolve = function(n, i) {
      var f = n.GetFixtureA().GetBody(),
        e = n.GetFixtureB().GetBody(),
        o = f.GetUserData(),
        s = e.GetUserData(),
        r = i.normalImpulses[0],
        u;
      r <= 2 || (u = function(n, i) {
        var u, e, f, o;
        !n || n.getHealth() == n.getFullHealth() && r < 12 || (r > 15 && !n.isDead && n.getObjectRoll() != "Enemy" && !creating_world && (n.getObjectRoll() == "Bird" || n.getObjectRoll() == "Boulder" || game_over ? (u = i.sprite.getPosition(), u.x < 2400 && !game_over && (e = camera_x(), show_smoke(u.x * VIEW_ZOOM + e, 600 - u.y * VIEW_ZOOM, 0), u.y > 120 && (f = parseInt(r), f > 1e3 && (f = 1e3), t += f))) : (sounds[sound_instance++].play(), sound_instance > 5 && (sound_instance = 1), last_hit = Math.floor(Date.now() / 1e3))), o = n.getObjectRoll(), o === GameObjectRoll.Enemy && !creating_world && n.damage(r), o === GameObjectRoll.Wood && !creating_world && r > WOOD_MIN_IMPULSE && n.damage(r * WOOD_DAMAGE_SCALE), o === GameObjectRoll.Glass && !creating_world && r > GLASS_MIN_IMPULSE && n.damage(n.getFullHealth()), o === GameObjectRoll.Dirt && !creating_world && r > STONE_MIN_IMPULSE && n.damage(r * WOOD_DAMAGE_SCALE))
      }, u(o, f), u(s, e))
    }, {
      toWorld: function(n) {
        return i(n)
      },
      toScreen: function(n) {
        return o(n)
      },
      initWorld: function() {
        f = t = 0, game_over = !1, birds_gone = !1, creating_world = !0, n = new b2World(new b2Vec2(0, -GRAVITY), !0), n.SetContinuousPhysics(!0), n.SetContactListener(r), setTimeout("creating_world=false;", 2e3), u = [], document.getElementById("score_div").innerHTML = "000000"
      },
      getUserScore: function() {
        return t
      },
      // every physics body with a sprite (game.js -> checkPortals)
      bodies: function() {
        return u
      },
      // the Box2D world itself (tools/check_levels.js copies it)
      world: function() {
        return n
      },
      enablePhysicsFor: function(t) {
        var o = new b2BodyDef,
          s = {
            x: t.sprite.getScaleX(),
            y: t.sprite.getScaleY()
          },
          h = t.sprite.getAnchorPointInPoints(),
          l = cc.p(h.x * s.x, h.y * s.y),
          a = t.sprite.getPosition(),
          v = t.sprite.getContentSize(),
          e = {
            width: v.width * s.x,
            height: v.height * s.y
          },
          y = cc.p(a.x - l.x + e.width / 2, a.y - l.y + e.height / 2),
          r, f;
        o.type = t.type === "static" ? b2Body.b2_staticBody : t.type === "dynamic" ? b2Body.b2_dynamicBody : b2Body.b2_kinematicBody, o.position.Set(i(y.x), i(y.y)), o.angle = c(t.sprite.getRotation()), r = new b2FixtureDef;
        switch (t.shape) {
          case "circle":
            r.shape = new b2CircleShape(i(t.radius || e.height / 2));
            break;
          case "box":
            r.shape = new b2PolygonShape, r.shape.SetAsBox(i(e.width) / 2, i(e.height) / 2)
        }
        r.density = t.density || 1, r.friction = t.friction || .5, r.restitution = t.restitution || .1, t.groupIndex && (r.filter.groupIndex = t.groupIndex), f = n.CreateBody(o), f.CreateFixture(r), t.userData && f.SetUserData(t.userData), f.sprite = t.sprite, f.ppIron = t.sprite.ppName == "iron", t.sprite.body = f, u.push(f)
      },
      // Pumpkin bomb: push and hurt everything within `radius` px of (px, py),
      // less the further away it is, then remove the bomb's own body.
      // Iron (portal vaults) shields whatever is behind it.
      explode: function(bomb, px, py, radius, power, hurt) {
        var k, b, d, p, dx, dy, dist, f, len, role, from = new b2Vec2(i(px), i(py));
        for (k = 0; k < u.length; k++) {
          if ((b = u[k]) == bomb || !(d = b.GetUserData())) continue;
          p = b.GetWorldCenter(), dx = o(p.x) - px, dy = o(p.y) - py, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= radius || n.RayCastAll(from, p).some(function(fx) {
              return fx.GetBody().ppIron
            })) continue;
          f = 1 - dist / radius, len = dist || 1;
          b.ApplyImpulse(new b2Vec2((dx / len) * power * f, (dy / len + .4) * power * f), p);
          role = d.getObjectRoll();
          role == GameObjectRoll.Glass ? d.damage(d.getFullHealth()) : role != GameObjectRoll.Bird && d.damage(hurt * f)
        }
        last_hit = Math.floor(Date.now() / 1e3), n.DestroyBody(bomb), u.splice(u.indexOf(bomb), 1)
      },
      // World 3 hills: one static body made of thin slices that follow the
      // hill's surface (PP.levels.hillTop). Their bottoms hide in the ground.
      addHills: function(hills) {
        var body = n.CreateBody(new b2BodyDef),
          STEP = 12,
          BASE = 67,
          k, h, x, x1, xb, fd;
        for (k = 0; k < hills.length; k++)
          for (h = hills[k], x = h.x - h.topW / 2 - h.slope, x1 = h.x + h.topW / 2 + h.slope; x < x1; x = xb) {
            xb = Math.min(x + STEP, x1);
            fd = new b2FixtureDef, fd.friction = HILL_FRICTION, fd.restitution = .1, fd.shape = new b2PolygonShape;
            fd.shape.SetAsArray([new b2Vec2(i(x), i(BASE)), new b2Vec2(i(xb), i(BASE)), new b2Vec2(i(xb), i(PP.levels.hillTop(h, xb))), new b2Vec2(i(x), i(PP.levels.hillTop(h, x)))], 4);
            body.CreateFixture(fd)
          }
      },
      simulate: function() {
        var l, y, s, c, r, v;
        for (n.Step(PHYSICS_STEP, 10, 10), l = 0; l < u.length; l++) {
          var i = u[l],
            e = i.GetUserData(),
            p = i.GetPosition(),
            g = i.GetAngle();
          if (e && (i.sprite.getPosition().x > 2440 || i.sprite.getPosition().x < 0) && (e.getObjectRoll() != "Bird" && (e.isDead = !0), e.isContacted = !0), e && e.getObjectRoll() == "Enemy") {
            // enemies can't roll away: keep the whole head inside the enemy area
            var er = o(i.GetFixtureList().GetShape().GetRadius()),
              ex = MathH.clamp(o(p.x), ENEMY_MIN_X + er, ENEMY_MAX_X - er),
              ev = i.GetLinearVelocity();
            ex != o(p.x) && (i.SetPosition(new b2Vec2(ex / o(1), p.y)), (ex > o(p.x) ? ev.x < 0 : ev.x > 0) && i.SetLinearVelocity(new b2Vec2(-ev.x * .3, ev.y)), p = i.GetPosition())
          }
          if (e && e.getObjectRoll() == "Enemy" && e.isDead) {
            n.DestroyBody(i), t += 1e3, f++, i.sprite.runAction(cc.FadeOut.create(.5)), i.SetUserData(null), f == total_enemies && this.set_game_over();
            continue
          }
          if (e && (e.getObjectRoll() == "Wood" || e.getObjectRoll() == "Glass" || e.getObjectRoll() == "Dirt") && e.getRemaining() <= 0) {
            // broken: wood and stone after enough hits, glass after one
            n.DestroyBody(i), t += {
              Glass: 250,
              Wood: 500,
              Dirt: 750
            }[e.getObjectRoll()], i.sprite.runAction(cc.FadeOut.create(.3)), i.SetUserData(null), i.sprite.getPosition().x < 2400 && show_smoke(i.sprite.getPosition().x * VIEW_ZOOM + camera_x(), 600 - i.sprite.getPosition().y * VIEW_ZOOM, 0);
            continue
          }
          if (e && i.sprite.ppHurt !== undefined) {
            // look more beaten up as health runs out: name.png -> name_dmg1.png -> name_dmg2.png
            y = e.getRemaining() / e.getFullHealth(), y = y > .66 ? 0 : y > .33 ? 1 : 2;
            y != i.sprite.ppHurt && (i.sprite.ppHurt = y, i.sprite.setTexture(game.getTexture(i.sprite.ppName + (y ? "_dmg" + y : ""))))
          }
          y = parseInt(document.getElementById("score_div").innerHTML), y < b2.getUserScore() && (s = y + 10, s > b2.getUserScore() && (s = b2.getUserScore()), document.getElementById("score_div").innerHTML = "000000".substr(0, 6 - s.toString().length) + s);
          var a = {
              x: i.sprite.getScaleX(),
              y: i.sprite.getScaleY()
            },
            w = i.sprite.getAnchorPointInPoints(),
            b = cc.p(w.x * a.x, w.y * a.y),
            nt = i.sprite.getPosition(),
            k = i.sprite.getContentSize(),
            d = {
              width: k.width * a.x,
              height: k.height * a.y
            };
          i.sprite.setPosition(cc.p(o(p.x) + b.x - d.width / 2, o(p.y) + b.y - d.height / 2)), i.sprite.setRotation(h(g))
        }
        if (n.ClearForces(), game.focus_pos != -2 && !game.isPanning) {
          if (game.focus_pos >= game.birdCount) return;
          c = game.focus_pos >= 0 ? game.birdSprite[game.focus_pos].getPosition() : {
            x: 1200
          }, r = camera_x(), c.relativeX = c.x * VIEW_ZOOM + r, c.relativeX > 400 ? (game.focus_pos >= 0 ? (game.birdSprite[game.focus_pos]._position.xprev || (game.birdSprite[game.focus_pos]._position.xprev = 0), v = (game.birdSprite[game.focus_pos]._position.x - game.birdSprite[game.focus_pos]._position.xprev) * VIEW_ZOOM, v > 15 && (v = 15), r -= v, game.birdSprite[game.focus_pos]._position.xprev = game.birdSprite[game.focus_pos]._position.x) : r -= 15, r < MIN_SCROLL && (r = MIN_SCROLL), r <= 0 && (document.getElementById("viewport").style.marginLeft = r + "px")) : c.relativeX < 350 && (r += 15, r > 0 && (r = 0), r <= 0 && (document.getElementById("viewport").style.marginLeft = r + "px"))
        }
      },
      set_game_over: function() {
        var i, r, n;
        document.getElementById("preload_div").style.display = "block";
        if (!game_over) {
          for (game_over = !0, i = "", r = Math.min(3, game.birdCount + 1 - game.current_bird), n = 0; n <= 2; n++) i += r > n ? "&#9733;" : "&#9734;";
          document.getElementById("win_popup").style.display = "block", document.getElementById("win_popup_inner").innerHTML = "LEVEL CLEARED!<br>SCORE: " + t + "<br>" + i, storage["ab_level_" + level_number] = t + ":" + r;
          var who = log_winner(t, r);
          document.getElementById("win_popup_inner").innerHTML += '<br><span class="win_who">' + esc_html(who.player) + " &middot; " + who.time + "<\/span>"
        }
      },
      set_birds_gone: function() {
        var n = Math.floor(Date.now() / 1e3);
        if (n - last_hit < 3) return setTimeout("b2.set_birds_gone();", 1e3);
        birds_gone || game.current_bird == 0 || (birds_gone = !0, game_over || (document.getElementById("win_popup").style.display = "none", document.getElementById("preload_div").style.display = "block", document.getElementById("lose_popup").style.display = "block", document.getElementById("lose_popup_inner").innerHTML = "LEVEL FAILED!<br>", cackle_sound.currentTime = 0, cackle_sound.play()))
      },
      debugDraw: function(t) {
        if (s = t) {
          var i = new b2DebugDraw;
          i.SetSprite(document.getElementsByTagName("canvas")[0].getContext("2d")), i.SetDrawScale(e), i.SetFillAlpha(.5), i.SetLineThickness(1), i.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit), n.SetDebugDraw(i)
        }
      }
    }
  }(),
  CMenu = cc.Sprite.extend({
    defaultScale: .8,
    hovered: !1,
    boundingBox: null,
    onClickCallback: null,
    ctor: function(n) {
      this._super(), this.initWithTexture(n), this.setScale(this.defaultScale)
    },
    onClick: function(n) {
      this.onClickCallback = n
    },
    handleTouches: function() {
      this.hovered && this.onClickCallback && this.onClickCallback()
    },
    handleTouchesMoved: function(n) {
      var i = n[0].getLocation();
      this.boundingBox || (this.boundingBox = this.getBoundingBox()), cc.Rect.CCRectContainsPoint(this.boundingBox, i) ? this.hovered || (this.hovered = !0, this.runAction(cc.ScaleTo.create(.01, 1))) : this.hovered && (this.hovered = !1, this.runAction(cc.ScaleTo.create(.01, this.defaultScale)))
    },
    handleTouchesEnded: function() {}
  }),
  GameLayer = cc.Layer.extend({
    birdSprite: null,
    focus_pos: 0,
    isDraggingSling: !1,
    isPanning: !1,
    birdStartPos: cc.p(190, 210),
    slingRadius: {
      min: 20,
      max: 80
    },
    slingAngle: {
      min: cc.DEGREES_TO_RADIANS(250),
      max: cc.DEGREES_TO_RADIANS(295)
    },
    smokeDistance: 16,
    menus: [],
    lastSmoke: null,
    slingRubber1: null,
    slingRubber2: null,
    slingRubber3: null,
    current_bird: 0,
    getTexture: function(n) {
      return n == "iron" ? iron_texture() : cc.TextureCache.getInstance().addImage("sprites/" + n + ".png")
    },
    addObject: function(n) {
      var t = cc.Sprite.createWithTexture(this.getTexture(n.name));
      // ppHurt = current hurt look for things that have _dmg1/_dmg2 sprites
      return t.ppName = n.name, HURT_LOOKS[n.name] && n.userData && (t.ppHurt = 0), t.setAnchorPoint(n.anchor || cc.p(.5, .5)), t.setScaleX(n.scaleX || n.scale || 1), t.setScaleY(n.scaleY || n.scale || 1), t.setRotation(n.rotation || 0), t.setPosition(cc.p(n.x || 0, n.y || 0)), n.shape && b2.enablePhysicsFor({
        type: n.type,
        shape: n.shape,
        sprite: t,
        radius: n.radius,
        density: n.density,
        friction: n.friction,
        userData: n.userData
      }), this.addChild(t, n.z || 0), t
    },
    init: function() {
      resize_screen();
      window.onresize = resize_screen;
      var u, n, t, f, e, i;
      game ? (document.getElementById("frontpage_div").style.display = "none", document.getElementById("level_select_div").style.display = "none", document.getElementById("preload_div").style.display = "none", this.focus_pos = -2, document.getElementById("viewport").style.marginLeft = MIN_SCROLL + "px", setTimeout("pan_back(0);", 3e3)) : (game = this, document.onmouseup = function() {
        game.isPanning = !1
      }, document.ontouchend = function() {
        game.isPanning = !1
      }, document.getElementById("play_button").onclick = show_name_entry, document.getElementById("play_button").innerHTML = '<img src="sprites/play.png">', document.getElementById("viewport").style.cursor = "url('sprites/cursor_open.cur'), pointer"), document.getElementById("win_popup").style.display = "none", document.getElementById("lose_popup").style.display = "none", this._super(), this.removeAllChildrenWithCleanup(!0), this.setTouchEnabled(!0), this.setAnchorPoint(cc.p(0, 0)), this.setScale(VIEW_ZOOM), this.current_bird = 0, this.isDraggingSling = !1, this.armed = [], this.levelStart = Date.now();
      var r = cc.Director.getInstance(),
        o = this,
        s = r.getWinSize();
      b2.initWorld(), u = this.addObject({
        name: "ground",
        scaleX: 1,
        anchor: cc.p(0, 0),
        type: "static",
        shape: "box",
        density: 0
      }), n = [], n[0] = [{
        name: "wood1",
        x: 840.5,
        y: 71,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1017.5,
        y: 71,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 931.5,
        y: 131.5,
        scaleX: 1.3,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 931.5,
        y: 251.5,
        scaleX: 1.3,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 880,
        y: 330,
        rotation: -40,
        scaleX: .8,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 980,
        y: 330,
        rotation: 40,
        scaleX: .8,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 840.5,
        y: 200.5,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1017.5,
        y: 200.5,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 930,
        y: 300,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 931.5,
        y: 71,
        type: "dynamic",
        shape: "circle",
        density: 2,
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 931.5,
        y: 180,
        type: "dynamic",
        shape: "circle",
        density: 2,
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[1] = [{
        name: "enemy",
        x: 1002,
        y: 90,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 150)
      }, {
        name: "wood1",
        x: 903,
        y: 90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 904,
        y: 171,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 903,
        y: 252,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 903,
        y: 333,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 901,
        y: 415,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 150)
      }], n[2] = [{
        name: "wood1",
        x: 726,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 722,
        y: 173,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 910,
        y: 88,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 911,
        y: 169,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 909,
        y: 251,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1090,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1091,
        y: 175,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1092,
        y: 257,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1085,
        y: 338,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 722,
        y: 193,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 908,
        y: 271,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 1087,
        y: 357,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[3] = [{
        name: "dirt",
        x: 859,
        y: 91,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 859,
        y: 172,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "enemy",
        x: 944,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 100)
      }, {
        name: "dirt",
        x: 1130,
        y: 90,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 1130,
        y: 171,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 1130,
        y: 251,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "wood1",
        x: 859,
        y: 253,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 859,
        y: 333,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 1040,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 100)
      }], n[4] = [{
        name: "dirt",
        x: 748,
        y: 92,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "enemy",
        x: 746,
        y: 200,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 200)
      }, {
        name: "wood1",
        x: 900,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 900,
        y: 175,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 900,
        y: 258,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 900,
        y: 335,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 900,
        y: 412,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 900,
        y: 480,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 996,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 100)
      }, {
        name: "enemy",
        x: 1086,
        y: 91,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 100)
      }], n[5] = [{
        name: "wood2",
        x: 859,
        y: 193,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1016,
        y: 192,
        rotation: -271,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 934,
        y: 295,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 946,
        y: 91,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 938,
        y: 317,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[12] = [{
        name: "dirt",
        x: 1103,
        y: 90,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 856,
        y: 257,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 855,
        y: 92,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 855,
        y: 175,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "enemy",
        x: 931,
        y: 526,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood2",
        x: 978,
        y: 504,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "dirt",
        x: 1104,
        y: 422,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 1103,
        y: 340,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 1104,
        y: 257,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "dirt",
        x: 1103,
        y: 172,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "enemy",
        x: 936,
        y: 90,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 1024,
        y: 90,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 980,
        y: 158,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 855,
        y: 340,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 855,
        y: 423,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }], n[7] = [{
        name: "wood1",
        x: 806,
        y: 90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 864,
        y: 172,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 922,
        y: 254,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 960,
        y: 336,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1003,
        y: 253,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1058,
        y: 172,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1117,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 923,
        y: 90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1005,
        y: 90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 962,
        y: 172,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[8] = [{
        name: "wood1",
        x: 806,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 806,
        y: 173,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 807,
        y: 257,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 719,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 721,
        y: 174,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 634,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 896,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 805,
        y: 341,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 721,
        y: 257,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 634,
        y: 177,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[9] = [{
        name: "wood2",
        x: 645,
        y: 193,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 790,
        y: 192,
        rotation: -270,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 714,
        y: 294,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 721,
        y: 90,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood2",
        x: 892,
        y: 312,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1074,
        y: 292,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 994,
        y: 191,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1149,
        y: 191,
        rotation: -270,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 1086,
        y: 91,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 901,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 888,
        y: 331,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 706,
        y: 314,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 1068,
        y: 312,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[10] = [{
        name: "wood2",
        x: 645,
        y: 193,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 790,
        y: 192,
        rotation: -270,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 714,
        y: 294,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 721,
        y: 90,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood2",
        x: 892,
        y: 312,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1074,
        y: 292,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 994,
        y: 191,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 1149,
        y: 191,
        rotation: -270,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 1086,
        y: 91,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 901,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 888,
        y: 331,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 706,
        y: 314,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 1068,
        y: 312,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood2",
        x: 816,
        y: 433,
        rotation: -90,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 971,
        y: 434,
        rotation: -270,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 892,
        y: 536,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 893,
        y: 558,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], n[11] = [{
        name: "wood1",
        x: 772,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 951,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 854,
        y: 174,
        scaleX: 1.3,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 771,
        y: 194,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 953,
        y: 193,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 862,
        y: 277,
        scaleX: 1.3,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 864,
        y: 93,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 865,
        y: 195,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 771,
        y: 298,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 950,
        y: 298,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 858,
        y: 381,
        scaleX: 1.3,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 862,
        y: 298,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 860,
        y: 404,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 798,
        y: 467,
        scaleX: .8,
        rotation: -46,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 923,
        y: 470,
        scaleX: .8,
        rotation: -300,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }], n[6] = [{
        name: "wood1",
        x: 806,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1012,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 905,
        y: 256,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 899,
        y: 279,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "dirt",
        x: 558,
        y: 91,
        type: "static",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Dirt, 2e3)
      }, {
        name: "wood1",
        x: 558,
        y: 174,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 557,
        y: 340,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 558,
        y: 257,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 806,
        y: 173,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1012,
        y: 173,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }], n[13] = [{
        name: "wood1",
        x: 786,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 952,
        y: 91,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 869,
        y: 92,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 785,
        y: 176,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 786,
        y: 260,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 785,
        y: 342,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 951,
        y: 173,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 952,
        y: 255,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 952,
        y: 340,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 867,
        y: 172,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 869,
        y: 257,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "wood1",
        x: 701,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 702,
        y: 177,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 702,
        y: 259,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 702,
        y: 343,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 618,
        y: 92,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 619,
        y: 176,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 619,
        y: 258,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 619,
        y: 342,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }], n[14] = [{
        name: "wood1",
        x: 773,
        y: 91,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 788,
        y: 173,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 804,
        y: 256,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood2",
        x: 891,
        y: 336,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 992,
        y: 254,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1009,
        y: 172,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 1032,
        y: 90,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 852,
        y: 356,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "wood1",
        x: 934,
        y: 356,
        rotation: -360,
        type: "dynamic",
        shape: "box",
        userData: new BodyUserData(GameObjectRoll.Wood, 2e3)
      }, {
        name: "enemy",
        x: 900,
        y: 439,
        rotation: -360,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 910,
        y: 91,
        rotation: -360,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 1129,
        y: 92,
        rotation: -360,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }, {
        name: "enemy",
        x: 674,
        y: 89,
        rotation: -360,
        type: "dynamic",
        shape: "circle",
        userData: new BodyUserData(GameObjectRoll.Enemy, 400)
      }], total_enemies = 0;
      var world = Math.floor(level_number / LEVELS_PER_WORLD),
        loaded = world == 0 ? {
          list: n[level_number]
        } : PP.levels.load(world, level_number % LEVELS_PER_WORLD),
        level = loaded.list,
        hills = [],
        portals = [];
      for (t in level) level[t].hill && hills.push(level[t]), level[t].portal && portals.push(level[t]);
      hills.length && (b2.addHills(hills), this.addChild(make_hill_node(hills), 0));
      this.portals = make_portals(portals), portals.length && this.addChild(make_portal_node(this.portals), 3);
      PP.portals = this.portals;
      PP.groundAt = function(x) {
        for (var k = 0, y = 87; k < hills.length; k++) y = Math.max(y, PP.levels.hillTop(hills[k], x));
        return y
      };
      for (t in level) level[t].hill || level[t].portal || (world == 0 && (level[t].y += 30, level[t].x += 500), level[t].userData && level[t].userData.getObjectRoll() == GameObjectRoll.Dirt && (level[t].type = "dynamic", level[t].density = STONE_DENSITY, level[t].friction = STONE_FRICTION, level[t].userData = new BodyUserData(GameObjectRoll.Dirt, STONE_HEALTH)), this.addObject(level[t]), level[t].userData && level[t].userData.getObjectRoll() == GameObjectRoll.Enemy && total_enemies++);
      // birds: the world's list, or (world 3 on) the level's own line-up
      this.birdTypes = WORLDS[world].birds || loaded.birds;
      for (this.birdCount = this.birdTypes.length, this.birdSprite = [], t = 0; t < this.birdCount; t++) this.birdSprite[t] = this.addObject({
        name: this.birdTypes[t],
        scale: BIRD_SCALE[this.birdTypes[t]],
        // the queue squeezes together when there are many, so all stay on screen
        x: 130 - t * Math.min(50, this.birdCount > 3 ? 120 / (this.birdCount - 1) : 50),
        y: this.birdTypes[t] == "bird_split" ? 106 : 110, // sitting on the ground
        z: 1
      });
      f = this.addObject({
        name: "sling1",
        x: 214,
        y: 87,
        scale: .7,
        anchor: cc.p(1, 0)
      }), e = this.addObject({
        name: "sling2",
        x: 198,
        y: 144,
        scale: .7,
        anchor: cc.p(1, 0),
        z: 3
      }), this.slingRubber1 = this.addObject({
        name: "sling3",
        x: 208,
        y: 205,
        scaleY: .7,
        scaleX: 0,
        anchor: cc.p(1, .5),
        z: 0
      }), this.slingRubber2 = this.addObject({
        name: "sling3",
        x: 180,
        y: 210,
        scaleY: .7,
        scaleX: 0,
        anchor: cc.p(1, .5),
        z: 2
      }), this.slingRubber3 = null, i = cc.Spawn.create(cc.RotateBy.create(1.5, 360), cc.JumpTo.create(1.5, this.birdStartPos, 100, 1)), this.birdSprite[this.current_bird].runAction(i), this.scheduleUpdate(), pp_emit("level:start", {
        level: level_number,
        world: world
      })
    },
    update: function() {
      var i, t, r, u;
      if (b2.simulate(), this.checkPortals(), this.pulseArmed(), this.current_bird < this.birdCount && this.birdSprite[this.current_bird].body) {
        if (i = this.birdSprite[this.current_bird].body.GetUserData(), t = this.birdSprite[this.current_bird].getPosition(), !i || i.isContacted) {
          this.respawn_bird();
          return
        }
        r = cc.pSub(t, this.lastSmoke && this.lastSmoke.getPosition() || cc.p(0, 0)), u = cc.pLength(r), u >= this.smokeDistance && (this.lastSmoke = this.addObject({
          name: "smoke",
          x: t.x,
          y: t.y,
          scale: Math.random() >= .5 ? .8 : .6
        }))
      }
    },
    // Pumpkins that can still blow up throb, so players know to tap.
    pulseArmed: function() {
      for (var k = 0, s, t = Date.now() / 1e3; this.armed && k < this.armed.length; k++)
        s = this.armed[k], s.body && s.setScale(BIRD_SCALE.boulder * (1 + .08 * Math.sin(t * 12)))
    },
    // A flying panther (or split piece / pumpkin) that enters a portal pops
    // out of the same-colored one, keeping its speed. A short cool-down stops
    // it from bouncing straight back.
    checkPortals: function() {
      var ends = this.portals,
        list, now, k, j, b, d, p, x, y, e;
      if (!ends || !ends.length) return;
      for (list = b2.bodies(), now = Date.now(), k = 0; k < list.length; k++) {
        b = list[k], d = b.GetUserData();
        if (!d || d.getObjectRoll() != GameObjectRoll.Bird || b.ppPortalUntil > now) continue;
        p = b.GetPosition(), x = b2.toScreen(p.x), y = b2.toScreen(p.y);
        for (j = 0; j < ends.length; j++)
          if (e = ends[j], (x - e.x) * (x - e.x) + (y - e.y) * (y - e.y) < e.r * e.r) {
            b.SetPosition(new b2Vec2(b2.toWorld(e.partner.x), b2.toWorld(e.partner.y))), b.ppPortalUntil = now + 600;
            b.sprite && b.sprite.setPosition(cc.p(e.partner.x, e.partner.y));
            sounds[0].currentTime = 0, sounds[0].play(), pp_emit("bird:portal", {
              from: e,
              to: e.partner
            });
            break
          }
      }
    },
    respawn_bird: function() {
      if (this.current_bird++, this.current_bird < this.birdCount) {
        var n = cc.Spawn.create(cc.RotateBy.create(1.5, 360), cc.JumpTo.create(1.5, this.birdStartPos, 100, 1));
        this.birdSprite[this.current_bird].runAction(n), setTimeout("if(!game_over&&!game.isPanning){pan_back(game.current_bird);}", 4e3)
      } else birds_gone || setTimeout("b2.set_birds_gone();", 4e3)
    },
    // Density for the bird in the slingshot. Every kind flies the same arc;
    // the pumpkin bomb is heavier (and gets a matching bigger push).
    birdDensity: function() {
      var b = this.birdTypes[this.current_bird];
      return b == "bird_split" ? SPLIT_DENSITY : b == "boulder" ? BIRD_DENSITY * this.birdPower() * Math.pow(22 / this.birdRadius(), 2) : BIRD_DENSITY
    },
    birdPower: function() {
      return this.birdTypes[this.current_bird] == "boulder" ? PUMPKIN_WEIGHT : 1
    },
    birdRadius: function() {
      var s = this.birdSprite[this.current_bird];
      return s.getContentSize().height * s.getScaleY() / 2
    },
    // Tap while a split bird is flying: it becomes three, fanning out.
    trySplit: function() {
      var s = this.birdSprite[this.current_bird],
        d = s && s.body && s.body.GetUserData(),
        b, v, p, f, k, a, sp, piece;
      if (!d || d.isContacted || s.ppName != "bird_split" || s.ppSplit) return !1;
      s.ppSplit = !0, b = s.body, v = b.GetLinearVelocity(), p = s.getPosition(), f = b.GetFixtureList(), sp = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
      f.SetDensity(SPLIT_DENSITY / 2), b.ResetMassData(), b.SetLinearVelocity(v);
      for (k = -1; k <= 1; k += 2) {
        a = SPLIT_ANGLE * k, piece = this.addObject({
          name: "bird_split",
          x: p.x - v.y / sp * 40 * k,
          y: p.y + v.x / sp * 40 * k,
          rotation: s.getRotation(),
          z: 1
        }), b2.enablePhysicsFor({
          type: "dynamic",
          shape: "circle",
          sprite: piece,
          density: SPLIT_DENSITY / 2,
          restitution: .4,
          groupIndex: -1,
          userData: new BodyUserData(GameObjectRoll.Bird, 250)
        }), piece.body.SetLinearVelocity(new b2Vec2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a))), piece.body.SetAngularVelocity(b.GetAngularVelocity())
      }
      return show_smoke(p.x * VIEW_ZOOM + camera_x() - 16, 600 - p.y * VIEW_ZOOM - 16, 0), sounds[0].currentTime = 0, sounds[0].play(), pp_emit("bird:split", {
        x: p.x,
        y: p.y
      }), !0
    },
    // Tap while a pumpkin bomb is flying, or after it has landed: BOOM
    // (js/config.js -> randomBirds). The newest live pumpkin goes off first.
    tryExplode: function() {
      var armed = this.armed || [],
        s, d, cfg = PP.config.randomBirds,
        p, k, a, puff;
      while (armed.length && !(armed[armed.length - 1].body && (d = armed[armed.length - 1].body.GetUserData()))) armed.pop();
      if (!armed.length) return !1;
      s = armed.pop(), p = s.getPosition(), d.isContacted = !0;
      var R = cfg.blastRadius || 340;
      b2.explode(s.body, p.x, p.y, R, cfg.blastPower || 220, cfg.blastDamage || 4500);
      s.runAction(cc.Spawn.create(cc.ScaleTo.create(.3, 3), cc.FadeOut.create(.3)));
      // fireball: two rings of smoke flying out to the edge of the blast
      for (k = 0; k < 24; k++) a = k / 12 * Math.PI * 2 + (k >= 12 ? .26 : 0), puff = this.addObject({
        name: "smoke",
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        scale: k >= 12 ? 2 : 3,
        z: 4
      }), puff.runAction(cc.Spawn.create(cc.MoveBy.create(.6, cc.p(Math.cos(a) * R * (k >= 12 ? .5 : .85), Math.sin(a) * R * (k >= 12 ? .5 : .85))), cc.ScaleTo.create(.6, k >= 12 ? 6 : 8), cc.FadeOut.create(.6)));
      show_smoke(p.x * VIEW_ZOOM + camera_x() - 16, 600 - p.y * VIEW_ZOOM - 16, 0);
      shake_screen(14);
      for (k = 1; k <= 2; k++) sounds[k].volume = 1, sounds[k].currentTime = 0, sounds[k].play();
      setTimeout(function() {
        sounds[1].volume = sounds[2].volume = .2
      }, 600);
      pp_emit("bird:explode", {
        x: p.x,
        y: p.y
      });
      return !0
    },
    onTouchesBegan: function(n, t) {
      if (!game_over) {
        if (this.isDraggingSling) return this.onTouchesEnded(n, t);
        // Grab only on the bird itself, plus a small forgiving ring around it
        // (js/config.js -> sling.grabMargin, in screen pixels).
        var i = touch_to_world(n[0]),
          b = this.current_bird < this.birdCount && this.birdSprite[this.current_bird],
          r = b && cc.pSub(b.getPosition(), i),
          g = b && b.getContentSize().height * b.getScaleY() / 2 + SLING_GRAB_MARGIN / VIEW_ZOOM,
          grab = b && !b.body && cc.pLength(r) < g;
        // any other tap: split the flying cat or blow up a pumpkin
        if (!grab && (this.trySplit() || this.tryExplode())) return;
        if (b) {
          (this.isDraggingSling = grab) && !this.slingRubber3 && (this.slingRubber3 = this.addObject({
            name: "sling3",
            x: i.x,
            y: i.y,
            scaleY: 1.5,
            scaleX: 2,
            anchor: cc.p(0, .5),
            z: 1
          }))
        }
        this.isDraggingSling ? document.getElementById("viewport").style.cursor = "url('sprites/cursor_hold.cur'), pointer" : (this.isPanning = {
          x: n[0].getLocation().x,
          start: 0
        }, this.focus_pos = -2)
      }
    },
    onTouchesMoved: function(n) {
      var f, r, e, o;
      if (this.isPanning) {
        f = {
          x: n[0].getLocation().x
        }, r = -(this.isPanning.start + (this.isPanning.x - (f.x + camera_x()))), r > 0 && (r = 0), r < MIN_SCROLL && (r = MIN_SCROLL), document.getElementById("viewport").style.marginLeft = r + "px", this.focus_pos = -2;
        return
      }
      if (this.isDraggingSling && !(this.current_bird >= this.birdCount) && !this.birdSprite[this.current_bird].body) {
        this.slingRubber1.setVisible(!0), this.slingRubber2.setVisible(!0), this.slingRubber3.setVisible(!0);
        var f = touch_to_world(n[0]),
          s = cc.pSub(f, this.birdStartPos),
          u = cc.pLength(s),
          i = cc.pToAngle(s);
        i = i < 0 ? Math.PI * 2 + i : i, u = MathH.clamp(u, this.slingRadius.min, this.slingRadius.max), i <= this.slingAngle.max && i >= this.slingAngle.min && (u = this.slingRadius.min), this.birdSprite[this.current_bird].setPosition(cc.pAdd(this.birdStartPos, cc.p(u * Math.cos(i), u * Math.sin(i)))), e = function(n, t, i, r) {
          var e = n.getPosition(),
            o = cc.pSub(t, e),
            f = cc.pToAngle(o),
            s = cc.RADIANS_TO_DEGREES(f),
            u = cc.pLength(o) + (i || 8);
          n.setRotation(-s), n.setScaleX(-(u / n.getContentSize().width)), r && (n.setScaleY(1.1 - .7 / this.slingRadius.max * u), this.slingRubber3.setRotation(-s), this.slingRubber3.setPosition(cc.pAdd(e, cc.p(u * Math.cos(f), u * Math.sin(f)))))
        }.bind(this), o = this.birdSprite[this.current_bird].getPosition(), e(this.slingRubber2, o, 13, !0), e(this.slingRubber1, o, 0), this.slingRubber1.setScaleY(this.slingRubber2.getScaleY()), pp_emit("sling:aim", {
          x: o.x,
          y: o.y,
          impulseX: (this.birdStartPos.x - o.x) * LAUNCH_POWER * this.birdPower(),
          impulseY: (this.birdStartPos.y - o.y) * LAUNCH_POWER * this.birdPower(),
          radius: this.birdRadius(),
          density: this.birdDensity(),
          gravity: GRAVITY,
          step: PHYSICS_STEP,
          pxPerMetre: b2.toScreen(1),
          power: cc.pLength(cc.pSub(o, this.birdStartPos)) / this.slingRadius.max
        })
      }
    },
    onTouchesEnded: function() {
      pp_emit("sling:release");
      if (document.getElementById("viewport").style.cursor = "url('sprites/cursor_open.cur'), pointer", this.isPanning) {
        this.isPanning = !1;
        return
      }
      if (!(this.current_bird >= this.birdCount) && !this.birdSprite[this.current_bird].body && this.isDraggingSling) {
        this.slingRubber1.setVisible(!1), this.slingRubber2.setVisible(!1), this.slingRubber3.setVisible(!1), b2.enablePhysicsFor({
          type: "dynamic",
          shape: "circle",
          sprite: this.birdSprite[this.current_bird],
          density: this.birdDensity(),
          restitution: .4,
          groupIndex: this.birdTypes[this.current_bird] == "bird_split" ? -1 : 0,
          userData: new BodyUserData(GameObjectRoll.Bird, 250)
        });
        var i = cc.pSub(this.birdStartPos, this.birdSprite[this.current_bird].getPosition()),
          r = cc.pMult(i, LAUNCH_POWER * this.birdPower()),
          u = this.birdSprite[this.current_bird].body.GetWorldCenter();
        this.birdSprite[this.current_bird].body.ApplyImpulse(r, u), this.birdTypes[this.current_bird] == "boulder" && this.armed.push(this.birdSprite[this.current_bird]), sounds[0].play(), this.focus_pos = this.current_bird, this.isDraggingSling = !1, pp_emit("sling:launch", {
          x: this.birdSprite[this.current_bird].getPosition().x,
          y: this.birdSprite[this.current_bird].getPosition().y,
          power: cc.pLength(i) / this.slingRadius.max
        })
      }
    },
    onKeyUp: function() {},
    onKeyDown: function() {}
  }),
  GameScene = cc.Scene.extend({
    onEnter: function() {
      this._super();
      var n = new GameLayer;
      n.init(), this.addChild(n)
    }
  }),
  game = !1,
  level_number = 0,
  birds_gone = !1,
  game_over = !1,
  total_enemies = 0,
  creating_world = !1,
  last_hit = Math.floor(Date.now() / 1e3),
  oggs = ["sound_launch", "sound_hit", "sound_hit", "sound_hit", "sound_hit", "sound_hit"],
  sounds = new Array(oggs.length),
  cackle_sound = new Audio("sound/sound_cackle.wav"), // evil laugh when a level is lost (tools/make_sounds.py)
  music = new Audio(), // background music, see play_music()
  music_file = 0,
  sound_instance = 1;
for (j = 0; j < oggs.length; j++) sounds[j] = new Audio(""), sounds[j].src = "sound/" + oggs[j] + ".mp3", j > 0 && (sounds[j].volume = .2);
// Try each song in js/config.js -> music.files; a missing file falls through to the next.
var MUSIC_FILES = window.PP && PP.config && PP.config.music && PP.config.music.files || ["sound/music_theme.wav"];
music.onerror = function() {
  ++music_file < MUSIC_FILES.length && (music.src = MUSIC_FILES[music_file], music.ppWanted && play_music())
}, music.preload = "auto", music.src = MUSIC_FILES[0];
typeof document.oncontextmenu != "undefined" ? document.oncontextmenu = ce : document.onclick = nrc, typeof document.onselectstart != "undefined" && (document.onselectstart = ce)