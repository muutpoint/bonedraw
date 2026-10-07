#!/usr/bin/env node
/* Wild mode is a frozen look: these seeds must keep drawing exactly what they drew when it was made.
   node tools/check-wild.js           compare against tools/wild-fingerprints.json
   node tools/check-wild.js --write   record new fingerprints (only on purpose) */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
for (const f of ['rng', 'geom', 'species', 'names', 'rig', 'parts', 'draw', 'creature', 'bonedraw']) require(path.join(__dirname, '..', 'src', f + '.js'));
const BD = globalThis.BD;
const file = path.join(__dirname, 'wild-fingerprints.json');
const cases = [];
for (let i = 0; i < 16; i++) cases.push(['w' + i, 0.55], ['m' + i, 0.95]);
const now = {};
for (const [seed, w] of cases) {
  const svg = BD.generate({ mode: 'wild', seed, weirdness: w }).svg({ background: null });
  now[seed + '@' + w] = crypto.createHash('sha1').update(svg).digest('hex').slice(0, 16);
}
if (process.argv.includes('--write')) { fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n'); console.log('wrote', Object.keys(now).length, 'fingerprints'); process.exit(0); }
const was = JSON.parse(fs.readFileSync(file, 'utf8'));
const changed = Object.keys(was).filter((k) => was[k] !== now[k]);
console.log(changed.length ? 'CHANGED: ' + changed.join(', ') : 'wild mode unchanged (' + cases.length + ' seeds)');
process.exit(changed.length ? 1 : 0);
