#!/usr/bin/env node
/* bonedraw from the command line
   node cli.js --seed "Ro" > skeleton.svg
   node cli.js --seed "Ro" --style specimen --size 3000 > skeleton.svg
   node cli.js --seed "Ro" --format rig > skeleton_rig.json
   node cli.js --set archetype=ray,disc=1.6 --weird 0.4 > ray.svg
   node cli.js --mode wild --seed m5 --weird 0.95 > wild.svg
   node cli.js --human 1 --seed h2 --set archetype=humanoid > human.svg */
'use strict';
const path = require('path');
for (const f of ['rng', 'geom', 'species', 'names', 'rig', 'parts', 'draw', 'creature', 'bonedraw']) require(path.join(__dirname, 'src', f + '.js'));
const BD = globalThis.BD;
const a = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
const overrides = {};
if (a.set) for (const kv of a.set.split(',')) { const [k, v] = kv.split('='); overrides[k] = isNaN(Number(v)) ? (v === 'true' ? true : v === 'false' ? false : v) : Number(v); }
const res = BD.generate({ mode: a.mode, humanoid: !!a.human, seed: a.seed || BD.randomSeed(), overrides, weirdness: a.weird !== undefined ? Number(a.weird) : undefined, style: a.style || 'plate', label: a.label || 'name' });
if (a.format === 'rig' || a.format === 'json') {
  process.stdout.write(JSON.stringify({ name: res.name, seed: res.seed, params: res.params, units: 'trunk length = ' + BD.creature.T, axes: 'x right, y towards the tail; angles in radians, limits in degrees', restCurve: res.rig.restCurve(), rig: res.rig.toJSON() }));
} else {
  const n = Number(a.size || 1000);
  process.stdout.write(res.svg({ W: n, H: n }));
}
process.stderr.write(res.name + ' (' + res.seed + ', ' + res.params.archetype + ', ' + res.rig.bones.length + ' bones)\n');
