# Guide

Every control in the app, top to bottom. Hover any label for a hint.

## The header

- **Anatomical / Wild**: the two generators. Anatomical keeps shells, discs and bodies in
  one piece. **Wild** is the frozen first build, where a curved body can tear a disc or a
  turtle shell into drifting shards, armour plates swell to the size of the bones they sit
  on, and fin rays fork only once. The same seed gives the same monster every time.
- **Humanoid**: lets the smiler humanoid into the pool (see below). Off by default.

The app always opens in **Anatomical**, **Humanoid off**, **weirdness 0.5**, the
**Specimen** style and **Still**, whatever you did last time. Your look sliders, motion mix
and export settings are remembered.

## Seed and creatures

- Type any word as a **seed**: the same seed always gives the same skeleton and name.
- **New** (or space, or →) picks a random seed. **‹** (or ←) goes back.
- **Grid** shows twelve at once; click one to open it, **More** for another twelve.
- **Weirdness** (0 to 1): low is a plausible animal; the middle hybridises, borrowing
  whole trait groups from other body plans; high pushes proportions to extremes and bolts
  on extra limbs, horns, frills, tentacles and odd tails.
- **Label** under the creature: its Latin name, its seed, or nothing.
- **Show rig** (or `r`): draws the bones over the skeleton, with each joint's allowed swing
  as a wedge. Spine is red, ribs blue, girdles purple, limbs green, fin rays orange.

## Parameters

About 75 sliders and menus in groups: Body, Spine, Skull, Horns & frill, Ribs, Limbs,
Disc & fins, Tail, Armour and Drawing. Change any of them and it **stays locked** when you
press New (shown with a blinking square). Click a label to unlock it, or **reset all**.
Locking *Body plan* to *Ray / skate* and pressing New browses stingrays.

## Humanoid mode

A standing skeleton seen from the front, with the **smiler** as its skull: a rounded skull,
round eye sockets, and a mouth of two crossing jaw arcs with teeth. It has a breastbone and
sloping ribs, shoulder blades, collarbones, a pelvis, kneecaps, arms and legs, and it walks
with its knees lifting towards you.

With the toggle on, humanoids turn up among the random creatures (about one in five), and
at higher weirdness the smiler spreads: its skull, arms and legs can be grafted onto
any other body plan. With it off, nothing about the other creatures changes: every seed
draws exactly as before.

## Style

| Style | What it is |
|---|---|
| **Line art** | Black ink on cream, like an engraved plate. |
| **Specimen** | White bones on black. |
| **X-ray** | Bone as density with a faint flesh haze. *Film*: negative (bright bone) or positive (dark bone on paper). *Tint*: cool, neutral, sepia or green. |
| **Cleared & stained** | A clear amber body, bone stained alizarin red, cartilage alcian blue. *Ossified* sets how much has turned to bone (low gives the blue-tipped look of an embryo). Dark or light background. |

X-ray and cleared & stained share **Flesh**, **Plumpness** (how far flesh swells from the
bones), **Glow**, **Grain** and **Vignette**; X-ray adds **Exposure** and cleared adds
**Edge light**. **reset look** restores a look's defaults. These two looks are pixels,
so they export as PNG, video or GIF but not SVG.

## Motion

- **Movement** presets: *Auto* (picks one that suits the body), Swim, Slither, Walk / row,
  Flap, Fin ripple (stingray), Wing-beat (manta), Breathe (idle), Writhe, Everything, Still.
- **Intensity** and **Speed**.
- Six **layers** that mix freely: *Body wave*, *Fins & rays*, *Legs*, *Wings*, *Breathe*
  (the bones that otherwise stay put: ribs, girdles, the neck) and *Writhe*. Moving a
  layer slider turns the preset into a **Custom mix**, which is remembered.
- **Body waves** (how many waves fit along the body), **Fin waves** (ripples across a disc;
  0 beats it all at once like a manta), **Wave shape** (only the tail swings, to the whole
  body waves) and **Joint range** (scales every joint's limits; above 1 lets joints bend
  further than they should).
- **pause / play** or `p`.

## Export

| Format | Notes |
|---|---|
| **PNG** | The current frame at 1000 to 8000 px. |
| **SVG** | The current frame as vectors (line art and specimen only). |
| **MP4 video** | A loop, 720 to 2160 px square, 24, 30 or 60 fps, 1 to 8 loops, standard, high or maximum quality. |
| **GIF** | A loop, 360 to 800 px, 12.5, 20 or 25 fps. |
| **Rig (JSON)** | Every bone, joint limit and the drawing in each bone's frame. See [rig-format.md](rig-format.md). |

Videos and GIFs are rendered **frame by frame**: each frame is drawn at exactly its moment
in the loop and then encoded, so a 4K video is as smooth as a 720p one and one loop repeats
seamlessly. Pick a movement first (a creature standing still makes a one-frame loop). Click
the button again while it renders to cancel. GIFs get much bigger with film **Grain**, so turn
it down for small files. In the desktop app, the **Download** button opens a save dialog.

## Presets

A preset holds the mode, Humanoid, style, both looks' settings, weirdness, the movement and
every locked parameter. Tick **Keep seed** to save the exact creature too.

- **Save as…** names and stores it in this app.
- **Delete** removes a saved one.
- **Export** downloads the selected preset (or the current settings) as a
  `.bonedraw.json` file; **Import** loads one or more of them. A file can hold one preset or
  a list. Imported files are checked: unknown settings are dropped and values are clamped.
- Seven are built in: a cleared stingray, a radiograph lizard, the walking smiler, the
  smiler infection, wild monsters, a green ghost and an engraved plate.

## Shortcuts

| Key | Does |
|---|---|
| space, → | New creature |
| ← | Previous creature |
| `r` | Show / hide the rig |
| `p` | Play / pause |
| F11 | Full screen (desktop app) |

## Links

`#<seed>` opens that creature; `#wild/<seed>`, `#human/<seed>` and `#wild/human/<seed>`
open it in Wild and/or with Humanoid on.
