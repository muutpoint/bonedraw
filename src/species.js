/* bonedraw — shared parameter plumbing: validation and the weirdness mutator */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const { floor, round, pow } = Math;
  const lerp = (a, b, t) => a + (b - a) * t;

  function sanitize(schema, P) {
    for (const s of schema) {
      let v = P[s.key];
      if (v === undefined && s.def !== undefined) v = P[s.key] = s.def;
      if (s.type === 'range') {
        let x = Number(v);
        if (!Number.isFinite(x)) x = s.min;
        x = Math.min(s.max, Math.max(s.min, x));
        P[s.key] = s.int ? round(x) : x;
      } else if (s.type === 'select') {
        if (!s.options.includes(v)) P[s.key] = s.options[0];
      } else if (s.type === 'bool') P[s.key] = !!v;
    }
    return P;
  }

  // Weirdness, in three layers that kick in progressively:
  //   hybridise  – borrow whole trait groups from other families (from ~0.1)
  //   exaggerate – push proportions out towards the slider extremes (from ~0.4)
  //   pile on    – bolt on extra features: horns, spikes, tufts, tails… (from ~0.5)
  function mutate({ P, schema, groups, sampleArch, others, w, rng, addons = [] }) {
    if (!(w > 0)) return P;
    const w2 = w * w;
    const swaps = floor(w * 3 + w2 * 7 + rng.random() * w * 3);
    const pool = groups.slice();
    for (let i = 0; i < swaps && pool.length; i++) {
      const g = pool.splice(floor(rng.random() * pool.length), 1)[0];
      const O = sampleArch(rng.pick(others), rng.fork('donor' + i));
      for (const k of g) P[k] = O[k];
    }
    const pushP = pow(w, 2.2) * 0.5;
    for (const s of schema) {
      if (s.type !== 'range' || s.group === 'Drawing' || s.group === 'Colour' || s.noMutate) continue;
      if (!rng.chance(pushP)) continue;
      const toMax = rng.chance(s.bias === undefined ? 0.65 : s.bias);
      P[s.key] = lerp(Number(P[s.key]), toMax ? s.max : s.min, rng.range(0.35, 0.95));
    }
    const pileP = pow(w, 1.8);
    for (const a of addons) if (rng.chance(pileP * a.p)) a.fn(P, rng, w);
    return P;
  }

  BD.species = { sanitize, mutate };
})();
