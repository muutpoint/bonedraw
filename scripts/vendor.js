#!/usr/bin/env node
/* Copy the third-party files bonedraw ships (fonts, video and GIF encoders) out of node_modules.
   The copies are committed, so the page also runs from a plain web server with no npm install. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), nm = (p) => path.join(root, 'node_modules', p);
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true }); fs.copyFileSync(from, path.join(root, to)); console.log('  ', to); };

for (const w of [400, 500, 600, 700]) copy(nm(`@fontsource/space-grotesk/files/space-grotesk-latin-${w}-normal.woff2`), `assets/fonts/space-grotesk-${w}.woff2`);
copy(nm('@fontsource/space-grotesk/LICENSE'), 'assets/fonts/OFL-Space-Grotesk.txt');
copy(nm('mp4-muxer/build/mp4-muxer.mjs'), 'vendor/mp4-muxer.mjs');
copy(nm('mp4-muxer/LICENSE'), 'vendor/LICENSE-mp4-muxer.txt');
copy(nm('gifenc/dist/gifenc.esm.js'), 'vendor/gifenc.esm.js');
copy(nm('gifenc/LICENSE.md'), 'vendor/LICENSE-gifenc.txt');
