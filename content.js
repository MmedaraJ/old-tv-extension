// Finds videos on the page and puts an old-TV frame around the picture.
(() => {
  'use strict';
  if (window.__crtTvFrameLoaded) return;
  window.__crtTvFrameLoaded = true;

  const { DEFAULTS, computeLayout, buildSVG, setLed } = globalThis.CRTFrame;
  const MIN_W = 280;
  const MIN_H = 150;
  const TICK_MS = 300;
  const TAG = 'crt-tv-frame';

  let settings = { ...DEFAULTS };
  let settingsRev = 0;
  let uid = 0;
  const site = topHostname();
  const controllers = new Map();

  function topHostname() {
    try {
      if (window.top === window) return location.hostname;
      const ao = location.ancestorOrigins;
      if (ao && ao.length) return new URL(ao[ao.length - 1]).hostname;
    } catch (e) { /* cross-origin */ }
    try {
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch (e) { /* bad referrer */ }
    return location.hostname;
  }

  function isActive() {
    return settings.enabled && !(settings.disabledSites || []).includes(site);
  }

  function fullscreenEl() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function parsePair(value, fallback) {
    if (!value || value === 'none') return [fallback, fallback];
    const p = value.trim().split(/\s+/).map(parseFloat);
    return [p[0], p.length > 1 ? p[1] : (fallback === 0 ? 0 : p[0])];
  }

  // The video's rectangle before our scale/translate is applied.
  function layoutRect(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const [sx, sy] = parsePair(cs.scale, 1);
    const [tx, ty] = parsePair(cs.translate, 0);
    const w = r.width / (sx || 1);
    const h = r.height / (sy || 1);
    const cx = r.left + r.width / 2 - (tx || 0);
    const cy = r.top + r.height / 2 - (ty || 0);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  // Where the picture actually is inside the video element (object-fit aware).
  function contentRect(v, E, fit) {
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh || fit === 'fill' || fit === 'cover') return { ...E };
    let k = Math.min(E.w / vw, E.h / vh);
    if (fit === 'none') k = 1;
    else if (fit === 'scale-down') k = Math.min(1, k);
    const w = vw * k, h = vh * k;
    return { x: E.x + (E.w - w) / 2, y: E.y + (E.h - h) / 2, w, h };
  }

  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

  class Controller {
    constructor(video) {
      this.video = video;
      this.id = `crtf${++uid}`;
      this.host = null;
      this.root = null;
      this.geomKey = '';
      this.saved = null;
      this.applied = null;
      this.onMedia = () => this.update();
      this.onPlayState = () => setLed(this.root, !this.video.paused);
      for (const ev of ['loadedmetadata', 'resize', 'emptied']) video.addEventListener(ev, this.onMedia);
      for (const ev of ['play', 'playing', 'pause', 'ended']) video.addEventListener(ev, this.onPlayState);
      this.ro = new ResizeObserver(() => schedule());
      this.ro.observe(video);
    }

    // The element whose box the TV should fill (where the black bars live).
    findFrame(E) {
      const v = this.video;
      const yt = v.closest('.html5-video-player');
      if (yt) {
        if (yt.id === 'inline-preview-player' || yt.closest('ytd-video-preview, ytd-thumbnail, yt-thumbnail-view-model')) return null;
        return yt;
      }
      const fs = fullscreenEl();
      if (fs && fs !== v && fs.contains(v)) return fs;
      // A wrapper that exactly letterboxes / pillarboxes the video.
      let el = v.parentElement;
      for (let i = 0; i < 3 && el && el !== document.body && el !== document.documentElement; i++, el = el.parentElement) {
        const r = el.getBoundingClientRect();
        if (r.width < E.w - 2 || r.height < E.h - 2) break;
        const centered = near(r.left + r.width / 2, E.x + E.w / 2) && near(r.top + r.height / 2, E.y + E.h / 2);
        if (!centered) break;
        const sameW = near(r.width, E.w), sameH = near(r.height, E.h);
        if (sameW && sameH) continue;
        if (sameW || sameH) return el;
        break;
      }
      return v;
    }

    update() {
      const v = this.video;
      if (!v.isConnected) return this.destroy();
      if (!isActive() || fullscreenEl() === v || !v.videoWidth || !v.videoHeight) return this.detach();
      const cs = getComputedStyle(v);
      if (cs.display === 'none' || cs.visibility === 'hidden') return this.detach();
      // Decorative background loops (hero banners etc.) are left alone.
      if (v.muted && v.loop && !v.controls && cs.objectFit === 'cover' && !v.closest('.html5-video-player')) return this.detach();

      const E = layoutRect(v);
      const frameEl = this.findFrame(E);
      if (!frameEl) return this.detach();
      let F;
      if (frameEl === v) F = E;
      else {
        const r = frameEl.getBoundingClientRect();
        F = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
      if (F.w < MIN_W || F.h < MIN_H) return this.detach();

      const C = contentRect(v, E, cs.objectFit);
      const Cf = { x: C.x - F.x, y: C.y - F.y, w: C.w, h: C.h };

      this.place(frameEl, F);

      const key = [F.w, F.h, Cf.x, Cf.y, Cf.w, Cf.h].map((n) => Math.round(n)).join(',') + `|${settingsRev}`;
      if (key !== this.geomKey) {
        const L = computeLayout(F.w, F.h, Cf, settings);
        if (!L) return this.detach();
        this.geomKey = key;
        this.root.innerHTML = buildSVG(L, settings, this.id);
        setLed(this.root, !v.paused);
        // Move/shrink the picture so it sits exactly in the TV screen.
        const Ec = { x: E.x - F.x + E.w / 2, y: E.y - F.y + E.h / 2 };
        const Cc = { x: Cf.x + Cf.w / 2, y: Cf.y + Cf.h / 2 };
        const Sc = { x: L.S.x + L.S.w / 2, y: L.S.y + L.S.h / 2 };
        const dx = Sc.x - Ec.x - (Cc.x - Ec.x) * L.s;
        const dy = Sc.y - Ec.y - (Cc.y - Ec.y) * L.s;
        // Clip off the element's own letterbox area so only the picture moves into the screen.
        const inset = [C.y - E.y, E.x + E.w - (C.x + C.w), E.y + E.h - (C.y + C.h), C.x - E.x];
        this.applyVideo(L.s, dx, dy, inset);
      } else if (this.applied && v.style.getPropertyValue('scale') !== this.applied.scale) {
        // The site rewrote the video's inline style; put our transform back.
        this.writeVideo(this.applied);
      }
    }

    place(frameEl, F) {
      const v = this.video;
      let ref = v;
      if (frameEl !== v) while (ref.parentElement && ref.parentElement !== frameEl) ref = ref.parentElement;
      if (!this.host) {
        this.host = document.createElement(TAG);
        this.root = this.host.attachShadow({ mode: 'open' });
      }
      const h = this.host;
      if (h.parentNode !== ref.parentNode || !(ref.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        ref.after(h);
      }
      const z = getComputedStyle(ref).zIndex;
      const op = h.offsetParent;
      let ox, oy;
      if (!op || (op === document.body && getComputedStyle(op).position === 'static')) {
        ox = -window.scrollX;
        oy = -window.scrollY;
      } else {
        const r = op.getBoundingClientRect();
        ox = r.left + op.clientLeft - op.scrollLeft;
        oy = r.top + op.clientTop - op.scrollTop;
      }
      const css = `position:absolute!important;display:block!important;left:${(F.x - ox).toFixed(1)}px!important;` +
        `top:${(F.y - oy).toFixed(1)}px!important;width:${F.w.toFixed(1)}px!important;height:${F.h.toFixed(1)}px!important;` +
        `z-index:${/^-?\d+$/.test(z) ? z : 'auto'}!important;pointer-events:none!important;overflow:hidden!important;` +
        'margin:0!important;padding:0!important;border:0!important;right:auto!important;bottom:auto!important;transform:none!important;' +
        'opacity:1!important;filter:none!important;max-width:none!important;max-height:none!important;contain:strict;';
      if (css !== this.lastCss) {
        h.style.cssText = css;
        this.lastCss = css;
      }
    }

    applyVideo(s, dx, dy, inset) {
      const st = this.video.style;
      if (Math.abs(s - 1) < 0.0005 && Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return this.restoreVideo();
      if (!this.saved) {
        this.saved = {};
        for (const p of ['scale', 'translate', 'transform-origin', 'clip-path']) {
          this.saved[p] = [st.getPropertyValue(p), st.getPropertyPriority(p)];
        }
      }
      const letterboxed = inset.some((n) => n > 0.5);
      this.applied = {
        scale: String(Math.round(s * 10000) / 10000),
        translate: `${dx.toFixed(2)}px ${dy.toFixed(2)}px`,
        clip: letterboxed ? `inset(${inset.map((n) => `${Math.max(0, n).toFixed(1)}px`).join(' ')})` : '',
      };
      this.writeVideo(this.applied);
    }

    writeVideo(a) {
      const st = this.video.style;
      st.setProperty('scale', a.scale, 'important');
      st.setProperty('translate', a.translate, 'important');
      st.setProperty('transform-origin', '50% 50%', 'important');
      if (a.clip) st.setProperty('clip-path', a.clip, 'important');
      else if (this.saved) {
        const [val, prio] = this.saved['clip-path'];
        if (val) st.setProperty('clip-path', val, prio); else st.removeProperty('clip-path');
      }
    }

    restoreVideo() {
      if (!this.saved) return;
      const st = this.video.style;
      for (const [p, [val, prio]] of Object.entries(this.saved)) {
        if (val) st.setProperty(p, val, prio);
        else st.removeProperty(p);
      }
      this.saved = null;
      this.applied = null;
    }

    detach() {
      this.restoreVideo();
      if (this.host) this.host.remove();
      this.geomKey = '';
      this.lastCss = '';
    }

    destroy() {
      this.detach();
      this.ro.disconnect();
      for (const ev of ['loadedmetadata', 'resize', 'emptied']) this.video.removeEventListener(ev, this.onMedia);
      for (const ev of ['play', 'playing', 'pause', 'ended']) this.video.removeEventListener(ev, this.onPlayState);
      controllers.delete(this.video);
    }
  }

  const videos = document.getElementsByTagName('video');

  function tick() {
    for (const v of videos) {
      if (!controllers.has(v)) controllers.set(v, new Controller(v));
    }
    for (const c of [...controllers.values()]) {
      try { c.update(); } catch (e) { /* never break the page */ }
    }
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; tick(); });
  }

  function loadSettings(cb) {
    try {
      chrome.storage.local.get(DEFAULTS, (s) => {
        settings = { ...DEFAULTS, ...(s || {}) };
        settingsRev++;
        cb && cb();
      });
    } catch (e) {
      cb && cb();
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') loadSettings(schedule);
    });
  } catch (e) { /* not running as an extension */ }

  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, schedule, true);
  window.addEventListener('resize', schedule);
  loadSettings(() => {
    tick();
    setInterval(tick, TICK_MS);
  });
})();
