/*
 * Panther Pounce - level checker: proves every level can be beaten.
 *
 * A bot plays each level in its own copy of the physics world (same Box2D
 * settings and damage rules as game.js, plus portals and the enemy fence).
 * For every panther it tries aimed shots at each enemy and portal plus a
 * spread of angles and powers, keeps the shot that does the most, and moves
 * on. A level passes if the bot clears it with the panthers the level gives.
 * The bot only uses plain panthers (no splitting or pumpkin blasts), so real
 * players have it a little easier.
 *
 * How to run: start the game (python -m http.server 8000), open
 * http://localhost:8000/ and in the browser console:
 *
 *   var s = document.createElement('script'); s.src = 'tools/check_levels.js'; document.body.appendChild(s);
 *   PP.check.levels(0, 149).then(r => console.table(r));   // level_number range
 *
 * PP.check.progress shows how far it got.
 */
(function() {
  var STEP = 1 / 60,
    PX = 30, // pixels per metre, as in game.js
    START = { x: 190, y: 210 }, // slingshot (GameLayer.birdStartPos)
    BIRD_R = 22,
    MASS = BIRD_DENSITY * Math.PI * Math.pow(BIRD_R / PX, 2),
    POWERS = [80, 72, 64, 56, 48, 40], // slingshot pull in pixels (80 = full)
    MAX_ANGLE = 69.5; // the slingshot can't be pulled straight down

  // ------------------------------------------------------------ physics copy

  function cloneInto(W, s) {
    var def = new b2BodyDef,
      b, k, f, fd;
    def.type = s.type, def.position.Set(s.x, s.y), def.angle = s.angle;
    b = W.CreateBody(def);
    for (k = 0; k < s.fixtures.length; k++) {
      f = s.fixtures[k], fd = new b2FixtureDef;
      fd.shape = f.shape.Copy(), fd.density = f.density, fd.friction = f.friction, fd.restitution = f.restitution, fd.filter.groupIndex = f.group;
      b.CreateFixture(fd)
    }
    b.SetLinearVelocity(new b2Vec2(s.vx, s.vy)), b.SetAngularVelocity(s.w), b.SetAwake(s.awake);
    s.data && b.SetUserData({
      role: s.data.role,
      full: s.data.full,
      rem: s.data.rem
    });
    b.ppIron = s.iron;
    return b
  }

  function snapshotWorld(W, fromGame) {
    var out = [],
      b, f, d, p, v, fx;
    for (b = W.GetBodyList(); b; b = b.GetNext()) {
      if (!b.GetFixtureList()) continue;
      d = b.GetUserData(), p = b.GetPosition(), v = b.GetLinearVelocity(), fx = [];
      if (!fromGame && d && d.dead) continue;
      for (f = b.GetFixtureList(); f; f = f.GetNext()) fx.push({
        shape: f.GetShape(),
        density: f.GetDensity(),
        friction: f.GetFriction(),
        restitution: f.GetRestitution(),
        group: f.GetFilterData().groupIndex
      });
      out.push({
        type: b.GetType(),
        x: p.x,
        y: p.y,
        angle: b.GetAngle(),
        vx: v.x,
        vy: v.y,
        w: b.GetAngularVelocity(),
        awake: b.IsAwake(),
        iron: !!b.ppIron,
        fixtures: fx,
        data: d ? (fromGame ? {
          role: d.getObjectRoll(),
          full: d.getFullHealth(),
          rem: d.getRemaining()
        } : { role: d.role, full: d.full, rem: d.rem }) : null
      })
    }
    return out
  }

  // A running copy of a level. damage = false while things settle.
  function Sim(snap, portals) {
    var self = this,
      W = this.W = new b2World(new b2Vec2(0, -GRAVITY), !0),
      L = new Box2D.Dynamics.b2ContactListener;
    W.SetContinuousPhysics(!0);
    this.damage = !1, this.kills = 0, this.portals = portals || [], this.hurt = 0;
    L.PostSolve = function(c, imp) {
      var r = imp.normalImpulses[0];
      if (!self.damage || r <= 2) return;
      [c.GetFixtureA().GetBody(), c.GetFixtureB().GetBody()].forEach(function(b) {
        var d = b.GetUserData();
        if (!d || d.dead) return;
        if (d.role == "Enemy") d.rem -= r, self.hurt += Math.min(r, d.full) / d.full;
        else if (d.role == "Wood" && r > WOOD_MIN_IMPULSE) d.rem -= r * WOOD_DAMAGE_SCALE;
        else if (d.role == "Glass" && r > GLASS_MIN_IMPULSE) d.rem = 0;
        else if (d.role == "Dirt" && r > STONE_MIN_IMPULSE) d.rem -= r * WOOD_DAMAGE_SCALE;
      })
    };
    W.SetContactListener(L);
    snap.forEach(function(s) { cloneInto(W, s) });
  }

  Sim.prototype.enemies = function() {
    var n = 0;
    for (var b = this.W.GetBodyList(); b; b = b.GetNext()) {
      var d = b.GetUserData();
      d && !d.dead && d.role == "Enemy" && n++
    }
    return n
  };

  // One physics step with game.js's rules after it (simulate + checkPortals).
  Sim.prototype.step = function() {
    var W = this.W,
      kill = [],
      b, d, p, x, r, cx, v, k, e;
    W.Step(STEP, 10, 10), W.ClearForces();
    for (b = W.GetBodyList(); b; b = b.GetNext()) {
      if (!(d = b.GetUserData()) || d.dead) continue;
      p = b.GetPosition(), x = p.x * PX;
      if ((x > 2440 || x < 0) && d.role != "Bird") d.rem = 0;
      if (d.role == "Enemy") {
        r = b.GetFixtureList().GetShape().GetRadius() * PX, cx = Math.max(ENEMY_MIN_X + r, Math.min(ENEMY_MAX_X - r, x));
        if (cx != x) v = b.GetLinearVelocity(), b.SetPosition(new b2Vec2(cx / PX, p.y)), (cx > x ? v.x < 0 : v.x > 0) && b.SetLinearVelocity(new b2Vec2(-v.x * .3, v.y));
      }
      if (d.role == "Bird") {
        if (d.cool > 0) d.cool--;
        else
          for (k = 0; k < this.portals.length; k++)
            if (e = this.portals[k], Math.pow(x - e.x, 2) + Math.pow(p.y * PX - e.y, 2) < e.r * e.r) {
              b.SetPosition(new b2Vec2(e.partner.x / PX, e.partner.y / PX)), d.cool = 36;
              break
            }
      } else if (d.rem <= 0) kill.push(b);
    }
    for (k = 0; k < kill.length; k++) d = kill[k].GetUserData(), d.dead = !0, d.role == "Enemy" && this.kills++, W.DestroyBody(kill[k]);
  };

  // Run until everything is still (or `max` steps).
  Sim.prototype.run = function(min, max) {
    for (var k = 0; k < max; k++) {
      this.step();
      if (k >= min && k % 15 == 0 && this.still()) break
    }
  };

  Sim.prototype.still = function() {
    for (var b = this.W.GetBodyList(); b; b = b.GetNext()) {
      if (b.GetType() != b2Body.b2_dynamicBody || !b.IsAwake()) continue;
      var v = b.GetLinearVelocity();
      if (v.x * v.x + v.y * v.y > .05) return !1
    }
    return !0
  };

  Sim.prototype.launch = function(u, deg) {
    var a = deg * Math.PI / 180,
      pos = { x: START.x - u * Math.cos(a), y: START.y - u * Math.sin(a) },
      def = new b2BodyDef,
      fd = new b2FixtureDef,
      b;
    def.type = b2Body.b2_dynamicBody, def.position.Set(pos.x / PX, pos.y / PX);
    b = this.W.CreateBody(def);
    fd.shape = new b2CircleShape(BIRD_R / PX), fd.density = BIRD_DENSITY, fd.friction = .5, fd.restitution = .4;
    b.CreateFixture(fd), b.SetUserData({ role: "Bird", full: 250, rem: 250, cool: 0 });
    b.ApplyImpulse(new b2Vec2((START.x - pos.x) * LAUNCH_POWER, (START.y - pos.y) * LAUNCH_POWER), b.GetWorldCenter());
  };

  // ------------------------------------------------------------ aiming

  // Flight path for every pull/angle (no obstacles, but portals and hills).
  function paths(portals) {
    var out = [],
      k, j, deg, u, a, vx, vy, x, y, pts, wait, i, e;
    for (k = 0; k < POWERS.length; k++)
      for (deg = -20; deg <= MAX_ANGLE; deg += .25) {
        u = POWERS[k], a = deg * Math.PI / 180;
        x = START.x - u * Math.cos(a), y = START.y - u * Math.sin(a);
        vx = (START.x - x) * LAUNCH_POWER / MASS * PX, vy = (START.y - y) * LAUNCH_POWER / MASS * PX;
        pts = [], wait = 0;
        for (i = 0; i < 300; i++) {
          vy -= GRAVITY * PX * STEP, x += vx * STEP, y += vy * STEP;
          if (--wait < 0)
            for (j = 0; j < portals.length; j++)
              if (e = portals[j], Math.pow(x - e.x, 2) + Math.pow(y - e.y, 2) < e.r * e.r) {
                x = e.partner.x, y = e.partner.y, wait = 36;
                break
              }
          if (y < (PP.groundAt ? PP.groundAt(x) : 87) + BIRD_R - 30 || x > 2400) break;
          i % 2 || pts.push(x, y)
        }
        out.push({ u: u, deg: deg, pts: pts })
      }
    return out
  }

  // Shots whose path goes through (tx, ty): the best low and high arc per power.
  function aimAt(all, tx, ty, tol) {
    var best = {},
      k, p, j, d, m, key;
    for (k = 0; k < all.length; k++) {
      for (p = all[k], m = 1e9, j = 0; j < p.pts.length; j += 2) d = Math.pow(p.pts[j] - tx, 2) + Math.pow(p.pts[j + 1] - ty, 2), d < m && (m = d);
      if (m > tol * tol) continue;
      key = p.u + (p.deg > 35 ? "h" : "l");
      (!best[key] || m < best[key].m) && (best[key] = { u: p.u, deg: p.deg, m: m })
    }
    return Object.keys(best).map(function(k) { return best[k] })
  }

  function candidates(sim, all) {
    var out = [],
      b, d, p, e, k;
    for (b = sim.W.GetBodyList(); b; b = b.GetNext())
      if ((d = b.GetUserData()) && !d.dead && d.role == "Enemy") p = b.GetPosition(), out = out.concat(aimAt(all, p.x * PX, p.y * PX, 14));
    for (k = 0; k < sim.portals.length; k++) e = sim.portals[k], e.x < 900 && (out = out.concat(aimAt(all, e.x, e.y, 10)));
    for (k = -12; k <= 68; k += 4) out.push({ u: 80, deg: k }, { u: 70, deg: k }, { u: 60, deg: k }, { u: 50, deg: k });
    return out
  }

  // ------------------------------------------------------------ the bot

  // setTimeout is slowed down in background tabs; a message round-trip isn't.
  function yieldToBrowser() {
    return new Promise(function(r) {
      var ch = new MessageChannel;
      ch.port1.onmessage = function() { r() }, ch.port2.postMessage(0)
    })
  }

  function survivors(sim) {
    var out = [];
    for (var b = sim.W.GetBodyList(); b; b = b.GetNext()) {
      var d = b.GetUserData(), p = b.GetPosition();
      d && !d.dead && d.role == "Enemy" && out.push(Math.round(p.x * PX) + "," + Math.round(p.y * PX) + " hp " + Math.round(d.rem))
    }
    return out.join("; ")
  }

  async function checkLevel(n) {
    level_number = n, game.init();
    var birds = game.birdCount,
      portals = game.portals || [],
      snap = snapshotWorld(b2.world(), !0),
      sim = new Sim(snap, portals),
      all = paths(portals),
      shots = [],
      total, k, c, best, trial, score, t0 = Date.now();
    sim.run(120, 120), sim.damage = !0; // settle, like the game's first 2 seconds
    total = sim.enemies();
    for (k = 0; k < birds && sim.enemies() > 0; k++) {
      snap = snapshotWorld(sim.W), best = null;
      var list = candidates(sim, all);
      for (c = 0; c < list.length; c++) {
        trial = new Sim(snap, portals), trial.damage = !0, trial.launch(list[c].u, list[c].deg), trial.run(90, 420);
        score = trial.kills * 1e5 + trial.hurt * 1e3;
        (!best || score > best.score) && (best = { score: score, sim: trial, shot: list[c] });
        if (!trial.enemies()) break;
        c % 8 == 7 && await yieldToBrowser()
      }
      sim = best.sim, shots.push(best.shot.u + "@" + best.shot.deg + "° kills " + best.sim.kills);
      sim.kills = 0, sim.hurt = 0;
    }
    return {
      level: Math.floor(n / LEVELS_PER_WORLD) + 1 + "-" + (n % LEVELS_PER_WORLD + 1),
      ok: sim.enemies() == 0,
      enemies: total,
      birds: birds,
      used: shots.length,
      left: sim.enemies(),
      survivors: survivors(sim),
      secs: Math.round((Date.now() - t0) / 1e3),
      shots: shots.join(" | ")
    }
  }

  window.PP = window.PP || {};
  PP.check = {
    progress: null,
    level: checkLevel,
    levels: async function(from, to) {
      var out = [];
      for (var n = from; n <= to; n++) out.push(PP.check.progress = await checkLevel(n)), PP.check.results = out;
      return out
    },
    // Generated level n (worlds 4-10) failed? Try variants 1..max and return
    // the first one the bot beats; put it in PP.levels.tune (js/levels/generator.js).
    fix: async function(n, max) {
      for (var v = 1; v <= (max || 12); v++) {
        PP.levels.tune[n] = v;
        var r = await checkLevel(n);
        if (r.ok) return { n: n, variant: v, result: r }
      }
      delete PP.levels.tune[n];
      return { n: n, variant: null }
    }
  };
})();
