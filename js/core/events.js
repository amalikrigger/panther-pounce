/*
 * Panther Pounce - tiny event bus.
 * game.js announces what happens (aiming, launch, level start...) and
 * the effects, audio and UI modules listen. That keeps game.js changes
 * to one-line hooks.
 *
 *   PP.on('sling:launch', function (data) { ... });
 *   PP.emit('sling:launch', { x: 190, y: 210 });
 */
window.PP = window.PP || {};

(function (PP) {
  'use strict';

  var listeners = {};

  PP.on = function (name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
  };

  PP.off = function (name, fn) {
    var list = listeners[name];
    if (list) listeners[name] = list.filter(function (f) { return f !== fn; });
  };

  PP.emit = function (name, data) {
    var list = listeners[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](data);
      } catch (e) {
        // A broken effect must never break the game itself.
        console.error('[PP] listener for "' + name + '" failed:', e);
      }
    }
  };
})(window.PP);
