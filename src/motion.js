/* bonedraw — procedural motion: waves travelling along the rig's chains */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const { PI, sin, cos, max, min, abs, pow } = Math;
  const TAU = 2 * PI, DEG = PI / 180;
  const BASE_HZ = 0.5;        // one stroke every 2 s at speed 1
  const LOOP_CYCLES = 2;      // breathing and writhing run at half rate, so a loop is two strokes
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // Layers mix freely. Each one is an amount from 0 (off) to 1 (full), scaled by the master intensity.
  //   body     a wave down the spine: swimming (tail-led) or slithering (whole body)
  //   fin      fin rays and disc rays: travelling ripples, foreshortened as they tilt out of the page
  //   legs     stepping, rowing flippers, sculling fins, curling tentacles, with the trunk flexing
  //   flap     wings beating (any limb flaps at half strength; a disc beats like a manta)
  //   breathe  the bones that otherwise stay put: ribs open and close, girdles and the neck sway
  //   writhe   smooth, looping noise on every joint, like something alive and uneasy
  const LAYERS = ['body', 'fin', 'legs', 'flap', 'breathe', 'writhe'];
  const LAYER_LABEL = { body: 'Body wave', fin: 'Fins & rays', legs: 'Legs', flap: 'Wings', breathe: 'Breathe', writhe: 'Writhe' };

  const PRESETS = {
    auto: { label: 'Auto (suits the body)' },
    swim: { label: 'Swim', layers: { body: 1, fin: 0.6, legs: 0.25, breathe: 0.3 }, bodyWaves: 0.9, shape: 0.15 },
    slither: { label: 'Slither', layers: { body: 1, legs: 0.15, breathe: 0.3 }, bodyWaves: 1.5, shape: 0.85 },
    walk: { label: 'Walk / row', layers: { legs: 1, body: 0.2, fin: 0.35, breathe: 0.3 }, bodyWaves: 0.8, shape: 0.5 },
    flap: { label: 'Flap', layers: { flap: 1, body: 0.2, fin: 0.4, breathe: 0.3 }, bodyWaves: 0.7, shape: 0.3 },
    undulate: { label: 'Fin ripple (stingray)', layers: { fin: 1, body: 0.4, legs: 0.3, breathe: 0.25 }, finWaves: 1.4, bodyWaves: 1.2, shape: 0.1 },
    glide: { label: 'Wing-beat (manta)', layers: { fin: 0.7, flap: 0.8, body: 0.3, breathe: 0.25 }, finWaves: 0.25, bodyWaves: 1, shape: 0.1 },
    idle: { label: 'Breathe (idle)', layers: { breathe: 1, writhe: 0.12 } },
    writhe: { label: 'Writhe', layers: { writhe: 1, breathe: 0.4 } },
    all: { label: 'Everything', layers: { body: 0.7, fin: 0.7, legs: 0.7, flap: 0.6, breathe: 0.7, writhe: 0.45 }, bodyWaves: 1.1, finWaves: 1, shape: 0.5 },
    still: { label: 'Still', layers: {} },
  };
  const DEFAULTS = { preset: 'auto', master: 0.8, speed: 1, range: 1, bodyWaves: 1, finWaves: 1, shape: 0.4, layers: { body: 0, fin: 0, legs: 0, flap: 0, breathe: 0, writhe: 0 } };

  function autoPreset(meta) {
    const types = meta.limbs.map((l) => l.type);
    const real = types.filter((t) => t !== 'stub');
    if (meta.disc) return meta.cephalic ? 'glide' : 'undulate';
    if (types.includes('wing')) return 'flap';
    if (meta.arch === 'fish' || (real.length && real.every((t) => t === 'fin'))) return 'swim';
    if (!real.length) return 'slither';
    if (types.filter((t) => t === 'tentacle').length * 2 >= types.length) return 'writhe';
    return 'walk';
  }

  // settings (what the panel holds) -> the numbers motion runs on, for one rig
  function resolve(settings, rig) {
    const s = Object.assign({}, DEFAULTS, settings);
    let key = s.preset;
    if (key === 'auto') key = autoPreset(rig.meta);
    const out = { preset: s.preset, resolved: key, master: s.master, speed: s.speed, range: s.range, bodyWaves: s.bodyWaves, finWaves: s.finWaves, shape: s.shape, layers: {} };
    if (key === 'custom') {
      for (const l of LAYERS) out.layers[l] = (s.layers && s.layers[l]) || 0;
    } else {
      const p = PRESETS[key] || PRESETS.still;
      for (const l of LAYERS) out.layers[l] = (p.layers && p.layers[l]) || 0;
      for (const k of ['bodyWaves', 'finWaves', 'shape']) if (p[k] !== undefined) out[k] = p[k];
    }
    out.moving = out.master > 0 && LAYERS.some((l) => out.layers[l] > 0);
    return out;
  }

  const loopSeconds = (R) => LOOP_CYCLES / (BASE_HZ * Math.max(0.05, R.speed));

  // ------------------------------------------------------------ per-rig cache
  function prepare(rig) {
    if (rig._mo) return rig._mo;
    const B = rig.bones, n = B.length;
    const spine = rig.chains.spine || [];
    const trunk = spine.filter((i) => B[i].role === 'trunk');
    const tail = spine.filter((i) => B[i].role === 'tail');
    const anchor = trunk.length ? trunk[Math.floor(trunk.length * (rig.meta.disc ? 0.3 : 0.5))] : spine.length ? spine[0] : 0;
    // limbs in order along the body: alternate pairs step out of phase
    const limbs = rig.meta.limbs.slice().sort((a, b) => a.t - b.t);
    const rank = {};
    limbs.forEach((l, i) => (rank[l.idx] = i));
    const type = {}, front = {};
    for (const l of rig.meta.limbs) { type[l.idx] = l.type; front[l.idx] = l.front; }
    // a stable noise offset per chain, so writhing chains move coherently but differently
    const off = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const key = B[i].chain || 'b' + i;
      off[i] = (BD.hashString(key)[0] % 10007) / 97;
    }
    const range = new Float64Array(n), lo = new Float64Array(n), hi = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const b = B[i];
      // limits in "right-hand" terms: mirrored bones store flipped limits
      lo[i] = (b.side < 0 ? -b.lim[1] : b.lim[0]) * DEG;
      hi[i] = (b.side < 0 ? -b.lim[0] : b.lim[1]) * DEG;
      range[i] = max(abs(lo[i]), abs(hi[i]));
    }
    const sIdx = new Int32Array(n).fill(-1);
    spine.forEach((id, k) => (sIdx[id] = k));
    const tIdx = new Int32Array(n).fill(-1);
    trunk.forEach((id, k) => (tIdx[id] = k));
    tail.forEach((id, k) => (tIdx[id] = k));
    rig._mo = {
      spine, trunk, tail, anchor, rank, type, front, off, range, lo, hi, sIdx, tIdx,
      noise: new BD.Noise(new BD.Rng('motion').fork(String(n))),
      m: new Float64Array(n), E: new Float64Array(n), Ec: new Float64Array(n), S: new Float64Array(n), d: new Float64Array(n),
    };
    return rig._mo;
  }

  // ------------------------------------------------------------ the pose at time t
  function pose(rig, R, t) {
    const C = prepare(rig);
    const B = rig.bones, n = B.length;
    const { m, E, Ec, S, d, range: fr } = C;
    m.fill(0); E.fill(0); S.fill(1);
    const rest = rig.restDelta;
    if (!R.moving) {
      for (let i = 0; i < n; i++) d[i] = rest ? rest[i] || 0 : 0;
      return rig.pose(d);
    }
    const L = R.layers, I = R.master;
    const tau = TAU * BASE_HZ * R.speed * t, half = tau / 2;
    const nz = C.noise;
    const ring = (i, k, amp = 1.2) => nz.noise2(cos(half) * amp + C.off[i] + k * 0.23, sin(half) * amp + C.off[i] * 0.37);

    // ---- spine: a heading wave along the body; each joint turns by the change in heading
    const sp = C.spine, N = sp.length;
    if (N) {
      const sh = R.shape, aBody = I * L.body, aLegs = I * L.legs, aBr = I * L.breathe, aW = I * L.writhe;
      const env0 = lerp(0.1, 0.75, sh), envP = lerp(1.7, 0.6, sh);
      const nT = C.trunk.length, nC = C.tail.length;
      let prev = 0;
      for (let k = 0; k < N; k++) {
        const id = sp[k], b = B[id], u = N > 1 ? k / (N - 1) : 0;
        let H = 0;
        if (aBody) H += aBody * 0.75 * lerp(env0, 1, pow(u, envP)) * sin(tau - TAU * R.bodyWaves * u);
        if (aLegs) {
          // the trunk flexes side to side in time with the legs; the tail swings behind
          if (b.role === 'trunk' && nT > 1) H += aLegs * 0.2 * sin(tau) * cos((PI * C.tIdx[id]) / (nT - 1));
          else if (b.role === 'tail' && nC) {
            const ux = C.tIdx[id] / Math.max(1, nC - 1);
            H += aLegs * (-0.2 * sin(tau) * (1 - ux) + 0.35 * sin(tau - 2.2 * ux - 0.6) * ux);
          }
        }
        if (aBr && b.role === 'neck') H += aBr * 0.08 * sin(half) * u * 4;
        if (aW) H += aW * 0.5 * nz.noise2(cos(half) * 1.1 + u * 2.2, sin(half) * 1.1 + 5.3);
        m[id] += H - prev;
        prev = H;
      }
    }

    for (let i = 0; i < n; i++) {
      const b = B[i], role = b.role, r = fr[i];
      if (!r && role !== 'ray') continue;
      if (C.sIdx[i] >= 0) continue; // spine done above
      // ---- limbs
      if (b.limb >= 0) {
        const ty = C.type[b.limb], left = b.side < 0 ? 1 : 0, rank = C.rank[b.limb] || 0;
        const seg = b.seg, dig = role === 'digit', k = b.k;
        // stepping gait: diagonal pairs together; flippers and fins row both sides at once
        const gait = ty === 'flipper' ? 'row' : ty === 'fin' ? 'fin' : ty === 'tentacle' ? 'tentacle' : ty === 'wing' ? 'wing' : ty === 'arm' || ty === 'leg' ? 'biped' : 'step';
        const aLeg = I * (gait === 'fin' ? max(L.legs, L.fin) : gait === 'wing' ? L.legs * 0.3 : L.legs);
        if (aLeg && role !== 'girdle') {
          if (gait === 'step' || gait === 'wing') {
            const ph = tau + PI * (left + rank);
            const lift = max(0, -cos(ph));
            if (seg === 0 && !dig) { m[i] += aLeg * 0.8 * sin(ph) * r; E[i] += aLeg * 0.25 * lift; }
            else if (seg === 1 && !dig) { m[i] += aLeg * 0.6 * sin(ph - 1) * r; E[i] += aLeg * 0.55 * lift; }
            else if (seg === 2 && !dig) m[i] += aLeg * 0.5 * sin(ph - 1.8) * r;
            else if (dig) m[i] += aLeg * (k === 0 ? 0.35 * sin(ph - 2.2) : 0.15 * sin(ph - 2.4 - k * 0.3)) * r;
          } else if (gait === 'row') {
            const ph = tau + (C.front[b.limb] ? 0 : PI * 0.5) + rank * 0.3;
            if (seg === 0 && !dig) { m[i] += aLeg * 0.65 * sin(ph) * r; E[i] += aLeg * 0.6 * sin(ph + PI / 2); }
            else if (seg === 1 && !dig) m[i] += aLeg * 0.3 * sin(ph - 0.6) * r;
            else if (dig) { m[i] += aLeg * 0.25 * sin(ph - 1 - k * 0.3) * r; E[i] += aLeg * 0.15 * sin(ph + PI / 2 - 0.5 - k * 0.2); }
          } else if (gait === 'fin') {
            const ph = tau * 1.5 + rank * 0.8;
            if (role === 'ray') { const q = ph - b.u * 1.3 - k * 0.7; m[i] += aLeg * 0.4 * sin(q) * r; E[i] += aLeg * 0.3 * sin(q); }
            else if (seg === 0) m[i] += aLeg * 0.6 * sin(ph) * r;
          } else if (gait === 'biped') {
            // seen from the front: a thigh lifting towards us looks shorter, the shin folds back under it,
            // arms swing against the legs on the same side
            const arm = ty === 'arm', ph = tau + PI * left + (arm ? PI : 0);
            if (seg === 0 && !dig) { E[i] += aLeg * (arm ? 0.45 * sin(ph) : 0.65 * max(0, sin(ph))); m[i] += aLeg * 0.12 * sin(ph) * r; }
            else if (seg === 1 && !dig) { E[i] += aLeg * (arm ? 0.35 * max(0, sin(ph - 0.4)) : -0.95 * max(0, sin(ph - 0.5))); m[i] += aLeg * 0.08 * sin(ph - 0.5) * r; }
            else if (seg === 2 && !dig) m[i] += aLeg * 0.25 * sin(ph - 1.2) * r;
            else if (dig) m[i] += aLeg * 0.12 * sin(ph - 1 - k * 0.3) * r;
          } else if (gait === 'tentacle') {
            const ph = tau * 0.8 + rank * 1.3 + left * 0.9;
            m[i] += aLeg * 0.9 * sin(ph - seg * 0.45) * r;
          }
        }
        // wings beat; every other limb flaps at half strength
        const aF = I * L.flap * (ty === 'wing' ? 1 : 0.5);
        if (aF && role !== 'girdle') {
          const ph = tau;
          if (seg === 0 && !dig && role !== 'ray') { E[i] += aF * 1.0 * sin(ph); m[i] += aF * 0.35 * cos(ph) * r; }
          else if (seg === 1 && !dig) { E[i] += aF * 0.45 * sin(ph - 0.4); m[i] += aF * 0.55 * max(0, -sin(ph - 0.3)) * r; }
          else if (seg === 2 && !dig) E[i] += aF * 0.2 * sin(ph - 0.7);
          else if (dig) {
            E[i] += aF * 0.12 * sin(ph - 0.9 - 0.2 * k);
            if (k === 0) m[i] -= aF * 0.5 * max(0, -sin(ph)) * (b.u - 0.5) * 2 * r; // fingers close up on the upstroke
          } else if (role === 'ray') E[i] += aF * 0.25 * sin(ph - k * 0.4);
        }
        if (role === 'girdle' && L.breathe) m[i] += I * L.breathe * 0.5 * sin(half) * r;
      } else if (role === 'ray') {
        // ---- disc, tail fan and head lobes
        const g = b.g || '', k = b.k;
        if (g === 'disc') {
          const aFin = I * L.fin;
          if (aFin) {
            const q = tau - TAU * R.finWaves * b.u - k * 0.55;
            m[i] += aFin * 0.22 * sin(q) * r;
            E[i] += aFin * 0.42 * sin(q);
          }
          if (L.flap) E[i] += I * L.flap * 0.5 * sin(tau - k * 0.35 - b.u * 0.6);
        } else if (g === 'caudal') {
          const a = I * max(L.fin, L.body);
          if (a) { const q = tau - TAU * R.bodyWaves - k * 0.6 - b.u * 0.8; m[i] += a * 0.4 * sin(q) * r; E[i] += a * 0.15 * sin(q); }
        } else if (g === 'cephalic') {
          if (L.fin) m[i] += I * L.fin * 0.6 * sin(half + 0.5) * r;
        }
      } else if (role === 'rib') {
        if (L.breathe) {
          const u = b.n > 1 ? b.k / (b.n - 1) : 0, q = sin(half - u * 1.2);
          m[i] += I * L.breathe * 0.9 * q * r;
          S[i] *= 1 + I * L.breathe * 0.035 * q;
        }
      } else if (role === 'girdle') {
        if (L.breathe) m[i] += I * L.breathe * 0.5 * sin(half) * r;
      }
      // ---- writhe: every joint that can move, coherent along its chain
      if (L.writhe && r) m[i] += I * L.writhe * 0.9 * ring(i, b.k) * r * (C.type[b.limb] === 'tentacle' ? 1.6 : 1);
    }

    // ---- clamp to the joint limits (scaled by Joint range), then mirror the left side
    const ext = R.range;
    for (let i = 0; i < n; i++) {
      const b = B[i];
      let v = m[i];
      if (b.lim[0] === b.lim[1]) v = 0;
      else v = clamp(v, C.lo[i] * ext, C.hi[i] * ext);
      d[i] = (rest ? rest[i] || 0 : 0) + (b.side < 0 ? -v : v);
      // tilt out of the page accumulates down a chain; a tilted bone looks shorter from above
      const p = b.parent;
      Ec[i] = clamp((p >= 0 ? Ec[p] : 0) + E[i], -1.45, 1.45);
      S[i] *= cos(Ec[i]);
    }
    const T = rig.pose(d, null, S);
    // keep the middle of the body still, so the head and tail swing around it
    const a = C.anchor, R0 = rig.rest;
    const dA = R0.A[a] - T.A[a], cs = cos(dA), sn = sin(dA), ax = T.X[a], ay = T.Y[a];
    for (let i = 0; i < n; i++) {
      const x = T.X[i] - ax, y = T.Y[i] - ay;
      T.X[i] = R0.X[a] + x * cs - y * sn;
      T.Y[i] = R0.Y[a] + x * sn + y * cs;
      T.A[i] += dA;
    }
    T.S = Float64Array.from(S);
    return T;
  }

  // a frame that holds the whole loop, so the camera doesn't hunt
  function loopBounds(rig, R, samples = 16) {
    let bb = rig.bbox.slice();
    if (!R.moving) return bb;
    const Ls = loopSeconds(R);
    for (let k = 0; k < samples; k++) {
      const b = rig.boundsAt(pose(rig, R, (k / samples) * Ls));
      bb = [min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3])];
    }
    return bb;
  }

  BD.motion = { LAYERS, LAYER_LABEL, PRESETS, DEFAULTS, BASE_HZ, resolve, autoPreset, pose, loopBounds, loopSeconds };
})();
