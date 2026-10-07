/* bonedraw — browser UI */
(function () {
  'use strict';
  const BD = globalThis.BD;
  const $ = (id) => document.getElementById(id);
  const M = BD.creature;

  const START = { weirdness: 0.5, style: 'specimen', preset: 'still', mode: 'anatomical', humanoid: false };
  const state = {
    mode: 'anatomical',
    humanoid: false,
    seed: '',
    overrides: {},
    weirdness: 0.15,
    label: 'name',
    style: 'plate',
    showRig: false,
    playing: true,
    motion: null,
    look: null,
    view: 'single',
    history: [],
    current: null,
  };

  // ------------------------------------------------------------ storage (best effort)
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bonedraw.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bonedraw.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  // ------------------------------------------------------------ generation & painting
  function generate(seed) {
    return BD.generate({ mode: state.mode, humanoid: state.humanoid, seed, overrides: state.overrides, weirdness: state.weirdness, label: state.label, style: state.style });
  }

  function paint(cv, res, size, opts = {}) {
    const W = size, H = size;
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    const k = W / 1000;
    const labelH = res.label ? res.labelH * k : 0;
    const V = BD.draw.fitTransform(opts.bbox || res.rig.bbox, W, H, labelH, 56 * k);
    const pose = opts.pose || res.rig.rest;
    const post = BD.post.isPost(state.style);
    // X-ray and cleared & stained go through the shader; if WebGL2 is missing they fall back to Specimen
    const drewPost = post && BD.post.paint(ctx, res.rig, pose, V, {
      W, H, look: state.style, params: state.look[state.style], lineWeight: res.params.lineWeight, pxScale: k, time: opts.time || 0,
    });
    if (drewPost) { if (opts.overlay) BD.draw.overlay(ctx, res.rig, pose, V, { pxScale: k }); }
    else {
      BD.draw.canvas(ctx, res.rig, pose, V, {
        W, H, style: post ? 'specimen' : state.style, lineWeight: res.params.lineWeight, pxScale: k,
        overlay: opts.overlay, background: opts.background !== false,
      });
    }
    if (res.label && opts.label !== false) {
      const st = BD.draw.STYLES[state.style];
      ctx.fillStyle = drewPost ? BD.post.textColour(state.style, state.look[state.style]) : (st || BD.draw.STYLES.specimen).text;
      ctx.font = `italic ${26 * k}px 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(res.label, W / 2, H - labelH / 2);
    }
  }

  let pending = 0;
  function redraw() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const res = generate(state.seed);
      state.current = res;
      document.title = res.name + ' · bonedraw';
      syncParams(res.params);
      rigInfo(res.rig);
      writeHash();
      retime();
    });
  }

  // ------------------------------------------------------------ animation
  // The clock runs in "speed 1" seconds, so changing speed never makes the pose jump.
  const anim = { clock: 0, last: 0, raf: 0, R: null, bbox: null, pose: null, rec: null };
  function retime() {
    const res = state.current;
    if (!res) return;
    const R = BD.motion.resolve(state.motion, res.rig);
    anim.R = Object.assign({}, R, { speed: 1 });
    anim.speed = R.speed;
    anim.bbox = BD.motion.loopBounds(res.rig, anim.R);
    syncMotion(R);
    frame(performance.now(), true);
  }
  function frame(now, force) {
    cancelAnimationFrame(anim.raf);
    const res = state.current;
    if (!res || state.view !== 'single' || job) return;
    const dt = anim.last ? Math.min(0.1, (now - anim.last) / 1000) : 0;
    anim.last = now;
    const live = state.playing && anim.R.moving;
    if (live && !force) anim.clock += dt * anim.speed;
    anim.pose = BD.motion.pose(res.rig, anim.R, anim.clock);
    const cv = $('cv');
    const px = Math.round((cv.clientWidth || 700) * (window.devicePixelRatio || 1));
    paint(cv, res, px, { overlay: state.showRig, pose: anim.pose, bbox: anim.bbox, time: anim.clock });
    if (anim.rec) anim.rec.tick();
    if (live || anim.rec) anim.raf = requestAnimationFrame((t) => frame(t));
    else anim.last = 0;
  }

  // ------------------------------------------------------------ motion panel
  const M_SLIDERS = { mMaster: 'master', mSpeed: 'speed', mBodyWaves: 'bodyWaves', mFinWaves: 'finWaves', mShape: 'shape', mRange: 'range' };
  const SHAPE_KEYS = ['bodyWaves', 'finWaves', 'shape'];
  function buildMotion() {
    const sel = $('mPreset');
    for (const k in BD.motion.PRESETS) {
      const o = document.createElement('option');
      o.value = k; o.textContent = BD.motion.PRESETS[k].label;
      sel.appendChild(o);
    }
    const o = document.createElement('option');
    o.value = 'custom'; o.textContent = 'Custom mix';
    sel.appendChild(o);
    sel.addEventListener('change', () => { state.motion.preset = sel.value; saveMotion(); retime(); });
    const host = $('mLayers');
    for (const l of BD.motion.LAYERS) {
      const row = document.createElement('div');
      row.className = 'row layer';
      row.innerHTML = `<label class="lbl" for="mL_${l}">${BD.motion.LAYER_LABEL[l]}</label><input type="range" id="mL_${l}" min="0" max="1.5" step="0.01"><output id="mL_${l}Out"></output>`;
      host.appendChild(row);
      $('mL_' + l).addEventListener('input', () => { toCustom(); state.motion.layers[l] = Number($('mL_' + l).value); saveMotion(); retime(); });
    }
    for (const id in M_SLIDERS) {
      $(id).addEventListener('input', () => {
        const key = M_SLIDERS[id];
        if (SHAPE_KEYS.includes(key)) toCustom();
        state.motion[key] = Number($(id).value);
        saveMotion(); retime();
      });
    }
    $('play').addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
  }
  // editing a layer turns the current preset into an editable mix
  function toCustom() {
    if (state.motion.preset === 'custom' || !anim.R) return;
    const R = BD.motion.resolve(state.motion, state.current.rig);
    state.motion.preset = 'custom';
    state.motion.layers = Object.assign({}, R.layers);
    for (const k of SHAPE_KEYS) state.motion[k] = R[k];
  }
  function syncMotion(R) {
    if ($('exportHint')) setTimeout(() => exportHint(), 0);
    $('mPreset').value = state.motion.preset;
    const P = BD.motion.PRESETS;
    $('mHint').textContent = state.motion.preset === 'auto' ? 'Auto chose: ' + (P[R.resolved] ? P[R.resolved].label : R.resolved) : '';
    const vals = { mMaster: R.master, mSpeed: R.speed, mBodyWaves: R.bodyWaves, mFinWaves: R.finWaves, mShape: R.shape, mRange: R.range };
    for (const id in vals) { if (document.activeElement !== $(id)) $(id).value = vals[id]; $(id + 'Out').textContent = Number(vals[id]).toFixed(2); }
    for (const l of BD.motion.LAYERS) {
      const v = R.layers[l];
      if (document.activeElement !== $('mL_' + l)) $('mL_' + l).value = v;
      $('mL_' + l + 'Out').textContent = v.toFixed(2);
    }
    $('play').textContent = state.playing ? 'pause' : 'play';
  }
  function saveMotion() { store.set('motion', state.motion); }
  function togglePlay() {
    state.playing = !state.playing;
    store.set('playing', state.playing);
    $('play').textContent = state.playing ? 'pause' : 'play';
    anim.last = 0;
    frame(performance.now());
  }

  // fallback for browsers without a video encoder: record one loop off the screen as WebM
  function recordRealtime() {
    const res = state.current;
    if (!res || anim.rec) return;
    if (!anim.R.moving) { alert('Pick a movement first: nothing is moving.'); return; }
    if (typeof MediaRecorder === 'undefined') { alert('This browser cannot record video.'); return; }
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const type = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) { alert('This browser cannot record video.'); return; }
    const stream = $('cv').captureStream(60);
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      save(new Blob(chunks, { type }), slug(res.name) + '_' + slug(res.seed) + '_' + anim.R.resolved + '.' + ext);
      $('download').textContent = 'Download';
      $('download').disabled = false;
    };
    const loop = BD.motion.loopSeconds(anim.R);
    anim.clock = 0;
    anim.last = 0;
    if (!state.playing) togglePlay();
    $('download').textContent = 'Recording in real time…';
    $('download').disabled = true;
    anim.rec = {
      tick() {
        if (anim.clock >= loop) { anim.rec = null; anim.clock = 0; mr.stop(); }
      },
    };
    mr.start();
    frame(performance.now(), true);
  }

  function rigInfo(rig) {
    const roles = {};
    for (const b of rig.bones) roles[b.role] = (roles[b.role] || 0) + 1;
    const moving = rig.bones.filter((b) => b.lim[0] !== b.lim[1]).length;
    const parts = ['skull', 'neck', 'trunk', 'tail', 'rib', 'limb', 'digit', 'ray'].filter((k) => roles[k]).map((k) => roles[k] + ' ' + k);
    $('rigInfo').textContent = `${rig.bones.length} bones, ${moving} jointed · ${Object.keys(rig.chains).length} chains · ${parts.join(', ')}`;
  }

  function setSeed(seed, push = true) {
    if (push && state.seed && state.seed !== seed) state.history.push(state.seed);
    if (state.history.length > 200) state.history.shift();
    state.seed = seed;
    $('seed').value = seed;
    if (state.view === 'grid') setView('single');
    redraw();
  }

  // ------------------------------------------------------------ url
  // #seed for anatomical, #wild/seed for wild
  // #seed · #wild/seed · #human/seed · #wild/human/seed
  function writeHash() {
    const h = '#' + (state.mode === 'wild' ? 'wild/' : '') + (state.humanoid ? 'human/' : '') + encodeURIComponent(state.seed);
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function readHash() {
    const m = location.hash.match(/^#(?:(wild)\/)?(?:(human)\/)?(.+)$/);
    return m ? { mode: m[1] ? 'wild' : 'anatomical', humanoid: !!m[2], seed: decodeURIComponent(m[3]) } : null;
  }
  // Humanoid mode lets the smiler into the pool; its parts only show in the menus while it's on
  const HUMAN_ONLY = { archetype: ['humanoid'], skullShape: ['smiler'], frontLimb: ['arm', 'leg'], hindLimb: ['arm', 'leg'], extraLimb: ['arm', 'leg'] };
  function setHumanoid(on, quiet) {
    state.humanoid = !!on;
    store.set('humanoid', state.humanoid);
    const b = $('humanoid');
    b.classList.toggle('on', state.humanoid);
    b.setAttribute('aria-pressed', String(state.humanoid));
    for (const key in HUMAN_ONLY) {
      const sel = $('p_' + key);
      if (sel) for (const o of sel.options) if (HUMAN_ONLY[key].includes(o.value)) o.hidden = !state.humanoid;
      if (!state.humanoid && HUMAN_ONLY[key].includes(state.overrides[key])) delete state.overrides[key];
    }
    if (!quiet) state.view === 'grid' ? fillGrid() : redraw();
  }
  function setMode(mode, quiet) {
    state.mode = mode;
    store.set('mode', mode);
    for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.mode === mode);
    if (!quiet) state.view === 'grid' ? fillGrid() : redraw();
  }

  // ------------------------------------------------------------ parameters panel
  let controls = {};
  function fmtVal(s, v) {
    if (s.type === 'bool' || s.type === 'select') return '';
    return s.int ? String(v) : Number(v).toFixed(2);
  }
  function buildParams(schema) {
    controls = {};
    const host = $('paramGroups');
    host.innerHTML = '';
    const groups = {};
    for (const s of schema) (groups[s.group] = groups[s.group] || []).push(s);
    const openGroups = store.get('openGroups', ['Body']);
    for (const g in groups) {
      const det = document.createElement('details');
      det.open = openGroups.includes(g);
      det.dataset.group = g;
      det.addEventListener('toggle', () => {
        store.set('openGroups', [...host.querySelectorAll('details')].filter((d) => d.open).map((d) => d.dataset.group));
      });
      const sum = document.createElement('summary');
      sum.textContent = g;
      det.appendChild(sum);
      const rows = document.createElement('div');
      rows.className = 'rows';
      for (const s of groups[g]) rows.appendChild(paramRow(s));
      det.appendChild(rows);
      host.appendChild(det);
    }
  }
  function paramRow(s) {
    const row = document.createElement('div');
    row.className = 'row param';
    const id = 'p_' + s.key;
    const lbl = document.createElement('label');
    lbl.className = 'lbl';
    lbl.htmlFor = id;
    lbl.textContent = s.label;
    lbl.title = 'Click to unlock when changed';
    lbl.addEventListener('click', (e) => {
      if (s.key in state.overrides) { e.preventDefault(); delete state.overrides[s.key]; redraw(); }
    });
    row.appendChild(lbl);
    let input, out = null;
    if (s.type === 'select') {
      input = document.createElement('select');
      for (const o of s.options) {
        const op = document.createElement('option');
        op.value = o;
        op.textContent = (s.labels && s.labels[o]) || o;
        input.appendChild(op);
      }
      input.addEventListener('change', () => { state.overrides[s.key] = input.value; redraw(); });
      if (HUMAN_ONLY[s.key]) for (const o of input.options) if (HUMAN_ONLY[s.key].includes(o.value)) o.hidden = !state.humanoid;
    } else if (s.type === 'bool') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => { state.overrides[s.key] = input.checked; redraw(); });
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = s.min; input.max = s.max; input.step = s.step;
      out = document.createElement('output');
      input.addEventListener('input', () => {
        state.overrides[s.key] = s.int ? Math.round(Number(input.value)) : Number(input.value);
        out.textContent = fmtVal(s, input.value);
        redraw();
      });
    }
    input.id = id;
    row.appendChild(input);
    if (out) row.appendChild(out);
    controls[s.key] = { s, input, out, row };
    return row;
  }
  function syncParams(P) {
    for (const k in controls) {
      const c = controls[k], v = P[k];
      if (c.s.type === 'bool') c.input.checked = !!v;
      else if (document.activeElement !== c.input) c.input.value = v;
      if (c.out) c.out.textContent = fmtVal(c.s, v);
      c.row.classList.toggle('changed', k in state.overrides);
    }
  }

  // ------------------------------------------------------------ grid view
  let gridToken = 0;
  function fillGrid(append = false) {
    const grid = $('grid');
    if (!append) grid.innerHTML = '';
    const old = grid.querySelector('.more');
    if (old) old.remove();
    const token = ++gridToken;
    const cells = [];
    for (let i = 0; i < 12; i++) {
      const seed = BD.randomSeed();
      const cell = document.createElement('div');
      cell.className = 'cell pending';
      cell.title = seed;
      const cv = document.createElement('canvas');
      cell.appendChild(cv);
      cell.addEventListener('click', () => setSeed(seed));
      grid.appendChild(cell);
      cells.push({ cell, cv, seed });
    }
    const more = document.createElement('button');
    more.className = 'more';
    more.textContent = 'More';
    more.addEventListener('click', () => fillGrid(true));
    grid.appendChild(more);
    let i = 0;
    const step = () => {
      if (token !== gridToken || i >= cells.length) return;
      const { cell, cv, seed } = cells[i++];
      const res = generate(seed);
      paint(cv, res, Math.round((cell.clientWidth || 240) * (window.devicePixelRatio || 1)));
      cell.title = res.name + ' — ' + seed;
      cell.classList.remove('pending');
      setTimeout(step, 0);
    };
    step();
  }
  function setView(v) {
    state.view = v;
    for (const b of $('view').querySelectorAll('button')) b.classList.toggle('on', b.dataset.view === v);
    $('drawing').hidden = v !== 'single';
    $('grid').hidden = v !== 'grid';
    if (v === 'grid') { cancelAnimationFrame(anim.raf); fillGrid(); } else redraw();
  }

  // ------------------------------------------------------------ look panel (X-ray, cleared & stained)
  function buildLook() {
    const host = $('lookRows');
    host.innerHTML = '';
    const post = BD.post.isPost(state.style);
    // the shader looks are pixels; SVG can't hold them
    const svgOpt = $('fmt').querySelector('option[value="svg"]');
    svgOpt.disabled = post;
    if (post && $('fmt').value === 'svg') { $('fmt').value = 'png'; $('fmt').dispatchEvent(new Event('input')); }
    if (!post) return;
    const look = state.style, vals = state.look[look];
    for (const s of BD.post.SCHEMA) {
      if (!s.looks.includes(look)) continue;
      const row = document.createElement('div');
      row.className = 'row';
      const id = 'look_' + s.key;
      const lbl = document.createElement('label');
      lbl.className = 'lbl'; lbl.htmlFor = id; lbl.textContent = s.label;
      if (s.title) lbl.title = s.title;
      row.appendChild(lbl);
      let input;
      if (s.type === 'select') {
        input = document.createElement('select');
        for (const o of s.options) { const op = document.createElement('option'); op.value = o; op.textContent = (s.labels && s.labels[o]) || o; input.appendChild(op); }
        input.value = vals[s.key];
        input.addEventListener('change', () => { vals[s.key] = input.value; lookChanged(); });
        row.appendChild(input);
      } else {
        input = document.createElement('input');
        input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step; input.value = vals[s.key];
        const out = document.createElement('output');
        out.textContent = Number(vals[s.key]).toFixed(2);
        input.addEventListener('input', () => { vals[s.key] = Number(input.value); out.textContent = Number(input.value).toFixed(2); lookChanged(); });
        row.appendChild(input);
        row.appendChild(out);
      }
      input.id = id;
      host.appendChild(row);
    }
    const reset = document.createElement('button');
    reset.className = 'link';
    reset.textContent = 'reset look';
    reset.addEventListener('click', () => { state.look[look] = BD.post.defaults(look); lookChanged(); buildLook(); });
    host.appendChild(reset);
  }
  function lookChanged() {
    store.set('look', state.look);
    if (state.view === 'grid') fillGrid(); else frame(performance.now(), true);
  }

  // ------------------------------------------------------------ export
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function download() {
    const res = state.current;
    if (!res) return;
    const fmt = $('fmt').value, size = Number($('size').value);
    const transparent = $('bg').value === '';
    const base = slug(res.name) + '_' + slug(res.seed);
    if (fmt === 'json') {
      const data = {
        name: res.name, seed: res.seed, params: res.params,
        units: 'trunk length = ' + M.T, axes: 'x right, y towards the tail; angles in radians, limits in degrees',
        restCurve: res.rig.restCurve(),
        rig: res.rig.toJSON(),
      };
      return save(new Blob([JSON.stringify(data)], { type: 'application/json' }), base + '_rig.json');
    }
    if (fmt === 'mp4' || fmt === 'gif') return renderLoop(fmt);
    if (fmt === 'svg') {
      const svg = res.svg({ W: size, H: size, style: state.style, background: transparent ? null : undefined, pose: anim.pose, bbox: anim.bbox });
      return save(new Blob([svg], { type: 'image/svg+xml' }), base + '.svg');
    }
    const cv = document.createElement('canvas');
    try {
      paint(cv, res, size, { background: !transparent, overlay: state.showRig, pose: anim.pose, bbox: anim.bbox });
    } catch (e) { alert('That size is too large for this browser. Try a smaller export.'); return; }
    cv.toBlob((blob) => {
      if (!blob) { alert('That size is too large for this browser. Try a smaller export.'); return; }
      save(blob, base + '.png');
    }, 'image/png');
  }

  // ------------------------------------------------------------ export settings
  const SIZES = { png: [1000, 2000, 4000, 8000], svg: [1000, 2000, 4000, 8000], mp4: [720, 1080, 1440, 2160], gif: [360, 480, 600, 800] };
  const SIZE_DEF = { png: 2000, svg: 2000, mp4: 1080, gif: 480 };
  const FPS = { mp4: [24, 30, 60], gif: [12.5, 20, 25] };
  const FPS_DEF = { mp4: 30, gif: 20 };
  function fillSelect(sel, values, value, label) {
    sel.innerHTML = '';
    for (const v of values) { const o = document.createElement('option'); o.value = v; o.textContent = label(v); sel.appendChild(o); }
    sel.value = values.map(String).includes(String(value)) ? value : values[0];
  }
  function syncExport() {
    const f = $('fmt').value, pr = (store.get('xprefs', {})[f]) || {};
    const loop = f === 'mp4' || f === 'gif', still = f === 'png' || f === 'svg';
    if (SIZES[f]) fillSelect($('size'), SIZES[f], pr.size || SIZE_DEF[f], (n) => loop ? `${n} × ${n}` : `${n} px`);
    if (FPS[f]) fillSelect($('fps'), FPS[f], pr.fps || FPS_DEF[f], (n) => `${n} fps`);
    if (pr.loops) $('loops').value = pr.loops;
    if (pr.quality) $('vq').value = pr.quality;
    $('sizeRow').hidden = !SIZES[f];
    $('bgRow').hidden = !still;
    $('fpsRow').hidden = $('loopsRow').hidden = !loop;
    $('qualityRow').hidden = f !== 'mp4';
    store.set('x_fmt', f);
    exportHint();
  }
  function saveExportPrefs() {
    const f = $('fmt').value, all = store.get('xprefs', {});
    all[f] = { size: $('size').value, fps: $('fps').value, loops: $('loops').value, quality: $('vq').value };
    store.set('xprefs', all);
    exportHint();
  }
  function exportHint(msg) {
    if (msg !== undefined) { $('exportHint').textContent = msg; return; }
    const f = $('fmt').value;
    let t = '';
    if (f === 'json') t = 'Rig JSON holds every bone (parent, pivot, rest angle, joint limits, role) and the line art in each bone\'s own frame, for TouchDesigner or Blender.';
    else if (f === 'mp4' || f === 'gif') {
      const secs = BD.motion.loopSeconds({ speed: (state.motion && state.motion.speed) || 1 }) * Number($('loops').value || 1);
      const still = !anim.R || !anim.R.moving;
      t = still ? 'Pick a movement first: a creature standing still makes a one-frame loop.'
        : `${secs.toFixed(1)} s, drawn frame by frame at exactly the right moment and joined into a seamless loop. Click again while it renders to cancel.`;
      if (f === 'mp4' && !BD.exporter.canMP4()) t = 'This browser has no video encoder, so MP4 falls back to a real-time WebM recording.';
    }
    $('exportHint').textContent = t;
  }
  function setupExport() {
    const f = store.get('x_fmt', 'png');
    if ([...$('fmt').options].some((o) => o.value === f)) $('fmt').value = f;
    $('fmt').addEventListener('input', syncExport);
    for (const k of ['size', 'fps', 'loops', 'vq']) $(k).addEventListener('input', saveExportPrefs);
    syncExport();
  }

  // ------------------------------------------------------------ loop rendering (MP4, GIF)
  let job = null;
  async function renderLoop(fmt) {
    if (job) { job.cancel = true; return; }
    const res = state.current;
    if (!res || !anim.R || !anim.R.moving) { exportHint('Pick a movement first: a creature standing still makes a one-frame loop.'); return; }
    if (fmt === 'mp4' && !BD.exporter.canMP4()) return recordRealtime();
    const size = Number($('size').value), fps = Number($('fps').value), loops = Number($('loops').value), quality = $('vq').value;
    const R = anim.R, bbox = anim.bbox;
    const loopClock = BD.motion.loopSeconds(R);          // in speed-1 seconds
    const perLoop = Math.max(2, Math.round((loopClock / anim.speed) * fps));
    const frames = perLoop * loops;
    const btn = $('download'), bar = $('progress');
    job = { cancel: false };
    cancelAnimationFrame(anim.raf);
    btn.textContent = 'Rendering 0% · click to cancel';
    bar.hidden = false;
    bar.firstElementChild.style.width = '0%';
    const draw = (cv, i) => {
      const t = ((i % perLoop) / perLoop) * loopClock;
      paint(cv, res, size, { pose: BD.motion.pose(res.rig, R, t), bbox, time: t, overlay: state.showRig });
    };
    const t0 = performance.now();
    try {
      const blob = await BD.exporter[fmt]({
        size, fps, frames, quality, draw,
        progress: (f) => { const pc = Math.round(f * 100); btn.textContent = `Rendering ${pc}% · click to cancel`; bar.firstElementChild.style.width = pc + '%'; },
        cancelled: () => job.cancel,
      });
      save(blob, slug(res.name) + '_' + slug(res.seed) + '_' + R.resolved + '.' + fmt);
      exportHint(`Saved ${frames} frames (${size} × ${size}, ${fps} fps), ${(blob.size / 1e6).toFixed(1)} MB, in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
    } catch (e) {
      exportHint(e && e.message === 'cancelled' ? 'Cancelled.' : 'Export failed: ' + (e && e.message ? e.message : e));
    } finally {
      job = null;
      btn.textContent = 'Download';
      bar.hidden = true;
      anim.last = 0;
      frame(performance.now(), true);
    }
  }

  // ------------------------------------------------------------ presets
  // Built-in starting points. Anything a preset leaves out falls back to the defaults.
  const BUILTIN = [
    { name: 'Stingray, cleared & stained', style: 'cleared', weirdness: 0.15, overrides: { archetype: 'ray' }, motion: { preset: 'undulate' } },
    { name: 'Radiograph lizard, walking', style: 'xray', weirdness: 0.2, overrides: { archetype: 'lizard' }, motion: { preset: 'walk' }, look: { xray: { film: 'positive', tint: 'sepia', flesh: 0.8, puff: 1.7 } } },
    { name: 'Smiler humanoid, walking', humanoid: true, style: 'specimen', weirdness: 0.1, overrides: { archetype: 'humanoid' }, motion: { preset: 'walk' } },
    { name: 'Smiler infection', humanoid: true, style: 'specimen', weirdness: 0.75, motion: { preset: 'still' } },
    { name: 'Wild monsters, everything moving', mode: 'wild', style: 'specimen', weirdness: 0.95, motion: { preset: 'all' } },
    { name: 'Green ghost', style: 'xray', weirdness: 0.6, motion: { preset: 'writhe' }, look: { xray: { tint: 'green', glow: 1.1 } } },
    { name: 'Engraved plate', style: 'plate', weirdness: 0.2, motion: { preset: 'still' } },
  ];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const num = (v, d) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
  // imported files are data: keep only known settings, of the right types
  function cleanPreset(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const q = { name: String(p.name || 'Untitled').slice(0, 60) };
    q.mode = p.mode === 'wild' ? 'wild' : 'anatomical';
    q.humanoid = p.humanoid === true;
    q.style = ['plate', 'specimen', 'xray', 'cleared'].includes(p.style) ? p.style : 'specimen';
    q.label = ['name', 'seed', 'none'].includes(p.label) ? p.label : 'name';
    q.weirdness = Math.min(1, Math.max(0, num(p.weirdness, 0.5)));
    q.overrides = {};
    const schema = {};
    for (const sc of M.schema) schema[sc.key] = sc;
    if (p.overrides && typeof p.overrides === 'object') {
      for (const k of Object.keys(p.overrides)) {
        const sc = own(schema, k) ? schema[k] : null, v = p.overrides[k];
        if (!sc) continue;
        if (sc.type === 'select' && sc.options.includes(v)) q.overrides[k] = v;
        else if (sc.type === 'bool' && typeof v === 'boolean') q.overrides[k] = v;
        else if (sc.type === 'range' && Number.isFinite(Number(v))) q.overrides[k] = Number(v);
      }
    }
    const m = p.motion && typeof p.motion === 'object' ? p.motion : {};
    q.motion = { preset: m.preset === 'custom' || (typeof m.preset === 'string' && own(BD.motion.PRESETS, m.preset)) ? m.preset : 'still' };
    for (const k of ['master', 'speed', 'range', 'bodyWaves', 'finWaves', 'shape']) q.motion[k] = num(m[k], BD.motion.DEFAULTS[k]);
    q.motion.layers = {};
    for (const l of BD.motion.LAYERS) q.motion.layers[l] = num(m.layers && m.layers[l], 0);
    q.look = {};
    for (const lk of BD.post.LOOKS) {
      const src = (p.look && typeof p.look === 'object' && p.look[lk]) || {}, d = BD.post.defaults(lk);
      for (const sc of BD.post.SCHEMA) {
        if (!sc.looks.includes(lk)) continue;
        d[sc.key] = sc.type === 'select' ? (sc.options.includes(src[sc.key]) ? src[sc.key] : d[sc.key]) : num(src[sc.key], d[sc.key]);
      }
      q.look[lk] = d;
    }
    if (typeof p.seed === 'string' && p.seed.trim()) q.seed = p.seed.slice(0, 200);
    return q;
  }
  function snapshot(name, withSeed) {
    const c = (o) => JSON.parse(JSON.stringify(o));
    return {
      bonedraw: 'preset', version: 1, name, mode: state.mode, humanoid: state.humanoid, style: state.style, label: state.label,
      weirdness: state.weirdness, overrides: c(state.overrides), motion: c(state.motion), look: c(state.look), seed: withSeed ? state.seed : undefined,
    };
  }
  function applyPreset(p) {
    const q = cleanPreset(p);
    if (!q) return;
    state.overrides = q.overrides;
    state.weirdness = q.weirdness;
    state.label = q.label;
    state.look = q.look;
    store.set('look', state.look);
    state.motion = q.motion;
    saveMotion();
    state.style = q.style;
    $('styleMode').value = q.style;
    buildLook();
    $('weird').value = q.weirdness;
    $('weirdOut').textContent = q.weirdness.toFixed(2);
    $('labelMode').value = q.label;
    setMode(q.mode, true);
    setHumanoid(q.humanoid, true);
    if (state.view === 'grid') setView('single');
    if (q.seed) setSeed(q.seed); else redraw();
  }
  const savedPresets = () => (store.get('presets', []) || []).map(cleanPreset).filter(Boolean);
  function fillPresets(select) {
    const sel = $('presetSel'), saved = savedPresets();
    sel.innerHTML = '<option value="">Choose a preset…</option>';
    const grp = (label, list, pre) => {
      if (!list.length) return;
      const g = document.createElement('optgroup');
      g.label = label;
      list.forEach((p, i) => { const o = document.createElement('option'); o.value = pre + i; o.textContent = p.name; g.appendChild(o); });
      sel.appendChild(g);
    };
    grp('Built in', BUILTIN, 'b');
    grp('Saved', saved, 's');
    sel.value = select || '';
    $('presetDel').disabled = !sel.value.startsWith('s');
  }
  function selectedPreset() {
    const v = $('presetSel').value;
    if (!v) return null;
    return v[0] === 'b' ? BUILTIN[Number(v.slice(1))] : savedPresets()[Number(v.slice(1))];
  }
  function presetHint(t) { $('presetHint').textContent = t; }
  function addSaved(list) {
    const saved = savedPresets();
    let last = -1;
    for (const p of list) {
      let name = p.name, n = 2;
      const i = saved.findIndex((s) => s.name === name);
      if (i >= 0 && p._replace) { saved[i] = p; last = i; continue; }
      while (saved.some((s) => s.name === name)) name = p.name + ' (' + n++ + ')';
      saved.push(Object.assign({}, p, { name }));
      last = saved.length - 1;
    }
    store.set('presets', saved.map((p) => { const c = Object.assign({}, p); delete c._replace; return c; }));
    return last;
  }
  function setupPresets() {
    fillPresets();
    $('presetSel').addEventListener('change', () => {
      const p = selectedPreset();
      $('presetDel').disabled = !$('presetSel').value.startsWith('s');
      if (p) { applyPreset(p); presetHint('Loaded "' + p.name + '".'); }
    });
    $('presetSave').addEventListener('click', () => {
      $('presetNameRow').hidden = false;
      const cur = selectedPreset();
      $('presetName').value = cur && $('presetSel').value.startsWith('s') ? cur.name : (state.current ? state.current.name.replace(/\.$/, '') : 'My preset');
      $('presetName').focus();
      $('presetName').select();
    });
    const commit = () => {
      const name = $('presetName').value.trim().slice(0, 60);
      if (!name) return;
      const p = cleanPreset(snapshot(name, $('presetSeed').checked));
      p._replace = true;
      const i = addSaved([p]);
      fillPresets('s' + i);
      $('presetNameRow').hidden = true;
      presetHint('Saved "' + name + '".');
    };
    $('presetOk').addEventListener('click', commit);
    $('presetName').addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') $('presetNameRow').hidden = true; });
    $('presetDel').addEventListener('click', () => {
      const v = $('presetSel').value;
      if (!v.startsWith('s')) return;
      const saved = savedPresets(), i = Number(v.slice(1));
      if (!confirm('Delete the preset "' + saved[i].name + '"?')) return;
      const name = saved[i].name;
      saved.splice(i, 1);
      store.set('presets', saved);
      fillPresets();
      presetHint('Deleted "' + name + '".');
    });
    $('presetExport').addEventListener('click', () => {
      const p = selectedPreset();
      const out = p ? Object.assign({ bonedraw: 'preset', version: 1 }, cleanPreset(p)) : snapshot(state.current ? state.current.name.replace(/\.$/, '') : 'bonedraw', $('presetSeed').checked);
      save(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), slug(out.name) + '.bonedraw.json');
    });
    $('presetImport').addEventListener('click', () => $('presetFile').click());
    $('presetFile').addEventListener('change', async () => {
      const files = [...$('presetFile').files];
      $('presetFile').value = '';
      const found = [];
      for (const f of files) {
        try {
          const j = JSON.parse(await f.text());
          const items = Array.isArray(j) ? j : Array.isArray(j.presets) ? j.presets : [j];
          for (const it of items) { const q = cleanPreset(it); if (q) found.push(q); }
        } catch (e) { /* not JSON: skip */ }
      }
      if (!found.length) { presetHint('No presets found in that file.'); return; }
      const i = addSaved(found);
      fillPresets('s' + i);
      applyPreset(found[found.length - 1]);
      presetHint(`Imported ${found.length} preset${found.length > 1 ? 's' : ''}.`);
    });
  }

  // ------------------------------------------------------------ wiring
  function init() {
    // every launch opens the same way: medium weirdness, white-on-black specimen, standing still
    state.weirdness = START.weirdness;
    state.label = store.get('label', 'name');
    state.style = START.style;
    state.showRig = store.get('showRig', false);
    state.playing = store.get('playing', true);
    state.motion = Object.assign({}, BD.motion.DEFAULTS, store.get('motion', {}), { preset: START.preset });
    state.motion.layers = Object.assign({}, BD.motion.DEFAULTS.layers, state.motion.layers);
    buildMotion();
    state.look = {};
    const savedLook = store.get('look', {});
    for (const l of BD.post.LOOKS) state.look[l] = Object.assign(BD.post.defaults(l), savedLook[l] || {});
    $('styleMode').value = state.style;
    $('weird').value = state.weirdness;
    $('weirdOut').textContent = state.weirdness.toFixed(2);
    $('labelMode').value = state.label;
    $('showRig').checked = state.showRig;
    setupExport();

    $('seed').addEventListener('input', () => { state.seed = $('seed').value || ' '; if (state.view !== 'single') setView('single'); redraw(); });
    $('seed').addEventListener('change', () => { if (state.history[state.history.length - 1] !== state.seed) state.history.push(state.seed); });
    $('next').addEventListener('click', () => setSeed(BD.randomSeed()));
    $('prev').addEventListener('click', () => { const s = state.history.pop(); if (s) setSeed(s, false); });
    $('weird').addEventListener('input', () => {
      state.weirdness = Number($('weird').value);
      $('weirdOut').textContent = state.weirdness.toFixed(2);
      store.set('weirdness', state.weirdness);
      if (state.view === 'single') redraw();
    });
    $('weird').addEventListener('change', () => { if (state.view === 'grid') fillGrid(); });
    $('labelMode').addEventListener('change', () => { state.label = $('labelMode').value; store.set('label', state.label); state.view === 'grid' ? fillGrid() : redraw(); });
    $('styleMode').addEventListener('change', () => { state.style = $('styleMode').value; store.set('style', state.style); buildLook(); state.view === 'grid' ? fillGrid() : redraw(); });
    buildLook();
    $('showRig').addEventListener('change', () => { state.showRig = $('showRig').checked; store.set('showRig', state.showRig); frame(performance.now(), true); });
    $('resetAll').addEventListener('click', (e) => { e.preventDefault(); state.overrides = {}; redraw(); });
    for (const b of $('view').querySelectorAll('button')) b.addEventListener('click', () => setView(b.dataset.view));
    $('download').addEventListener('click', download);
    setupPresets();
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); setSeed(BD.randomSeed()); }
      else if (e.key === 'ArrowLeft') { const s = state.history.pop(); if (s) setSeed(s, false); }
      else if (e.key === 'r') { $('showRig').click(); }
      else if (e.key === 'p') { togglePlay(); }
    });
    window.addEventListener('hashchange', () => {
      const h = readHash();
      if (!h) return;
      if (h.mode !== state.mode) setMode(h.mode, true);
      if (h.humanoid !== state.humanoid) setHumanoid(h.humanoid, true);
      if (h.seed !== state.seed) setSeed(h.seed, true); else redraw();
    });
    for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (state.view === 'single') redraw(); }, 120); });

    buildParams(M.schema);
    const h = readHash();
    setMode(h ? h.mode : START.mode, true);
    setHumanoid(h ? h.humanoid : START.humanoid, true);
    $('humanoid').addEventListener('click', () => setHumanoid(!state.humanoid));
    setSeed(h ? h.seed : BD.randomSeed(), false);
  }
  init();
})();
