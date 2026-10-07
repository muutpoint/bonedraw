#!/usr/bin/env node
/* filmstrip of one motion loop: node tools/frames.js --seed stingray --preset auto --frames 8 > strip.svg */
'use strict';
const path = require('path');
for (const f of ['rng', 'geom', 'species', 'names', 'rig', 'parts', 'draw', 'creature', 'motion', 'bonedraw']) require(path.join(__dirname, '..', 'src', f + '.js'));
const BD = globalThis.BD;
const a = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
const overrides = {};
if (a.arch) overrides.archetype = a.arch;
const nF = Number(a.frames || 8), cell = Number(a.cell || 400), style = a.style || 'plate';
const res = BD.generate({ seed: a.seed || 'stingray', overrides, mode: a.mode, humanoid: !!a.human, weirdness: a.weird !== undefined ? Number(a.weird) : undefined, label: 'none' });
const settings = { preset: a.preset || 'auto', master: a.master !== undefined ? Number(a.master) : 0.8, speed: 1 };
const R = BD.motion.resolve(settings, res.rig);
const bb = BD.motion.loopBounds(res.rig, R);
const V = BD.draw.fitTransform(bb, cell, cell, 0, 12);
const Ls = BD.motion.loopSeconds(R);
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${nF * cell}" height="${cell}"><rect width="100%" height="100%" fill="${BD.draw.STYLES[style].bg}"/>`;
for (let f = 0; f < nF; f++) {
  const T = BD.motion.pose(res.rig, R, (f / nF) * Ls * (a.half ? 0.5 : 1));
  const svg = BD.draw.svg(res.rig, T, V, { W: cell, H: cell, style, background: null, lineWeight: res.params.lineWeight * 0.8 });
  out += `<g transform="translate(${f * cell},0)">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
}
out += `<text x="10" y="22" font-size="16" fill="#b33" font-family="Menlo">${res.seed} · ${res.params.archetype} · ${R.resolved}</text></svg>`;
process.stdout.write(out);
