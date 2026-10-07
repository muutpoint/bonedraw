# Development

## Run it

```
python3 tools/serve.py          # the web page on http://localhost:8766  (PORT=... to change)
npm install                     # once, for the desktop app and its build tools
npm start                       # the desktop app
```

The page is plain JavaScript with no build step: `src/` loads directly in the browser and
in Node.

## Layout

```
index.html, style.css   the page
main.js                 the desktop app shell (Electron)
assets/                 logo, smiler, gear knob, Space Grotesk
vendor/                 mp4-muxer and gifenc, copied from node_modules (npm run vendor)
build/icon.png          the app icon
src/rng.js              seeded random numbers and noise
src/geom.js             curves, polygons, fields
src/species.js          parameter validation and the weirdness mutator
src/rig.js              bones, joints, posing, local-frame drawing, JSON export
src/parts.js            bone shapes: long bones, vertebrae, claws, plates, fin rays
src/creature.js         body plans, parameters, the skeleton builder, names
src/motion.js           motion presets and layers, the pose at time t, loop framing
src/post.js             X-ray and cleared & stained: flesh and bone layers, the GLSL shader
src/draw.js             canvas and SVG rendering, styles, rig overlay
src/names.js            Latin binomials
src/bonedraw.js         generate(): seed -> rig + drawing
src/app.js              the interface
src/fx.js               interface effects: knobs, pings, scramble, scan sweep
src/export.js           frame-exact MP4 and GIF export
cli.js                  command line
tools/                  dev server, contact sheets, filmstrips, regression checks
scripts/                packaging helpers
docs/                   this documentation
```

## Command line

```
node cli.js --seed "Ro" > skeleton.svg
node cli.js --seed "Ro" --style specimen --size 3000 > skeleton.svg    # plate | specimen
node cli.js --seed "Ro" --format rig > skeleton_rig.json
node cli.js --set archetype=ray,disc=1.6,rays=150 --weird 0.4 > ray.svg
node cli.js --mode wild --seed m5 --weird 0.95 > wild.svg
node cli.js --human 1 --seed h2 --set archetype=humanoid > human.svg
```

The X-ray and cleared & stained looks need a browser (WebGL2), so the command line draws
line art and specimen only.

```
node tools/sheet.js --n 12 --cols 4 --arch ray --style specimen > sheet.svg   # contact sheet
node tools/sheet.js --human 1 --arch humanoid --n 8 > humans.svg
node tools/frames.js --seed stingray --preset auto --frames 8 > strip.svg     # one motion loop
```

`--arch` takes a body plan: `ray fish serpent lizard turtle bat mammal frog plesio humanoid`.

## Checks

```
npm test                   # runs both checks below
node tools/check-wild.js   # 32 Wild seeds must draw exactly as they did
node tools/check-base.js   # 60 Anatomical seeds must be unchanged with Humanoid off
```

Each compares SHA-1 fingerprints of the drawings with `tools/*-fingerprints.json`. If you
change the generator on purpose, rerun with `--write` to record the new ones.

## Packaging the desktop app

The desktop app is [Electron](https://www.electronjs.org/) around the unchanged page,
packaged by [electron-builder](https://www.electron.build/). Settings are in the `build`
section of `package.json`.

```
npm run dist:mac      # dist/bonedraw-<version>-mac-arm64.dmg and -mac-x64.dmg  (needs a Mac)
npm run dist:win      # dist/bonedraw-<version>-win-x64.exe                     (needs Windows)
```

The Windows installer is built on a Windows machine by the **Build** workflow
(`.github/workflows/build.yml`), which can be run from the repository's Actions tab or
by pushing a tag like `v1.0.0`, and attaches both installers to a release.

**Signing.** There's no paid Apple or Windows certificate, so the apps are unsigned.
`scripts/adhoc-sign.js` gives the Mac app a consistent ad-hoc signature (Apple Silicon
needs one to start at all), but macOS and Windows still ask for confirmation the first time
it opens. To remove that, sign and notarise with an Apple Developer ID and a Windows code
signing certificate: set `mac.identity` and add `CSC_LINK`/`CSC_KEY_PASSWORD` secrets.

**Third-party files.** `npm run vendor` copies the font and the two encoders from
`node_modules` into `assets/fonts` and `vendor`. The copies are committed, so the page runs
from a plain web server without `npm install`. Their licences are in
[../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

**Telegraf.** The page uses the Telegraf typeface if it is installed on the machine and
Space Grotesk otherwise. The font file is deliberately not in the repository or the
installers: Telegraf is a Pangram Pangram typeface and bundling it needs their app licence.
