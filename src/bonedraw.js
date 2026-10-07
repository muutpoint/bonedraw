/* bonedraw — public entry point: seed + overrides -> rig + drawing */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const C = BD.creature, D = BD.draw;

  BD.modes = { creature: C };
  const DEFAULTS = { W: 1000, H: 1000, labelH: 90, margin: 56, label: 'name', weirdness: 0.15, style: 'plate' };

  BD.generate = function (opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const seed = String(o.seed);
    const wild = o.mode === 'wild';
    const P = C.sample(seed, o.overrides || {}, o.weirdness, { wild, humanoid: !!o.humanoid });
    const { rig } = C.build(P, seed, { wild });
    const latin = C.name(P, seed);
    const labelH = o.label === 'none' ? 0 : o.labelH;
    const label = o.label === 'none' ? '' : o.label === 'seed' ? seed : latin + '.';
    // frame on the rest pose
    const view = (W, H) => D.fitTransform(rig.bbox, W, H, o.label === 'none' ? 0 : o.labelH * (H / o.H), o.margin * (W / o.W));
    return {
      seed, mode: wild ? 'wild' : 'anatomical', params: P, name: latin, rig, label, labelH,
      svg: (so = {}) => {
        const W = so.W || o.W, H = so.H || o.H;
        return D.svg(rig, so.pose || rig.rest, so.bbox ? D.fitTransform(so.bbox, W, H, o.label === 'none' ? 0 : o.labelH * (H / o.H), o.margin * (W / o.W)) : view(W, H), { W, H, style: so.style || o.style, lineWeight: P.lineWeight, label, labelH: labelH * (H / o.H), background: so.background, fontSize: 26 * (H / o.H) });
      },
      view,
    };
  };
})();
