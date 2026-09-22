/*
 * game-driver.js — neutral offline driver (replaces the portal SDK).
 * Loaded FIRST in <head>, before any game script runs.
 * Exposes the GameSnacks-compatible surface the game may call, with
 * ad/storage/gameplay callbacks always resolved so the game never freezes.
 */
(function () {
  'use strict';

  var log = function () { try { console.log.apply(console, ['[GameDriver]'].concat([].slice.call(arguments))); } catch (e) {} };

  /* ---- ads: every callback/promise is resolved immediately (benign status) ---- */
  function resolveAdBreak(cfg) {
    cfg = cfg || {};
    try { if (typeof cfg.beforeReward === 'function') cfg.beforeReward(function () {}); } catch (e) {}
    try { if (typeof cfg.adClosed === 'function') cfg.adClosed(); } catch (e) {}
    try { if (typeof cfg.adBreakDone === 'function') cfg.adBreakDone({ status: 'dismissed' }); } catch (e) {}
    return Promise.resolve({ status: 'dismissed' });
  }

  function adApi() {
    return {
      requestAd: function (type, cfg) { return resolveAdBreak(cfg); },
      showAd: function (cfg) { return resolveAdBreak(cfg); },
      adBreak: function (cfg) { return resolveAdBreak(cfg); },
      rewardedBreak: function () { return Promise.resolve(false); },
      commercialBreak: function () { return Promise.resolve(); },
      beforeReward: function (cb) { if (typeof cb === 'function') cb(function () {}); },
      adClosed: function (cb) { if (typeof cb === 'function') cb(); },
      adViewed: function (cb) { if (typeof cb === 'function') cb(); },
      adBreakDone: function (cb) { if (typeof cb === 'function') cb({ status: 'dismissed' }); },
    };
  }

  /* ---- audio: no-op stubs keeping the method names ---- */
  var audio = {
    enable: function () {}, disable: function () {}, setEnabled: function () {},
    play: function () {}, pause: function () {}, stop: function () {}, mute: function () {}, unmute: function () {},
    sfx: function () {}, bgSound: function () {}, bgm: function () {},
    isMuted: function () { return false; },
  };

  /* ---- storage: sync localStorage + async/base64 variants ---- */
  function b64e(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return s; } }
  function b64d(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return s; } }

  var storage = {
    getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
    clear: function () { try { localStorage.clear(); } catch (e) {} },
    get: function (k) { return this.getItem(k); },
    set: function (k, v) { return this.setItem(k, v); },
    getAsync: function (k) {
      var v = this.getItem(k);
      return Promise.resolve(v == null ? null : b64d(v));
    },
    setAsync: function (k, v) { this.setItem(k, b64e(String(v))); return Promise.resolve(); },
  };

  /* ---- gameplay events: neutral no-ops ---- */
  var game = {
    firstFrameReady: function () { log('firstFrameReady'); },
    gameStart: function () {},
    levelStart: function () {},
    levelEnd: function () {},
    happytime: function () {},
    gameover: function () {},
    setProgress: function () {},
    firstPlay: function () {},
    start: function () {},
    loadingComplete: function () {},
    ready: function () {},
  };

  /* ---- neutral SDK root: known namespaces + catch-all Proxy for the rest ---- */
  function makeNamespace(base) {
    if (typeof Proxy === 'undefined') return base;
    return new Proxy(base, {
      get: function (t, p) {
        if (p in t) return t[p];
        log('stub namespace prop:', String(p));
        return function () { return Promise.resolve({ status: 'dismissed' }); };
      },
    });
  }

  var root = makeNamespace({
    ad: makeNamespace(adApi()),
    ads: makeNamespace(adApi()),
    audio: makeNamespace(audio),
    sound: makeNamespace(audio),
    storage: makeNamespace(storage),
    game: makeNamespace(game),
    player: makeNamespace({ getName: function () { return ''; } }),
    environment: makeNamespace({ portal: 'offline' }),
  });

  try {
    Object.defineProperty(window, 'GameSnacks', { value: root, writable: true, configurable: true });
  } catch (e) {
    window.GameSnacks = root;
  }
  window.GameDriver = root;

  /* ---- guarded auto-recovery: one reload max on early boot crash loop ---- */
  window.addEventListener('error', function (ev) {
    var n = 0;
    try { n = (parseInt(sessionStorage.getItem('gd_err'), 10) || 0) + 1; sessionStorage.setItem('gd_err', String(n)); } catch (e) { n = 1; }
    log('page error', n, ev && ev.message);
    if (n === 6 && performance.now() < 25000) {
      try { sessionStorage.setItem('gd_err', '0'); } catch (e) {}
      log('early crash loop → single recovery reload');
      setTimeout(function () { location.reload(); }, 300);
    }
  });
  window.addEventListener('load', function () {
    setTimeout(function () { try { sessionStorage.setItem('gd_err', '0'); } catch (e) {} }, 30000);
  });
})();
