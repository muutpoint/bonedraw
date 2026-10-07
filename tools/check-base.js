#!/usr/bin/env node
/* Anatomical mode must not change when the Humanoid toggle is off.
   node tools/check-base.js --write   record;   node tools/check-base.js   compare */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
for (const f of ['rng', 'geom', 'species', 'names', 'rig', 'parts', 'draw', 'creature', 'bonedraw']) require(path.join(__dirname, '..', 'src', f + '.js'));
const BD = globalThis.BD;
const file = path.join(__dirname, 'base-fingerprints.json');
const now = {};
for (let i = 0; i < 60; i++) {
  const w = (i % 6) / 5;
  const res = BD.generate({ seed: 'b' + i, weirdness: w });
  const svg = res.svg({ background: null });
  now['b' + i + '@' + w] = crypto.createHash('sha1').update(svg + res.name).digest('hex').slice(0, 16);
}
if (process.argv.includes('--write')) { fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n'); console.log('wrote', Object.keys(now).length); process.exit(0); }
const was = JSON.parse(fs.readFileSync(file, 'utf8'));
const changed = Object.keys(was).filter((k) => was[k] !== now[k]);
console.log(changed.length ? 'CHANGED: ' + changed.join(', ') : 'anatomical mode unchanged (60 seeds)');
process.exit(changed.length ? 1 : 0);
