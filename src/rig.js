/* bonedraw — the rig: a tree of bones with joints, and the line art bound to them */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const G = BD.geom;
  const { PI, cos, sin } = Math;
  const DEG = PI / 180;

  // A skeleton is built in its rest pose, in world coordinates (y down, head up).
  // Every drawn item belongs to one bone. finalize() re-expresses each item in its
  // bone's local frame, so posing the bones (rotating joints) carries the drawing
  // with them. Bones are created parent-first, so one pass computes a pose.
  //
  // bone fields
  //   h       joint (pivot) position at rest, world
  //   a       rest direction, radians (0 = +x, PI/2 = towards the tail)
  //   len     length to the bone's tip
  //   role    skull, neck, trunk, tail, rib, girdle, limb, digit, ray, horn, fixed …
  //   side    +1 right, -1 left, 0 midline (mirrored bones flip their joint limits)
  //   chain   id shared by a run of bones that bend together (a tail, a fin ray, a finger)
  //   k, n    index within the chain and chain length
  //   lim     joint limits in degrees [min, max] relative to the rest angle
  class Rig {
    constructor() {
      this.bones = [];
      this.items = [];
      this.chains = {};
    }
    bone(o) {
      const b = {
        id: this.bones.length,
        parent: o.parent === undefined ? -1 : o.parent,
        h: [o.h[0], o.h[1]],
        a: o.a || 0,
        len: o.len || 0,
        role: o.role || 'fixed',
        side: o.side || 0,
        chain: o.chain || null,
        k: o.k || 0,
        n: o.n || 1,
        lim: o.lim ? o.lim.slice() : [0, 0],
        seg: o.seg === undefined ? null : o.seg,
        g: o.g || null,                      // group for motion (disc, caudal, a fin…)
        u: o.u === undefined ? 0 : o.u,      // position within that group, 0..1
        limb: o.limb === undefined ? -1 : o.limb,
        flesh: o.flesh || 0,                 // radius of soft tissue moulded round the bone (post looks)
      };
      if (b.parent >= this.bones.length) throw new Error('bone parent must exist first');
      this.bones.push(b);
      return b.id;
    }
    // item: pts in world rest coords. fill: closed bone shape (painted, occludes what's under it).
    // w: stroke weight multiplier. z: depth (higher draws on top). kind: bone | line | ray | soft
    add(bone, pts, o = {}) {
      if (!pts || pts.length < 2) return;
      this.items.push({
        bone, pts, z: o.z || 0, fill: !!o.fill, holes: o.holes && o.holes.length ? o.holes : null,
        w: o.w || 1, kind: o.kind || (o.fill ? 'bone' : 'line'), closed: !!(o.fill || o.closed),
        // optional second bone: each point blends towards it by wts[i] (soft tissue spanning a joint)
        bone2: o.bone2 === undefined ? -1 : o.bone2, wts: o.wts || null,
      });
    }
    mark() { return { b: this.bones.length, i: this.items.length }; }
    // copy everything built since mark m to the other side of the midline
    mirror(m) {
      const map = {};
      const nb = this.bones.length, ni = this.items.length;
      for (let i = m.b; i < nb; i++) {
        const b = this.bones[i];
        map[i] = this.bone({
          ...b,
          parent: b.parent in map ? map[b.parent] : b.parent,
          h: [-b.h[0], b.h[1]],
          a: PI - b.a,
          side: -b.side,
          lim: [-b.lim[1], -b.lim[0]],
          chain: b.chain ? b.chain + '~' : null,
        });
      }
      const mx = (pts) => pts.map((p) => [-p[0], p[1]]);
      for (let i = m.i; i < ni; i++) {
        const it = this.items[i];
        const b2 = it.bone2 >= 0 && it.bone2 in map ? map[it.bone2] : it.bone2;
        this.items.push({ ...it, bone: it.bone in map ? map[it.bone] : it.bone, bone2: b2, pts: mx(it.pts), holes: it.holes && it.holes.map(mx) });
      }
      return map;
    }
    finalize(opts = {}) {
      const B = this.bones;
      for (const b of B) {
        if (b.parent < 0) { b.lo = [b.h[0], b.h[1]]; b.la = b.a; continue; }
        const p = B[b.parent];
        b.lo = G.rot(G.sub(b.h, p.h), -p.a);
        b.la = b.a - p.a;
      }
      // chains: ordered bone lists, so motion can travel along them
      this.chains = {};
      for (const b of B) if (b.chain) (this.chains[b.chain] = this.chains[b.chain] || []).push(b.id);
      for (const c in this.chains) this.chains[c].sort((x, y) => B[x].k - B[y].k);
      // optional hand-drawn wobble, applied in rest space so it follows the bones
      if (opts.wobble > 0 && opts.noise) {
        const nz = opts.noise, a = opts.wobble, f = opts.freq || 0.09;
        const wob = (p) => [p[0] + a * nz.noise2(p[0] * f, p[1] * f), p[1] + a * nz.noise2(p[0] * f + 31.7, p[1] * f - 17.3)];
        for (const it of this.items) {
          it.pts = it.pts.map(wob);
          if (it.holes) it.holes = it.holes.map((h) => h.map(wob));
        }
      }
      // stable depth sort
      this.items.forEach((it, i) => (it._i = i));
      this.items.sort((x, y) => x.z - y.z || x._i - y._i);
      const toLocal = (b) => (p) => { const d = G.rot([p[0] - b.h[0], p[1] - b.h[1]], -b.a); return d; };
      for (const it of this.items) {
        const b = B[it.bone];
        const f = toLocal(b);
        it.lp = flat(it.pts.map(f));
        it.lh = it.holes ? it.holes.map((h) => flat(h.map(f))) : null;
        if (it.bone2 >= 0) {
          it.lp2 = flat(it.pts.map(toLocal(B[it.bone2])));
          it.wts = Float64Array.from(it.wts || it.pts.map((_, i) => i / Math.max(1, it.pts.length - 1)));
        }
      }
      // the rest pose may carry a built-in curve (a coiled tail, an S-bent snake) on a straight skeleton
      this.restDelta = opts.restDelta || null;
      this.rest = this.pose(this.restDelta);
      this.bbox = this.boundsAt(this.rest);
      return this;
    }
    // world transforms for a pose. delta: per-bone extra rotation (radians), optional.
    // root: optional { x, y, a } offset for the root bone(s).
    // S: optional per-bone stretch along the bone (foreshortening when a fin or wing tilts out of the page).
    pose(delta, root, S) {
      const B = this.bones, n = B.length;
      const X = new Float64Array(n), Y = new Float64Array(n), A = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const b = B[i], d = delta ? delta[i] || 0 : 0;
        if (b.parent < 0) {
          if (root) {
            const c = cos(root.a || 0), s = sin(root.a || 0);
            X[i] = root.x + b.lo[0] * c - b.lo[1] * s; Y[i] = root.y + b.lo[0] * s + b.lo[1] * c; A[i] = b.la + (root.a || 0) + d;
          } else { X[i] = b.lo[0]; Y[i] = b.lo[1]; A[i] = b.la + d; }
        } else {
          const p = b.parent, c = cos(A[p]), s = sin(A[p]), ox = S ? b.lo[0] * S[p] : b.lo[0];
          X[i] = X[p] + ox * c - b.lo[1] * s;
          Y[i] = Y[p] + ox * s + b.lo[1] * c;
          A[i] = A[p] + b.la + d;
        }
      }
      return { X, Y, A, S: S || null };
    }
    boundsAt(T) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const it of this.items) {
        const L = this.worldPts(it, T);
        for (let j = 0; j < L.length; j += 2) {
          const x = L[j], y = L[j + 1];
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return [x0, y0, x1, y1];
    }
    // item points in world coords for pose T, as a flat array
    worldPts(it, T, L = it.lp) {
      const b = it.bone, k = T.S ? T.S[b] : 1, c = cos(T.A[b]) * k, s = sin(T.A[b]), ox = T.X[b], oy = T.Y[b];
      const ks = k * sin(T.A[b]), cc = cos(T.A[b]);
      const out = new Float64Array(L.length);
      for (let j = 0; j < L.length; j += 2) {
        out[j] = ox + L[j] * c - L[j + 1] * s;
        out[j + 1] = oy + L[j] * ks + L[j + 1] * cc;
      }
      if (it.bone2 >= 0 && L === it.lp) {
        const b2 = it.bone2, k2 = T.S ? T.S[b2] : 1, c2 = cos(T.A[b2]), s2 = sin(T.A[b2]), X2 = T.X[b2], Y2 = T.Y[b2], L2 = it.lp2, W = it.wts;
        for (let j = 0; j < L.length; j += 2) {
          const w = W[j >> 1];
          if (w <= 0) continue;
          const lx = L2[j] * k2;
          const x = X2 + lx * c2 - L2[j + 1] * s2, y = Y2 + lx * s2 + L2[j + 1] * c2;
          out[j] += (x - out[j]) * w; out[j + 1] += (y - out[j + 1]) * w;
        }
      }
      return out;
    }
    // the built-in curve of the rest pose (a serpent's S, a coiled tail): one extra rotation per bone, in radians
    restCurve() {
      const rd = this.restDelta;
      return Array.from({ length: this.bones.length }, (_, i) => r4((rd && rd[i]) || 0));
    }
    // portable description for other tools (TouchDesigner, Blender, …)
    toJSON() {
      return {
        bones: this.bones.map((b) => ({
          id: b.id, parent: b.parent, role: b.role, side: b.side, chain: b.chain, k: b.k, n: b.n,
          head: [r2(b.h[0]), r2(b.h[1])], angle: r4(b.a), length: r2(b.len),
          local: { offset: [r2(b.lo[0]), r2(b.lo[1])], angle: r4(b.la) },
          limits: b.lim.map((v) => r2(v)), group: b.g || undefined, u: b.g ? r2(b.u) : undefined, limb: b.limb >= 0 ? b.limb : undefined,
        })),
        items: this.items.map((it) => ({
          bone: it.bone, kind: it.kind, fill: it.fill, closed: it.closed, z: it.z, weight: it.w,
          local: Array.from(it.lp, r2), holes: it.lh ? it.lh.map((h) => Array.from(h, r2)) : undefined,
          bone2: it.bone2 >= 0 ? it.bone2 : undefined, local2: it.lp2 ? Array.from(it.lp2, r2) : undefined, weights: it.wts ? Array.from(it.wts, r2) : undefined,
        })),
      };
    }
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const r4 = (v) => Math.round(v * 10000) / 10000;
  function flat(pts) {
    const out = new Float64Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) { out[2 * i] = pts[i][0]; out[2 * i + 1] = pts[i][1]; }
    return out;
  }

  BD.Rig = Rig;
  BD.DEG = DEG;
})();
