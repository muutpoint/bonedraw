/* bonedraw — interface effects: gear knobs, click pings, scrambled labels, the scan sweep */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- sliders: the gradient fills to the knob and the gear turns with the value
  function paintRange(el) {
    const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value);
    const f = max > min ? (v - min) / (max - min) : 0;
    el.style.setProperty('--f', f.toFixed(4));
    el.style.setProperty('--rot', (f * 300).toFixed(1) + 'deg');
  }
  // the app sets slider values in code all the time; catch those too
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  Object.defineProperty(HTMLInputElement.prototype, 'value', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); if (this.type === 'range') paintRange(this); },
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.type !== 'range') return;
    paintRange(el);
    const out = el.parentElement && el.parentElement.querySelector('output');
    if (out) { out.classList.add('hot'); clearTimeout(out._t); out._t = setTimeout(() => out.classList.remove('hot'), 400); }
  });
  document.querySelectorAll('input[type=range]').forEach(paintRange);

  if (calm) return;

  // ---- a small square ping wherever something is pressed
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button, select, summary, input[type=checkbox], #grid .cell, #modes button')) return;
    const p = document.createElement('span');
    p.className = 'ping';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 500);
  });

  // ---- labels scramble through glyphs for a moment when pressed
  const GLYPHS = '▚▞░▒▓01#/\\<>_+';
  function scramble(el) {
    if (el._scr || el.children.length) return;
    const text = el.textContent, dur = 260, t0 = performance.now();
    el._scr = true;
    // timers rather than animation frames, so the label always comes back, even in a background tab
    const iv = setInterval(() => {
      const keep = Math.floor(Math.min(1, (performance.now() - t0) / dur) * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) s += i < keep || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
    }, 33);
    setTimeout(() => { clearInterval(iv); el.textContent = text; el._scr = false; }, dur);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#next, #modes button, .seg button, #download, #grid .more, #humanoid');
    if (b) scramble(b.id === 'humanoid' ? b.querySelector('.t') : b);
  });

  // ---- a scan line sweeps each new specimen in, and the corner brackets breathe out
  let lastSeed = null;
  function sweep() {
    const scan = $('scan'), d = $('drawing');
    if (!scan || d.hidden) return;
    scan.classList.remove('go');
    void scan.offsetWidth;
    scan.classList.add('go');
    d.classList.add('pulse');
    clearTimeout(d._t);
    d._t = setTimeout(() => d.classList.remove('pulse'), 380);
  }
  new MutationObserver(() => {
    const seed = $('seed') && $('seed').value;
    if (seed !== lastSeed) { if (lastSeed !== null) sweep(); lastSeed = seed; }
  }).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', (e) => { if (e.target.closest('#modes button, #humanoid')) sweep(); });
})();
