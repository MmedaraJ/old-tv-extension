(() => {
  'use strict';
  const { DEFAULTS, THEMES, computeLayout, buildSVG } = globalThis.CRTFrame;
  const $ = (id) => document.getElementById(id);
  let settings = { ...DEFAULTS };
  let site = '';

  const save = (patch) => {
    settings = { ...settings, ...patch };
    chrome.storage.local.set(patch);
    render();
  };

  let timer = 0;
  const saveSoon = (patch) => {
    settings = { ...settings, ...patch };
    render();
    clearTimeout(timer);
    timer = setTimeout(() => chrome.storage.local.set(patch), 120);
  };

  function drawPreview() {
    const W = 292, H = 164;
    const C = { x: (W - H * 4 / 3) / 2, y: 0, w: H * 4 / 3, h: H }; // a 4:3 picture
    const L = computeLayout(W, H, C, settings);
    const pic = $('picture');
    if (!L) return;
    Object.assign(pic.style, { left: `${L.S.x}px`, top: `${L.S.y}px`, width: `${L.S.w}px`, height: `${L.S.h}px` });
    $('previewFrame').innerHTML = buildSVG(L, settings, 'pv');
    $('previewFrame').querySelectorAll('.led').forEach((el) => el.setAttribute('fill', '#ff4a3a'));
    $('previewFrame').querySelectorAll('.led-glow').forEach((el) => el.setAttribute('opacity', '0.9'));
  }

  function render() {
    const siteOff = (settings.disabledSites || []).includes(site);
    $('enabled').checked = settings.enabled;
    $('siteOn').checked = !siteOff;
    $('siteOn').disabled = !site;
    $('size').value = settings.size;
    $('scanlines').value = settings.scanlines;
    $('glass').checked = settings.glass;
    $('panel').checked = settings.panel;
    if (document.activeElement !== $('label')) $('label').value = settings.label;
    document.querySelectorAll('#themes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === settings.theme)));
    document.body.classList.toggle('off', !settings.enabled || siteOff);
    drawPreview();
  }

  function buildThemeButtons() {
    const wrap = $('themes');
    for (const [key, t] of Object.entries(THEMES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.theme = key;
      const sw = document.createElement('i');
      sw.style.background = `linear-gradient(${t.cab[0]}, ${t.cab[2]})`;
      sw.style.setProperty('--bezel', t.bezel[1]);
      btn.append(sw, document.createTextNode(t.name));
      btn.addEventListener('click', () => save({ theme: key }));
      wrap.append(btn);
    }
  }

  function wire() {
    $('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
    $('siteOn').addEventListener('change', (e) => {
      const set = new Set(settings.disabledSites || []);
      if (e.target.checked) set.delete(site); else set.add(site);
      save({ disabledSites: [...set] });
    });
    $('size').addEventListener('input', (e) => saveSoon({ size: Number(e.target.value) }));
    $('scanlines').addEventListener('input', (e) => saveSoon({ scanlines: Number(e.target.value) }));
    $('glass').addEventListener('change', (e) => save({ glass: e.target.checked }));
    $('panel').addEventListener('change', (e) => save({ panel: e.target.checked }));
    $('label').addEventListener('input', (e) => saveSoon({ label: e.target.value }));
  }

  buildThemeButtons();
  wire();
  chrome.storage.local.get(DEFAULTS, (s) => {
    settings = { ...DEFAULTS, ...s };
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        const u = new URL(tabs[0].url);
        if (u.protocol === 'http:' || u.protocol === 'https:') site = u.hostname;
      } catch (e) { /* no tab url */ }
      $('site').textContent = site || 'this page';
      render();
    });
  });
})();
