// Shared drawing code for the TV frame. Loaded by the content script and the popup preview.
(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    disabledSites: [],
    theme: 'walnut',
    size: 1, // frame thickness multiplier (0.4 – 2)
    scanlines: 30, // 0 – 100
    glass: true, // curved-glass vignette and glare
    panel: true, // side panel with knobs when there is room for it
    label: 'SOLID STATE',
  };

  const THEMES = {
    walnut: {
      name: '70s Walnut',
      wall: ['#1d1611', '#0a0705'],
      cab: ['#80502e', '#5c341b', '#3a1e0d'],
      grain: { freq: '0.0035 0.11', rgb: [0.16, 0.07, 0.02], gain: 2.4, bias: -1.05 },
      edge: ['rgba(255,214,170,0.45)', 'rgba(0,0,0,0.6)'],
      trim: ['#f4f4f4', '#8a8a8a', '#ffffff', '#5e5e5e'],
      bezel: ['#2c2c2c', '#141414', '#080808'],
      panel: ['#dcd8cf', '#a8a399', '#d2cdc3'],
      panelText: '#2a1a0e',
      knob: ['#f5f2ec', '#b9b4aa', '#6b665e'],
      knobRim: '#1b1b1b',
      pointer: '#b8322a',
      grille: '#140b05',
      slat: '#6e4527',
      label: '#ecdcb8',
    },
    black: {
      name: '80s Black',
      wall: ['#14161a', '#060708'],
      cab: ['#36383d', '#202125', '#0f1012'],
      grain: { freq: '0.9', rgb: [0, 0, 0], gain: 1.2, bias: -0.45 },
      edge: ['rgba(255,255,255,0.22)', 'rgba(0,0,0,0.7)'],
      trim: ['#9a9da4', '#45474c', '#b4b7bd', '#2d2f33'],
      bezel: ['#1e1f22', '#0e0e10', '#050506'],
      panel: ['#2b2c30', '#1b1c1f', '#26272a'],
      panelText: '#c5c9d1',
      knob: ['#6b6e75', '#34363a', '#141416'],
      knobRim: '#0b0b0c',
      pointer: '#e9e9e9',
      grille: '#09090a',
      slat: '#2d2e33',
      label: '#c9ccd3',
    },
    beige: {
      name: '90s Beige',
      wall: ['#1b1a17', '#0a0a09'],
      cab: ['#ece4d1', '#d6ccb4', '#b2a68b'],
      grain: { freq: '0.85', rgb: [0.35, 0.3, 0.22], gain: 1.0, bias: -0.4 },
      edge: ['rgba(255,255,255,0.6)', 'rgba(60,50,30,0.55)'],
      trim: ['#d9d0bb', '#9d927a', '#e8e0cc', '#8a7f68'],
      bezel: ['#cfc5ac', '#b7ad94', '#a1977f'],
      panel: ['#dfd7c3', '#c8bfa8', '#d8d0bb'],
      panelText: '#5a5244',
      knob: ['#f7f2e6', '#d2cab6', '#968d7a'],
      knobRim: '#7d7461',
      pointer: '#5a5244',
      grille: '#776e5a',
      slat: '#c9c0a8',
      label: '#6b6252',
    },
    red: {
      name: '60s Red',
      wall: ['#181012', '#090608'],
      cab: ['#e2433a', '#b8261e', '#7a130e'],
      grain: { freq: '0.8', rgb: [0.25, 0, 0], gain: 1.0, bias: -0.4 },
      edge: ['rgba(255,220,210,0.55)', 'rgba(40,0,0,0.6)'],
      trim: ['#ffffff', '#9a9a9a', '#ffffff', '#6a6a6a'],
      bezel: ['#f4efe4', '#ddd6c6', '#c6bfae'],
      panel: ['#f5f1e7', '#ddd7c9', '#efe9dc'],
      panelText: '#8a1710',
      knob: ['#ffffff', '#c8c8c8', '#7d7d7d'],
      knobRim: '#4a4a4a',
      pointer: '#b8261e',
      grille: '#4d0b08',
      slat: '#ead9c8',
      label: '#fff1e2',
    },
  };

  const PANEL_RATIO = 0.34; // side panel width relative to screen height

  // Work out where the TV, bezel, screen and panel go inside a W x H frame,
  // given the rectangle C (frame coordinates) the video picture occupies.
  function computeLayout(W, H, C, opts) {
    const m = Math.min(W, H);
    const k = opts.size || 1;
    const b = Math.max(6, m * 0.03 * k); // bezel thickness
    const c = Math.max(5, m * 0.022 * k); // cabinet wall thickness
    const chin = Math.max(12, m * 0.05 * k); // extra cabinet below the screen
    const gap = c * 0.9;

    const sA = Math.min(1, (W - 2 * (b + c)) / C.w, (H - 2 * (b + c) - chin) / C.h);
    let sB = -1;
    if (opts.panel) {
      sB = Math.min(1, (W - 2 * (b + c) - gap) / (C.w + PANEL_RATIO * C.h), (H - 2 * (b + c)) / C.h);
    }
    // Prefer the knob panel when it costs (almost) no extra shrinking.
    const usePanel = opts.panel && sB >= sA * 0.97 && C.h * sB >= 150;
    const s = usePanel ? sB : sA;
    if (!(s > 0.2)) return null;

    const w = C.w * s;
    const h = C.h * s;
    const panelW = usePanel ? PANEL_RATIO * h : 0;
    const TW = w + 2 * (b + c) + (usePanel ? gap + panelW : 0);
    const TH = h + 2 * (b + c) + (usePanel ? 0 : chin);
    const K = { x: (W - TW) / 2, y: (H - TH) / 2, w: TW, h: TH };
    const bo = { x: K.x + c, y: K.y + c, w: w + 2 * b, h: h + 2 * b };
    const S = { x: bo.x + b, y: bo.y + b, w, h };
    const panel = usePanel ? { x: bo.x + bo.w + gap, y: bo.y, w: panelW, h: bo.h } : null;
    const sm = Math.min(w, h);
    return {
      W, H, s, b, c, K, bo, S, panel,
      rK: Math.min(TW, TH) * 0.07,
      rB: sm * 0.07 + b * 0.6,
      r: sm * 0.065,
      bulge: sm * 0.012,
    };
  }

  const f = (n) => Math.round(n * 10) / 10;

  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M${f(x + r)},${f(y)}H${f(x + w - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}` +
      `V${f(y + h - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}H${f(x + r)}` +
      `A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}V${f(y + r)}A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}Z`;
  }

  // CRT "pillow" shape that stays inside the x,y,w,h box: rounded, slightly
  // pulled-in corners and edges that bow out to touch the box at their midpoints.
  function pillow(x, y, w, h, r, d) {
    const R = x + w, B = y + h;
    return `M${f(x + r)},${f(y + d)}` +
      `Q${f(x + w / 2)},${f(y - d)} ${f(R - r)},${f(y + d)}` +
      `Q${f(R - d)},${f(y + d)} ${f(R - d)},${f(y + r)}` +
      `Q${f(R + d)},${f(y + h / 2)} ${f(R - d)},${f(B - r)}` +
      `Q${f(R - d)},${f(B - d)} ${f(R - r)},${f(B - d)}` +
      `Q${f(x + w / 2)},${f(B + d)} ${f(x + r)},${f(B - d)}` +
      `Q${f(x + d)},${f(B - d)} ${f(x + d)},${f(B - r)}` +
      `Q${f(x - d)},${f(y + h / 2)} ${f(x + d)},${f(y + r)}` +
      `Q${f(x + d)},${f(y + d)} ${f(x + r)},${f(y + d)}Z`;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

  function stops(colors) {
    return colors.map((col, i) => `<stop offset="${colors.length === 1 ? 0 : i / (colors.length - 1)}" stop-color="${col}"/>`).join('');
  }

  function knob(id, cx, cy, R, angle, T, ticks) {
    let out = '';
    if (ticks) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r1 = R * 1.12, r2 = R * 1.24;
        out += `<line x1="${f(cx + Math.cos(a) * r1)}" y1="${f(cy + Math.sin(a) * r1)}" x2="${f(cx + Math.cos(a) * r2)}" y2="${f(cy + Math.sin(a) * r2)}" stroke="${T.panelText}" stroke-width="${f(Math.max(1, R * 0.05))}" stroke-linecap="round" opacity="0.75"/>`;
        if (R >= 18) {
          const rn = R * 1.48;
          out += `<text x="${f(cx + Math.cos(a) * rn)}" y="${f(cy + Math.sin(a) * rn + R * 0.09)}" font-size="${f(R * 0.25)}" text-anchor="middle" fill="${T.panelText}" opacity="0.8">${i + 2}</text>`;
        }
      }
    }
    const pa = (angle * Math.PI) / 180;
    out += `<circle cx="${f(cx)}" cy="${f(cy + R * 0.1)}" r="${f(R * 1.02)}" fill="#000" opacity="0.45" filter="url(#${id}soft)"/>`;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${T.knobRim}"/>`;
    const kr = R * 0.93;
    const dash = (2 * Math.PI * kr) / 40;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(kr)}" fill="none" stroke="url(#${id}knob)" stroke-width="${f(R * 0.12)}" stroke-dasharray="${f(dash * 0.55)} ${f(dash * 0.45)}"/>`;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.82)}" fill="url(#${id}knob)"/>`;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.82)}" fill="url(#${id}knobShine)"/>`;
    out += `<line x1="${f(cx + Math.cos(pa) * R * 0.28)}" y1="${f(cy + Math.sin(pa) * R * 0.28)}" x2="${f(cx + Math.cos(pa) * R * 0.74)}" y2="${f(cy + Math.sin(pa) * R * 0.74)}" stroke="${T.pointer}" stroke-width="${f(Math.max(1.5, R * 0.1))}" stroke-linecap="round"/>`;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.24)}" fill="${T.knobRim}" opacity="0.85"/>`;
    return out;
  }

  function grille(x, y, w, h, T, vertical) {
    const r = Math.min(w, h) * 0.12;
    let out = `<path d="${rr(x, y, w, h, r)}" fill="${T.grille}"/>`;
    const step = Math.max(3, (vertical ? w : h) / 10);
    out += '<g>';
    if (vertical) {
      for (let px = x + step * 0.75; px < x + w - step * 0.4; px += step) {
        out += `<line x1="${f(px)}" y1="${f(y + h * 0.12)}" x2="${f(px)}" y2="${f(y + h * 0.88)}" stroke="${T.slat}" stroke-width="${f(step * 0.42)}" stroke-linecap="round"/>`;
      }
    } else {
      for (let py = y + step * 0.75; py < y + h - step * 0.4; py += step) {
        out += `<line x1="${f(x + w * 0.08)}" y1="${f(py)}" x2="${f(x + w * 0.92)}" y2="${f(py)}" stroke="${T.slat}" stroke-width="${f(step * 0.42)}" stroke-linecap="round"/>`;
      }
    }
    out += '</g>';
    out += `<path d="${rr(x + 0.5, y + 0.5, w - 1, h - 1, r)}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>`;
    return out;
  }

  function fitText(text, fontSize, maxW) {
    const est = text.length * fontSize * 0.68;
    return est > maxW ? ` textLength="${f(maxW)}" lengthAdjust="spacingAndGlyphs"` : '';
  }

  // Build the SVG markup for a layout. Everything is opaque except the screen.
  function buildSVG(L, opts, id) {
    const T = THEMES[opts.theme] || THEMES.walnut;
    const { W, H, K, bo, S, b, c, panel } = L;
    const screen = pillow(S.x + 1, S.y + 1, S.w - 2, S.h - 2, L.r, L.bulge);
    const cabinet = rr(K.x, K.y, K.w, K.h, L.rK);
    const wallPath = `M0,0H${f(W)}V${f(H)}H0Z` + cabinet;
    const label = esc(String(opts.label || '').toUpperCase().slice(0, 24));
    const scan = Math.max(0, Math.min(100, Number(opts.scanlines) || 0)) / 100;
    const font = `font-family="Futura, 'Century Gothic', 'Avenir Next', 'Trebuchet MS', Arial, sans-serif" font-weight="700"`;
    const g = T.grain;

    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}">`;
    s += '<defs>';
    s += `<linearGradient id="${id}wall" x1="0" y1="0" x2="0" y2="1">${stops(T.wall)}</linearGradient>`;
    s += `<pattern id="${id}stripe" width="28" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#fff" opacity="0.018"/></pattern>`;
    s += `<radialGradient id="${id}glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8fb4ff" stop-opacity="0.10"/><stop offset="1" stop-color="#8fb4ff" stop-opacity="0"/></radialGradient>`;
    s += `<linearGradient id="${id}cab" x1="0" y1="0" x2="0" y2="1">${stops(T.cab)}</linearGradient>`;
    s += `<linearGradient id="${id}sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="0.85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>`;
    s += `<linearGradient id="${id}edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.edge[0]}"/><stop offset="1" stop-color="${T.edge[1]}"/></linearGradient>`;
    s += `<linearGradient id="${id}bezel" x1="0" y1="0" x2="0" y2="1">${stops(T.bezel)}</linearGradient>`;
    s += `<linearGradient id="${id}trim" x1="0" y1="0" x2="1" y2="1">${stops(T.trim)}</linearGradient>`;
    s += `<linearGradient id="${id}panel" x1="0" y1="0" x2="1" y2="1">${stops(T.panel)}</linearGradient>`;
    s += `<radialGradient id="${id}knob" cx="0.35" cy="0.3" r="0.85">${stops(T.knob)}</radialGradient>`;
    s += `<radialGradient id="${id}knobShine" cx="0.32" cy="0.26" r="0.45"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    s += `<radialGradient id="${id}vig" cx="0.5" cy="0.5" r="0.72"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient>`;
    s += `<linearGradient id="${id}glare" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.13"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.02"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    s += `<pattern id="${id}scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#000"/></pattern>`;
    s += `<filter id="${id}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(Math.max(1, c * 0.25))}"/></filter>`;
    s += `<filter id="${id}blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(Math.max(2, c * 0.9))}"/></filter>`;
    s += `<filter id="${id}inner" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(Math.max(1.5, b * 0.35))}"/></filter>`;
    s += `<filter id="${id}ledglow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2"/></filter>`;
    if (g) {
      s += `<filter id="${id}grain" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${g.freq}" numOctaves="4" seed="11"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 ${g.rgb[0]}  0 0 0 0 ${g.rgb[1]}  0 0 0 0 ${g.rgb[2]}  ${g.gain} 0 0 0 ${g.bias}"/></filter>`;
    }
    s += `<clipPath id="${id}wallClip"><path d="${wallPath}" clip-rule="evenodd"/></clipPath>`;
    s += `<clipPath id="${id}cabClip"><path d="${cabinet}${screen}" clip-rule="evenodd"/></clipPath>`;
    s += `<clipPath id="${id}screenClip"><path d="${screen}"/></clipPath>`;
    s += '</defs>';

    // Room behind the set (only visible where the TV doesn't reach the edges).
    s += `<g clip-path="url(#${id}wallClip)">`;
    s += `<rect width="${f(W)}" height="${f(H)}" fill="url(#${id}wall)"/>`;
    s += `<rect width="${f(W)}" height="${f(H)}" fill="url(#${id}stripe)"/>`;
    s += `<ellipse cx="${f(K.x + K.w / 2)}" cy="${f(K.y + K.h / 2)}" rx="${f(K.w * 0.85)}" ry="${f(K.h * 0.85)}" fill="url(#${id}glow)"/>`;
    s += `<ellipse cx="${f(K.x + K.w / 2)}" cy="${f(K.y + K.h)}" rx="${f(K.w * 0.56)}" ry="${f(Math.max(4, c * 0.9))}" fill="#000" opacity="0.7" filter="url(#${id}blur)"/>`;
    const below = H - (K.y + K.h);
    if (below > 6) {
      const fh = Math.min(c * 1.3, below - 2), fw = Math.max(8, K.w * 0.07);
      for (const fx of [K.x + K.w * 0.12, K.x + K.w * 0.88 - fw]) {
        s += `<path d="${rr(fx, K.y + K.h - 4, fw, fh + 4, Math.min(3, fw / 4))}" fill="#0c0c0c"/>`;
      }
    }
    if (K.y > H * 0.14) {
      const cx = K.x + K.w / 2, top = K.y;
      const len = Math.min(K.y * 0.92, K.h * 0.75);
      const dome = Math.max(10, K.w * 0.05);
      for (const deg of [-28, 26]) {
        const a = ((deg - 90) * Math.PI) / 180;
        const ex = cx + Math.cos(a) * len, ey = top - dome * 0.3 + Math.sin(a) * len;
        s += `<line x1="${f(cx)}" y1="${f(top - dome * 0.3)}" x2="${f(ex)}" y2="${f(ey)}" stroke="#bdbdbd" stroke-width="${f(Math.max(1.5, dome * 0.09))}" stroke-linecap="round"/>`;
        s += `<circle cx="${f(ex)}" cy="${f(ey)}" r="${f(Math.max(2, dome * 0.14))}" fill="#d9d9d9"/>`;
      }
      s += `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(dome)}" ry="${f(dome * 0.55)}" fill="#151515"/>`;
    }
    s += '</g>';

    // Cabinet.
    s += `<path d="${cabinet}${screen}" fill-rule="evenodd" fill="url(#${id}cab)"/>`;
    if (g) s += `<g clip-path="url(#${id}cabClip)"><rect x="${f(K.x)}" y="${f(K.y)}" width="${f(K.w)}" height="${f(K.h)}" filter="url(#${id}grain)"/></g>`;
    s += `<path d="${cabinet}${screen}" fill-rule="evenodd" fill="url(#${id}sheen)"/>`;
    s += `<path d="${rr(K.x + 0.75, K.y + 0.75, K.w - 1.5, K.h - 1.5, L.rK)}" fill="none" stroke="url(#${id}edge)" stroke-width="1.5"/>`;

    // Bezel around the tube, with a chrome trim ring and a dark recessed lip.
    s += `<path d="${rr(bo.x, bo.y, bo.w, bo.h, L.rB)}${screen}" fill-rule="evenodd" fill="url(#${id}bezel)"/>`;
    const tw = Math.max(1.5, b * 0.13);
    s += `<path d="${rr(bo.x + tw / 2, bo.y + tw / 2, bo.w - tw, bo.h - tw, L.rB - tw / 2)}" fill="none" stroke="url(#${id}trim)" stroke-width="${f(tw)}"/>`;
    s += `<path d="${screen}" fill="none" stroke="#000" stroke-opacity="0.9" stroke-width="${f(Math.max(2, b * 0.32))}"/>`;
    s += `<path d="${pillow(S.x - b * 0.22, S.y - b * 0.22, S.w + b * 0.44, S.h + b * 0.44, L.r + b * 0.2, L.bulge)}" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1"/>`;

    // Glass on top of the picture.
    s += `<g clip-path="url(#${id}screenClip)">`;
    if (scan > 0) s += `<rect x="${f(S.x)}" y="${f(S.y)}" width="${f(S.w)}" height="${f(S.h)}" fill="url(#${id}scan)" opacity="${f(scan * 0.6 * 100) / 100}"/>`;
    if (opts.glass) {
      s += `<rect x="${f(S.x)}" y="${f(S.y)}" width="${f(S.w)}" height="${f(S.h)}" fill="url(#${id}vig)"/>`;
      s += `<ellipse cx="${f(S.x + S.w * 0.3)}" cy="${f(S.y + S.h * 0.08)}" rx="${f(S.w * 0.55)}" ry="${f(S.h * 0.38)}" fill="url(#${id}glare)"/>`;
      s += `<path d="${screen}" fill="none" stroke="#000" stroke-opacity="0.75" stroke-width="${f(b * 0.9)}" filter="url(#${id}inner)"/>`;
    }
    s += '</g>';

    if (panel) {
      const P = panel;
      const pcx = P.x + P.w / 2;
      s += `<path d="${rr(P.x, P.y, P.w, P.h, P.w * 0.08)}" fill="url(#${id}panel)"/>`;
      s += `<path d="${rr(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1, P.w * 0.08)}" fill="none" stroke="#000" stroke-opacity="0.35"/>`;
      const fs = P.w * 0.095;
      if (label) s += `<text x="${f(pcx)}" y="${f(P.y + P.h * 0.075 + fs * 0.35)}" font-size="${f(fs)}" letter-spacing="${f(fs * 0.12)}" text-anchor="middle" fill="${T.panelText}" ${font}${fitText(label, fs, P.w * 0.84)}>${label}</text>`;
      s += `<g ${font}>`;
      s += knob(id, pcx, P.y + P.h * 0.3, P.w * 0.24, -60, T, true);
      s += knob(id, pcx, P.y + P.h * 0.565, P.w * 0.17, 140, T, false);
      s += '</g>';
      if (P.w > 70) s += `<text x="${f(pcx)}" y="${f(P.y + P.h * 0.565 + P.w * 0.27)}" font-size="${f(P.w * 0.055)}" letter-spacing="${f(P.w * 0.01)}" text-anchor="middle" fill="${T.panelText}" opacity="0.75" ${font}>VOLUME</text>`;
      const ledY = P.y + P.h * 0.7;
      s += `<circle class="led-glow" cx="${f(pcx)}" cy="${f(ledY)}" r="${f(Math.max(2.5, P.w * 0.03))}" fill="#ff3b2f" opacity="0" filter="url(#${id}ledglow)"/>`;
      s += `<circle class="led" cx="${f(pcx)}" cy="${f(ledY)}" r="${f(Math.max(1.8, P.w * 0.022))}" fill="#4a1410"/>`;
      s += grille(P.x + P.w * 0.12, P.y + P.h * 0.75, P.w * 0.76, P.h * 0.2, T, false);
    } else {
      const top = bo.y + bo.h, hh = K.y + K.h - top;
      const mid = top + hh * 0.47;
      const u = hh * 0.6;
      const fs = u * 0.45;
      if (label) s += `<text x="${f(bo.x + bo.w / 2)}" y="${f(mid + fs * 0.36)}" font-size="${f(fs)}" letter-spacing="${f(fs * 0.18)}" text-anchor="middle" fill="${T.label}" opacity="0.92" ${font}${fitText(label, fs, bo.w * 0.34)}>${label}</text>`;
      const gw = Math.min(bo.w * 0.2, u * 4.5);
      s += grille(bo.x + hh * 0.2, mid - u * 0.42, gw, u * 0.84, T, true);
      const R = u * 0.42;
      const k1 = bo.x + bo.w - hh * 0.2 - R;
      s += `<g ${font}>${knob(id, k1, mid, R, -40, T, false)}${knob(id, k1 - R * 2.8, mid, R, 120, T, false)}</g>`;
      const lx = k1 - R * 5.2;
      s += `<circle class="led-glow" cx="${f(lx)}" cy="${f(mid)}" r="${f(Math.max(2.5, R * 0.3))}" fill="#ff3b2f" opacity="0" filter="url(#${id}ledglow)"/>`;
      s += `<circle class="led" cx="${f(lx)}" cy="${f(mid)}" r="${f(Math.max(1.8, R * 0.2))}" fill="#4a1410"/>`;
    }

    s += '</svg>';
    return s;
  }

  // Turn our own SVG markup into DOM nodes without innerHTML, which pages that
  // enforce Trusted Types (YouTube does) refuse to run.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const TOKEN = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  const ATTR = /([\w:-]+)="([^"]*)"/g;

  function render(target, markup) {
    const frag = document.createDocumentFragment();
    const stack = [frag];
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(markup))) {
      const parent = stack[stack.length - 1];
      if (m[5] !== undefined) {
        parent.appendChild(document.createTextNode(decode(m[5])));
      } else if (m[1]) {
        if (stack.length > 1) stack.pop();
      } else {
        const el = document.createElementNS(SVGNS, m[2]);
        ATTR.lastIndex = 0;
        let a;
        while ((a = ATTR.exec(m[3]))) if (a[1] !== 'xmlns') el.setAttribute(a[1], decode(a[2]));
        parent.appendChild(el);
        if (!m[4]) stack.push(el);
      }
    }
    target.replaceChildren(frag);
  }

  function setLed(root, on) {
    if (!root) return;
    root.querySelectorAll('.led').forEach((el) => el.setAttribute('fill', on ? '#ff4a3a' : '#4a1410'));
    root.querySelectorAll('.led-glow').forEach((el) => el.setAttribute('opacity', on ? '0.9' : '0'));
  }

  globalThis.CRTFrame = { DEFAULTS, THEMES, computeLayout, buildSVG, render, setLed };
})();
