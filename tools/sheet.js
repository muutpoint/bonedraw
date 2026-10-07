#!/usr/bin/env node
/* contact sheet for tuning: node tools/sheet.js --n 12 --cols 4 --arch ray --prefix a --weird 0.2 > sheet.svg */
'use strict';
const path = require('path');
for (const f of ['rng', 'geom', 'species', 'names', 'rig', 'parts', 'draw', 'creature', 'bonedraw']) require(path.join(__dirname, '..', 'src', f + '.js'));
const BD = globalThis.BD;
const a = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
const n = Number(a.n || 12), cols = Number(a.cols || 4), cell = Number(a.cell || 500);
const rows = Math.ceil(n / cols);
const overrides = {};
if (a.arch) overrides.archetype = a.arch;
if (a.set) for (const kv of a.set.split(',')) { const [k, v] = kv.split('='); overrides[k] = isNaN(Number(v)) ? (v === 'true' ? true : v === 'false' ? false : v) : Number(v); }
const style = a.style || 'plate';
const bg = BD.draw.STYLES[style].bg;
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}"><rect width="100%" height="100%" fill="${bg}"/>`;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const seed = (a.prefix || 's') + i;
  const t = Date.now();
  const res = BD.generate({ seed, overrides, style, mode: a.mode, humanoid: !!a.human, weirdness: a.weird !== undefined ? Number(a.weird) : undefined });
  const svg = res.svg({ background: null });
  const ms = Date.now() - t;
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
  out += `<g transform="translate(${x},${y}) scale(${cell / 1000})">${inner}<text x="20" y="40" font-size="22" fill="#b33" font-family="Menlo">${seed} · ${res.params.archetype} · ${res.rig.bones.length}b · ${ms}ms</text></g>`;
}
out += '</svg>';
process.stdout.write(out);
process.stderr.write(`total ${Date.now() - t0}ms\n`);
