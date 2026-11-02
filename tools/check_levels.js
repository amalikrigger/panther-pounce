/*
 * Panther Pounce - level checker: proves every level can be beaten.
 *
 * A bot plays each level in its own copy of the physics world (same Box2D
 * settings and damage rules as game.js, plus portals and the enemy fence).
 * For every panther it tries aimed shots at each enemy and portal plus a
 * spread of angles and powers, keeps the shot that does the most, and moves
 * on. A level passes if the bot clears it with the level's own line-up of
 * panthers, used the way a player would: split cats split (or not), pumpkin
 * bombs blow up on impact or once they've stopped.
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
    // the bird in flight touched something (split/explode timing)
    L.BeginContact = function(c) {
      [c.GetFixtureA().GetBody(), c.GetFixtureB().GetBody()].forEach(function(b) {
        var d = b.GetUserData();
        d && d.role == "Bird" && !d.contacted && (d.contacted = self.steps || 1)
      })
    };
    this.steps = 0;
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
    this.steps++, this.ability();
  };

  // Special panthers, the way a player would use them (game.js trySplit and
  // tryExplode): split after `split` steps, explode on impact or once still.
  Sim.prototype.ability = function(atEnd) {
    var a = this.active,
      b, d;
    if (!a || a.done || !(b = a.body) || !(d = b.GetUserData())) return;
    if (a.type == "bird_split" && a.split && this.steps - a.at >= a.split) {
      a.done = !0;
      if (!d.contacted) this.split(b);
    } else if (a.type == "boulder" && (a.boom == "contact" && d.contacted && this.steps - d.contacted >= 4 || a.boom == "settle" && atEnd)) {
      a.done = !0, this.explode(b);
    }
  };

  Sim.prototype.split = function(b) {
    var v = b.GetLinearVelocity(),
      p = b.GetPosition(),
      sp = Math.sqrt(v.x * v.x + v.y * v.y) || 1,
      f = b.GetFixtureList(),
      k, a, piece;
    f.SetDensity(SPLIT_DENSITY / 2), b.ResetMassData(), b.SetLinearVelocity(v);
    for (k = -1; k <= 1; k += 2) {
      a = SPLIT_ANGLE * k;
      piece = this.body(p.x * PX - v.y / sp * 40 * k, p.y * PX + v.x / sp * 40 * k, 18, SPLIT_DENSITY / 2, -1);
      piece.SetLinearVelocity(new b2Vec2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)));
      piece.SetAngularVelocity(b.GetAngularVelocity())
    }
  };

  // Same as b2.explode in game.js (iron blocks the blast).
  Sim.prototype.explode = function(bomb) {
    var cfg = PP.config.randomBirds,
      R = cfg.blastRadius || 340,
      power = cfg.blastPower || 220,
      hurt = cfg.blastDamage || 4500,
      c = bomb.GetPosition(),
      from = new b2Vec2(c.x, c.y),
      self = this,
      b, d, p, dx, dy, dist, f, len;
    for (b = this.W.GetBodyList(); b; b = b.GetNext()) {
      if (b == bomb || !(d = b.GetUserData()) || d.dead) continue;
      p = b.GetWorldCenter(), dx = (p.x - c.x) * PX, dy = (p.y - c.y) * PX, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= R || this.W.RayCastAll(from, p).some(function(fx) { return fx.GetBody().ppIron })) continue;
      f = 1 - dist / R, len = dist || 1;
      b.ApplyImpulse(new b2Vec2(dx / len * power * f, (dy / len + .4) * power * f), p);
      if (d.role == "Glass") d.rem = 0;
      else if (d.role != "Bird") d.role == "Enemy" && (self.hurt += Math.min(hurt * f, d.rem) / d.full), d.rem -= hurt * f;
    }
    bomb.GetUserData().dead = !0, this.W.DestroyBody(bomb);
  };

  // Run until everything is still (or `max` steps). A pumpkin set to go off
  // "once still" explodes then, and the run carries on until things settle.
  Sim.prototype.run = function(min, max) {
    for (var k = 0; k < max; k++) {
      this.step();
      if (k >= min && k % 15 == 0 && this.still()) break
    }
    var a = this.active;
    if (a && !a.done && a.type == "boulder" && a.boom == "settle") {
      this.ability(!0);
      for (k = 0; k < 300; k++)
        if (this.step(), k >= 60 && k % 15 == 0 && this.still()) break
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

  Sim.prototype.body = function(x, y, radius, density, group) {
    var def = new b2BodyDef,
      fd = new b2FixtureDef,
      b;
    def.type = b2Body.b2_dynamicBody, def.position.Set(x / PX, y / PX);
    b = this.W.CreateBody(def);
    fd.shape = new b2CircleShape(radius / PX), fd.density = density, fd.friction = .5, fd.restitution = .4, fd.filter.groupIndex = group || 0;
    b.CreateFixture(fd), b.SetUserData({ role: "Bird", full: 250, rem: 250, cool: 0 });
    return b
  };

  // shot = { u: pull, deg: angle, split: steps (split cat), boom: "contact"/"settle" (pumpkin) }
  Sim.prototype.launch = function(type, shot) {
    var a = shot.deg * Math.PI / 180,
      pos = { x: START.x - shot.u * Math.cos(a), y: START.y - shot.u * Math.sin(a) },
      power = type == "boulder" ? PUMPKIN_WEIGHT : 1,
      r = type == "boulder" ? 73 * BIRD_SCALE.boulder / 2 : type == "bird_split" ? 18 : BIRD_R,
      density = type == "bird_split" ? SPLIT_DENSITY : type == "boulder" ? BIRD_DENSITY * power * Math.pow(22 / r, 2) : BIRD_DENSITY,
      b = this.body(pos.x, pos.y, r, density, type == "bird_split" ? -1 : 0);
    b.ApplyImpulse(new b2Vec2((START.x - pos.x) * LAUNCH_POWER * power, (START.y - pos.y) * LAUNCH_POWER * power), b.GetWorldCenter());
    this.active = { body: b, type: type, split: shot.split, boom: shot.boom, at: this.steps };
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

  // How a player might use each kind of panther.
  var WAYS = {
    bird: [{}],
    bird_split: [{}, { split: 36 }],
    boulder: [{ boom: "contact" }, { boom: "settle" }]
  };

  async function checkLevel(n) {
    level_number = n, game.init();
    var types = game.birdTypes.slice(),
      portals = game.portals || [],
      snap = snapshotWorld(b2.world(), !0),
      sim = new Sim(snap, portals),
      all = paths(portals),
      shots = [],
      total, k, c, w, best, trial, score, shot, ways, t0 = Date.now();
    sim.run(120, 120), sim.damage = !0; // settle, like the game's first 2 seconds
    total = sim.enemies();
    for (k = 0; k < types.length && sim.enemies() > 0; k++) {
      snap = snapshotWorld(sim.W), best = null, ways = WAYS[types[k]] || WAYS.bird;
      var list = candidates(sim, all);
      search: for (c = 0; c < list.length; c++)
        for (w = 0; w < ways.length; w++) {
          shot = Object.assign({}, list[c], ways[w]);
          trial = new Sim(snap, portals), trial.damage = !0, trial.launch(types[k], shot), trial.run(90, 420);
          score = trial.kills * 1e5 + trial.hurt * 1e3;
          (!best || score > best.score) && (best = { score: score, sim: trial, shot: shot });
          if (!trial.enemies()) break search;
          (c * ways.length + w) % 8 == 7 && await yieldToBrowser()
        }
      shot = best.shot, shots.push(types[k] + " " + shot.u + "@" + shot.deg + (shot.split ? " split" : "") + (shot.boom ? " boom:" + shot.boom : "") + " kills " + best.sim.kills);
      sim = best.sim, sim.kills = 0, sim.hurt = 0, sim.active = null;
    }
    return {
      level: Math.floor(n / LEVELS_PER_WORLD) + 1 + "-" + (n % LEVELS_PER_WORLD + 1),
      ok: sim.enemies() == 0,
      enemies: total,
      birds: types.join(","),
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
    // Level n (world 3 on) failed? Try variants 1..max (another line-up, and
    // for worlds 4-10 also another, slightly easier layout) and return the
    // first one the bot beats; put it in PP.levels.tune (js/levels/generator.js).
    fix: async function(n, max) {
      var old = PP.levels.tune[n];
      for (var v = 1; v <= (max || 12); v++) {
        PP.levels.tune[n] = v;
        var r = await checkLevel(n);
        if (r.ok) return { n: n, variant: v, result: r }
      }
      old ? PP.levels.tune[n] = old : delete PP.levels.tune[n];
      return { n: n, variant: null }
    }
  };
})();
