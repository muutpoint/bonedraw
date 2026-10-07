/* bonedraw — bone shapes: long bones, vertebrae, claws, spikes, plates, fin rays */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const G = BD.geom;
  const { PI, sin, cos, exp, pow, max, min, abs, ceil } = Math;
  const { add, sub, mul, norm, perp, dist, lerp, lerp2, angleOf, rot, dir, clamp } = G;

  const LIGHT = G.norm([-0.55, -0.85]);
  // x along, y across, from origin h at angle a
  const frame = (h, a) => { const c = cos(a), s = sin(a); return (x, y) => [h[0] + x * c - y * s, h[1] + x * s + y * c]; };

  // A long bone from joint a to joint b: a shaft with swollen ends (epiphyses),
  // a rounded cap at each end, the far one split into two condyles by a notch.
  // Returns { poly, shade } where shade is a contour line on the side away from the light.
  function longBone(a, b, o = {}) {
    const L = max(1e-3, dist(a, b)), ang = angleOf(sub(b, a)), f = frame(a, ang);
    const w = o.w, ka = o.ka === undefined ? 1.6 : o.ka, kb = o.kb === undefined ? 1.8 : o.kb;
    const e = o.ends || 0.16, bow = (o.bow || 0) * L, nB = o.notch === undefined ? 0.45 : o.notch;
    const taper = o.taper === undefined ? 1 : o.taper;
    const hw = (t) => w * lerp(1, taper, t) * (1 + (ka - 1) * exp(-pow(t / e, 2)) + (kb - 1) * exp(-pow((1 - t) / e, 2)));
    const cy = (t) => bow * sin(PI * t);
    const n = o.n || 12, capL = o.cap === undefined ? 0.75 : o.cap;
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([t * L, cy(t) + hw(t)]); }
    const rB = hw(1), rA = hw(0);
    for (let k = 1; k < 9; k++) {
      const th = PI / 2 - (PI * k) / 9;
      const rr = rB * (1 - nB * 0.5 * exp(-pow(th / 0.42, 2)));
      pts.push([L + rr * cos(th) * capL, cy(1) + rr * sin(th)]);
    }
    for (let i = n; i >= 0; i--) { const t = i / n; pts.push([t * L, cy(t) - hw(t)]); }
    for (let k = 1; k < 9; k++) {
      const th = -PI / 2 - (PI * k) / 9;
      const rr = rA * (1 - (o.notchA || 0) * 0.5 * exp(-pow((th + PI) / 0.42, 2)));
      pts.push([rr * cos(th) * capL, cy(0) + rr * sin(th)]);
    }
    const poly = pts.map((p) => f(p[0], p[1]));
    const side = G.dot(rot([0, 1], ang), LIGHT) < 0 ? 1 : -1;
    const shade = [];
    for (let i = 0; i <= 8; i++) { const t = lerp(0.22, 0.8, i / 8); shade.push(f(t * L, cy(t) + side * hw(t) * 0.42)); }
    return { poly, shade, L, ang };
  }

  // a curved tapering spike or claw from base a towards b, bent sideways by curl
  function claw(a, b, w, curl = 0.25, o = {}) {
    const L = dist(a, b), m = lerp2(a, b, 0.5), nrm = perp(norm(sub(b, a)));
    const c = add(m, mul(nrm, curl * L));
    const center = G.quadBezier(a, c, b, o.n || 10);
    const tp = o.tipPow || 0.9;
    return G.strokePolygon(center, (t) => w * pow(1 - t, tp) + w * 0.04, (t) => w * pow(1 - t, tp) + w * 0.04, { capStart: o.capStart !== false, capEnd: false });
  }

  // a tapered curved rod (rib, horn, bar) along a centreline
  function rod(center, w0, w1, o = {}) {
    const wf = o.wf || ((t) => lerp(w0, w1, t));
    return G.strokePolygon(center, wf, wf, { capStart: o.capStart !== false, capEnd: o.capEnd !== false, capScale: o.capScale || 0.8 });
  }

  // jittered ellipse, for carpals, plates, lumps
  function blob(c, rx, ry, a = 0, rng = null, rough = 0.12, n = 14) {
    const pts = [];
    const ph = rng ? rng.random() * 6.28 : 0, k = rng ? rng.int(2, 4) : 3;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * PI;
      const r = 1 + rough * sin(k * t + ph) * 0.6 + (rng ? rng.range(-rough, rough) * 0.4 : 0);
      pts.push(add(c, rot([rx * r * cos(t), ry * r * sin(t)], a)));
    }
    return G.chaikin(pts, 1, true);
  }

  // A vertebra seen from above, centred on the spine. h: front of the centrum, a: direction
  // towards the tail, L: length along the spine, w: centrum half-width.
  // tp: transverse process length (beyond the centrum), sweep: tilt of the processes towards the tail.
  function vertebra(h, a, L, w, o = {}) {
    const f = frame(h, a);
    const tp = o.tp || 0, sw = (o.sweep || 0) * tp * 0.6, tw = clamp(L * (o.tpWidth || 0.34), 0.05, L * 0.6);
    const z = o.zyg === undefined ? 0.18 : o.zyg;
    const half = [[0.03 * L, 0], [0.02 * L, 0.42 * w], [-z * L, 0.62 * w], [0.12 * L, 0.72 * w]];
    if (tp > 0.04 * w) {
      const x0 = 0.3 * L;
      half.push([x0, 0.66 * w], [x0 + sw - tw * 0.1, w * 0.62 + tp * 0.55], [x0 + sw, w * 0.62 + tp], [x0 + sw + tw * 0.9, w * 0.62 + tp * 0.93], [x0 + tw * 1.05 + sw * 0.5, w * 0.62 + tp * 0.4], [x0 + tw, 0.6 * w]);
    } else half.push([0.4 * L, 0.68 * w]);
    half.push([0.78 * L, 0.5 * w], [(1 + z * 0.6) * L, 0.6 * w], [0.97 * L, 0.3 * w], [0.95 * L, 0]);
    const right = half.map((p) => f(p[0], p[1]));
    const left = half.slice(1, -1).reverse().map((p) => f(p[0], -p[1]));
    const poly = G.chaikin([...right, ...left], 2, true);
    const det = [];
    if (o.spine !== false && L > 0.6) {
      const s = o.spineLen === undefined ? 0.45 : o.spineLen;
      det.push(G.closeLine(G.ellipse(f(L * 0.55, 0), L * s * 0.5, w * 0.16, 10, a)));
    }
    return { poly, det, tip: f(0.3 * L + sw + tw * 0.45, w * 0.62 + tp * 0.95) };
  }

  // a fin ray as one polyline, plus small node ticks every `bead` units
  function rayMarks(pl, w, bead) {
    const out = [];
    if (!bead) return out;
    const cum = G.cumLengths(pl), L = cum[cum.length - 1];
    for (let s = bead * 0.6; s < L - bead * 0.3; s += bead) {
      const p = G.pointAtLength(pl, cum, s), q = G.pointAtLength(pl, cum, s + 0.01);
      const n = perp(norm(sub(q, p)));
      out.push([add(p, mul(n, w)), sub(p, mul(n, w))]);
    }
    return out;
  }

  // cubic Bézier
  function cubic(a, b, c, d, n = 16) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
    }
    return out;
  }

  // split a polyline into k runs by arc length (fractions in cuts), sharing their end points
  function splitAt(pl, cuts) {
    const cum = G.cumLengths(pl), L = cum[cum.length - 1];
    const runs = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s0 = cuts[i] * L, s1 = cuts[i + 1] * L;
      const n = max(2, ceil(((s1 - s0) / L) * pl.length) + 1);
      runs.push(G.subPath(pl, cum, s0, s1, n));
    }
    return runs;
  }

  BD.parts = { LIGHT, frame, longBone, claw, rod, blob, vertebra, rayMarks, cubic, splitAt };
})();
