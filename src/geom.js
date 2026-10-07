/* bonedraw — geometry: vectors, curves, polygons, clipping, scalar fields */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const { PI, sin, cos, atan2, sqrt, abs, min, max, floor, ceil, hypot } = Math;

  // ---------------------------------------------------------------- vectors
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const len = (a) => hypot(a[0], a[1]);
  const dist = (a, b) => hypot(a[0] - b[0], a[1] - b[1]);
  const norm = (a) => { const l = hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
  const perp = (a) => [-a[1], a[0]];
  const rot = (a, t) => { const c = cos(t), s = sin(t); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };
  const dir = (t) => [cos(t), sin(t)];
  const angleOf = (a) => atan2(a[1], a[0]);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // a polyline may carry a kind flag (.k: 'sh' shading, 'mf' marking fill, 'ol' outline) that transforms keep
  const keepK = (src, out) => { if (src.k) out.k = src.k; return out; };
  const mirrorX = (pts) => keepK(pts, pts.map((p) => [-p[0], p[1]]));
  const translate = (pts, o) => keepK(pts, pts.map((p) => [p[0] + o[0], p[1] + o[1]]));

  // ---------------------------------------------------------------- polylines
  function cumLengths(pl) {
    const c = [0];
    for (let i = 1; i < pl.length; i++) c.push(c[i - 1] + dist(pl[i - 1], pl[i]));
    return c;
  }
  function polyLength(pl) {
    let s = 0;
    for (let i = 1; i < pl.length; i++) s += dist(pl[i - 1], pl[i]);
    return s;
  }
  function pointAtLength(pl, cum, s) {
    const L = cum[cum.length - 1];
    if (s <= 0) return pl[0].slice();
    if (s >= L) return pl[pl.length - 1].slice();
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1;
    return lerp2(pl[lo], pl[hi], (s - cum[lo]) / seg);
  }
  function resampleN(pl, n) {
    if (pl.length < 2) return pl.map((p) => p.slice());
    const cum = cumLengths(pl), L = cum[cum.length - 1];
    const out = [];
    for (let i = 0; i < n; i++) out.push(pointAtLength(pl, cum, (L * i) / (n - 1)));
    return out;
  }
  function resample(pl, step) {
    const L = polyLength(pl);
    return resampleN(pl, max(2, ceil(L / step) + 1));
  }
  // portion of a polyline between arc lengths s0 and s1
  function subPath(pl, cum, s0, s1, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(pointAtLength(pl, cum, lerp(s0, s1, i / (n - 1))));
    return out;
  }
  function chaikin(pl, iters = 1, closed = false) {
    let pts = pl;
    for (let k = 0; k < iters; k++) {
      const out = [], n = pts.length;
      if (!closed) out.push(pts[0]);
      const m = closed ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        out.push(lerp2(a, b, 0.25), lerp2(a, b, 0.75));
      }
      if (!closed) out.push(pts[n - 1]);
      pts = out;
    }
    return pts;
  }
  // centripetal Catmull-Rom through the given points
  function catmullRom(pts, samples = 8, closed = false) {
    const n = pts.length;
    if (n < 2) return pts.map((p) => p.slice());
    if (n === 2 && !closed) return resampleN(pts, samples + 1);
    const P = closed
      ? [pts[n - 1], ...pts, pts[0], pts[1]]
      : [sub(mul(pts[0], 2), pts[1]), ...pts, sub(mul(pts[n - 1], 2), pts[n - 2])];
    const out = [];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      const t0 = 0;
      const t1 = t0 + max(1e-4, sqrt(dist(p0, p1)));
      const t2 = t1 + max(1e-4, sqrt(dist(p1, p2)));
      const t3 = t2 + max(1e-4, sqrt(dist(p2, p3)));
      for (let k = 0; k < samples; k++) {
        const t = t1 + ((t2 - t1) * k) / samples;
        const A1 = lerp2(p0, p1, (t - t0) / (t1 - t0));
        const A2 = lerp2(p1, p2, (t - t1) / (t2 - t1));
        const A3 = lerp2(p2, p3, (t - t2) / (t3 - t2));
        const B1 = lerp2(A1, A2, (t - t0) / (t2 - t0));
        const B2 = lerp2(A2, A3, (t - t1) / (t3 - t1));
        out.push(lerp2(B1, B2, (t - t1) / (t2 - t1)));
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function quadBezier(a, c, b, n = 12) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push(lerp2(lerp2(a, c, t), lerp2(c, b, t), t));
    }
    return out;
  }
  // offset a polyline sideways by d(t) (t = 0..1 along its length)
  function offsetLine(pl, d) {
    const cum = cumLengths(pl), L = cum[cum.length - 1] || 1, n = pl.length;
    return pl.map((p, i) => {
      const a = pl[max(0, i - 1)], b = pl[min(n - 1, i + 1)];
      const nr = perp(norm(sub(b, a)));
      return add(p, mul(nr, typeof d === 'function' ? d(cum[i] / L) : d));
    });
  }
  // walk a path from a start point, heading supplied per arc length
  function walk(start, heading, length, step) {
    const pts = [start.slice()];
    let p = start.slice();
    const n = max(2, ceil(length / step));
    const ds = length / n;
    for (let i = 0; i < n; i++) {
      const s = i * ds;
      const h = heading(s, p);
      p = add(p, mul(dir(h), ds));
      pts.push(p);
    }
    return pts;
  }

  // ---------------------------------------------------------------- shapes
  function ellipse(c, rx, ry, n = 28, a0 = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * PI;
      const p = rot([rx * cos(t), ry * sin(t)], a0);
      out.push([c[0] + p[0], c[1] + p[1]]);
    }
    return out;
  }
  const closeLine = (poly) => [...poly, poly[0]];
  // half = right-hand margin from top-centre to bottom-centre; returns closed polygon
  function symmetricOutline(half) {
    const left = mirrorX(half).reverse();
    return [...half, ...left.slice(1, -1)];
  }
  function capArc(end, prev, wA, wB, scale = 1, m = 8) {
    const T = norm(sub(end, prev)), N = perp(T);
    const r = ((wA + wB) / 2) * scale;
    const out = [];
    if (wA + wB < 1e-3) return out;
    for (let k = 1; k < m; k++) {
      const f = (PI * k) / m;
      const c = cos(f);
      out.push(add(end, add(mul(N, c * (c > 0 ? wA : wB)), mul(T, sin(f) * r))));
    }
    return out;
  }
  // thick stroke around a centreline; wl/wr give half-widths on the left (+normal) and right
  function strokePolygon(center, wl, wr, opts = {}) {
    const n = center.length;
    const cum = cumLengths(center), L = cum[n - 1] || 1;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = center[max(0, i - 1)], b = center[min(n - 1, i + 1)];
      const nr = perp(norm(sub(b, a)));
      const t = cum[i] / L;
      left.push(add(center[i], mul(nr, wl(t))));
      right.push(sub(center[i], mul(nr, wr(t))));
    }
    const out = [...left];
    if (opts.capEnd !== false) out.push(...capArc(center[n - 1], center[n - 2], wl(1), wr(1), opts.capScale || 1));
    out.push(...right.reverse());
    if (opts.capStart !== false) out.push(...capArc(center[0], center[1], wr(0), wl(0), opts.capScale || 1));
    return out;
  }

  // ---------------------------------------------------------------- polygon queries
  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1];
    }
    return [x0, y0, x1, y1];
  }
  function bboxUnion(a, b) {
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])];
  }
  function pointInPoly(p, poly) {
    let inside = false;
    const x = p[0], y = p[1];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToSeg(p, a, b) {
    const ab = sub(b, a), ap = sub(p, a);
    const l2 = dot(ab, ab);
    const t = l2 ? clamp(dot(ap, ab) / l2, 0, 1) : 0;
    return dist(p, add(a, mul(ab, t)));
  }
  function distToPoly(p, poly) {
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = min(d, distToSeg(p, poly[j], poly[i]));
    return d;
  }
  function polyArea(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return a / 2;
  }
  function centroid(poly) {
    let x = 0, y = 0;
    for (const p of poly) { x += p[0]; y += p[1]; }
    return [x / poly.length, y / poly.length];
  }
  // ray-march from p along d until outside the test region
  function exitDistance(p, d, inside, maxLen, step = 0.25) {
    let s = 0;
    while (s < maxLen && inside(add(p, mul(d, s)))) s += step;
    return s;
  }

  // ---------------------------------------------------------------- clipping
  // A polygon prepared with a coarse edge grid so segment tests stay cheap.
  function preparePoly(poly) {
    const bb = bbox(poly), n = poly.length, G = 20;
    const cw = (bb[2] - bb[0]) / G || 1, ch = (bb[3] - bb[1]) / G || 1;
    const cells = Array.from({ length: G * G }, () => []);
    const ci = (x) => clamp(floor((x - bb[0]) / cw), 0, G - 1);
    const cj = (y) => clamp(floor((y - bb[1]) / ch), 0, G - 1);
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const i0 = ci(min(a[0], b[0])), i1 = ci(max(a[0], b[0]));
      const j0 = cj(min(a[1], b[1])), j1 = cj(max(a[1], b[1]));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) cells[j * G + k].push(i);
    }
    return { pts: poly, bb, G, cw, ch, cells, ci, cj, stamp: new Int32Array(n), tick: 0 };
  }
  function segCrossings(a, b, P) {
    const ts = [];
    const bb = P.bb;
    if (max(a[0], b[0]) < bb[0] || min(a[0], b[0]) > bb[2] || max(a[1], b[1]) < bb[1] || min(a[1], b[1]) > bb[3]) return ts;
    const i0 = P.ci(min(a[0], b[0])), i1 = P.ci(max(a[0], b[0]));
    const j0 = P.cj(min(a[1], b[1])), j1 = P.cj(max(a[1], b[1]));
    const tick = ++P.tick, pts = P.pts, n = pts.length;
    const r = sub(b, a);
    for (let j = j0; j <= j1; j++) {
      for (let k = i0; k <= i1; k++) {
        for (const e of P.cells[j * P.G + k]) {
          if (P.stamp[e] === tick) continue;
          P.stamp[e] = tick;
          const c = pts[e], d = pts[(e + 1) % n];
          const s = sub(d, c), den = cross(r, s);
          if (abs(den) < 1e-12) continue;
          const ca = sub(c, a);
          const t = cross(ca, s) / den, u = cross(ca, r) / den;
          if (t > 0 && t < 1 && u >= 0 && u < 1) ts.push(t);
        }
      }
    }
    return ts.sort((x, y) => x - y);
  }
  // split a polyline by a prepared polygon, keeping the inside or outside pieces
  function clipPolyline(pl, P, keepInside) {
    const res = [];
    let cur = null, state = null;
    const bb = P.bb;
    const emit = (p0, p1, inside) => {
      if (inside === keepInside) {
        if (!cur) { cur = [p0]; res.push(cur); }
        cur.push(p1);
      } else cur = null;
    };
    for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], b = pl[i + 1];
      const out = max(a[0], b[0]) < bb[0] || min(a[0], b[0]) > bb[2] || max(a[1], b[1]) < bb[1] || min(a[1], b[1]) > bb[3];
      if (out) { state = false; emit(a, b, false); continue; }
      const ts = segCrossings(a, b, P);
      if (!ts.length) {
        // re-check now and then so a crossing exactly on a vertex can't leave a stale state
        if (state === null || i % 16 === 0) state = pointInPoly(lerp2(a, b, 0.5), P.pts);
        emit(a, b, state);
        continue;
      }
      const ks = [0, ...ts, 1];
      for (let k = 0; k < ks.length - 1; k++) {
        if (ks[k + 1] - ks[k] < 1e-9) continue;
        const inside = pointInPoly(lerp2(a, b, (ks[k] + ks[k + 1]) / 2), P.pts);
        emit(lerp2(a, b, ks[k]), lerp2(a, b, ks[k + 1]), inside);
        state = inside;
      }
    }
    return res.filter((r) => r.length > 1);
  }
  function clipLines(lines, poly, keepInside) {
    const P = poly.pts ? poly : preparePoly(poly);
    const out = [];
    for (const l of lines) out.push(...clipPolyline(l, P, keepInside));
    return out;
  }
  // keep the runs of a polyline where pred(point) is true
  function breakBy(pl, pred, step) {
    const pts = step ? resample(pl, step) : pl;
    const out = [];
    let cur = null;
    for (const p of pts) {
      if (pred(p)) { if (!cur) { cur = []; out.push(cur); } cur.push(p); }
      else cur = null;
    }
    return out.filter((r) => r.length > 1);
  }
  // full-length parallel lines across a polygon
  function parallelLines(poly, angle, spacing, phase = 0) {
    const bb = bbox(poly);
    const c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
    const R = hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + spacing;
    const d = dir(angle), nr = perp(d);
    const P = preparePoly(poly);
    const out = [];
    for (let s = -R + (((phase % spacing) + spacing) % spacing); s <= R; s += spacing) {
      const o = add(c, mul(nr, s));
      out.push(...clipPolyline([sub(o, mul(d, R)), add(o, mul(d, R))], P, true));
    }
    return out;
  }

  // ---------------------------------------------------------------- scalar fields
  class Field {
    constructor(bb, cell, fn, pad = 3) {
      this.cell = cell;
      this.x0 = bb[0] - pad * cell;
      this.y0 = bb[1] - pad * cell;
      this.nx = ceil((bb[2] - bb[0]) / cell) + 2 * pad + 1;
      this.ny = ceil((bb[3] - bb[1]) / cell) + 2 * pad + 1;
      this.v = new Float32Array(this.nx * this.ny);
      for (let j = 0; j < this.ny; j++)
        for (let i = 0; i < this.nx; i++) this.v[j * this.nx + i] = fn([this.x0 + i * cell, this.y0 + j * cell]);
    }
    at(i, j) {
      i = clamp(i, 0, this.nx - 1); j = clamp(j, 0, this.ny - 1);
      return this.v[j * this.nx + i];
    }
    sample(p) {
      const fx = (p[0] - this.x0) / this.cell, fy = (p[1] - this.y0) / this.cell;
      const i = floor(fx), j = floor(fy), tx = fx - i, ty = fy - j;
      const a = this.at(i, j), b = this.at(i + 1, j), c = this.at(i, j + 1), d = this.at(i + 1, j + 1);
      return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
    grad(p) {
      const e = this.cell;
      return [
        (this.sample([p[0] + e, p[1]]) - this.sample([p[0] - e, p[1]])) / (2 * e),
        (this.sample([p[0], p[1] + e]) - this.sample([p[0], p[1] - e])) / (2 * e),
      ];
    }
    maxValue() { let m = -Infinity; for (const x of this.v) if (x > m) m = x; return m; }
  }
  function distanceField(poly, cell) {
    const bb = bbox(poly);
    if (!cell) cell = max(bb[2] - bb[0], bb[3] - bb[1]) / 70;
    return new Field(bb, cell, (p) => (pointInPoly(p, poly) ? 1 : -1) * distToPoly(p, poly));
  }
  // iso-lines of a field at the given level (marching squares, chained into polylines)
  function marchingSquares(F, level) {
    const segs = [];
    const { nx, ny, x0, y0, cell } = F;
    const val = (i, j) => F.v[j * nx + i] - level;
    const pt = (key) => {
      const [t, i, j] = key;
      if (t === 0) { // horizontal edge (i,j)-(i+1,j)
        const a = val(i, j), b = val(i + 1, j), f = a / (a - b);
        return [x0 + (i + f) * cell, y0 + j * cell];
      }
      const a = val(i, j), b = val(i, j + 1), f = a / (a - b);
      return [x0 + i * cell, y0 + (j + f) * cell];
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = val(i, j) > 0, b = val(i + 1, j) > 0, c = val(i + 1, j + 1) > 0, d = val(i, j + 1) > 0;
        const idx = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = [0, i, j], R = [1, i + 1, j], B = [0, i, j + 1], L = [1, i, j];
        const center = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 > 0;
        switch (idx) {
          case 1: segs.push([L, B]); break;
          case 2: segs.push([B, R]); break;
          case 3: segs.push([L, R]); break;
          case 4: segs.push([T, R]); break;
          case 5: if (center) { segs.push([T, L]); segs.push([R, B]); } else { segs.push([T, R]); segs.push([L, B]); } break;
          case 6: segs.push([T, B]); break;
          case 7: segs.push([T, L]); break;
          case 8: segs.push([T, L]); break;
          case 9: segs.push([T, B]); break;
          case 10: if (center) { segs.push([T, R]); segs.push([L, B]); } else { segs.push([T, L]); segs.push([B, R]); } break;
          case 11: segs.push([T, R]); break;
          case 12: segs.push([L, R]); break;
          case 13: segs.push([R, B]); break;
          case 14: segs.push([L, B]); break;
        }
      }
    }
    // chain segments sharing edge keys
    const k = (e) => e.join(',');
    const adj = new Map();
    segs.forEach((s, idx) => {
      for (const e of s) {
        const kk = k(e);
        if (!adj.has(kk)) adj.set(kk, []);
        adj.get(kk).push(idx);
      }
    });
    const used = new Uint8Array(segs.length);
    const lines = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      const chain = [segs[s0][0], segs[s0][1]];
      for (const forward of [true, false]) {
        for (;;) {
          const endKey = k(forward ? chain[chain.length - 1] : chain[0]);
          const next = (adj.get(endKey) || []).find((id) => !used[id]);
          if (next === undefined) break;
          used[next] = 1;
          const [e0, e1] = segs[next];
          const other = k(e0) === endKey ? e1 : e0;
          if (forward) chain.push(other); else chain.unshift(other);
        }
      }
      lines.push(chain.map(pt));
    }
    return lines;
  }

  // dart-throwing scatter of points inside a polygon with a minimum spacing
  function scatter(poly, minDist, rng, density = 1, accept) {
    const bb = bbox(poly);
    const cs = minDist / Math.SQRT2;
    const gw = ceil((bb[2] - bb[0]) / cs) + 1, gh = ceil((bb[3] - bb[1]) / cs) + 1;
    const grid = new Int32Array(gw * gh).fill(-1);
    const pts = [];
    const area = abs(polyArea(poly));
    const tries = floor((area / (minDist * minDist)) * 3 * density) + 10;
    for (let t = 0; t < tries; t++) {
      const p = [rng.range(bb[0], bb[2]), rng.range(bb[1], bb[3])];
      if (!pointInPoly(p, poly)) continue;
      if (accept && !accept(p)) continue;
      const gi = floor((p[0] - bb[0]) / cs), gj = floor((p[1] - bb[1]) / cs);
      let ok = true;
      for (let j = max(0, gj - 2); j <= min(gh - 1, gj + 2) && ok; j++)
        for (let i = max(0, gi - 2); i <= min(gw - 1, gi + 2); i++) {
          const q = grid[j * gw + i];
          if (q >= 0 && dist(pts[q], p) < minDist) { ok = false; break; }
        }
      if (!ok) continue;
      grid[gj * gw + gi] = pts.length;
      pts.push(p);
    }
    return pts;
  }

  BD.geom = {
    add, sub, mul, dot, cross, len, dist, norm, perp, rot, dir, angleOf, lerp, lerp2, clamp, smoothstep,
    keepK, mirrorX, translate, cumLengths, polyLength, pointAtLength, resample, resampleN, subPath, chaikin,
    catmullRom, quadBezier, offsetLine, walk, ellipse, closeLine, symmetricOutline, strokePolygon,
    bbox, bboxUnion, pointInPoly, distToSeg, distToPoly, polyArea, centroid, exitDistance,
    preparePoly, clipPolyline, clipLines, breakBy, parallelLines, Field, distanceField, marchingSquares, scatter,
  };
})();
