/* bonedraw — drawing a posed rig to a canvas or to SVG */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});

  // fill: paint for bone shapes. edge: their outline. line: detail strokes. ray: fin rays.
  const STYLES = {
    plate: { label: 'Line art', bg: '#fbf8f0', fill: '#fbf8f0', edge: '#1b1a17', line: '#1b1a17', ray: '#1b1a17', soft: '#8a8475', shade: '#1b1a17', text: '#1b1a17', shadeW: 0.7 },
    specimen: { label: 'Specimen', bg: '#0a0b0d', fill: '#e4e9e7', edge: '#8c989b', line: '#a3aeb0', ray: '#d9e1e0', soft: '#3a4245', shade: '#aab4b6', text: '#c9d0cf', shadeW: 0.6 },
  };
  const WIDTH = { bone: 1, line: 0.62, ray: 0.7, soft: 0.5, shade: 0.55 };

  function fitTransform(bb, W, H, labelH, margin) {
    const aw = W - 2 * margin, ah = H - labelH - 2 * margin;
    const bw = Math.max(1e-6, bb[2] - bb[0]), bh = Math.max(1e-6, bb[3] - bb[1]);
    const s = Math.min(aw / bw, ah / bh);
    return { s, tx: W / 2 - ((bb[0] + bb[2]) / 2) * s, ty: margin + ah / 2 - ((bb[1] + bb[3]) / 2) * s };
  }

  // walk the items in depth order, calling back with screen-space point arrays
  function eachItem(rig, T, V, fn) {
    for (const it of rig.items) {
      const w = rig.worldPts(it, T);
      for (let j = 0; j < w.length; j += 2) { w[j] = w[j] * V.s + V.tx; w[j + 1] = w[j + 1] * V.s + V.ty; }
      let holes = null;
      if (it.lh) {
        holes = it.lh.map((h) => {
          const q = rig.worldPts(it, T, h);
          for (let j = 0; j < q.length; j += 2) { q[j] = q[j] * V.s + V.tx; q[j + 1] = q[j + 1] * V.s + V.ty; }
          return q;
        });
      }
      fn(it, w, holes);
    }
  }

  function strokeOf(it, st) {
    if (it.fill) return st.edge;
    return st[it.kind] || st.line;
  }
  function widthOf(it, st, lw) {
    const k = it.kind === 'shade' ? st.shadeW : WIDTH[it.kind] || WIDTH.line;
    return lw * (it.fill ? 1 : k) * it.w;
  }

  // ------------------------------------------------------------ canvas
  function canvas(ctx, rig, T, V, opts = {}) {
    const st = STYLES[opts.style] || STYLES.plate;
    const lw = (opts.lineWidth || 1.2) * (opts.lineWeight || 1) * (opts.pxScale || 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (opts.background !== false) { ctx.fillStyle = st.bg; ctx.fillRect(0, 0, opts.W, opts.H); }
    // consecutive strokes of the same look are batched into one path
    let batch = null, bKey = '';
    const flush = () => {
      if (!batch) return;
      ctx.strokeStyle = batch.c; ctx.lineWidth = batch.w; ctx.stroke(batch.p);
      batch = null; bKey = '';
    };
    eachItem(rig, T, V, (it, w, holes) => {
      if (it.fill) {
        flush();
        const p = new Path2D();
        addPath(p, w, true);
        if (holes) for (const h of holes) addPath(p, h, true);
        ctx.fillStyle = st.fill;
        ctx.fill(p, 'evenodd');
        ctx.strokeStyle = st.edge;
        ctx.lineWidth = widthOf(it, st, lw);
        ctx.stroke(p);
      } else {
        const c = strokeOf(it, st), wd = widthOf(it, st, lw), key = c + '|' + wd.toFixed(3);
        if (key !== bKey) { flush(); batch = { p: new Path2D(), c, w: wd }; bKey = key; }
        addPath(batch.p, w, it.closed);
      }
    });
    flush();
    if (opts.overlay) overlay(ctx, rig, T, V, opts);
    ctx.restore();
  }
  function addPath(p, w, closed) {
    p.moveTo(w[0], w[1]);
    for (let j = 2; j < w.length; j += 2) p.lineTo(w[j], w[j + 1]);
    if (closed) p.closePath();
  }

  // the rig itself: bones as lines from joint to tip, joints as dots coloured by role
  const ROLE_COLOUR = {
    skull: '#d0452f', neck: '#d0452f', trunk: '#d0452f', tail: '#d0452f', rib: '#2f7fd0', girdle: '#7a4fd0',
    limb: '#1f9d6a', digit: '#1f9d6a', ray: '#d08a1f', horn: '#999', fixed: '#999',
  };
  function overlay(ctx, rig, T, V, opts) {
    const s = opts.pxScale || 1;
    // joint limits as wedges at each pivot (skipping the hundreds of fin-ray and finger joints)
    const rd = rig.restDelta;
    ctx.globalAlpha = 0.16;
    for (const b of rig.bones) {
      if (b.parent < 0 || b.lim[0] === b.lim[1] || b.role === 'ray' || b.role === 'digit') continue;
      const x = T.X[b.id] * V.s + V.tx, y = T.Y[b.id] * V.s + V.ty;
      const base = T.A[b.parent] + b.la + (rd ? rd[b.id] || 0 : 0);
      const r = Math.min(26, Math.max(7, b.len * V.s * 0.45)) * (b.role === 'rib' ? 0.6 : 1);
      ctx.fillStyle = ROLE_COLOUR[b.role] || '#999';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, r, base + b.lim[0] * Math.PI / 180, base + b.lim[1] * Math.PI / 180);
      ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 1.1 * s;
    for (const b of rig.bones) {
      const x = T.X[b.id] * V.s + V.tx, y = T.Y[b.id] * V.s + V.ty;
      const L = b.len * V.s * (T.S ? T.S[b.id] : 1);
      const ex = x + Math.cos(T.A[b.id]) * L, ey = y + Math.sin(T.A[b.id]) * L;
      const c = ROLE_COLOUR[b.role] || '#999';
      ctx.strokeStyle = c;
      ctx.globalAlpha = b.role === 'ray' ? 0.45 : 0.85;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, (b.role === 'ray' || b.role === 'digit' ? 1.3 : 2.3) * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ svg
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  function d(w, closed) {
    let s = 'M' + f2(w[0]) + ' ' + f2(w[1]);
    for (let j = 2; j < w.length; j += 2) s += 'L' + f2(w[j]) + ' ' + f2(w[j + 1]);
    return closed ? s + 'Z' : s;
  }
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  }
  function svg(rig, T, V, opts = {}) {
    const st = STYLES[opts.style] || STYLES.plate;
    const W = opts.W, H = opts.H;
    const lw = (opts.lineWidth || 1.2) * (opts.lineWeight || 1);
    const bg = opts.background === undefined ? st.bg : opts.background;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    if (bg) out += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
    out += `<g stroke-linecap="round" stroke-linejoin="round">`;
    let run = null;
    const flush = () => { if (run) { out += `<path d="${run.d}" fill="none" stroke="${run.c}" stroke-width="${f2(run.w)}"/>`; run = null; } };
    eachItem(rig, T, V, (it, w, holes) => {
      if (it.fill) {
        flush();
        let p = d(w, true);
        if (holes) for (const h of holes) p += d(h, true);
        out += `<path d="${p}" fill="${st.fill}" fill-rule="evenodd" stroke="${st.edge}" stroke-width="${f2(widthOf(it, st, lw))}"/>`;
      } else {
        const c = strokeOf(it, st), wd = widthOf(it, st, lw);
        if (!run || run.c !== c || Math.abs(run.w - wd) > 1e-3) { flush(); run = { d: '', c, w: wd }; }
        run.d += d(w, it.closed);
      }
    });
    flush();
    out += '</g>';
    if (opts.label) {
      const fs = opts.fontSize || 26;
      out += `<text x="${W / 2}" y="${H - opts.labelH / 2 + fs * 0.1}" text-anchor="middle" font-family="'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif" font-style="italic" font-size="${fs}" fill="${st.text}">${escapeXml(opts.label)}</text>`;
    }
    return out + '</svg>';
  }

  BD.draw = { STYLES, fitTransform, canvas, svg, overlay, eachItem };
})();
